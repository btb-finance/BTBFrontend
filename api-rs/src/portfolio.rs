//! wallet_portfolio: what a wallet holds in the protocols BTB supports, on every EVM chain they run on, valued in USD.
//! Candidates come from the BTB registry (each protocol's tokens, receipt tokens and vaults) and from the yield
//! index (every listed Morpho vault and other ERC-4626 vaults). Balances are read on chain in JSON-RPC batches,
//! vault shares are converted to the underlying asset, prices come from DefiLlama, and Aave V3 adds supplied,
//! borrowed and the health factor per chain. Read-only, public on-chain data.

use crate::tools::{bad, opt_str, Ctx, ToolError};
use futures::future::join_all;
use serde_json::{json, Map, Value};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const CACHE_SECS: u64 = 60;

fn llama_chain(id: i64) -> Option<&'static str> {
    Some(match id {
        1 => "ethereum", 10 => "optimism", 25 => "cronos", 50 => "xdc", 56 => "bsc", 130 => "unichain", 137 => "polygon",
        143 => "monad", 146 => "sonic", 196 => "xlayer", 252 => "fraxtal", 324 => "era", 480 => "wc", 999 => "hyperliquid",
        1135 => "lisk", 1329 => "sei", 1776 => "injective", 1868 => "soneium", 2020 => "ronin", 2222 => "kava", 2818 => "morph",
        4326 => "megaeth", 4663 => "robinhood", 5000 => "mantle", 5042 => "arc", 8217 => "klaytn", 8453 => "base", 9745 => "plasma",
        34443 => "mode", 42161 => "arbitrum", 42220 => "celo", 42793 => "etherlink", 43114 => "avax", 48900 => "zircuit",
        57073 => "ink", 59144 => "linea", 80094 => "berachain", 81457 => "blast", 98866 => "plume_mainnet", 534352 => "scroll",
        _ => return None,
    })
}

pub fn chain_label(id: i64) -> String {
    match id {
        1 => "Ethereum", 10 => "Optimism", 25 => "Cronos", 50 => "XDC", 56 => "BNB Chain", 130 => "Unichain", 137 => "Polygon",
        143 => "Monad", 146 => "Sonic", 196 => "X Layer", 252 => "Fraxtal", 324 => "zkSync Era", 480 => "World Chain",
        999 => "HyperEVM", 1135 => "Lisk", 1329 => "Sei", 1776 => "Injective", 1868 => "Soneium", 1923 => "Swellchain",
        2222 => "Kava", 2818 => "Morph", 4663 => "Robinhood Chain", 5000 => "Mantle", 5042 => "Arc", 8217 => "Kaia",
        8453 => "Base", 9745 => "Plasma", 34443 => "Mode", 42161 => "Arbitrum", 42220 => "Celo", 43114 => "Avalanche",
        48900 => "Zircuit", 57073 => "Ink", 59144 => "Linea", 80094 => "Berachain", 98866 => "Plume", 534352 => "Scroll",
        _ => return format!("chain {id}"),
    }
    .to_string()
}

/// Names that are a chain's wrapped coin or a generic bridged dollar: holding them is not a position in the protocol.
const GENERIC: &[&str] = &["WETH", "WHYPE", "WBNB", "WPOL", "WAVAX", "USDC.e"];
/// Governance and utility tokens: shown as the protocol's token, not as money deposited in it.
const GOV: &[&str] = &[
    "AAVE", "LINK", "COMP", "CRV", "ENA", "FF", "FT", "MORPHO", "PENDLE", "RPL", "OGN", "SKY", "MKR", "INV", "USUAL", "SYRUP", "UP",
    "KITTEN", "SWAP", "IMU", "YB", "DBR", "OHM", "SIERRA", "LDO", "EIGEN", "REZ", "STO", "AID",
];
/// Categories whose positions are not ERC-20 balances, or that have nothing to hold.
const NOT_YET: &[(&str, &str)] = &[
    ("uniswap", "LP positions: see wallet_positions"),
    ("curve-dex", "LP positions: see wallet_positions"),
    ("eigenlayer", "restaked shares (coming next)"),
    ("liquity-v2", "troves (coming next)"),
    ("hyperliquid", "perp account (coming next)"),
    ("polymarket", "prediction shares (coming next)"),
    ("ens", "names (coming next)"),
];

#[derive(Clone)]
struct Candidate {
    chain: i64,
    address: String,
    protocol: String,
    slug: String,
    category: String,
    name: String,
    /// The underlying asset for an ERC-4626 vault, when the index knows it.
    asset: Option<String>,
    from_index: bool,
}

