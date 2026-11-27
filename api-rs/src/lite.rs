//! Small tools with no keys and no contract decoding: quick_token_check (GoPlus) and bridge_status (LI.FI).
//! Ports of src/lib/mcp/tokens.ts quickTokenCheck and src/lib/mcp/bridge.ts bridgeStatus: same answers.

use crate::pools::{chain_key, js_round, num};
use crate::tools::{bad, opt_str, ToolError};
use serde_json::{json, Map, Value};
use std::time::Duration;

/// Chains BTB has an RPC for (src/lib/chainClient.ts CHAINS).
const KNOWN_CHAINS: &[i64] = &[1, 56, 137, 42161, 10, 8453, 43114, 80094, 146, 2020, 130, 59144, 999, 9745, 42793, 5000, 143, 4326, 534352, 250, 81457, 324, 4663, 5042, 57073];

/// src/lib/mcp/tokens.ts tokenChainId: an id, or a name through build.ts CHAIN_IDS, limited to chains with an RPC.
pub fn token_chain_id(input: &str) -> Option<i64> {
    let n: Option<i64> = input.trim().parse().ok().filter(|n: &i64| *n > 0);
    let id = n.or_else(|| {
        Some(match chain_key(input).as_str() {
            "ethereum" => 1, "base" => 8453, "bnbchain" => 56, "robinhoodchain" => 4663, "arc" => 5042, "arbitrum" => 42161,
            "optimism" => 10, "polygon" => 137, "unichain" => 130, "avalanche" => 43114, "linea" => 59144, "berachain" => 80094,
            "ronin" => 2020, "hyperevm" => 999, "plasma" => 9745, "etherlink" => 42793, "monad" => 143, "megaeth" => 4326,
            _ => return None,
        })
    })?;
    KNOWN_CHAINS.contains(&id).then_some(id)
}

fn is_hex(s: &str, len: usize) -> bool {
    s.len() == len + 2 && s.starts_with("0x") && s[2..].chars().all(|c| c.is_ascii_hexdigit())
}

/// viem formatUnits: a base-unit integer as a decimal string, without trailing zeros.
pub fn format_units(raw: &str, decimals: usize) -> String {
    let digits: String = raw.trim_start_matches('0').to_string();
    let digits = if digits.is_empty() { "0".to_string() } else { digits };
    let padded = format!("{:0>width$}", digits, width = decimals + 1);
    let (int, frac) = padded.split_at(padded.len() - decimals);
    let frac = frac.trim_end_matches('0');
    if frac.is_empty() { int.to_string() } else { format!("{int}.{frac}") }
}

pub async fn quick_token_check(a: &Map<String, Value>, http: &reqwest::Client) -> Result<Value, ToolError> {
    let chain = opt_str(a, "chain")?.ok_or_else(|| bad("chain is required"))?;
    let token = opt_str(a, "token")?.ok_or_else(|| bad("token is required"))?;
    let chain_id = token_chain_id(&chain).ok_or_else(|| ToolError(format!("Unknown chain \"{chain}\".")))?;
    if !is_hex(&token, 40) {
        return Err(ToolError("token must be a 0x address (find_token gives it).".into()));
    }
    let token = token.to_lowercase();
    let body: Value = match http
        .get(format!("https://api.gopluslabs.io/api/v1/token_security/{chain_id}?contract_addresses={token}"))
        .timeout(Duration::from_secs(10))
        .send()
        .await
    {
        Ok(r) => r.json().await.unwrap_or(Value::Null),
        Err(_) => Value::Null,
    };
    let x = &body["result"][&token];
    if !x.is_object() {
        return Ok(json!({ "chainId": chain_id, "token": token, "checked": false, "note": "No free check available for this token or chain. A full scan on btb.finance covers more.", "scanLink": format!("https://btb.finance/scan?token={token}") }));
    }
    let yes = |k: &str| x[k].as_str() == Some("1");
    let pct = |k: &str| x[k].as_str().filter(|s| !s.is_empty()).and_then(|s| s.parse::<f64>().ok()).map(|n| js_round(n * 10_000.0) / 100.0);
    let mut flags: Vec<String> = [
        (yes("is_honeypot"), "honeypot: it cannot be sold"),
        (yes("cannot_sell_all"), "cannot sell the whole balance"),
        (yes("is_mintable"), "owner can mint more"),
        (yes("owner_change_balance"), "owner can change balances"),
        (yes("hidden_owner"), "hidden owner"),
        (yes("is_blacklisted"), "has a blacklist"),
        (yes("transfer_pausable"), "transfers can be paused"),
        (yes("slippage_modifiable"), "tax can be changed"),
        (yes("is_proxy"), "upgradeable proxy"),
        (x["is_open_source"].as_str() == Some("0"), "source code not verified"),
    ]
    .into_iter()
    .filter(|(on, _)| *on)
    .map(|(_, f)| f.to_string())
    .collect();
    let (buy, sell) = (pct("buy_tax"), pct("sell_tax"));
    if buy.unwrap_or(0.0) > 10.0 || sell.unwrap_or(0.0) > 10.0 {
        flags.push(format!("high tax (buy {}%, sell {}%)", crate::pools::num_text(buy.unwrap_or(0.0)), crate::pools::num_text(sell.unwrap_or(0.0))));
    }
    let n = flags.len();
    Ok(json!({
        "chainId": chain_id, "token": token, "checked": true, "source": "GoPlus (free basic check)",
        "symbol": x["token_symbol"].as_str().map(|s| json!(s)).unwrap_or(Value::Null),
        "honeypot": yes("is_honeypot"), "buyTaxPct": buy.map(num).unwrap_or(Value::Null), "sellTaxPct": sell.map(num).unwrap_or(Value::Null),
        "holders": x["holder_count"].as_str().filter(|s| !s.is_empty()).and_then(|s| s.parse::<f64>().ok()).map(num).unwrap_or(Value::Null),
        "openSource": x["is_open_source"].as_str() == Some("1"),
        "flags": flags,
        "verdict": if n == 0 { "no red flags in the basic check".to_string() } else { format!("{n} warning{}", if n > 1 { "s" } else { "" }) },
        "note": "Basic and free. token_safety or a btb.finance scan also checks holders, liquidity locks and flows.",
    }))
}

