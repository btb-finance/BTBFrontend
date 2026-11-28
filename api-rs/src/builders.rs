//! Transactions built for a wallet to sign: swaps (KyberSwap), Aave V3 lend and withdraw, Morpho vault deposit and
//! withdraw, and cross-chain swaps (LI.FI). Ports of src/lib/mcp/build.ts, aave.ts, vaults.ts and bridge.ts: same
//! steps, labels, dry runs and sign links. Nothing here signs or sends.

use crate::lite::{format_units, token_chain_id};
use crate::pools::{js_round, num};
use crate::signlink::with_sign_link;
use crate::swap::{self, kyber_fetch, kyber_slug, to_base_units, Catalog};
use crate::tools::{bad, opt_str, Ctx, ToolError};
use serde_json::{json, Map, Value};
use std::time::Duration;

// ---- encoding and chain reads ----

fn pad_addr(a: &str) -> String {
    format!("{:0>64}", a.trim_start_matches("0x").to_lowercase())
}
fn pad_u(x: u128) -> String {
    format!("{x:064x}")
}
fn is_addr(s: &str) -> bool {
    s.len() == 42 && s.starts_with("0x") && s[2..].chars().all(|c| c.is_ascii_hexdigit())
}
fn hex_u128(h: &str) -> u128 {
    let t = h.trim_start_matches("0x").trim_start_matches('0');
    if t.len() > 32 { u128::MAX } else { u128::from_str_radix(if t.is_empty() { "0" } else { t }, 16).unwrap_or(0) }
}
fn units(raw: u128, dec: u32) -> String {
    format_units(&raw.to_string(), dec as usize)
}
fn parse_units(amount: &str, dec: u32) -> Result<u128, ToolError> {
    to_base_units(amount, dec).parse::<u128>().map_err(|_| ToolError("amount is too large".into()))
}
fn is_decimal(s: &str) -> bool {
    let (i, f) = s.split_once('.').unwrap_or((s, "0"));
    !i.is_empty() && !f.is_empty() && i.chars().chain(f.chars()).all(|c| c.is_ascii_digit())
}

async fn read_u(http: &reqwest::Client, chain: i64, to: &str, data: String) -> Result<u128, ToolError> {
    swap::eth_call(http, chain, to, &data, None).await.map(|h| hex_u128(&h)).map_err(ToolError)
}
async fn read_addr(http: &reqwest::Client, chain: i64, to: &str, data: &str) -> Result<String, ToolError> {
    let h = swap::eth_call(http, chain, to, data, None).await.map_err(ToolError)?;
    let h = h.trim_start_matches("0x");
    if h.len() < 64 {
        return Err(ToolError("unexpected answer from the contract".into()));
    }
    Ok(format!("0x{}", &h[24..64]))
}
async fn balance_of(http: &reqwest::Client, chain: i64, token: &str, owner: &str) -> Result<u128, ToolError> {
    read_u(http, chain, token, format!("0x70a08231{}", pad_addr(owner))).await
}
async fn allowance(http: &reqwest::Client, chain: i64, token: &str, owner: &str, spender: &str) -> Result<u128, ToolError> {
    read_u(http, chain, token, format!("0xdd62ed3e{}{}", pad_addr(owner), pad_addr(spender))).await
}
async fn decimals(http: &reqwest::Client, chain: i64, token: &str) -> Result<u32, ToolError> {
    read_u(http, chain, token, "0x313ce567".into()).await.map(|d| d as u32)
}
async fn symbol(http: &reqwest::Client, chain: i64, token: &str) -> String {
    swap::eth_call(http, chain, token, "0x95d89b41", None).await.ok().and_then(|h| swap::decode_string(&h)).unwrap_or_else(|| "?".into())
}
async fn native_balance(http: &reqwest::Client, chain: i64, owner: &str) -> u128 {
    let Some(url) = swap::rpc_url(chain) else { return 0 };
    let r: Option<Value> = async {
        http.post(url).json(&json!({ "jsonrpc": "2.0", "id": 1, "method": "eth_getBalance", "params": [owner, "latest"] })).timeout(Duration::from_secs(12)).send().await.ok()?.json().await.ok()
    }
    .await;
    r.and_then(|v| v["result"].as_str().map(hex_u128)).unwrap_or(0)
}
fn approve_data(spender: &str, amount: u128) -> String {
    format!("0x095ea7b3{}{}", pad_addr(spender), pad_u(amount))
}

/// A dry run of the final step from the wallet (build.ts simulate), worded like viem's messages.
async fn simulate(http: &reqwest::Client, chain: i64, from: &str, to: &str, data: &str, value: u128, blocked_by: Option<&str>) -> Value {
    if let Some(b) = blocked_by {
        return json!({ "status": "skipped", "reason": b });
    }
    let Some(url) = swap::rpc_url(chain) else { return json!({ "status": "reverted", "reason": "no RPC for this chain" }) };
    let mut call = json!({ "from": from, "to": to, "data": data });
    if value > 0 {
        call["value"] = json!(format!("0x{value:x}"));
    }
    let r: Result<Value, String> = async {
        http.post(url)
            .json(&json!({ "jsonrpc": "2.0", "id": 1, "method": "eth_call", "params": [call, "latest"] }))
            .timeout(Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())
    }
    .await;
    let reason = match r {
        Ok(v) if v.get("error").is_none() => return json!({ "status": "passed" }),
        Ok(v) => {
            let e = &v["error"];
            let msg = e["message"].as_str().unwrap_or("");
            let data = e["data"].as_str().unwrap_or("");
            if let Some(text) = data.strip_prefix("0x08c379a0").and_then(|d| swap::decode_string(&format!("0x{d}"))) {
                format!("Execution reverted with reason: {text}.")
            } else if msg.contains("insufficient funds") {
                "The total cost (gas * gas fee + value) of executing this transaction exceeds the balance of the account.".to_string()
            } else if let Some(text) = msg.strip_prefix("execution reverted: ") {
                format!("Execution reverted with reason: {text}.")
            } else {
                "Execution reverted for an unknown reason.".to_string()
            }
        }
        Err(e) => e,
    };
    json!({ "status": "reverted", "reason": reason.chars().take(300).collect::<String>() })
}

struct Call {
    to: String,
    data: String,
    value: u128,
    gas: Option<String>,
    label: String,
}

fn tx_out(calls: &[Call], chain: i64, from: &str) -> Value {
    Value::Array(
        calls
            .iter()
            .enumerate()
            .map(|(i, c)| {
                let mut m = Map::new();
                m.insert("step".into(), json!(i + 1));
                m.insert("label".into(), json!(c.label));
                m.insert("chainId".into(), json!(chain));
                m.insert("from".into(), json!(from));
                m.insert("to".into(), json!(c.to));
                m.insert("data".into(), json!(c.data));
                m.insert("value".into(), json!(format!("0x{:x}", c.value)));
                if let Some(g) = &c.gas {
                    m.insert("gas".into(), json!(g));
                }
                Value::Object(m)
            })
            .collect(),
    )
}