fn candidates(ctx: &Ctx<'_>, markets: &[crate::store::Market]) -> Vec<Candidate> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    let mut protos: Vec<&Value> = crate::registry::protocols().iter().collect();
    // Issuers first, so USDC belongs to Circle and not to a protocol that merely uses it.
    protos.sort_by_key(|p| if p["category"].as_str() == Some("Stablecoin Issuer") { 0 } else { 1 });
    for p in protos {
        for c in p["contracts"].as_array().into_iter().flatten() {
            let role = c["role"].as_str().unwrap_or("");
            if !matches!(role, "token" | "vault" | "staking") {
                continue;
            }
            let (Some(chain), Some(addr)) = (c["chainId"].as_i64(), c["address"].as_str()) else { continue };
            let name = c["name"].as_str().unwrap_or("").to_string();
            // USDC and USDT belong to their issuers; another protocol listing them (as collateral) is not a position.
            let foreign_dollar = (name.starts_with("USDC") || name.starts_with("USDT")) && p["category"].as_str() != Some("Stablecoin Issuer");
            if foreign_dollar || GENERIC.iter().any(|g| name.eq_ignore_ascii_case(g)) || addr.len() != 42 {
                continue;
            }
            if seen.insert((chain, addr.to_lowercase())) {
                out.push(Candidate {
                    chain,
                    address: addr.to_lowercase(),
                    protocol: p["name"].as_str().unwrap_or("").to_string(),
                    slug: p["slug"].as_str().unwrap_or("").to_string(),
                    category: p["category"].as_str().unwrap_or("").to_string(),
                    name,
                    asset: None,
                    from_index: false,
                });
            }
        }
    }
    let _ = ctx;
    for m in markets {
        let Some(addr) = m.address.as_deref().filter(|a| a.len() == 42 && a.starts_with("0x")) else { continue };
        if m.kind == "lend" {
            continue;
        }
        if seen.insert((m.chain_id, addr.to_lowercase())) {
            let slug = crate::registry::protocols()
                .iter()
                .find(|p| p["name"].as_str().map(|n| n.to_lowercase().starts_with(&m.protocol.to_lowercase())).unwrap_or(false))
                .and_then(|p| p["slug"].as_str())
                .unwrap_or("")
                .to_string();
            out.push(Candidate {
                chain: m.chain_id,
                address: addr.to_lowercase(),
                protocol: m.protocol.clone(),
                slug,
                category: if m.kind == "vault" { "Vault".into() } else { "Yield".into() },
                name: m.name.clone(),
                asset: m.asset_address.clone().map(|a| a.to_lowercase()),
                from_index: true,
            });
        }
    }
    out
}

fn pad_addr(a: &str) -> String {
    format!("{:0>64}", a.trim_start_matches("0x").to_lowercase())
}
fn word(h: &str, i: usize) -> Option<&str> {
    let h = h.trim_start_matches("0x");
    h.get(i * 64..(i + 1) * 64)
}
/// A 256-bit word as a decimal string (balances can exceed u128 only in theory; this keeps every digit).
fn word_dec(w: &str) -> String {
    let mut digits: Vec<u32> = vec![0];
    for c in w.chars() {
        let mut carry = c.to_digit(16).unwrap_or(0);
        for d in digits.iter_mut() {
            let v = *d * 16 + carry;
            *d = v % 10;
            carry = v / 10;
        }
        while carry > 0 {
            digits.push(carry % 10);
            carry /= 10;
        }
    }
    let s: String = digits.iter().rev().map(|d| char::from_digit(*d, 10).unwrap()).collect();
    let t = s.trim_start_matches('0');
    if t.is_empty() { "0".into() } else { t.into() }
}
fn as_f64(dec: &str, decimals: u32) -> f64 {
    dec.parse::<f64>().unwrap_or(0.0) / 10f64.powi(decimals as i32)
}

