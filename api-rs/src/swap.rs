//! Tokens and swaps for agents: the LI.FI token catalog, KyberSwap quotes (through btb.finance's relay when
//! KyberSwap refuses the server), find_token and quote_swap. Ports of src/lib/kyberswap.ts and src/lib/mcp/tokens.ts,
//! with numbers printed the way JavaScript prints them, so both servers give the same answers.

use crate::lite::token_chain_id;
use crate::tools::{bad, opt_str, ToolError};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

pub const BTB: &str = "0x88888888c90cd71b35830dabfd24743dbc135b51";
const NATIVE_ADDR: &str = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
pub const BTB_SWAP_FEE_BPS: u32 = 100;

pub fn kyber_slug(chain_id: i64) -> Option<&'static str> {
    Some(match chain_id {
        1 => "ethereum", 56 => "bsc", 137 => "polygon", 42161 => "arbitrum", 10 => "optimism", 8453 => "base", 43114 => "avalanche",
        59144 => "linea", 80094 => "berachain", 2020 => "ronin", 130 => "unichain", 999 => "hyperevm", 9745 => "plasma", 42793 => "etherlink",
        143 => "monad", 4326 => "megaeth", 4663 => "robinhood", 5042 => "arc",
        _ => return None,
    })
}
/// In chain id order, as JavaScript lists an object with number keys.
const KYBER_LIST: &str = "ethereum, optimism, bsc, unichain, polygon, monad, hyperevm, ronin, megaeth, robinhood, arc, base, plasma, arbitrum, etherlink, avalanche, linea, berachain";

pub fn native_symbol(chain_id: i64) -> &'static str {
    match chain_id {
        56 => "BNB", 137 => "POL", 43114 => "AVAX", 80094 => "BERA", 143 => "MON", 999 => "HYPE", 9745 => "XPL", 2020 => "RON",
        _ => "ETH",
    }
}

fn ds_chain(chain_id: i64) -> Option<&'static str> {
    Some(match chain_id {
        1 => "ethereum", 8453 => "base", 56 => "bsc", 42161 => "arbitrum", 10 => "optimism", 137 => "polygon", 130 => "unichain",
        4663 => "robinhood", 43114 => "avalanche", 59144 => "linea",
        _ => return None,
    })
}

// ---- numbers as JavaScript's toLocaleString('en-US') prints them ----

fn group(int: &str) -> String {
    let (sign, digits) = int.strip_prefix('-').map_or(("", int), |d| ("-", d));
    let mut out = String::new();
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(c);
    }
    format!("{sign}{out}")
}
fn trim_join(s: &str) -> String {
    let (int, frac) = s.split_once('.').unwrap_or((s, ""));
    let frac = frac.trim_end_matches('0');
    if frac.is_empty() { group(int) } else { format!("{}.{}", group(int), frac) }
}
/// toLocaleString('en-US', { maximumFractionDigits: d })
pub fn locale_frac(n: f64, d: usize) -> String {
    trim_join(&format!("{n:.d$}"))
}
/// toLocaleString('en-US', { maximumSignificantDigits: d })
pub fn locale_sig(n: f64, d: usize) -> String {
    if n == 0.0 || !n.is_finite() {
        return "0".into();
    }
    let mag = n.abs().log10().floor() as i32;
    let decimals = (d as i32 - 1 - mag).max(0) as usize;
    let rounded: f64 = format!("{n:.d$e}", d = d - 1).parse().unwrap_or(n);
    trim_join(&format!("{rounded:.decimals$}"))
}
pub fn r2(x: Option<f64>) -> Value {
    x.map(|v| crate::pools::num(crate::pools::js_round(v * 100.0) / 100.0)).unwrap_or(Value::Null)
}

// ---- the LI.FI token catalog: the list btb.finance's Swap screen shows ----

#[derive(Clone)]
pub struct CatToken {
    pub address: String,
    pub symbol: String,
    pub name: String,
    pub decimals: u32,
    pub price_usd: Option<f64>,
    pub verified: bool,
}

#[derive(Clone, Default)]
pub struct Catalog(Arc<Mutex<HashMap<i64, (Instant, Arc<Vec<CatToken>>)>>>);