fn round2(x: f64) -> Value {
    num(js_round(x * 100.0) / 100.0)
}
fn wallet_arg(a: &Map<String, Value>) -> Result<String, ToolError> {
    let w = opt_str(a, "wallet")?.ok_or_else(|| bad("wallet is required"))?;
    if !is_addr(&w) {
        return Err(bad("wallet must be a 0x address"));
    }
    Ok(w)
}
fn last_sim(n: usize, sim: &Value) -> Vec<Option<Value>> {
    (0..n).map(|i| (i + 1 == n).then(|| sim.clone())).collect()
}

// ---- build_swap ----

pub async fn build_swap(a: &Map<String, Value>, ctx: &Ctx<'_>) -> Result<Value, ToolError> {
    let http = ctx.http;
    let chain_in = opt_str(a, "chain")?.ok_or_else(|| bad("chain is required"))?;
    let token_in = opt_str(a, "tokenIn")?.ok_or_else(|| bad("tokenIn is required"))?;
    let token_out = opt_str(a, "tokenOut")?.ok_or_else(|| bad("tokenOut is required"))?;
    let mut amount = opt_str(a, "amount")?.ok_or_else(|| bad("amount is required"))?;
    let wallet = wallet_arg(a)?;
    let recipient = opt_str(a, "recipient")?.unwrap_or_else(|| wallet.clone());
    let slippage = a.get("slippageBps").and_then(|v| v.as_f64()).unwrap_or(50.0).clamp(1.0, 3000.0) as u32;
    let native = |t: &str| matches!(t.to_lowercase().as_str(), "eth" | "bnb" | "native" | "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
    let chain = token_chain_id(&chain_in).filter(|c| kyber_slug(*c).is_some()).ok_or_else(|| {
        ToolError(format!("Swaps are not available on \"{chain_in}\". Chains: ethereum, bsc, polygon, arbitrum, optimism, base, avalanche, linea, berachain, ronin, unichain, hyperevm, plasma, etherlink, monad, megaeth, robinhood, arc."))
    })?;
    let (in_native, out_native) = (native(&token_in), native(&token_out));
    if !in_native && !is_addr(&token_in) {
        return Err(ToolError("tokenIn must be a token address or \"ETH\" for the native coin.".into()));
    }
    if !out_native && !is_addr(&token_out) {
        return Err(ToolError("tokenOut must be a token address or \"ETH\" for the native coin.".into()));
    }
    if amount == "max" {
        if in_native {
            return Err(ToolError("\"max\" is for tokens: the native coin also pays gas, so give an amount.".into()));
        }
        let bal = balance_of(http, chain, &token_in, &wallet).await?;
        if bal == 0 {
            return Err(ToolError("The wallet holds none of tokenIn on this chain. Check wallet_tokens for where it is.".into()));
        }
        amount = units(bal, decimals(http, chain, &token_in).await?);
    } else if !is_decimal(&amount) {
        return Err(bad("amount must be a number of whole units or \"max\""));
    }
    let dec_in = if in_native { 18 } else { decimals(http, chain, &token_in).await? };
    let dec_out = if out_native { 18 } else { decimals(http, chain, &token_out).await? };
    let raw = parse_units(&amount, dec_in)?;
    if raw == 0 {
        return Err(ToolError("amount must be above zero.".into()));
    }
    let tin = if in_native { "ETH" } else { token_in.as_str() };
    let tout = if out_native { "ETH" } else { token_out.as_str() };
    let q = swap::kyber_quote(http, chain, tin, tout, &raw.to_string(), dec_out, dec_in, Some(swap::BTB_SWAP_FEE_BPS)).await.map_err(ToolError)?;
    let slug = kyber_slug(chain).unwrap_or("");
    let built = kyber_fetch(http, &format!("{slug}/api/v1/route/build"), "", Some(&json!({ "routeSummary": q.route_summary, "sender": wallet, "recipient": recipient, "slippageTolerance": slippage }))).await.map_err(|e| ToolError(format!("KyberSwap build {e}")))?;
    if built["code"].as_i64() != Some(0) {
        return Err(ToolError(built["message"].as_str().unwrap_or("Build error").to_string()));
    }
    let d = &built["data"];
    let router = d["routerAddress"].as_str().map(String::from).unwrap_or_else(|| q.router.clone());
    let value: u128 = d["transactionValue"].as_str().or(d["value"].as_str()).and_then(|v| v.parse().ok()).unwrap_or(0);
    let mut calls = Vec::new();
    let mut balance_ok;
    let mut blocked: Option<&str> = None;
    let mut symbol_in = "ETH".to_string();
    if in_native {
        balance_ok = native_balance(http, chain, &wallet).await >= raw;
    } else {
        let (sym, bal, allow) = futures::join!(symbol(http, chain, &token_in), balance_of(http, chain, &token_in, &wallet), allowance(http, chain, &token_in, &wallet, &router));
        symbol_in = sym;
        balance_ok = bal? >= raw;
        if allow? < raw {
            calls.push(Call { to: token_in.clone(), data: approve_data(&router, raw), value: 0, gas: None, label: format!("Approve exactly {amount} {symbol_in} for the KyberSwap router") });
            blocked = Some("The approval in step 1 must be confirmed first; the swap is checked again when it is sent.");
        }
    }
    let swap_data = d["data"].as_str().unwrap_or("0x").to_string();
    calls.push(Call { to: router.clone(), data: swap_data.clone(), value, gas: d["gas"].as_str().map(String::from).or_else(|| d["gas"].as_u64().map(|g| g.to_string())), label: format!("Swap {amount} {symbol_in} on KyberSwap ({})", q.route) });
    let sim = if balance_ok { simulate(http, chain, &wallet, &router, &swap_data, value, blocked).await } else { json!({ "status": "skipped", "reason": "The wallet does not hold enough of tokenIn." }) };
    if !balance_ok {
        balance_ok = false;
    }
    let (symbol_out, grade) = futures::join!(
        async { if out_native { "ETH".to_string() } else { let s = symbol(http, chain, &token_out).await; if s == "?" { "?".into() } else { s } } },
        async { if out_native { None } else { crate::tools::token_grade(ctx, Some(chain), &token_out).await } }
    );
    let fee = swap::BTB_SWAP_FEE_BPS as f64 / 100.0;
    let warnings = if q.amount_out_usd > 0.0 && q.gas_usd / q.amount_out_usd > 0.05 {
        json!([format!("Gas (about ${}) is {}% of what this swap returns (about ${}). A bigger amount, or a cheaper chain, wastes less.", crate::pools::num_text(js_round(q.gas_usd * 100.0) / 100.0), js_round(q.gas_usd / q.amount_out_usd * 100.0), crate::pools::num_text(js_round(q.amount_out_usd * 100.0) / 100.0))])
    } else {
        json!([])
    };
    let n = calls.len();
    let r = json!({
        "chainId": chain, "wallet": wallet, "recipient": recipient,
        "quote": {
            "amountIn": amount, "symbolIn": symbol_in, "amountOut": q.amount_out_formatted, "symbolOut": symbol_out, "amountOutRaw": q.amount_out,
            "amountOutUsd": round2(q.amount_out_usd), "priceImpactPct": round2(q.price_impact), "gasUsd": round2(q.gas_usd), "route": q.route, "slippageBps": slippage,
            "btbFeePct": num(fee), "btbFeeNote": format!("{}% of the output goes to BTB and is shared with BTB users every Friday. Already deducted from amountOut.", crate::pools::num_text(fee)),
        },
        "tokenOutSafety": grade.map(|g| json!({ "score": g.score.map(num), "honeypot": g.honeypot, "flags": g.flags })),
        "warnings": warnings,
        "balanceOk": balance_ok,
        "simulation": sim,
        "transactions": tx_out(&calls, chain, &wallet),
        "expiresInSeconds": 120,
        "notes": [
            "Sign and send the transactions in step order from the wallet; wait for each to confirm.",
            "Quotes move: rebuild if more than about two minutes pass before sending.",
            "Nothing was signed or sent. Not financial advice.",
        ],
    });
    let title = format!("Swap {amount} {} for {}", r["quote"]["symbolIn"].as_str().unwrap_or(""), r["quote"]["symbolOut"].as_str().unwrap_or(""));
    let sims = last_sim(n, &r["simulation"]);
    let swap_params = json!({ "chainId": chain, "tokenIn": token_in, "tokenOut": token_out, "amount": amount, "slippageBps": slippage });
    Ok(with_sign_link(r, &title, &wallet, &sims, Some(swap_params)))
}

// ---- Aave V3 ----

const SECONDS_PER_YEAR: f64 = 31_536_000.0;
fn apy_pct(ray: f64) -> f64 {
    js_round(((1.0 + ray / 1e27 / SECONDS_PER_YEAR).powf(SECONDS_PER_YEAR) - 1.0) * 10_000.0) / 100.0
}

/// JavaScript's Number.prototype.toPrecision(3).
fn to_precision3(x: f64) -> String {
    if x == 0.0 {
        return "0.00".into();
    }
    let e = x.abs().log10().floor() as i32;
    if e < -6 || e >= 3 {
        let s = format!("{x:.2e}");
        let (m, ex) = s.split_once('e').unwrap_or((&s, "0"));
        let exn: i32 = ex.parse().unwrap_or(0);
        return format!("{m}e{}{}", if exn >= 0 { "+" } else { "-" }, exn.abs());
    }
    let decimals = (2 - e).max(0) as usize;
    format!("{x:.decimals$}")
}

async fn aave_pool(chain: i64) -> Result<String, ToolError> {
    let mut a = Map::new();
    a.insert("protocol".into(), json!("aave-v3"));
    let p = crate::registry::detail(&a)?;
    p["contracts"]
        .as_array()
        .into_iter()
        .flatten()
        .find(|c| c["chainId"].as_i64() == Some(chain) && c["role"].as_str() == Some("pool"))
        .and_then(|c| c["address"].as_str().map(String::from))
        .ok_or_else(|| ToolError(format!("Aave V3 is not in the BTB registry on chain {chain}. Chains: Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, BNB Chain.")))
}

async fn resolve_token(http: &reqwest::Client, cat: &Catalog, chain: i64, token: &str) -> Result<(String, String, u32), ToolError> {
    if token.eq_ignore_ascii_case("eth") || token.eq_ignore_ascii_case("native") {
        return Err(ToolError("Aave lends the wrapped coin: use WETH (or WBNB, WPOL), swapping ETH to it first with build_swap if needed.".into()));
    }
    let found = swap::find_one(http, cat, token, &chain.to_string()).await?;
    let t = found["tokens"].get(0).cloned().unwrap_or(Value::Null);
    let addr = t["address"].as_str().unwrap_or("");
    if !is_addr(addr) {
        return Err(ToolError(format!("No token \"{token}\" on chain {chain}. Pass its address.")));
    }
    Ok((addr.to_string(), t["symbol"].as_str().unwrap_or(token).to_string(), t["decimals"].as_u64().unwrap_or(18) as u32))
}

struct Reserve {
    a_token: String,
    supply_apy: f64,
    active: bool,
    frozen: bool,
    paused: bool,
}
async fn reserve(http: &reqwest::Client, chain: i64, pool: &str, asset: &str) -> Result<Reserve, ToolError> {
    let h = swap::eth_call(http, chain, pool, &format!("0x35ea6a75{}", pad_addr(asset)), None).await.map_err(ToolError)?;
    let h = h.trim_start_matches("0x");
    let w = |i: usize| &h[i * 64..(i + 1) * 64];
    if h.len() < 64 * 9 {
        return Err(ToolError("unexpected answer from Aave".into()));
    }
    let a_token = format!("0x{}", &w(8)[24..]);
    if a_token.trim_start_matches("0x").chars().all(|c| c == '0') {
        return Err(ToolError("This token is not listed on Aave V3 on this chain. lending_rates shows what is.".into()));
    }
    let cfg = u128::from_str_radix(&w(0)[32..], 16).unwrap_or(0);
    let bit = |n: u32| (cfg >> n) & 1 == 1;
    let rate = u128::from_str_radix(&w(2)[32..], 16).unwrap_or(0) as f64;
    Ok(Reserve { a_token, supply_apy: apy_pct(rate), active: bit(56), frozen: bit(57), paused: bit(60) })
}
async fn account(http: &reqwest::Client, chain: i64, pool: &str, wallet: &str) -> Result<(bool, Option<f64>), ToolError> {
    let h = swap::eth_call(http, chain, pool, &format!("0xbf92857c{}", pad_addr(wallet)), None).await.map_err(ToolError)?;
    let h = h.trim_start_matches("0x");
    if h.len() < 64 * 6 {
        return Err(ToolError("unexpected answer from Aave".into()));
    }
    let debt = hex_u128(&h[64..128]);
    let hf = hex_u128(&h[320..384]);
    Ok((debt > 0, (debt > 0).then(|| js_round(hf as f64 / 1e18 * 100.0) / 100.0)))
}

pub async fn build_lend(a: &Map<String, Value>, ctx: &Ctx<'_>) -> Result<Value, ToolError> {
    if opt_str(a, "protocol")?.map(|p| p.to_lowercase().replace([' ', '_'], "-")).as_deref().is_some_and(|p| p == "aave-v4" || p == "v4") {
        return build_lend_v4(a, ctx).await;
    }
    let http = ctx.http;
    let chain_in = opt_str(a, "chain")?.ok_or_else(|| bad("chain is required"))?;
    let token_in = opt_str(a, "token")?.ok_or_else(|| bad("token is required"))?;
    let amount_in = opt_str(a, "amount")?.ok_or_else(|| bad("amount is required"))?;
    let wallet = wallet_arg(a)?;
    let chain = token_chain_id(&chain_in).ok_or_else(|| ToolError(format!("Unknown chain \"{chain_in}\".")))?;
    let pool = aave_pool(chain).await?;
    let (asset, sym, dec) = resolve_token(http, ctx.tokens, chain, &token_in).await?;
    let (res, bal, allow, acct) = futures::join!(reserve(http, chain, &pool, &asset), balance_of(http, chain, &asset, &wallet), allowance(http, chain, &asset, &wallet, &pool), account(http, chain, &pool, &wallet));
    let (res, bal, allow, (has_debt, hf)) = (res?, bal?, allow?, acct?);
    if !res.active || res.frozen || res.paused {
        return Err(ToolError(format!("Aave is not taking new {sym} deposits on this chain right now ({}).", if res.paused { "paused" } else if res.frozen { "frozen" } else { "inactive" })));
    }
    let amount = if amount_in == "max" { bal } else { parse_units(&amount_in, dec)? };
    if amount == 0 {
        return Err(ToolError(format!("The wallet holds no {sym} on this chain.")));
    }
    let human = units(amount, dec);
    let mut calls = Vec::new();
    if allow < amount {
        calls.push(Call { to: asset.clone(), data: approve_data(&pool, amount), value: 0, gas: None, label: format!("Approve exactly {human} {sym} for Aave") });
    }
    let data = format!("0x617ba037{}{}{}{}", pad_addr(&asset), pad_u(amount), pad_addr(&wallet), pad_u(0));
    calls.push(Call { to: pool.clone(), data: data.clone(), value: 0, gas: None, label: format!("Lend {human} {sym} on Aave") });
    let sim = if bal < amount {
        json!({ "status": "skipped", "reason": format!("The wallet holds {} {sym}, less than {human}.", units(bal, dec)) })
    } else {
        simulate(http, chain, &wallet, &pool, &data, 0, (calls.len() > 1).then_some("Runs once the approval in step 1 is confirmed.")).await
    };
    let yearly = human.parse::<f64>().unwrap_or(0.0) * res.supply_apy / 100.0;
    let n = calls.len();
    let r = json!({
        "chainId": chain, "protocol": "Aave V3", "action": "lend", "pool": pool, "token": { "address": asset, "symbol": sym, "decimals": dec },
        "amount": human, "supplyApyPct": num(res.supply_apy),
        "position": { "healthFactor": hf.map(num), "hasDebt": has_debt, "earnPerYearAtCurrentRate": format!("{} {sym}", to_precision3(yearly)) },
        "simulation": sim, "transactions": tx_out(&calls, chain, &wallet),
        "warnings": if bal < amount { json!([format!("Not enough {sym}: the wallet holds {}.", units(bal, dec))]) } else { json!([]) },
    });
    let title = format!("Lend {human} {sym} on Aave");
    let sims = last_sim(n, &r["simulation"]);
    Ok(with_sign_link(r, &title, &wallet, &sims, None))
}

/// Aave V4 Main Spoke and its Core Hub per chain (registry aave-v4).
fn aave_v4(chain: i64) -> Option<(&'static str, &'static str)> {
    match chain {
        1 => Some(("0x94e7A5dCbE816e498b89aB752661904E2F56c485", "0xCca852Bc40e560adC3b1Cc58CA5b55638ce826c9")),
        43114 => Some(("0x435272CefF93a1E657E8ABfdf0A13e95900A3a56", "0xd07369fAE4A5BB13c9Ce446B052c7867B1AbDf6e")),
        _ => None,
    }
}

/// Lend on Aave V4: approve the Spoke, then Spoke.supply(reserveId, amount, wallet). reserveId comes from the Hub's
/// asset id for the token (Hub.getAssetId, Spoke.getReserveId).
async fn build_lend_v4(a: &Map<String, Value>, ctx: &Ctx<'_>) -> Result<Value, ToolError> {
    let http = ctx.http;
    let chain_in = opt_str(a, "chain")?.ok_or_else(|| bad("chain is required"))?;
    let token_in = opt_str(a, "token")?.ok_or_else(|| bad("token is required"))?;
    let amount_in = opt_str(a, "amount")?.ok_or_else(|| bad("amount is required"))?;
    let wallet = wallet_arg(a)?;
    let chain = token_chain_id(&chain_in).ok_or_else(|| ToolError(format!("Unknown chain \"{chain_in}\".")))?;
    let (spoke, hub) = aave_v4(chain).ok_or_else(|| ToolError("Aave V4 lending is built for ethereum and avalanche (the Core markets).".into()))?;
    let (asset, sym, dec) = resolve_token(http, ctx.tokens, chain, &token_in).await?;
    let asset_id = swap::eth_call(http, chain, hub, &format!("0x{}{}", crate::launchpads::selector("getAssetId(address)"), pad_addr(&asset)), None)
        .await
        .map_err(|_| ToolError(format!("Aave V4 does not list {sym} on this chain's Core market.")))?;
    let reserve_id = read_u(http, chain, spoke, format!("0x{}{}{}", crate::launchpads::selector("getReserveId(address,uint256)"), pad_addr(hub), asset_id.trim_start_matches("0x"))).await
        .map_err(|_| ToolError(format!("Aave V4's main market does not take {sym} on this chain.")))?;
    let (bal, allow) = futures::join!(balance_of(http, chain, &asset, &wallet), allowance(http, chain, &asset, &wallet, spoke));
    let (bal, allow) = (bal?, allow?);
    let amount = if amount_in == "max" { bal } else { parse_units(&amount_in, dec)? };
    if amount == 0 {
        return Err(ToolError(format!("The wallet holds no {sym} on this chain.")));
    }
    let human = units(amount, dec);
    let mut calls = Vec::new();
    if allow < amount {
        calls.push(Call { to: asset.clone(), data: approve_data(spoke, amount), value: 0, gas: None, label: format!("Approve exactly {human} {sym} for Aave V4") });
    }
    let data = format!("0x{}{}{}{}", crate::launchpads::selector("supply(uint256,uint256,address)"), pad_u(reserve_id), pad_u(amount), pad_addr(&wallet));
    calls.push(Call { to: spoke.to_string(), data: data.clone(), value: 0, gas: None, label: format!("Lend {human} {sym} on Aave V4") });
    let sim = if bal < amount {
        json!({ "status": "skipped", "reason": format!("The wallet holds {} {sym}, less than {human}.", units(bal, dec)) })
    } else {
        simulate(http, chain, &wallet, spoke, &data, 0, (calls.len() > 1).then_some("Runs once the approval in step 1 is confirmed.")).await
    };
    // Today's rate for this market, from the same feed as lending_rates.
    let mut q = Map::new();
    q.insert("token".into(), json!(sym));
    q.insert("protocol".into(), json!("aave"));
    let chain_name = if chain == 1 { "Ethereum" } else { "Avalanche" };
    let apy = crate::rates::lending(&q, ctx.rates, http).await.ok().and_then(|v| {
        v["markets"].as_array()?.iter().filter(|m| m["protocol"] == "Aave V4" && m["chain"].as_str().is_some_and(|c| c.eq_ignore_ascii_case(chain_name)))
            .max_by(|x, y| x["tvlUsd"].as_f64().unwrap_or(0.0).total_cmp(&y["tvlUsd"].as_f64().unwrap_or(0.0)))
            .and_then(|m| m["supplyApyPct"].as_f64())
    });
    let yearly = apy.map(|p| to_precision3(human.parse::<f64>().unwrap_or(0.0) * p / 100.0));
    let n = calls.len();
    let r = json!({
        "chainId": chain, "protocol": "Aave V4", "action": "lend", "spoke": spoke, "hub": hub, "reserveId": reserve_id.to_string(),
        "token": { "address": asset, "symbol": sym, "decimals": dec }, "amount": human, "supplyApyPct": apy.map(num),
        "position": { "earnPerYearAtCurrentRate": yearly.map(|y| format!("{y} {sym}")) },
        "simulation": sim, "transactions": tx_out(&calls, chain, &wallet),
        "warnings": if bal < amount { json!([format!("Not enough {sym}: the wallet holds {}.", units(bal, dec))]) } else { json!([]) },
    });
    let title = format!("Lend {human} {sym} on Aave V4");
    let sims = last_sim(n, &r["simulation"]);
    Ok(with_sign_link(r, &title, &wallet, &sims, None))
}

pub async fn build_withdraw(a: &Map<String, Value>, ctx: &Ctx<'_>) -> Result<Value, ToolError> {
    let http = ctx.http;
    let chain_in = opt_str(a, "chain")?.ok_or_else(|| bad("chain is required"))?;
    let token_in = opt_str(a, "token")?.ok_or_else(|| bad("token is required"))?;
    let amount_in = opt_str(a, "amount")?.ok_or_else(|| bad("amount is required"))?;
    let wallet = wallet_arg(a)?;
    let chain = token_chain_id(&chain_in).ok_or_else(|| ToolError(format!("Unknown chain \"{chain_in}\".")))?;
    let pool = aave_pool(chain).await?;
    let (asset, sym, dec) = resolve_token(http, ctx.tokens, chain, &token_in).await?;
    let res = reserve(http, chain, &pool, &asset).await?;
    let (supplied, liquidity, acct) = futures::join!(balance_of(http, chain, &res.a_token, &wallet), balance_of(http, chain, &asset, &res.a_token), account(http, chain, &pool, &wallet));
    let (supplied, liquidity, (has_debt, hf)) = (supplied?, liquidity?, acct?);
    if supplied == 0 {
        return Err(ToolError(format!("This wallet has no {sym} lent on Aave on this chain.")));
    }
    let all = amount_in == "max";
    let amount = if all { supplied } else { parse_units(&amount_in, dec)? };
    let human = units(amount, dec);
    let data = format!("0x69328dec{}{}{}", pad_addr(&asset), if all { "f".repeat(64) } else { pad_u(amount) }, pad_addr(&wallet));
    let label = if all { format!("Withdraw all {sym} from Aave (about {human})") } else { format!("Withdraw {human} {sym} from Aave") };
    let calls = vec![Call { to: pool.clone(), data: data.clone(), value: 0, gas: None, label }];
    let sim = simulate(http, chain, &wallet, &pool, &data, 0, None).await;
    let mut warnings = Vec::new();
    if amount > liquidity {
        warnings.push(format!("Aave holds only {} {sym} right now (the rest is lent out); withdraw less, or wait for repayments.", units(liquidity, dec)));
    }
    if has_debt {
        warnings.push(format!("This wallet has borrowed on Aave (health factor {}). Withdrawing collateral lowers it; below 1 the position can be liquidated.", hf.map(crate::pools::num_text).unwrap_or_else(|| "null".into())));
    }
    let r = json!({
        "chainId": chain, "protocol": "Aave V3", "action": "withdraw", "pool": pool, "token": { "address": asset, "symbol": sym, "decimals": dec },
        "amount": human, "supplyApyPct": num(res.supply_apy),
        "position": { "suppliedNow": units(supplied, dec), "withdrawableNow": units(liquidity.min(supplied), dec), "healthFactor": hf.map(num), "hasDebt": has_debt },
        "simulation": sim, "transactions": tx_out(&calls, chain, &wallet), "warnings": warnings,
    });
    let title = format!("Withdraw {sym} from Aave");
    let sims = vec![Some(r["simulation"].clone())];
    Ok(with_sign_link(r, &title, &wallet, &sims, None))
}

// ---- Morpho vaults (ERC-4626) ----

async fn morpho_vault(http: &reqwest::Client, chain: i64, vault: &str) -> Option<(String, String)> {
    for version in ["v2", "v1"] {
        let r = http.get(format!("https://api.morpho.org/v0/vaults-{version}/{chain}:{vault}")).timeout(Duration::from_secs(8)).send().await.ok()?;
        if r.status().is_success() {
            if let Ok(b) = r.json::<Value>().await {
                if b["data"].is_object() {
                    return Some((b["data"]["name"].as_str().unwrap_or("Morpho vault").to_string(), version.to_string()));
                }
            }
        }
    }
    None
}

struct Vault {
    chain: i64,
    vault: String,
    asset: String,
    sym: String,
    dec: u32,
    share_dec: u32,
    name: String,
    version: String,
}
async fn open_vault(a: &Map<String, Value>, http: &reqwest::Client) -> Result<(Vault, String), ToolError> {
    let chain_in = opt_str(a, "chain")?.ok_or_else(|| bad("chain is required"))?;
    let vault = opt_str(a, "vault")?.ok_or_else(|| bad("vault is required"))?;
    let wallet = wallet_arg(a)?;
    let chain = token_chain_id(&chain_in).ok_or_else(|| ToolError(format!("Unknown chain \"{chain_in}\".")))?;
    if !is_addr(&vault) {
        return Err(ToolError("vault must be the vault address (compare_yield gives it).".into()));
    }
    let vault = vault.to_lowercase();
    let (name, version) = morpho_vault(http, chain, &vault).await.ok_or_else(|| ToolError("This is not a vault Morpho knows on this chain. Use compare_yield for vault addresses, or build_tx for other contracts.".into()))?;
    let (asset, share_dec) = futures::join!(read_addr(http, chain, &vault, "0x38d52e0f"), decimals(http, chain, &vault));
    let asset = asset?;
    let (sym, dec) = futures::join!(symbol(http, chain, &asset), decimals(http, chain, &asset));
    let sym = if sym == "?" { "tokens".to_string() } else { sym };
    Ok((Vault { chain, vault, asset, sym, dec: dec?, share_dec: share_dec?, name, version }, wallet))
}

pub async fn build_vault_deposit(a: &Map<String, Value>, ctx: &Ctx<'_>) -> Result<Value, ToolError> {
    let http = ctx.http;
    let amount_in = opt_str(a, "amount")?.ok_or_else(|| bad("amount is required"))?;
    let (v, wallet) = open_vault(a, http).await?;
    let (bal, allow, max_dep) = futures::join!(
        balance_of(http, v.chain, &v.asset, &wallet),
        allowance(http, v.chain, &v.asset, &wallet, &v.vault),
        read_u(http, v.chain, &v.vault, format!("0x402d267d{}", pad_addr(&wallet)))
    );
    let (bal, allow) = (bal?, allow?);
    let amount = if amount_in == "max" { bal } else { parse_units(&amount_in, v.dec)? };
    if amount == 0 {
        return Err(ToolError(format!("The wallet holds no {} on this chain.", v.sym)));
    }
    // Morpho V2 vaults always report maxDeposit 0 (they check caps and gates inside deposit): only V1's answer counts.
    if v.version == "v1" && max_dep.as_ref().ok() == Some(&0) {
        return Err(ToolError(format!("{} is not taking deposits from this wallet right now (it may be full or gated).", v.name)));
    }
    let shares = read_u(http, v.chain, &v.vault, format!("0xef8b30f7{}", pad_u(amount))).await?;
    let human = units(amount, v.dec);
    let mut calls = Vec::new();
    if allow < amount {
        calls.push(Call { to: v.asset.clone(), data: approve_data(&v.vault, amount), value: 0, gas: None, label: format!("Approve exactly {human} {} for {}", v.sym, v.name) });
    }
    let data = format!("0x6e553f65{}{}", pad_u(amount), pad_addr(&wallet));
    calls.push(Call { to: v.vault.clone(), data: data.clone(), value: 0, gas: None, label: format!("Deposit {human} {} into {}", v.sym, v.name) });
    let sim = if bal < amount {
        json!({ "status": "skipped", "reason": format!("The wallet holds {} {}, less than {human}.", units(bal, v.dec), v.sym) })
    } else {
        simulate(http, v.chain, &wallet, &v.vault, &data, 0, (calls.len() > 1).then_some("Runs once the approval in step 1 is confirmed.")).await
    };
    let n = calls.len();
    let r = json!({
        "chainId": v.chain, "wallet": wallet, "vault": v.vault, "vaultName": v.name, "morphoVersion": v.version, "token": { "address": v.asset, "symbol": v.sym },
        "deposit": human, "sharesAbout": units(shares, v.share_dec),
        "simulation": sim, "transactions": tx_out(&calls, v.chain, &wallet),
        "warnings": if bal < amount { json!([format!("Not enough {}: the wallet holds {}.", v.sym, units(bal, v.dec))]) } else { json!([]) },
        "notes": ["The shares grow in value as the vault earns; withdraw any time with build_vault_withdraw (subject to the vault having liquidity).", "Vaults carry smart-contract and curator risk. Not financial advice."],
    });
    let title = format!("Deposit {human} {} into {}", v.sym, v.name);
    let sims = last_sim(n, &r["simulation"]);
    Ok(with_sign_link(r, &title, &wallet, &sims, None))
}

pub async fn build_vault_withdraw(a: &Map<String, Value>, ctx: &Ctx<'_>) -> Result<Value, ToolError> {
    let http = ctx.http;
    let amount_in = opt_str(a, "amount")?.ok_or_else(|| bad("amount is required"))?;
    let (v, wallet) = open_vault(a, http).await?;
    let (shares, max_w) = futures::join!(balance_of(http, v.chain, &v.vault, &wallet), read_u(http, v.chain, &v.vault, format!("0xce96cb77{}", pad_addr(&wallet))));
    let shares = shares?;
    if shares == 0 {
        return Err(ToolError(format!("This wallet has nothing in {}.", v.name)));
    }
    let value = read_u(http, v.chain, &v.vault, format!("0x07a2d13a{}", pad_u(shares))).await?;
    let all = amount_in == "max";
    let amount = if all { value } else { parse_units(&amount_in, v.dec)? };
    let human = units(amount, v.dec);
    let (data, label) = if all {
        (format!("0xba087652{}{}{}", pad_u(shares), pad_addr(&wallet), pad_addr(&wallet)), format!("Withdraw everything from {} (about {human} {})", v.name, v.sym))
    } else {
        (format!("0xb460af94{}{}{}", pad_u(amount), pad_addr(&wallet), pad_addr(&wallet)), format!("Withdraw {human} {} from {}", v.sym, v.name))
    };
    let calls = vec![Call { to: v.vault.clone(), data: data.clone(), value: 0, gas: None, label }];
    let sim = simulate(http, v.chain, &wallet, &v.vault, &data, 0, None).await;
    // Morpho V2 vaults always report maxWithdraw 0 (liquidity is checked inside withdraw): the dry run decides there.
    let withdrawable = if v.version == "v1" { max_w.ok() } else { None };
    let r = json!({
        "chainId": v.chain, "wallet": wallet, "vault": v.vault, "vaultName": v.name, "token": { "address": v.asset, "symbol": v.sym },
        "withdraw": human,
        "position": { "worthNow": units(value, v.dec), "withdrawableNow": withdrawable.map(|w| json!(units(w, v.dec))).unwrap_or(json!("see the dry run")) },
        "simulation": sim, "transactions": tx_out(&calls, v.chain, &wallet),
        "warnings": match withdrawable { Some(w) if amount > w => json!([format!("Only {} {} can be withdrawn right now (the rest is lent out). Withdraw less, or wait.", units(w, v.dec), v.sym)]), _ => json!([]) },
    });
    let title = format!("Withdraw {human} {} from {}", v.sym, v.name);
    let sims = vec![Some(r["simulation"].clone())];
    Ok(with_sign_link(r, &title, &wallet, &sims, None))
}

// ---- build_bridge (LI.FI) ----

fn chain_name(id: i64) -> String {
    match id {
        1 => "Ethereum", 8453 => "Base", 56 => "BNB Chain", 42161 => "Arbitrum", 10 => "Optimism", 137 => "Polygon", 130 => "Unichain",
        4663 => "Robinhood Chain", 43114 => "Avalanche", 59144 => "Linea",
        _ => return format!("chain {id}"),
    }
    .to_string()
}

pub async fn build_bridge(a: &Map<String, Value>, ctx: &Ctx<'_>) -> Result<Value, ToolError> {
    let http = ctx.http;
    let from_in = opt_str(a, "fromChain")?.ok_or_else(|| bad("fromChain is required"))?;
    let to_in = opt_str(a, "toChain")?.ok_or_else(|| bad("toChain is required"))?;
    let tin = opt_str(a, "tokenIn")?.ok_or_else(|| bad("tokenIn is required"))?;
    let tout = opt_str(a, "tokenOut")?.ok_or_else(|| bad("tokenOut is required"))?;
    let amount_in = opt_str(a, "amount")?.ok_or_else(|| bad("amount is required"))?;
    let wallet = wallet_arg(a)?;
    let (Some(from), Some(to)) = (token_chain_id(&from_in), token_chain_id(&to_in)) else {
        return Err(ToolError("Unknown chain. Use names like base, ethereum, arbitrum, optimism, polygon, bnb, unichain, robinhood.".into()));
    };
    if from == to {
        return Err(ToolError("Same chain: use build_swap instead.".into()));
    }
    const ZERO: &str = "0x0000000000000000000000000000000000000000";
    let tok = |t: &str| if t.eq_ignore_ascii_case("eth") { Some(ZERO.to_string()) } else if is_addr(t) { Some(t.to_lowercase()) } else { None };
    let (Some(token_in), Some(token_out)) = (tok(&tin), tok(&tout)) else {
        return Err(ToolError("tokenIn and tokenOut must be \"ETH\" (the native coin) or token addresses from find_token on their own chains.".into()));
    };
    let dec = if token_in == ZERO { 18 } else { decimals(http, from, &token_in).await? };
    let raw = if amount_in == "max" {
        if token_in == ZERO {
            return Err(ToolError("\"max\" is for tokens: the native coin also pays gas, so give an amount.".into()));
        }
        let b = balance_of(http, from, &token_in, &wallet).await?;
        if b == 0 {
            return Err(ToolError("The wallet holds none of tokenIn on this chain.".into()));
        }
        b
    } else {
        if !is_decimal(&amount_in) {
            return Err(ToolError("amount must be a plain number of whole units, or \"max\".".into()));
        }
        parse_units(&amount_in, dec)?
    };
    let integrator = std::env::var("LIFI_INTEGRATOR").ok().filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "btb-finance".into());
    let mut url = format!("https://li.quest/v1/quote?fromChain={from}&toChain={to}&fromToken={token_in}&toToken={token_out}&fromAmount={raw}&fromAddress={wallet}&toAddress={wallet}&slippage=0.03&order=FASTEST&integrator={}", integrator.trim());
    if let Some(fee) = std::env::var("LIFI_FEE").ok().and_then(|f| f.parse::<f64>().ok()).filter(|f| *f > 0.0 && *f < 1.0) {
        url.push_str(&format!("&fee={fee}"));
    }
    let r = http.get(&url).timeout(Duration::from_secs(20)).send().await.map_err(|e| ToolError(e.to_string()))?;
    let ok = r.status().is_success();
    let status = r.status().as_u16();
    let q: Value = r.json().await.unwrap_or(Value::Null);
    if !ok || !q["transactionRequest"].is_object() {
        return Err(ToolError(format!("No bridge route: {}. Try another token or a bigger amount.", q["message"].as_str().map(String::from).unwrap_or_else(|| format!("HTTP {status}")))));
    }
    let from_sym = q["action"]["fromToken"]["symbol"].as_str().unwrap_or("").to_string();
    let to_sym = q["action"]["toToken"]["symbol"].as_str().unwrap_or("").to_string();
    let to_dec = q["action"]["toToken"]["decimals"].as_u64().unwrap_or(18) as usize;
    let human = units(raw, dec);
    let approval = q["estimate"]["approvalAddress"].as_str().unwrap_or("").to_string();
    let mut calls = Vec::new();
    let balance_ok;
    if token_in != ZERO {
        let (allow, bal) = futures::join!(allowance(http, from, &token_in, &wallet, &approval), balance_of(http, from, &token_in, &wallet));
        balance_ok = bal? >= raw;
        if allow? < raw {
            calls.push(Call { to: token_in.clone(), data: approve_data(&approval, raw), value: 0, gas: None, label: format!("Approve exactly {human} {from_sym} for the LI.FI router") });
        }
    } else {
        balance_ok = native_balance(http, from, &wallet).await >= raw;
    }
    let out = format_units(q["estimate"]["toAmount"].as_str().unwrap_or("0"), to_dec);
    let min = format_units(q["estimate"]["toAmountMin"].as_str().unwrap_or("0"), to_dec);
    let tr = &q["transactionRequest"];
    let tx_to = tr["to"].as_str().unwrap_or("").to_string();
    let tx_data = tr["data"].as_str().unwrap_or("0x").to_string();
    let tx_value = hex_u128(tr["value"].as_str().unwrap_or("0x0"));
    let out_short = {
        let v = out.parse::<f64>().unwrap_or(0.0);
        let s = format!("{:.*e}", 5, v);
        let rounded: f64 = s.parse().unwrap_or(v);
        crate::pools::num_text(rounded)
    };
    calls.push(Call { to: tx_to.clone(), data: tx_data.clone(), value: tx_value, gas: None, label: format!("Bridge {human} {from_sym} to about {out_short} {to_sym} on {} (via {})", chain_name(to), q["tool"].as_str().unwrap_or("")) });
    let sim = if !balance_ok {
        json!({ "status": "skipped", "reason": format!("The wallet holds less than {human} {from_sym}.") })
    } else {
        simulate(http, from, &wallet, &tx_to, &tx_data, tx_value, (calls.len() > 1).then_some("Runs once the approval in step 1 is confirmed.")).await
    };
    let usd = |v: &Value| v.as_str().and_then(|s| s.parse::<f64>().ok()).map(|x| js_round(x * 100.0) / 100.0);
    let in_usd = usd(&q["estimate"]["fromAmountUSD"]);
    let out_usd = usd(&q["estimate"]["toAmountUSD"]);
    let sum = |k: &str| q["estimate"][k].as_array().into_iter().flatten().map(|f| f["amountUSD"].as_str().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0)).sum::<f64>();
    let (fees, gas) = (sum("feeCosts"), sum("gasCosts"));
    let mut warnings = Vec::new();
    if let (Some(i), Some(o)) = (in_usd, out_usd) {
        if i != 0.0 && o != 0.0 && o < i * 0.95 {
            warnings.push(format!("You receive about ${} for ${} sent ({}% less, after fees and price impact). A bigger amount or another route may lose less.", crate::pools::num_text(o), crate::pools::num_text(i), js_round((1.0 - o / i) * 100.0)));
        }
    }
    if let Some(i) = in_usd.filter(|i| *i != 0.0) {
        if gas + fees > i * 0.1 {
            warnings.push(format!("Fees and gas (about ${}) are more than 10% of what you send.", crate::pools::num_text(js_round((gas + fees) * 100.0) / 100.0)));
        }
    }
    let n = calls.len();
    let r = json!({
        "chainId": from, "toChainId": to, "wallet": wallet,
        "quote": {
            "send": format!("{human} {from_sym} on {}", chain_name(from)), "receive": format!("{out} {to_sym}"), "receiveAtLeast": format!("{min} {to_sym}"),
            "onChain": chain_name(to), "route": q["tool"], "sendUsd": in_usd.map(num), "receiveUsd": out_usd.map(num),
            "feesUsd": num(js_round(fees * 100.0) / 100.0), "gasUsd": num(js_round(gas * 100.0) / 100.0),
            "estimatedSeconds": q["estimate"]["executionDuration"].clone(),
        },
        "balanceOk": balance_ok, "simulation": sim, "warnings": warnings,
        "transactions": tx_out(&calls, from, &wallet),
        "notes": [
            "Sign on the source chain; the tokens arrive in the same wallet on the destination chain, usually within the estimated time.",
            "Follow the delivery with bridge_status and the source transaction hash. Quotes go stale in a few minutes: rebuild rather than sign an old one.",
            "Nothing was signed or sent. Not financial advice.",
        ],
    });
    let title = format!("Send {human} {from_sym} on {} to {} as {to_sym}", chain_name(from), chain_name(to));
    let sims = last_sim(n, &r["simulation"]);
    Ok(with_sign_link(r, &title, &wallet, &sims, None))
}