/// eth_call for many (to, data) pairs on one chain: JSON-RPC batches of 40, one by one when a node refuses batches.
/// Each answer is the hex result, or None when that call failed.
async fn calls(http: &reqwest::Client, chain: i64, reqs: &[(String, String)]) -> Result<Vec<Option<String>>, String> {
    let url = crate::txstatus::rpc_for(chain).ok_or("no RPC")?;
    let mut out = vec![None; reqs.len()];
    for (ci, chunk) in reqs.chunks(40).enumerate() {
        let body: Vec<Value> = chunk
            .iter()
            .enumerate()
            .map(|(i, (to, data))| json!({ "jsonrpc": "2.0", "id": i, "method": "eth_call", "params": [{ "to": to, "data": data }, "latest"] }))
            .collect();
        let r = http.post(url).json(&body).timeout(Duration::from_secs(15)).send().await.map_err(|e| e.to_string())?;
        let v: Value = r.json().await.map_err(|e| e.to_string())?;
        if let Some(arr) = v.as_array() {
            for x in arr {
                if let (Some(i), Some(res)) = (x["id"].as_u64(), x["result"].as_str()) {
                    if res.len() > 2 {
                        out[ci * 40 + i as usize] = Some(res.to_string());
                    }
                }
            }
        } else {
            // No batch support: ask one at a time, a few in flight.
            let single = join_all(chunk.iter().map(|(to, data)| async move {
                let r: Option<Value> = async {
                    http.post(url)
                        .json(&json!({ "jsonrpc": "2.0", "id": 1, "method": "eth_call", "params": [{ "to": to, "data": data }, "latest"] }))
                        .timeout(Duration::from_secs(12))
                        .send()
                        .await
                        .ok()?
                        .json()
                        .await
                        .ok()
                }
                .await;
                r.and_then(|v| v["result"].as_str().filter(|s| s.len() > 2).map(String::from))
            }))
            .await;
            for (i, s) in single.into_iter().enumerate() {
                out[ci * 40 + i] = s;
            }
        }
    }
    Ok(out)
}

struct Holding {
    c: Candidate,
    raw: String,
    decimals: u32,
    symbol: String,
    /// For vaults: the asset amount the shares are worth, and the asset.
    underlying: Option<(String, String, u32, String)>, // (raw assets, asset address, asset decimals, asset symbol)
}

async fn scan_chain(http: &reqwest::Client, chain: i64, wallet: &str, cands: Vec<Candidate>) -> Result<Vec<Holding>, String> {
    let bal_data = format!("0x70a08231{}", pad_addr(wallet));
    let reqs: Vec<(String, String)> = cands.iter().map(|c| (c.address.clone(), bal_data.clone())).collect();
    let bals = calls(http, chain, &reqs).await?;
    let held: Vec<(Candidate, String)> = cands
        .into_iter()
        .zip(bals)
        .filter_map(|(c, b)| {
            let b = b?;
            if b.trim_start_matches("0x").len() != 64 {
                return None; // not an ERC-20 balance answer
            }
            let d = word_dec(word(&b, 0)?);
            (d != "0").then_some((c, d))
        })
        .collect();
    if held.is_empty() {
        return Ok(vec![]);
    }
    // decimals, symbol, asset() and convertToAssets(balance) for each holding.
    let mut reqs = Vec::new();
    for (c, raw) in &held {
        let amount = format!("{:0>64}", u128_hex(raw));
        reqs.push((c.address.clone(), "0x313ce567".to_string()));
        reqs.push((c.address.clone(), "0x95d89b41".to_string()));
        reqs.push((c.address.clone(), "0x38d52e0f".to_string()));
        reqs.push((c.address.clone(), format!("0x07a2d13a{amount}")));
    }
    let meta = calls(http, chain, &reqs).await?;
    let mut out = Vec::new();
    let mut assets_needed = Vec::new();
    for (i, (c, raw)) in held.into_iter().enumerate() {
        let decimals = meta[i * 4].as_deref().and_then(|h| word(h, 0)).map(|w| u32::from_str_radix(&w[56..], 16).unwrap_or(18)).unwrap_or(18);
        let symbol = meta[i * 4 + 1].as_deref().and_then(crate::swap::decode_string).unwrap_or_else(|| c.name.clone());
        let asset = meta[i * 4 + 2].as_deref().and_then(|h| word(h, 0)).map(|w| format!("0x{}", &w[24..])).or(c.asset.clone());
        let assets_raw = meta[i * 4 + 3].as_deref().and_then(|h| word(h, 0)).map(word_dec);
        let underlying = match (asset, assets_raw) {
            (Some(a), Some(r)) if a != "0x0000000000000000000000000000000000000000" => {
                assets_needed.push(a.clone());
                Some((r, a, 18, String::new()))
            }
            _ => None,
        };
        out.push(Holding { c, raw, decimals, symbol, underlying });
    }
    if !assets_needed.is_empty() {
        let reqs: Vec<(String, String)> = assets_needed.iter().flat_map(|a| [(a.clone(), "0x313ce567".to_string()), (a.clone(), "0x95d89b41".to_string())]).collect();
        let meta = calls(http, chain, &reqs).await.unwrap_or_default();
        let mut info: HashMap<String, (u32, String)> = HashMap::new();
        for (i, a) in assets_needed.iter().enumerate() {
            let d = meta.get(i * 2).cloned().flatten().as_deref().and_then(|h| word(h, 0).map(|w| u32::from_str_radix(&w[56..], 16).unwrap_or(18))).unwrap_or(18);
            let s = meta.get(i * 2 + 1).cloned().flatten().as_deref().and_then(crate::swap::decode_string).unwrap_or_default();
            info.insert(a.clone(), (d, s));
        }
        for h in out.iter_mut() {
            if let Some(u) = h.underlying.as_mut() {
                if let Some((d, s)) = info.get(&u.1) {
                    u.2 = *d;
                    u.3 = s.clone();
                }
            }
        }
    }
    Ok(out)
}