pub async fn bridge_status(a: &Map<String, Value>, http: &reqwest::Client) -> Result<Value, ToolError> {
    let hash = opt_str(a, "hash")?.ok_or_else(|| bad("hash is required"))?;
    if !is_hex(&hash, 64) {
        return Err(bad("hash must be the source transaction hash."));
    }
    let mut url = format!("https://li.quest/v1/status?txHash={hash}");
    if let Some(id) = opt_str(a, "fromChain")?.and_then(|c| token_chain_id(&c)) {
        url.push_str(&format!("&fromChain={id}"));
    }
    if let Some(id) = opt_str(a, "toChain")?.and_then(|c| token_chain_id(&c)) {
        url.push_str(&format!("&toChain={id}"));
    }
    let s: Value = match http.get(&url).timeout(Duration::from_secs(15)).send().await {
        Ok(r) => r.json().await.unwrap_or(Value::Null),
        Err(_) => Value::Null,
    };
    if s.is_null() || s.get("message").is_some() {
        let note = s["message"].as_str().unwrap_or("Not known to the bridge yet: if it was just sent, check again in a minute.");
        return Ok(json!({ "hash": hash, "status": "NOT_FOUND", "note": note }));
    }
    let amt = |x: &Value| -> Value {
        match (x["amount"].as_str(), x["token"]["symbol"].as_str(), x["token"]["decimals"].as_u64()) {
            (Some(a), Some(sym), Some(d)) => json!(format!("{} {sym}", format_units(a, d as usize))),
            _ => Value::Null,
        }
    };
    let or_null = |v: &Value| if v.is_null() { Value::Null } else { v.clone() };
    let status = s["status"].as_str().unwrap_or("");
    Ok(json!({
        "hash": hash, "status": or_null(&s["status"]),
        "detail": s["substatusMessage"].as_str().or(s["substatus"].as_str()).map(|x| json!(x)).unwrap_or(Value::Null),
        "route": or_null(&s["tool"]),
        "sent": amt(&s["sending"]), "sourceLink": or_null(&s["sending"]["txLink"]),
        "received": amt(&s["receiving"]), "receivingChainId": or_null(&s["receiving"]["chainId"]),
        "receivingTx": or_null(&s["receiving"]["txHash"]), "receivingLink": or_null(&s["receiving"]["txLink"]),
        "note": match status {
            "DONE" => "Delivered.",
            "FAILED" => "The transfer failed; funds are usually refunded on the source chain. Check detail.",
            _ => "On its way. Check again shortly.",
        },
    }))
}

pub fn definitions(read: &Value) -> Vec<Value> {
    vec![
        json!({
            "name": "quick_token_check",
            "title": "Free token check",
            "description": "A free basic safety check of any token (GoPlus): honeypot, buy and sell tax, owner can mint or change balances, blacklist, pausable transfers, proxy, verified source, holders. Use it when token_safety has no recent scan; it is not as deep as a btb.finance scan.",
            "inputSchema": { "type": "object", "properties": {
                "chain": { "type": "string", "description": "Chain name or id." },
                "token": { "type": "string", "pattern": "^0x[0-9a-fA-F]{40}$", "description": "Token address." }
            }, "required": ["chain", "token"] },
            "annotations": read,
        }),
        json!({
            "name": "bridge_status",
            "title": "Cross-chain transfer status",
            "description": "Whether a cross-chain transfer (from build_bridge or any LI.FI route) arrived: pending, done with the receiving transaction and amount, or failed. Give the source transaction hash (sign_status shows it).",
            "inputSchema": { "type": "object", "properties": {
                "hash": { "type": "string", "pattern": "^0x[0-9a-fA-F]{64}$", "description": "Source chain transaction hash." },
                "fromChain": { "type": "string" }, "toChain": { "type": "string" }
            }, "required": ["hash"] },
            "annotations": read,
        }),
    ]
}