pub fn definitions() -> Vec<Value> {
    let w = json!({ "readOnlyHint": true, "destructiveHint": false, "idempotentHint": false, "openWorldHint": true });
    let wallet = json!({ "type": "string", "pattern": "^0x[0-9a-fA-F]{40}$" });
    vec![
        json!({ "name": "build_swap", "title": "Build a swap (unsigned)",
            "description": "A swap ready to sign: the best KyberSwap price on that chain, an exact-amount approval if needed, then the swap, with the quote, price impact, BTB fee, a safety grade for the token bought and a dry run. For a person, give them the signLink (opens btb.finance with the steps to sign in their wallet); an agent with its own wallet can sign the transactions itself. Use this, not just quote_swap, whenever someone wants to swap.",
            "inputSchema": { "type": "object", "properties": {
                "chain": { "type": "string", "description": "Chain name or id, e.g. \"base\", \"ethereum\", \"bnb\", \"arbitrum\", 8453." },
                "tokenIn": { "type": "string", "description": "Token to sell: its address, or \"ETH\" for the chain's native coin." },
                "tokenOut": { "type": "string", "description": "Token to buy: its address, or \"ETH\" for the native coin." },
                "amount": { "type": "string", "pattern": "^(\\d+(\\.\\d+)?|max)$", "description": "Amount of tokenIn in whole units, e.g. \"250\" or \"0.5\", or \"max\" for the wallet's whole balance of a token (not the native coin, which also pays gas)." },
                "wallet": wallet.clone(), "recipient": { "type": "string", "pattern": "^0x[0-9a-fA-F]{40}$", "description": "Who receives tokenOut. Default: wallet." },
                "slippageBps": { "type": "integer", "minimum": 1, "maximum": 3000, "description": "Slippage tolerance in bps. Default 50 (0.5%)." }
            }, "required": ["chain", "tokenIn", "tokenOut", "amount", "wallet"] }, "annotations": w }),
        json!({ "name": "build_lend", "title": "Lend on Aave (ready to sign)",
            "description": "Lend a token on Aave V3, or Aave V4 with protocol \"aave-v4\" (the Core markets on ethereum and avalanche): the exact approval only if needed, then the supply, as ONE signLink for the person, with the live supply APY, what the amount earns a year, the wallet's health factor (V3) and a dry run. Use this, not build_tx, for Aave deposits.",
            "inputSchema": { "type": "object", "properties": {
                "chain": { "type": "string", "description": "Chain name or id: ethereum, base, arbitrum, optimism, polygon, avalanche, bnb." },
                "protocol": { "type": "string", "enum": ["aave-v3", "aave-v4"], "description": "Default aave-v3. aave-v4 lends in Aave V4's Core market (ethereum, avalanche)." },
                "token": { "type": "string", "description": "Symbol or address, e.g. \"USDC\", \"WETH\". Aave takes the wrapped coin, not native ETH." },
                "wallet": wallet.clone(), "amount": { "type": "string", "pattern": "^(\\d+(\\.\\d+)?|max)$", "description": "Whole units, e.g. \"10\", or \"max\" for the whole balance." }
            }, "required": ["chain", "token", "wallet", "amount"] }, "annotations": w }),
        json!({ "name": "build_withdraw", "title": "Withdraw from Aave (ready to sign)",
            "description": "Take a lent token back from Aave V3, as a signLink for the person: how much is supplied, how much can be withdrawn right now, the health factor (if the wallet borrows) and a dry run. amount \"max\" takes everything including interest.",
            "inputSchema": { "type": "object", "properties": {
                "chain": { "type": "string", "description": "Chain name or id: ethereum, base, arbitrum, optimism, polygon, avalanche, bnb." },
                "token": { "type": "string", "description": "Symbol or address, e.g. \"USDC\", \"WETH\". Aave takes the wrapped coin, not native ETH." },
                "wallet": wallet.clone(), "amount": { "type": "string", "pattern": "^(\\d+(\\.\\d+)?|max)$", "description": "Whole units, or \"max\" for all of it." }
            }, "required": ["chain", "token", "wallet", "amount"] }, "annotations": w }),
        json!({ "name": "build_vault_deposit", "title": "Deposit into a vault (ready to sign)",
            "description": "Deposit into a Morpho vault (V1 or V2, any ERC-4626 vault Morpho knows): the exact approval only if needed, then the deposit, as ONE signLink, with the shares you get and a dry run. Fast: no contract lookup. Get the vault address from compare_yield.",
            "inputSchema": { "type": "object", "properties": {
                "chain": { "type": "string", "description": "Chain name or id." }, "vault": { "type": "string", "pattern": "^0x[0-9a-fA-F]{40}$", "description": "The vault address, from compare_yield." },
                "wallet": wallet.clone(), "amount": { "type": "string", "pattern": "^(\\d+(\\.\\d+)?|max)$", "description": "Whole units of the vault's token, or \"max\" for the whole balance." }
            }, "required": ["chain", "vault", "wallet", "amount"] }, "annotations": w }),
        json!({ "name": "build_vault_withdraw", "title": "Withdraw from a vault (ready to sign)",
            "description": "Take tokens back from a Morpho vault (V1 or V2): an amount, or \"max\" to redeem every share including interest, as a signLink, with what the position is worth, what can be withdrawn right now and a dry run.",
            "inputSchema": { "type": "object", "properties": {
                "chain": { "type": "string", "description": "Chain name or id." }, "vault": { "type": "string", "pattern": "^0x[0-9a-fA-F]{40}$", "description": "The vault address, from compare_yield." },
                "wallet": wallet.clone(), "amount": { "type": "string", "pattern": "^(\\d+(\\.\\d+)?|max)$", "description": "Whole units of the token, or \"max\" for everything." }
            }, "required": ["chain", "vault", "wallet", "amount"] }, "annotations": w }),
        json!({ "name": "build_bridge", "title": "Swap across chains (ready to sign)",
            "description": "Sell a token on one chain and receive any token on another chain (e.g. USDC on Base to ETH on Ethereum), through LI.FI's best bridge and DEX route: an exact approval if needed, then the bridge transaction, as ONE signLink, with what arrives (and the minimum), fees, gas, the estimated time and a dry run. Tokens arrive in the same wallet. Use find_token for each token on its own chain first.",
            "inputSchema": { "type": "object", "properties": {
                "fromChain": { "type": "string", "description": "Chain the tokens leave, e.g. \"base\"." }, "toChain": { "type": "string", "description": "Chain they arrive on, e.g. \"ethereum\"." },
                "tokenIn": { "type": "string", "description": "\"ETH\" for the native coin, or the token address on fromChain." },
                "tokenOut": { "type": "string", "description": "\"ETH\" for the native coin, or the token address on toChain." },
                "amount": { "type": "string", "pattern": "^(\\d+(\\.\\d+)?|max)$", "description": "Whole units of tokenIn, or \"max\" for the whole balance of a token." },
                "wallet": wallet
            }, "required": ["fromChain", "toChain", "tokenIn", "tokenOut", "amount", "wallet"] }, "annotations": w }),
    ]
}