fn u128_hex(dec: &str) -> String {
    // Decimal string to hex (any length).
    let mut digits: Vec<u32> = vec![0];
    for c in dec.chars() {
        let mut carry = c.to_digit(10).unwrap_or(0);
        for d in digits.iter_mut() {
            let v = *d * 10 + carry;
            *d = v % 16;
            carry = v / 16;
        }
        while carry > 0 {
            digits.push(carry % 16);
            carry /= 16;
        }
    }
    digits.iter().rev().map(|d| char::from_digit(*d, 16).unwrap()).collect::<String>().trim_start_matches('0').to_string()
}

/// DefiLlama prices for (chain, address) pairs, in batches of 80.
async fn prices(http: &reqwest::Client, keys: &[(i64, String)]) -> HashMap<(i64, String), f64> {
    let ids: Vec<String> = keys.iter().filter_map(|(c, a)| llama_chain(*c).map(|s| format!("{s}:{a}"))).collect::<HashSet<_>>().into_iter().collect();
    let mut out = HashMap::new();
    let pages = join_all(ids.chunks(80).map(|chunk| {
        let url = format!("https://coins.llama.fi/prices/current/{}", chunk.join(","));
        async move { http.get(url).timeout(Duration::from_secs(12)).send().await.ok()?.json::<Value>().await.ok() }
    }))
    .await;
    let rev: HashMap<&str, i64> = keys.iter().filter_map(|(c, _)| llama_chain(*c).map(|s| (s, *c))).collect();
    for p in pages.into_iter().flatten() {
        for (k, v) in p["coins"].as_object().into_iter().flatten() {
            if let (Some((slug, addr)), Some(price)) = (k.split_once(':'), v["price"].as_f64()) {
                if let Some(c) = rev.get(slug) {
                    out.insert((*c, addr.to_lowercase()), price);
                }
            }
        }
    }
    out
}

/// Aave V3 on one chain: (supplied USD, borrowed USD, health factor).
async fn aave_account(http: &reqwest::Client, chain: i64, pool: &str, wallet: &str) -> Option<(f64, f64, Option<f64>)> {
    let h = crate::swap::eth_call(http, chain, pool, &format!("0xbf92857c{}", pad_addr(wallet)), None).await.ok()?;
    let usd = |i: usize| word(&h, i).map(word_dec).map(|d| as_f64(&d, 8)).unwrap_or(0.0);
    let (supplied, borrowed) = (usd(0), usd(1));
    if supplied == 0.0 && borrowed == 0.0 {
        return None;
    }
    let hf = (borrowed > 0.0).then(|| word(&h, 5).map(word_dec).map(|d| as_f64(&d, 18)).unwrap_or(0.0));
    Some((supplied, borrowed, hf))
}

fn r2(x: f64) -> Value {
    crate::pools::num((x * 100.0).round() / 100.0)
}
fn amount_text(x: f64) -> String {
    if x >= 1000.0 {
        format!("{x:.2}")
    } else if x >= 1.0 {
        format!("{x:.4}")
    } else {
        format!("{x:.6}")
    }
    .trim_end_matches('0')
    .trim_end_matches('.')
    .to_string()
}

fn kind_of(h: &Holding) -> &'static str {
    let sym = h.symbol.to_uppercase();
    if h.c.category == "Stablecoin Issuer" {
        "stablecoin"
    } else if GOV.contains(&sym.as_str()) || h.c.name.to_lowercase().ends_with(" token") {
        "token"
    } else if h.underlying.is_some() || h.c.category == "Vault" {
        "vault"
    } else if h.c.category.contains("Staking") || h.c.category.contains("Restaking") {
        "staked"
    } else {
        "deposit"
    }
}

static CACHE: OnceLock<Mutex<HashMap<String, (Instant, Value)>>> = OnceLock::new();