impl Catalog {
    pub async fn list(&self, http: &reqwest::Client, chain_id: i64) -> Arc<Vec<CatToken>> {
        if let Some((at, l)) = self.0.lock().await.get(&chain_id) {
            if at.elapsed() < Duration::from_secs(3600) {
                return l.clone();
            }
        }
        let mut out = Vec::new();
        if let Ok(r) = http.get(format!("https://li.quest/v1/tokens?chains={chain_id}")).timeout(Duration::from_secs(10)).send().await {
            if let Ok(b) = r.json::<Value>().await {
                for t in b["tokens"][chain_id.to_string()].as_array().into_iter().flatten() {
                    let (Some(a), Some(s), Some(d)) = (t["address"].as_str(), t["symbol"].as_str(), t["decimals"].as_u64()) else { continue };
                    if t["verificationStatus"].as_str() == Some("flagged") || s.is_empty() {
                        continue;
                    }
                    let p: f64 = t["priceUSD"].as_str().and_then(|x| x.parse().ok()).or_else(|| t["priceUSD"].as_f64()).unwrap_or(0.0);
                    out.push(CatToken {
                        address: a.to_lowercase(), symbol: s.to_string(), name: t["name"].as_str().filter(|n| !n.is_empty()).unwrap_or(s).to_string(),
                        decimals: d as u32, price_usd: (p > 0.0).then_some(p), verified: t["verificationStatus"].as_str() == Some("verified"),
                    });
                }
            }
        }
        let l = Arc::new(out);
        if !l.is_empty() {
            self.0.lock().await.insert(chain_id, (Instant::now(), l.clone()));
        }
        l
    }
}

// ---- chain reads ----

pub fn rpc_url(chain_id: i64) -> Option<&'static str> {
    crate::txstatus::rpc_for(chain_id)
}

pub async fn eth_call(http: &reqwest::Client, chain_id: i64, to: &str, data: &str, from: Option<&str>) -> Result<String, String> {
    let url = rpc_url(chain_id).ok_or("no RPC for this chain")?;
    let mut call = json!({ "to": to, "data": data });
    if let Some(f) = from {
        call["from"] = json!(f);
    }
    let r: Value = http
        .post(url)
        .json(&json!({ "jsonrpc": "2.0", "id": 1, "method": "eth_call", "params": [call, "latest"] }))
        .timeout(Duration::from_secs(12))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    if let Some(e) = r.get("error") {
        return Err(e["message"].as_str().unwrap_or("call reverted").to_string());
    }
    r["result"].as_str().map(String::from).ok_or_else(|| "no result".into())
}

pub fn word_hex_to_dec(hex: &str) -> String {
    let h = hex.trim_start_matches("0x");
    let mut digits: Vec<u8> = vec![0];
    for c in h.chars() {
        let mut carry = c.to_digit(16).unwrap_or(0);
        for d in digits.iter_mut() {
            let v = *d as u32 * 16 + carry;
            *d = (v % 10) as u8;
            carry = v / 10;
        }
        while carry > 0 {
            digits.push((carry % 10) as u8);
            carry /= 10;
        }
    }
    let s: String = digits.iter().rev().map(|d| char::from(b'0' + d)).collect();
    let t = s.trim_start_matches('0');
    if t.is_empty() { "0".into() } else { t.into() }
}

pub fn decode_string(hex: &str) -> Option<String> {
    let h = hex.trim_start_matches("0x");
    let bytes: Vec<u8> = (0..h.len() / 2).filter_map(|i| u8::from_str_radix(&h[i * 2..i * 2 + 2], 16).ok()).collect();
    if bytes.len() >= 96 {
        let len = u128::from_str_radix(&h[64..128], 16).ok()? as usize;
        Some(String::from_utf8_lossy(&bytes[64..(64 + len).min(bytes.len())]).to_string())
    } else if !bytes.is_empty() {
        Some(String::from_utf8_lossy(&bytes).trim_end_matches('\0').to_string())
    } else {
        None
    }
}

/// Symbol, decimals and USD price (src/lib/mcp/tokens.ts tokenMeta): native, then the catalog, then the contract.
pub async fn token_meta(http: &reqwest::Client, cat: &Catalog, chain_id: i64, token: &str) -> Result<(String, u32, Option<f64>), String> {
    let list = cat.list(http, chain_id).await;
    if token.eq_ignore_ascii_case("ETH") {
        let eth = list.iter().find(|t| t.address == "0x0000000000000000000000000000000000000000" || t.address == NATIVE_ADDR);
        return Ok((native_symbol(chain_id).to_string(), 18, eth.and_then(|t| t.price_usd)));
    }
    if let Some(t) = list.iter().find(|t| t.address == token.to_lowercase()) {
        return Ok((t.symbol.clone(), t.decimals, t.price_usd));
    }
    let (sym, dec) = futures::join!(eth_call(http, chain_id, token, "0x95d89b41", None), eth_call(http, chain_id, token, "0x313ce567", None));
    let dec = dec.map(|h| u32::from_str_radix(h.trim_start_matches("0x").trim_start_matches('0'), 16).unwrap_or(0))?;
    let symbol = sym.ok().and_then(|h| decode_string(&h)).unwrap_or_else(|| token[..8].to_string());
    Ok((symbol, dec, None))
}

