//! wallet_overview: one call that tells a person (or the agent helping them) where they stand and what to do.
//! Net worth across protocols, liquidity pools and the wallet itself (counted once), warnings that need attention
//! (Aave health factor, pools out of range), and money that could earn more (idle stablecoins, vaults well below
//! the best rate on their chain), each with the exact build tool and arguments to act on it.

use crate::tools::{bad, opt_str, Ctx, ToolError};
use serde_json::{json, Map, Value};
use std::collections::HashSet;
use std::time::Duration;

const STABLES: &[&str] = &["USDC", "USDT", "USDG", "DAI", "USDS", "USDE", "PYUSD", "USDC.E", "USDBC", "FDUSD", "RLUSD", "USDT0"];
const HF_WARN: f64 = 1.5;
const HF_DANGER: f64 = 1.15;

fn is_stable(s: &str) -> bool {
    STABLES.contains(&s.to_uppercase().as_str())
}
fn f(v: &Value) -> f64 {
    v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse().ok())).unwrap_or(0.0)
}
fn r2(x: f64) -> Value {
    crate::pools::num((x * 100.0).round() / 100.0)
}
fn money(x: f64) -> String {
    if x.abs() >= 1000.0 {
        let s = format!("{:.0}", x.abs());
        let mut out = String::new();
        for (i, c) in s.chars().enumerate() {
            if i > 0 && (s.len() - i) % 3 == 0 {
                out.push(',');
            }
            out.push(c);
        }
        format!("{}${out}", if x < 0.0 { "-" } else { "" })
    } else {
        format!("{}${:.2}", if x < 0.0 { "-" } else { "" }, x.abs())
    }
}

/// A tool on the upstream connector (btb.finance) for the parts not in Rust yet; its JSON answer.
async fn upstream(http: &reqwest::Client, tool: &str, args: Value) -> Result<Value, String> {
    let base = std::env::var("UPSTREAM_URL").unwrap_or_else(|_| "https://btb.finance".into());
    let msg = json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": { "name": tool, "arguments": args } });
    let r = http
        .post(format!("{base}/api/mcp"))
        .header("accept", "application/json, text/event-stream")
        .json(&msg)
        .timeout(Duration::from_secs(28))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let text = r.text().await.map_err(|e| e.to_string())?;
    let body = if text.trim_start().starts_with('{') {
        text
    } else {
        text.lines().filter_map(|l| l.strip_prefix("data:")).map(str::trim).filter(|l| !l.is_empty()).last().unwrap_or("").to_string()
    };
    let v: Value = serde_json::from_str(&body).map_err(|e| format!("bad answer: {e}"))?;
    let res = &v["result"];
    let inner = res["content"][0]["text"].as_str().unwrap_or("");
    if res["isError"].as_bool() == Some(true) {
        return Err(inner.chars().take(200).collect());
    }
    serde_json::from_str(inner).map_err(|_| inner.chars().take(200).collect())
}

/// Markets a build tool can deposit into: Morpho vaults (build_vault_deposit) and Aave V3 (build_lend).
fn actionable(m: &Value) -> bool {
    let kind = m["kind"].as_str().unwrap_or("");
    let p = m["protocol"].as_str().unwrap_or("").to_lowercase();
    (kind == "vault" && p.contains("morpho")) || (kind == "lend" && p.starts_with("aave v3"))
}
/// The rate to compare on: the 7-day average when known (one-day rates jump), plus rewards.
fn apy(m: &Value) -> f64 {
    let base = m["apy7dPct"].as_f64().unwrap_or_else(|| f(&m["baseApyPct"]));
    base + f(&m["rewardApyPct"])
}
/// A market can take this amount without becoming most of its own deposits (at most 10% of its TVL).
fn fits(m: &Value, usd: f64) -> bool {
    f(&m["tvlUsd"]) >= usd * 10.0
}
fn market_brief(m: &Value) -> Value {
    json!({ "name": m["name"], "protocol": m["protocol"], "kind": m["kind"], "address": m["address"], "apyPct": r2(apy(m)), "apy7dPct": m["apy7dPct"], "tvlUsd": m["tvlUsd"] })
}

async fn best_for(ctx: &Ctx<'_>, token: &str, chain: i64) -> Vec<Value> {
    let mut a = Map::new();
    a.insert("token".into(), json!(token));
    a.insert("chain".into(), json!(chain.to_string()));
    a.insert("kinds".into(), json!(["vault", "lend"]));
    a.insert("minTvlUsd".into(), json!(1_000_000));
    a.insert("limit".into(), json!(15));
    crate::yields::compare(&a, ctx).await.ok().and_then(|r| r["markets"].as_array().cloned()).unwrap_or_default()
}