pub async fn wallet_portfolio(a: &Map<String, Value>, ctx: &Ctx<'_>) -> Result<Value, ToolError> {
    let raw = opt_str(a, "wallet")?.ok_or_else(|| bad("wallet is required"))?;
    if crate::solana::is_address(raw.trim()) {
        return crate::solana::portfolio(ctx.http, raw.trim()).await.map_err(ToolError);
    }
    let wallet = raw.to_lowercase();
    if wallet.len() != 42 || !wallet.starts_with("0x") || !wallet[2..].chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(bad("wallet must be a 0x address"));
    }
    let only: Option<HashSet<i64>> = opt_str(a, "chains")?.map(|s| s.split(',').filter_map(|c| crate::lite::token_chain_id(c.trim())).collect());
    let key = format!("{wallet}|{:?}", only.as_ref().map(|s| { let mut v: Vec<_> = s.iter().collect(); v.sort(); v }));
    let cache = CACHE.get_or_init(Default::default);
    let skip_cache = flag(a, "fresh");
    if let Some((t, v)) = cache.lock().ok().and_then(|m| m.get(&key).cloned()).filter(|_| !skip_cache) {
        if t.elapsed() < Duration::from_secs(CACHE_SECS) {
            return Ok(v);
        }
    }
    let http = ctx.http;
    let markets: Vec<crate::store::Market> = ctx.index.markets.read().await.values().cloned().collect();
    let mut by_chain: BTreeMap<i64, Vec<Candidate>> = BTreeMap::new();
    for c in candidates(ctx, &markets) {
        if only.as_ref().map(|o| o.contains(&c.chain)).unwrap_or(true) {
            by_chain.entry(c.chain).or_default().push(c);
        }
    }
    let unavailable: Vec<i64> = by_chain.keys().copied().filter(|c| crate::txstatus::rpc_for(*c).is_none()).collect();
    let checked_protocols: HashSet<String> = by_chain.values().flatten().filter(|c| !c.from_index).map(|c| c.slug.clone()).collect();
    let aave_pools: Vec<(i64, String)> = crate::registry::protocols()
        .iter()
        .filter(|p| p["slug"].as_str() == Some("aave-v3"))
        .flat_map(|p| p["contracts"].as_array().cloned().unwrap_or_default())
        .filter(|c| c["role"].as_str() == Some("pool"))
        .filter_map(|c| Some((c["chainId"].as_i64()?, c["address"].as_str()?.to_string())))
        .filter(|(c, _)| only.as_ref().map(|o| o.contains(c)).unwrap_or(true))
        .collect();

    // Smart scan: a full scan the first time (and once a day), then only the tokens the wallet held, and only on
    // chains where it sent a transaction since (its nonce moved). Chains with nothing held and no new transaction
    // cost one nonce read.
    let fresh = flag(a, "fresh");
    let now = chrono::Utc::now().timestamp();
    let mem = load_memory(ctx, &wallet).await;
    let live: Vec<i64> = by_chain.keys().copied().filter(|c| crate::txstatus::rpc_for(*c).is_some()).collect();
    let fetch_nonces = || {
        let live = live.clone();
        let w = wallet.clone();
        async move {
            join_all(live.iter().map(|c| {
                let w = w.clone();
                async move { (*c, nonce(http, *c, &w).await) }
            }))
            .await
            .into_iter()
            .collect::<HashMap<i64, Option<u64>>>()
        }
    };
    // With nothing remembered every chain is scanned anyway, so the nonces are read alongside the scan.
    let nonces_first = !mem.is_empty() && !fresh;
    let mut nonces: HashMap<i64, Option<u64>> = if nonces_first { fetch_nonces().await } else { HashMap::new() };
    let mut plan: Vec<(i64, Vec<Candidate>, bool)> = Vec::new();
    let mut lists: HashMap<i64, u64> = HashMap::new();
    let mut skipped = Vec::new();
    for (chain, cands) in by_chain {
        if crate::txstatus::rpc_for(chain).is_none() {
            continue;
        }
        let list = list_hash(&cands);
        let known = mem.get(&chain).filter(|m| {
            !fresh && m.list == list && now - m.scanned_at < FULL_EVERY_SECS && nonces.get(&chain).copied().flatten() == Some(m.nonce)
        });
        match known {
            None => {
                lists.insert(chain, list);
                plan.push((chain, cands, true))
            }
            Some(m) => {
                let held: Vec<Candidate> = cands.into_iter().filter(|c| m.held.contains(&c.address)).collect();
                if held.is_empty() {
                    skipped.push(chain);
                } else {
                    plan.push((chain, held, false));
                }
            }
        }
    }
    let full_chains: HashSet<i64> = plan.iter().filter(|p| p.2).map(|p| p.0).collect();
    let scans = join_all(plan.into_iter().map(|(chain, cands, full)| {
        let wallet = wallet.clone();
        async move { (chain, full, tokio::time::timeout(Duration::from_secs(25), scan_chain(http, chain, &wallet, cands)).await) }
    }));
    let aave = join_all(
        aave_pools
            .iter()
            .filter(|(c, _)| full_chains.contains(c) || mem.get(c).map(|m| m.aave).unwrap_or(false))
            .map(|(c, p)| {
                let w = wallet.clone();
                async move { (*c, aave_account(http, *c, p, &w).await) }
            }),
    );
    let (scans, aave, late) = futures::join!(scans, aave, async { if nonces_first { HashMap::new() } else { fetch_nonces().await } });
    nonces.extend(late);
    let aave_on: HashSet<i64> = aave.iter().filter(|(_, x)| x.is_some()).map(|(c, _)| *c).collect();

    let mut holdings = Vec::new();
    let mut scanned = Vec::new();
    let mut failed = Vec::new();
    let mut quick = Vec::new();
    let mut updates = Vec::new();
    for (chain, full, r) in scans {
        match r {
            Ok(Ok(h)) => {
                if full {
                    scanned.push(chain);
                    let held: HashSet<String> = h.iter().map(|x| x.c.address.clone()).collect();
                    if let Some(n) = nonces.get(&chain).copied().flatten() {
                        updates.push((chain, ChainMemory { nonce: n, held, aave: aave_on.contains(&chain), scanned_at: now, list: lists.get(&chain).copied().unwrap_or(0) }));
                    }
                } else {
                    quick.push(chain);
                }
                holdings.extend(h);
            }
            _ => failed.push(chain),
        }
    }
    save_memory(ctx, &wallet, updates).await;
    let mode = if full_chains.is_empty() { "quick" } else if quick.is_empty() && skipped.is_empty() { "full" } else { "mixed" };
    // Aave aTokens are counted through the account totals, not as loose tokens.
    let mut keys: Vec<(i64, String)> = Vec::new();
    for h in &holdings {
        keys.push((h.c.chain, h.c.address.clone()));
        if let Some(u) = &h.underlying {
            keys.push((h.c.chain, u.1.clone()));
        }
    }
    let px = prices(http, &keys).await;

    let mut groups: BTreeMap<String, (String, String, f64, Vec<Value>)> = BTreeMap::new();
    let mut by_kind: BTreeMap<&str, f64> = BTreeMap::new();
    let mut total = 0.0;
    for h in &holdings {
        let amount = as_f64(&h.raw, h.decimals);
        let under = h.underlying.as_ref().map(|u| (as_f64(&u.0, u.2), u));
        // Vault shares are valued from the underlying they convert to; other tokens from their own price.
        let usd = under.and_then(|(amt, u)| px.get(&(h.c.chain, u.1.clone())).map(|p| p * amt)).or_else(|| px.get(&(h.c.chain, h.c.address.clone())).map(|p| p * amount));
        // A token worth less than a cent is dust, and unpriced spam is hidden too.
        if usd.map(|u| u < 0.01).unwrap_or(h.c.from_index) {
            continue;
        }
        let kind = kind_of(h);
        if let Some(u) = usd {
            total += u;
            *by_kind.entry(kind).or_default() += u;
        }
        let mut pos = json!({
            "chainId": h.c.chain, "chain": chain_label(h.c.chain), "kind": kind, "name": h.c.name, "symbol": h.symbol,
            "address": h.c.address, "amount": amount_text(amount), "usd": usd.map(r2),
        });
        if let Some((amt, u)) = under {
            if !u.3.is_empty() && !u.3.eq_ignore_ascii_case(&h.symbol) {
                pos["underlying"] = json!({ "symbol": u.3, "amount": amount_text(amt), "address": u.1 });
            }
        }
        let g = groups.entry(h.c.protocol.clone()).or_insert_with(|| (h.c.slug.clone(), h.c.category.clone(), 0.0, vec![]));
        g.2 += usd.unwrap_or(0.0);
        g.3.push(pos);
    }
    let mut debt = 0.0;
    let mut aave_rows = Vec::new();
    for (chain, acct) in aave {
        if let Some((sup, bor, hf)) = acct {
            total += sup;
            debt += bor;
            *by_kind.entry("lent").or_default() += sup;
            aave_rows.push(json!({
                "chainId": chain, "chain": chain_label(chain), "kind": "lent", "name": "Aave V3 account", "suppliedUsd": r2(sup), "borrowedUsd": r2(bor),
                "healthFactor": hf.map(|h| r2(h.min(1e6))), "usd": r2(sup - bor),
            }));
        }
    }
    if !aave_rows.is_empty() {
        let g = groups.entry("Aave V3".into()).or_insert_with(|| ("aave-v3".into(), "Lending".into(), 0.0, vec![]));
        g.2 += aave_rows.iter().filter_map(|r| r["usd"].as_f64()).sum::<f64>();
        g.3.extend(aave_rows);
    }
    let mut protocols: Vec<Value> = groups
        .into_iter()
        .map(|(name, (slug, category, usd, mut positions))| {
            positions.sort_by(|a, b| b["usd"].as_f64().unwrap_or(0.0).total_cmp(&a["usd"].as_f64().unwrap_or(0.0)));
            json!({ "protocol": name, "slug": slug, "category": category, "usd": r2(usd), "positions": positions })
        })
        .collect();
    protocols.sort_by(|a, b| b["usd"].as_f64().unwrap_or(0.0).total_cmp(&a["usd"].as_f64().unwrap_or(0.0)));

    let all: Vec<&Value> = crate::registry::protocols().iter().collect();
    let non_evm: Vec<&str> = all
        .iter()
        .filter(|p| !p["contracts"].as_array().into_iter().flatten().any(|c| c["chainId"].as_i64().is_some()))
        .filter_map(|p| p["name"].as_str())
        .collect();
    let pending: Vec<Value> = NOT_YET.iter().map(|(s, why)| json!({ "protocol": all.iter().find(|p| p["slug"].as_str() == Some(s)).and_then(|p| p["name"].as_str()).unwrap_or(s), "status": why })).collect();
    scanned.sort();
    failed.sort();
    let r = json!({
        "wallet": wallet,
        "totalUsd": r2(total), "debtUsd": r2(debt), "netUsd": r2(total - debt),
        "byKind": by_kind.into_iter().map(|(k, v)| (k.to_string(), r2(v))).collect::<Map<String, Value>>(),
        "protocols": protocols,
        "coverage": {
            "mode": mode,
            "chainsScanned": scanned.iter().map(|c| json!({ "chainId": c, "chain": chain_label(*c) })).collect::<Vec<_>>(),
            "chainsRechecked": quick.iter().map(|c| json!({ "chainId": c, "chain": chain_label(*c) })).collect::<Vec<_>>(),
            "chainsSkipped": skipped.len(),
            "howItWorks": "First look: every protocol on every chain. After that, only what the wallet held, re-scanning a chain fully when the wallet sends a transaction there, and everything once a day. Pass fresh=true to scan everything now.",
            "chainsFailed": failed.iter().chain(unavailable.iter()).map(|c| json!({ "chainId": c, "chain": chain_label(*c) })).collect::<Vec<_>>(),
            "protocolsChecked": checked_protocols.len() + usize::from(!aave_pools.is_empty() && !checked_protocols.contains("aave-v3")),
            "vaultsChecked": markets.iter().filter(|m| m.kind != "lend" && m.address.as_deref().map(|a| a.len() == 42).unwrap_or(false)).count(),
            "otherBlockchains": non_evm,
            "notReadHereYet": pending,
        },
        "kinds": { "lent": "supplied to a lending market (Aave: net of borrowing in usd)", "vault": "shares of a vault, worth the underlying shown", "staked": "liquid staking or restaking tokens", "deposit": "a protocol's yield or savings token", "stablecoin": "stablecoins held", "token": "the protocol's own token" },
        "notes": ["Public on-chain data, read-only. Values from DefiLlama prices; unpriced dust is hidden.", "LP positions are in wallet_positions."],
    });
    if let Ok(mut m) = cache.lock() {
        m.retain(|_, (t, _)| t.elapsed() < Duration::from_secs(CACHE_SECS));
        m.insert(key, (Instant::now(), r.clone()));
    }
    Ok(r)
}