// ---- KyberSwap ----

pub struct Quote {
    pub amount_out: String,
    pub amount_out_formatted: String,
    pub amount_out_usd: f64,
    pub rate: f64,
    pub price_impact: f64,
    pub gas_usd: f64,
    pub route: String,
    pub route_summary: Value,
    pub router: String,
}

/// GET to KyberSwap; refused (403/451) server requests go again through btb.finance's /api/kyber relay.
pub async fn kyber_fetch(http: &reqwest::Client, path: &str, query: &str, body: Option<&Value>) -> Result<Value, String> {
    let url = format!("https://aggregator-api.kyberswap.com/{path}{}", if query.is_empty() { String::new() } else { format!("?{query}") });
    let relay_ready = std::env::var("KYBER_PROXY_URL").is_ok() && std::env::var("KYBER_PROXY_SECRET").is_ok();
    let direct = match body {
        Some(b) => http.post(&url).header("x-client-id", "btb-finance").json(b),
        None => http.get(&url).header("x-client-id", "btb-finance"),
    }
    .timeout(Duration::from_secs(15))
    .send()
    .await;
    // Some hosts are blocked by KyberSwap (403/451) or cannot reach it at all: both go through the relay.
    let blocked = match &direct {
        Ok(r) => matches!(r.status().as_u16(), 403 | 451),
        Err(_) => true,
    };
    let res = if blocked && relay_ready {
        http.post(std::env::var("KYBER_PROXY_URL").unwrap())
            .header("x-btb-relay-key", std::env::var("KYBER_PROXY_SECRET").unwrap())
            .json(&json!({ "path": path, "query": query, "body": body }))
            .timeout(Duration::from_secs(20))
            .send()
            .await
            .map_err(|e| e.to_string())?
    } else {
        direct.map_err(|e| e.to_string())?
    };
    let code = res.status();
    let v: Value = res.json().await.map_err(|e| e.to_string())?;
    if !code.is_success() {
        return Err(format!("KyberSwap {}", code.as_u16()));
    }
    Ok(v)
}

pub async fn kyber_quote(http: &reqwest::Client, chain_id: i64, token_in: &str, token_out: &str, amount_in: &str, decimals_out: u32, decimals_in: u32, fee_bps: Option<u32>) -> Result<Quote, String> {
    let slug = kyber_slug(chain_id).ok_or_else(|| format!("KyberSwap is not configured for chain {chain_id}"))?;
    let addr = |t: &str| if t.eq_ignore_ascii_case("ETH") { NATIVE_ADDR.to_string() } else { t.to_string() };
    let mut q = format!("tokenIn={}&tokenOut={}&amountIn={amount_in}&saveGas=0&gasInclude=1", addr(token_in), addr(token_out));
    if let Some(bps) = fee_bps {
        let receiver = std::env::var("NEXT_PUBLIC_BTB_SWAP_FEE_RECEIVER").unwrap_or_else(|_| "0xfed2Ff614E0289D41937139730B49Ee158D02299".into());
        q.push_str(&format!("&chargeFeeBy=currency_out&isInBps=true&feeAmount={bps}&feeReceiver={receiver}"));
    }
    let json = kyber_fetch(http, &format!("{slug}/api/v1/routes"), &q, None).await?;
    if json["code"].as_i64() != Some(0) {
        return Err(json["message"].as_str().unwrap_or("KyberSwap error").to_string());
    }
    let rs = json["data"]["routeSummary"].clone();
    let amount_out = rs["amountOut"].as_str().unwrap_or("0").to_string();
    let out_num = amount_out.parse::<f64>().unwrap_or(0.0) / 10f64.powi(decimals_out as i32);
    let in_num = rs["amountIn"].as_str().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0) / 10f64.powi(decimals_in as i32);
    let mut paths: Vec<String> = Vec::new();
    for route in rs["route"].as_array().into_iter().flatten() {
        for pool in route.as_array().into_iter().flatten() {
            if let Some(ex) = pool["exchange"].as_str() {
                if !paths.iter().any(|p| p == ex) {
                    paths.push(ex.to_string());
                }
            }
        }
    }
    let f = |k: &str| rs[k].as_str().and_then(|s| s.parse::<f64>().ok()).or_else(|| rs[k].as_f64()).unwrap_or(0.0);
    Ok(Quote {
        amount_out_formatted: if out_num > 0.0 && out_num < 0.001 { locale_sig(out_num, 4) } else { locale_frac(out_num, 6) },
        amount_out,
        amount_out_usd: f("amountOutUsd"),
        rate: if in_num > 0.0 { out_num / in_num } else { 0.0 },
        price_impact: f("priceImpact"),
        gas_usd: f("gasUsd"),
        route: if paths.is_empty() { "KyberSwap".into() } else { paths.into_iter().take(3).collect::<Vec<_>>().join(" · ") },
        router: json["data"]["routerAddress"].as_str().unwrap_or("").to_string(),
        route_summary: rs,
    })
}