pub async fn wallet_overview(a: &Map<String, Value>, ctx: &Ctx<'_>) -> Result<Value, ToolError> {
    let wallet = opt_str(a, "wallet")?.ok_or_else(|| bad("wallet is required"))?;
    if wallet.len() != 42 || !wallet.starts_with("0x") || !wallet[2..].chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(bad("wallet must be a 0x address"));
    }
    let idle_min = a.get("idleMinUsd").map(f).filter(|x| *x > 0.0).unwrap_or(5.0);
    let mut pa = Map::new();
    pa.insert("wallet".into(), json!(wallet));
    let (portfolio, tokens, positions) = futures::join!(
        crate::portfolio::wallet_portfolio(&pa, ctx),
        upstream(ctx.http, "wallet_tokens", json!({ "wallet": wallet, "minUsd": 0.5 })),
        upstream(ctx.http, "wallet_positions", json!({ "address": wallet })),
    );
    let mut sources = Map::new();
    let portfolio = match portfolio {
        Ok(p) => { sources.insert("protocols".into(), json!("ok")); p }
        Err(e) => { sources.insert("protocols".into(), json!(format!("failed: {}", e.0))); json!({}) }
    };
    let tokens = match tokens {
        Ok(t) => { sources.insert("walletTokens".into(), json!("ok")); t }
        Err(e) => { sources.insert("walletTokens".into(), json!(format!("failed: {e}"))); json!({}) }
    };
    let positions = match positions {
        Ok(p) => { sources.insert("liquidityPools".into(), json!("ok")); p }
        Err(e) => { sources.insert("liquidityPools".into(), json!(format!("failed: {e}"))); json!({}) }
    };

    // ---- what is where ----
    let protocols_usd = f(&portfolio["totalUsd"]);
    let debt = f(&portfolio["debtUsd"]);
    let mut counted: HashSet<(i64, String)> = HashSet::new();
    let mut aave = Vec::new();
    let mut vaults = Vec::new();
    for g in portfolio["protocols"].as_array().into_iter().flatten() {
        for p in g["positions"].as_array().into_iter().flatten() {
            if let (Some(c), Some(ad)) = (p["chainId"].as_i64(), p["address"].as_str()) {
                counted.insert((c, ad.to_lowercase()));
            }
            match p["kind"].as_str() {
                Some("lent") => aave.push(p.clone()),
                Some("vault") => vaults.push((g["protocol"].as_str().unwrap_or("").to_string(), p.clone())),
                _ => {}
            }
        }
    }
    let mut wallet_usd = 0.0;
    let mut idle = Vec::new();
    for t in tokens["tokens"].as_array().into_iter().flatten() {
        let usd = f(&t["usd"]);
        let key = (t["chainId"].as_i64().unwrap_or(0), t["address"].as_str().unwrap_or("").to_lowercase());
        if usd <= 0.0 || counted.contains(&key) {
            continue;
        }
        wallet_usd += usd;
        if is_stable(t["symbol"].as_str().unwrap_or("")) && usd >= idle_min {
            idle.push(t.clone());
        }
    }
    let lps: Vec<Value> = positions["positions"].as_array().cloned().unwrap_or_default().into_iter().filter(|p| p["closed"].as_bool() != Some(true)).collect();
    let lp_usd: f64 = lps.iter().map(|p| f(&p["valueUsd"])).sum();
    let fees: f64 = lps.iter().map(|p| f(&p["uncollectedFeesUsd"])).sum();
    let manage = positions["manageLink"].clone();

    // ---- warnings ----
    let mut warnings = Vec::new();
    for p in &aave {
        let hf = p["healthFactor"].as_f64();
        if let Some(h) = hf.filter(|h| *h < HF_WARN) {
            warnings.push(json!({
                "severity": if h < HF_DANGER { "danger" } else { "warning" },
                "type": "aave_health",
                "chain": p["chain"], "chainId": p["chainId"],
                "message": format!("Aave on {}: health factor {:.2}. Below 1 the loan can be liquidated. Repay some of the {} borrowed or add collateral.", p["chain"].as_str().unwrap_or(""), h, money(f(&p["borrowedUsd"]))),
                "borrowedUsd": p["borrowedUsd"], "suppliedUsd": p["suppliedUsd"], "healthFactor": hf,
            }));
        }
    }
    for p in &lps {
        if p["inRange"].as_bool() == Some(false) && f(&p["valueUsd"]) >= 1.0 {
            let auto = p["autoManaged"].as_bool() == Some(true);
            warnings.push(json!({
                "severity": "info",
                "type": "lp_out_of_range",
                "chain": p["chain"], "dex": p["dex"], "pair": p["pair"], "tokenId": p["tokenId"], "valueUsd": p["valueUsd"],
                "message": format!("{} on {} ({}) is out of range: {} earning no fees.{}", p["pair"].as_str().unwrap_or(""), p["dex"].as_str().unwrap_or(""), p["chain"].as_str().unwrap_or(""), money(f(&p["valueUsd"])), if auto { " Auto-management will move it." } else { " Move the range, or turn on auto-management (auto_manage_setup)." }),
                "autoManaged": auto, "manageLink": manage,
            }));
        }
    }

    // ---- opportunities ----
    let mut opportunities = Vec::new();
    for t in &idle {
        let (Some(chain), Some(sym)) = (t["chainId"].as_i64(), t["symbol"].as_str()) else { continue };
        let markets = best_for(ctx, sym, chain).await;
        let usd = f(&t["usd"]);
        let Some(best) = markets.iter().filter(|m| actionable(m) && fits(m, usd)).max_by(|x, y| apy(x).total_cmp(&apy(y))) else { continue };
        let rate = apy(best);
        let token_addr = t["address"].as_str().unwrap_or(sym);
        let (tool, args) = if best["kind"] == "vault" {
            ("build_vault_deposit", json!({ "chain": chain.to_string(), "vault": best["address"], "wallet": wallet, "amount": "max" }))
        } else {
            ("build_lend", json!({ "chain": chain.to_string(), "token": token_addr, "wallet": wallet, "amount": "max" }))
        };
        opportunities.push(json!({
            "type": "idle_stablecoin",
            "chain": t["chain"], "chainId": chain, "token": sym, "amount": t["balance"], "usd": r2(usd),
            "message": format!("{} {} on {} earns nothing. {} ({}) pays {:.2}%: about {} a year.", t["balance"].as_str().unwrap_or(""), sym, t["chain"].as_str().unwrap_or(""), best["name"].as_str().unwrap_or(""), best["protocol"].as_str().unwrap_or(""), rate, money(usd * rate / 100.0)),
            "extraPerYearUsd": r2(usd * rate / 100.0),
            "to": market_brief(best),
            "act": [{ "tool": tool, "arguments": args }],
        }));
    }
    for (protocol, p) in &vaults {
        let (Some(chain), Some(sym), Some(addr)) = (p["chainId"].as_i64(), p["underlying"]["symbol"].as_str(), p["address"].as_str()) else { continue };
        if !is_stable(sym) || f(&p["usd"]) < idle_min {
            continue;
        }
        let markets = best_for(ctx, sym, chain).await;
        let current = markets.iter().find(|m| m["address"].as_str().map(|x| x.eq_ignore_ascii_case(addr)).unwrap_or(false));
        let usd_held = f(&p["usd"]);
        let Some(best) = markets
            .iter()
            .filter(|m| actionable(m) && fits(m, usd_held) && !m["address"].as_str().map(|x| x.eq_ignore_ascii_case(addr)).unwrap_or(false))
            .max_by(|x, y| apy(x).total_cmp(&apy(y)))
        else { continue };
        let now = current.map(apy);
        let gain = apy(best) - now.unwrap_or(0.0);
        if now.is_none() || gain < 0.75 {
            continue;
        }
        let usd = f(&p["usd"]);
        let deposit = if best["kind"] == "vault" {
            json!({ "tool": "build_vault_deposit", "arguments": { "chain": chain.to_string(), "vault": best["address"], "wallet": wallet, "amount": "max" }, "after": "the withdrawal confirms" })
        } else {
            json!({ "tool": "build_lend", "arguments": { "chain": chain.to_string(), "token": sym, "wallet": wallet, "amount": "max" }, "after": "the withdrawal confirms" })
        };
        opportunities.push(json!({
            "type": "better_vault",
            "chain": p["chain"], "chainId": chain, "token": sym, "usd": r2(usd),
            "message": format!("{} in {} {} on {} earns {:.2}%. {} ({}) pays {:.2}% on the same token: about {} more a year.", money(usd), protocol, p["symbol"].as_str().unwrap_or(""), p["chain"].as_str().unwrap_or(""), now.unwrap_or(0.0), best["name"].as_str().unwrap_or(""), best["protocol"].as_str().unwrap_or(""), apy(best), money(usd * gain / 100.0)),
            "extraPerYearUsd": r2(usd * gain / 100.0),
            "from": current.map(market_brief), "to": market_brief(best),
            "act": [{ "tool": "build_vault_withdraw", "arguments": { "chain": chain.to_string(), "vault": addr, "wallet": wallet, "amount": "max" } }, deposit],
        }));
    }
    opportunities.sort_by(|x, y| f(&y["extraPerYearUsd"]).total_cmp(&f(&x["extraPerYearUsd"])));

    let net = protocols_usd - debt + lp_usd + wallet_usd;
    let danger = warnings.iter().filter(|w| w["severity"] == "danger").count();
    let extra: f64 = opportunities.iter().map(|o| f(&o["extraPerYearUsd"])).sum();
    let headline = format!(
        "Net worth {} ({} in protocols, {} in pools, {} in the wallet{}). {}{}",
        money(net), money(protocols_usd - debt), money(lp_usd), money(wallet_usd),
        if debt > 0.0 { format!(", after {} borrowed", money(debt)) } else { String::new() },
        if danger > 0 { format!("{danger} urgent warning{}. ", if danger == 1 { "" } else { "s" }) } else if !warnings.is_empty() { format!("{} thing{} to look at. ", warnings.len(), if warnings.len() == 1 { "" } else { "s" }) } else { "Nothing needs attention. ".into() },
        if extra >= 1.0 { format!("Moving idle or low-earning stablecoins could add about {} a year.", money(extra)) } else { String::new() },
    );
    let top_tokens: Vec<Value> = {
        let mut v: Vec<Value> = tokens["tokens"].as_array().cloned().unwrap_or_default().into_iter()
            .filter(|t| !counted.contains(&(t["chainId"].as_i64().unwrap_or(0), t["address"].as_str().unwrap_or("").to_lowercase())))
            .collect();
        v.sort_by(|x, y| f(&y["usd"]).total_cmp(&f(&x["usd"])));
        v.into_iter().take(15).map(|t| json!({ "chain": t["chain"], "chainId": t["chainId"], "symbol": t["symbol"], "address": t["address"], "amount": t["balance"], "usd": t["usd"] })).collect()
    };
    Ok(json!({
        "wallet": wallet,
        "headline": headline,
        "netWorthUsd": r2(net),
        "breakdown": { "protocolsUsd": r2(protocols_usd), "debtUsd": r2(debt), "liquidityPoolsUsd": r2(lp_usd), "walletUsd": r2(wallet_usd), "uncollectedFeesUsd": r2(fees) },
        "warnings": warnings,
        "opportunities": opportunities,
        "holdings": {
            "protocols": portfolio["protocols"],
            "liquidityPools": lps.iter().map(|p| json!({ "chain": p["chain"], "dex": p["dex"], "pair": p["pair"], "valueUsd": p["valueUsd"], "inRange": p["inRange"], "uncollectedFeesUsd": p["uncollectedFeesUsd"], "autoManaged": p["autoManaged"], "heldBy": p["heldBy"] })).collect::<Vec<_>>(),
            "walletTokens": top_tokens,
        },
        "sources": sources,
        "howToAct": "Each opportunity's act list is the build calls to make, in order; each returns a signLink for the person. Nothing here signs or sends. Not financial advice.",
    }))
}

pub fn definitions(read: &Value) -> Vec<Value> {
    vec![json!({
        "name": "wallet_overview",
        "title": "Where a wallet stands, and what to do",
        "description": "Start here when someone asks about their portfolio. One call: net worth across BTB's protocols (about 36 chains), liquidity pools and the wallet's own tokens, each counted once; warnings that need attention (Aave health factor low, pools out of range); and opportunities (idle stablecoins earning nothing, vaults well below the best rate on their chain), each with the yearly gain (on 7-day average rates, only into markets big enough to take the amount) and the exact build tool calls to act. Includes a one-line headline to show the person. Public on-chain data, read-only. Takes about 5 to 25 seconds.",
        "inputSchema": { "type": "object", "properties": {
            "wallet": { "type": "string", "pattern": "^0x[0-9a-fA-F]{40}$" },
            "idleMinUsd": { "type": "number", "minimum": 0, "description": "Smallest idle stablecoin balance worth suggesting a move for. Default 5." }
        }, "required": ["wallet"] },
        "annotations": read,
    })]
}