pub fn definitions(read: &Value) -> Vec<Value> {
    vec![json!({
        "name": "wallet_portfolio",
        "title": "Everything a wallet holds in DeFi",
        "description": "What a wallet holds across the protocols BTB supports, on every EVM chain they run on (about 36), or on Solana for a Solana address (SOL, tokens, Jupiter, Meteora, STKESOL, Pump coins and Pump creator fees to claim): Aave supplied and borrowed with the health factor, Morpho and other vault shares with the underlying, liquid staking and restaking (Lido, Rocket Pool, Renzo, Origin, StakeStone), Ethena, Sky, Usual, Maple, Falcon, Inverse, Olympus and more, stablecoins and protocol tokens. Grouped by protocol with USD values, totals by kind, and which chains were scanned. LP positions are in wallet_positions. Remembers which protocols each wallet uses, so later looks are fast. Public on-chain data, read-only; cached a minute.",
        "inputSchema": { "type": "object", "properties": {
            "wallet": { "type": "string", "pattern": "^(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$", "description": "An EVM address (0x...) or a Solana address." },
            "fresh": { "type": "boolean", "description": "Scan every protocol on every chain now instead of only what the wallet used (default false)." },
            "chains": { "type": "string", "description": "Optional comma-separated chains to limit the scan, e.g. \"base,ethereum\". Default: every chain." }
        }, "required": ["wallet"] },
        "annotations": read,
    })]
}