// ---- find_token ----

fn is_addr(s: &str) -> bool {
    s.len() == 42 && s.starts_with("0x") && s[2..].chars().all(|c| c.is_ascii_hexdigit())
}

/// Marks each match tradeable or not: whether KyberSwap finds a route selling one unit for the native coin.
async fn with_tradeable(http: &reqwest::Client, chain_id: i64, tokens: Vec<Value>) -> Vec<Value> {
    if kyber_slug(chain_id).is_none() {
        return tokens;
    }
    futures::future::join_all(tokens.into_iter().map(|mut t| async move {
        let addr = t["address"].as_str().unwrap_or("").to_string();
        if !is_addr(&addr) {
            return t;
        }
        let dec = t["decimals"].as_u64().unwrap_or(18) as u32;
        let one = format!("1{}", "0".repeat(dec as usize));
        let ok = tokio::time::timeout(Duration::from_secs(4), kyber_quote(http, chain_id, &addr, "ETH", &one, 18, dec, None)).await;
        if let Ok(r) = ok {
            let traded = r.map(|q| q.amount_out.trim_start_matches('0') != "").unwrap_or(false);
            t.as_object_mut().map(|m| m.insert("tradeable".into(), json!(traded)));
        }
        t
    }))
    .await
}

pub async fn find_one(http: &reqwest::Client, cat: &Catalog, query: &str, chain_in: &str) -> Result<Value, ToolError> {
    let q: String = query.trim().chars().take(80).collect();
    let chain_id = token_chain_id(chain_in).ok_or_else(|| ToolError(format!("Unknown chain \"{chain_in}\".")))?;
    if q.is_empty() {
        return Err(ToolError("query is required.".into()));
    }
    let lower = q.to_lowercase();
    if lower == "btb" || lower == "btb finance" || lower == BTB {
        if chain_id != 1 {
            return Ok(json!({ "chainId": chain_id, "tokens": [], "note": "BTB Finance's BTB is only on Ethereum (chain 1). A BTB on this chain is a different token." }));
        }
        return Ok(json!({ "chainId": chain_id, "tokens": [{ "address": BTB, "symbol": "BTB", "name": "BTB Finance", "decimals": 18, "source": "btb" }] }));
    }
    if ["eth", "ether", "native"].contains(&lower.as_str()) || lower == native_symbol(chain_id).to_lowercase() {
        return Ok(json!({ "chainId": chain_id, "tokens": [{ "address": "ETH", "symbol": native_symbol(chain_id), "name": "Native coin", "decimals": 18, "source": "native", "note": "Use \"ETH\" as the token for the native coin in swaps." }] }));
    }
    // 1. The swap catalog, by exact symbol, name or address; verified first.
    let list = cat.list(http, chain_id).await;
    let mut exact: Vec<&CatToken> = list.iter().filter(|t| t.address == lower || t.symbol.to_lowercase() == lower || t.name.to_lowercase() == lower).collect();
    exact.sort_by_key(|t| !t.verified);
    if !exact.is_empty() {
        let tokens: Vec<Value> = exact
            .iter()
            .take(3)
            .map(|t| {
                let mut m = Map::new();
                m.insert("address".into(), json!(t.address));
                m.insert("symbol".into(), json!(t.symbol));
                m.insert("name".into(), json!(t.name));
                m.insert("decimals".into(), json!(t.decimals));
                if let Some(p) = t.price_usd {
                    m.insert("priceUsd".into(), json!(p));
                }
                m.insert("verified".into(), json!(t.verified));
                m.insert("source".into(), json!("catalog"));
                Value::Object(m)
            })
            .collect();
        return Ok(json!({ "chainId": chain_id, "tokens": with_tradeable(http, chain_id, tokens).await }));
    }
    // 2. LI.FI's single lookup.
    if let Ok(r) = http.get(format!("https://li.quest/v1/token?chain={chain_id}&token={}", urlencode(&q))).timeout(Duration::from_secs(5)).send().await {
        if r.status().is_success() {
            if let Ok(t) = r.json::<Value>().await {
                let a = t["address"].as_str().unwrap_or("");
                if !a.is_empty() && t["verificationStatus"].as_str() != Some("flagged") && a.trim_start_matches("0x").chars().any(|c| c != '0') {
                    let mut m = Map::new();
                    m.insert("address".into(), json!(a.to_lowercase()));
                    for k in ["symbol", "name", "decimals"] {
                        if !t[k].is_null() {
                            m.insert(k.into(), t[k].clone());
                        }
                    }
                    let p: f64 = t["priceUSD"].as_str().and_then(|x| x.parse().ok()).unwrap_or(0.0);
                    if p != 0.0 && p.is_finite() {
                        m.insert("priceUsd".into(), json!(p));
                    }
                    m.insert("source".into(), json!("lifi"));
                    return Ok(json!({ "chainId": chain_id, "tokens": with_tradeable(http, chain_id, vec![Value::Object(m)]).await }));
                }
            }
        }
    }
    // 3. DEX Screener: anything trading on a DEX, most liquid first.
    if let Some(ds) = ds_chain(chain_id) {
        if let Ok(r) = http.get(format!("https://api.dexscreener.com/latest/dex/search?q={}", urlencode(&q))).header("user-agent", "curl/8.4.0").timeout(Duration::from_secs(6)).send().await {
            if let Ok(d) = r.json::<Value>().await {
                let mut found: indexmap::IndexMap<String, (String, String, f64, Option<f64>)> = indexmap::IndexMap::new();
                for p in d["pairs"].as_array().into_iter().flatten() {
                    if p["chainId"].as_str() != Some(ds) {
                        continue;
                    }
                    for (side, price) in [(&p["baseToken"], p["priceUsd"].as_str()), (&p["quoteToken"], None)] {
                        let Some(a) = side["address"].as_str() else { continue };
                        let (sym, name) = (side["symbol"].as_str().unwrap_or(""), side["name"].as_str().unwrap_or(""));
                        if !(sym.to_lowercase() == lower || name.to_lowercase() == lower || a.to_lowercase() == lower) {
                            continue;
                        }
                        let e = found.entry(a.to_lowercase()).or_insert((sym.to_string(), name.to_string(), 0.0, None));
                        e.2 += p["liquidity"]["usd"].as_f64().unwrap_or(0.0);
                        if e.3.is_none() {
                            e.3 = price.and_then(|x| x.parse::<f64>().ok()).filter(|x| *x != 0.0);
                        }
                    }
                }
                let mut rows: Vec<(String, (String, String, f64, Option<f64>))> = found.into_iter().collect();
                rows.sort_by(|a, b| b.1 .2.partial_cmp(&a.1 .2).unwrap_or(std::cmp::Ordering::Equal));
                let tokens: Vec<Value> = rows
                    .into_iter()
                    .take(3)
                    .map(|(a, (sym, name, liq, price))| {
                        let mut m = Map::new();
                        m.insert("address".into(), json!(a));
                        m.insert("symbol".into(), json!(sym));
                        m.insert("name".into(), json!(name));
                        m.insert("liquidityUsd".into(), crate::pools::num(crate::pools::js_round(liq)));
                        if let Some(p) = price {
                            m.insert("priceUsd".into(), json!(p));
                        }
                        m.insert("source".into(), json!("dexscreener"));
                        Value::Object(m)
                    })
                    .collect();
                if !tokens.is_empty() {
                    return Ok(json!({ "chainId": chain_id, "tokens": with_tradeable(http, chain_id, tokens).await, "note": "Not in the swap catalog: the most liquid match is first; copies with tiny liquidity may be fakes." }));
                }
            }
        }
    }
    Ok(json!({ "chainId": chain_id, "tokens": [], "note": format!("No token \"{q}\" found on chain {chain_id}. Do not guess an address; ask for the contract address.") }))
}