// ---- what each wallet uses, remembered ----

const FULL_EVERY_SECS: i64 = 86_400;

#[derive(Clone)]
pub struct ChainMemory {
    nonce: u64,
    /// Candidate token addresses the wallet held at the last full scan.
    held: HashSet<String>,
    aave: bool,
    scanned_at: i64,
    /// Which candidate list the full scan used: new vaults or registry tokens on the chain mean a new full scan.
    list: u64,
}

fn list_hash(cands: &[Candidate]) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut v: Vec<&str> = cands.iter().map(|c| c.address.as_str()).collect();
    v.sort_unstable();
    let mut h = std::collections::hash_map::DefaultHasher::new();
    v.hash(&mut h);
    h.finish()
}

fn flag(a: &Map<String, Value>, k: &str) -> bool {
    match a.get(k) {
        Some(Value::Bool(b)) => *b,
        Some(Value::String(s)) => s == "true" || s == "1",
        _ => false,
    }
}

static MEMORY: OnceLock<Mutex<HashMap<String, HashMap<i64, ChainMemory>>>> = OnceLock::new();

const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS wallet_chains (
  wallet text NOT NULL, chain_id bigint NOT NULL, nonce bigint NOT NULL, held jsonb NOT NULL, aave boolean NOT NULL,
  scanned_at bigint NOT NULL, list bigint NOT NULL DEFAULT 0, PRIMARY KEY (wallet, chain_id))";

async fn load_memory(ctx: &Ctx<'_>, wallet: &str) -> HashMap<i64, ChainMemory> {
    let map = MEMORY.get_or_init(Default::default);
    if let Some(m) = map.lock().ok().and_then(|m| m.get(wallet).cloned()) {
        return m;
    }
    let mut out = HashMap::new();
    if let Some(db) = &ctx.index.db {
        static READY: tokio::sync::OnceCell<()> = tokio::sync::OnceCell::const_new();
        READY.get_or_init(|| async { let _ = sqlx::query(SCHEMA).execute(db).await; }).await;
        let rows: Vec<(i64, i64, serde_json::Value, bool, i64, i64)> =
            sqlx::query_as("SELECT chain_id, nonce, held, aave, scanned_at, list FROM wallet_chains WHERE wallet = $1").bind(wallet).fetch_all(db).await.unwrap_or_default();
        for (chain, nonce, held, aave, scanned_at, list) in rows {
            let held = held.as_array().into_iter().flatten().filter_map(|x| x.as_str().map(String::from)).collect();
            out.insert(chain, ChainMemory { nonce: nonce as u64, held, aave, scanned_at, list: list as u64 });
        }
    }
    if let Ok(mut m) = map.lock() {
        m.insert(wallet.to_string(), out.clone());
    }
    out
}

async fn save_memory(ctx: &Ctx<'_>, wallet: &str, updates: Vec<(i64, ChainMemory)>) {
    if updates.is_empty() {
        return;
    }
    if let Ok(mut m) = MEMORY.get_or_init(Default::default).lock() {
        let w = m.entry(wallet.to_string()).or_default();
        for (c, mem) in &updates {
            w.insert(*c, mem.clone());
        }
    }
    if let Some(db) = &ctx.index.db {
        let _ = sqlx::query(SCHEMA).execute(db).await;
        for (chain, m) in updates {
            let held: Vec<&String> = m.held.iter().collect();
            let _ = sqlx::query(
                "INSERT INTO wallet_chains (wallet, chain_id, nonce, held, aave, scanned_at, list) VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (wallet, chain_id) DO UPDATE SET nonce = $3, held = $4, aave = $5, scanned_at = $6, list = $7",
            )
            .bind(wallet)
            .bind(chain)
            .bind(m.nonce as i64)
            .bind(json!(held))
            .bind(m.aave)
            .bind(m.scanned_at)
            .bind(m.list as i64)
            .execute(db)
            .await;
        }
    }
}

async fn nonce(http: &reqwest::Client, chain: i64, wallet: &str) -> Option<u64> {
    let url = crate::txstatus::rpc_for(chain)?;
    let v: Value = http
        .post(url)
        .json(&json!({ "jsonrpc": "2.0", "id": 1, "method": "eth_getTransactionCount", "params": [wallet, "latest"] }))
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;
    u64::from_str_radix(v["result"].as_str()?.trim_start_matches("0x"), 16).ok()
}