fn urlencode(s: &str) -> String {
    s.bytes()
        .map(|b| if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") })
        .collect()
}

pub async fn find_token(a: &Map<String, Value>, http: &reqwest::Client, cat: &Catalog) -> Result<Value, ToolError> {
    let query = opt_str(a, "query")?.ok_or_else(|| bad("query is required"))?;
    if let Some(chain) = opt_str(a, "chain")? {
        return find_one(http, cat, &query, &chain).await;
    }
    // Every main chain in one call: where a token lives is often the question.
    let chains = ["ethereum", "base", "bnb", "arbitrum", "optimism", "polygon", "unichain", "robinhood"];
    let found = futures::future::join_all(chains.iter().map(|c| find_one(http, cat, &query, c))).await;
    let hits: Vec<Value> = found
        .into_iter()
        .filter_map(|f| f.ok())
        .filter(|f| f["tokens"].as_array().is_some_and(|t| !t.is_empty()))
        .map(|f| {
            let mut m = Map::new();
            m.insert("chainId".into(), f["chainId"].clone());
            m.insert("tokens".into(), f["tokens"].clone());
            if let Some(n) = f["note"].as_str().filter(|n| !n.is_empty()) {
                m.insert("note".into(), json!(n));
            }
            Value::Object(m)
        })
        .collect();
    let mut out = Map::new();
    out.insert("query".into(), json!(query));
    let empty = hits.is_empty();
    out.insert("chains".into(), Value::Array(hits));
    if empty {
        out.insert("note".into(), json!(format!("No token \"{query}\" on {}. Ask for the contract address and chain.", chains.join(", "))));
    }
    Ok(Value::Object(out))
}

// ---- quote_swap ----

pub async fn quote_swap(a: &Map<String, Value>, http: &reqwest::Client, cat: &Catalog) -> Result<Value, ToolError> {
    let chain_in = opt_str(a, "chain")?.ok_or_else(|| bad("chain is required"))?;
    let token_in = opt_str(a, "tokenIn")?.ok_or_else(|| bad("tokenIn is required"))?;
    let token_out = opt_str(a, "tokenOut")?.ok_or_else(|| bad("tokenOut is required"))?;
    let amount = opt_str(a, "amount")?.ok_or_else(|| bad("amount is required"))?;
    let chain_id = token_chain_id(&chain_in).filter(|c| kyber_slug(*c).is_some()).ok_or_else(|| ToolError(format!("Swaps are not available on \"{chain_in}\". Chains: {KYBER_LIST}.")))?;
    let ok_token = |t: &str| t.eq_ignore_ascii_case("ETH") || is_addr(t);
    if !ok_token(&token_in) || !ok_token(&token_out) {
        return Err(ToolError("tokenIn and tokenOut must be \"ETH\" (the native coin) or a token address from find_token.".into()));
    }
    let decimal = amount.split_once('.').map_or(amount.chars().all(|c| c.is_ascii_digit()) && !amount.is_empty(), |(i, f)| !i.is_empty() && !f.is_empty() && (i.to_owned() + f).chars().all(|c| c.is_ascii_digit()));
    if !decimal {
        return Err(ToolError("amount must be a plain number of whole units, e.g. \"1\" or \"0.25\".".into()));
    }
    let (inm, outm) = futures::join!(token_meta(http, cat, chain_id, &token_in), token_meta(http, cat, chain_id, &token_out));
    let (in_sym, in_dec, in_price) = inm.map_err(ToolError)?;
    let (out_sym, out_dec, out_price) = outm.map_err(ToolError)?;
    let raw = to_base_units(&amount, in_dec);
    let tin = if token_in.eq_ignore_ascii_case("ETH") { "ETH" } else { &token_in };
    let tout = if token_out.eq_ignore_ascii_case("ETH") { "ETH" } else { &token_out };
    let q = kyber_quote(http, chain_id, tin, tout, &raw, out_dec, in_dec, Some(BTB_SWAP_FEE_BPS)).await.map_err(ToolError)?;
    let out_num = q.amount_out.parse::<f64>().unwrap_or(0.0) / 10f64.powi(out_dec as i32);
    let sell_usd = in_price.map(|p| amount.parse::<f64>().unwrap_or(0.0) * p);
    let get_usd = out_price.map(|p| out_num * p).or(Some(q.amount_out_usd).filter(|x| *x != 0.0));
    let loss = match (sell_usd, get_usd) {
        (Some(s), Some(g)) if s != 0.0 && g != 0.0 => Some(crate::pools::js_round((1.0 - g / s) * 1000.0) / 10.0),
        _ => None,
    };
    let mut price = Map::new();
    price.insert(in_sym.clone(), in_price.map(|x| json!(x)).unwrap_or(Value::Null));
    price.insert(out_sym.clone(), out_price.map(|x| json!(x)).unwrap_or(Value::Null));
    let mut out = Map::new();
    out.insert("chainId".into(), json!(chain_id));
    out.insert("sell".into(), json!({ "amount": amount, "symbol": in_sym, "usd": r2(sell_usd) }));
    out.insert("get".into(), json!({ "amount": q.amount_out_formatted, "symbol": out_sym, "usd": r2(get_usd) }));
    out.insert("rate".into(), json!(format!("1 {in_sym} = {} {out_sym}", locale_sig(q.rate, 6))));
    out.insert("priceUsd".into(), Value::Object(price));
    out.insert("priceImpactPct".into(), crate::pools::num(q.price_impact));
    out.insert("gasUsd".into(), r2(Some(q.gas_usd)));
    out.insert("route".into(), json!(q.route));
    if let Some(l) = loss.filter(|l| *l > 5.0) {
        out.insert("warning".into(), json!(format!("About {}% less than the market value of what is sold: the pool is thin for this size. Suggest a smaller amount.", crate::pools::num_text(l))));
    }
    out.insert("note".into(), json!("After the 1% BTB fee (shared with BTB users every Friday). Quotes move with the market. This is only a price: to swap for a person, call build_swap with their wallet and give them its signLink."));
    out.insert("swapLink".into(), json!(format!("https://btb.finance/swap?chain={chain_id}&from={token_in}&to={token_out}&amount={amount}")));
    Ok(Value::Object(out))
}

/// "1.5" with 6 decimals → "1500000" (viem parseUnits, truncating extra digits).
pub fn to_base_units(amount: &str, decimals: u32) -> String {
    let (int, frac) = amount.split_once('.').unwrap_or((amount, ""));
    let mut frac: String = frac.chars().take(decimals as usize).collect();
    while frac.len() < decimals as usize {
        frac.push('0');
    }
    let s = format!("{int}{frac}").trim_start_matches('0').to_string();
    if s.is_empty() { "0".into() } else { s }
}

pub fn definitions(read: &Value) -> Vec<Value> {
    vec![
        json!({
            "name": "find_token",
            "title": "Find a token address",
            "description": "A token's contract address on one chain, by symbol, name or address, with decimals and USD price: first the swap catalog btb.finance uses (verified tokens first), then any token trading on a DEX (most liquid first). Use it before quoting, swapping or reading a balance; never write a token address from memory. \"ETH\" is the native coin.",
            "inputSchema": { "type": "object", "properties": {
                "query": { "type": "string", "description": "Symbol, name or address, e.g. \"USDC\", \"ezETH\", \"PONS\"." },
                "chain": { "type": "string", "description": "Chain name or id, e.g. \"base\", \"ethereum\", \"bnb\", \"robinhood\", 8453. Omit to search every main chain at once." }
            }, "required": ["query"] },
            "annotations": read,
        }),
        json!({
            "name": "quote_swap",
            "title": "Swap quote",
            "description": "A live quote at the best KyberSwap route, after the 1% BTB fee: what an amount of one token gets of another, both sides in USD, rate, price impact, gas, and a warning when the pool is thin for the size. Read-only; use build_swap to get the transactions, or give the swapLink to a person.",
            "inputSchema": { "type": "object", "properties": {
                "chain": { "type": "string", "description": "Chain name or id." },
                "tokenIn": { "type": "string", "description": "Token sold: address from find_token, or \"ETH\" for the native coin." },
                "tokenOut": { "type": "string", "description": "Token bought: address, or \"ETH\"." },
                "amount": { "type": "string", "pattern": "^\\d+(\\.\\d+)?$", "description": "Amount of tokenIn in whole units, e.g. \"1\" or \"0.25\"." }
            }, "required": ["chain", "tokenIn", "tokenOut", "amount"] },
            "annotations": read,
        }),
    ]
}
