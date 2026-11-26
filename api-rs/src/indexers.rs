//! Background jobs that fill the yield index (src/store.rs): Morpho vaults from Morpho's REST API, Aave V3 reserves
//! read from Aave's own contracts, and the other lending, savings and staking markets from DefiLlama's yields feed.
//! Every job replaces its own source as a whole, so a market that disappears upstream disappears here too.

use crate::store::{Index, Market};
use futures::stream::{self, StreamExt};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Duration;

fn now() -> i64 {
    chrono::Utc::now().timestamp()
}

fn chain_name(id: i64) -> &'static str {
    match id {
        1 => "Ethereum", 8453 => "Base", 56 => "BNB Chain", 42161 => "Arbitrum", 10 => "Optimism", 137 => "Polygon",
        43114 => "Avalanche", 130 => "Unichain", 4663 => "Robinhood Chain", 999 => "HyperEVM", 143 => "Monad", 5042 => "Arc",
        _ => "Other",
    }
}

/// Runs `job` now and then every `every`, logging how it went.
pub fn every<F, Fut>(name: &'static str, every: Duration, job: F)
where
    F: Fn() -> Fut + Send + 'static,
    Fut: std::future::Future<Output = anyhow::Result<usize>> + Send,
{
    tokio::spawn(async move {
        loop {
            let started = std::time::Instant::now();
            match job().await {
                Ok(n) => tracing::info!(job = name, markets = n, ms = started.elapsed().as_millis() as u64, "indexed"),
                Err(e) => tracing::warn!(job = name, error = %e, "index job failed; keeping the last markets"),
            }
            tokio::time::sleep(every).await;
        }
    });
}

// ---- Morpho vaults (api.morpho.org REST; the GraphQL API shuts down in January 2027) ----

const MORPHO: &str = "https://api.morpho.org";
const MORPHO_CHAINS: &[i64] = &[1, 8453, 42161, 10, 137, 130, 4663, 999];

async fn get_json(http: &reqwest::Client, url: &str) -> anyhow::Result<Value> {
    let r = http.get(url).timeout(Duration::from_secs(20)).send().await?;
    if !r.status().is_success() {
        anyhow::bail!("{url}: HTTP {}", r.status());
    }
    Ok(r.json().await?)
}

/// Every listed vault (V1 and V2) on our chains, with its live size and 1-day and 7-day APY.
pub async fn morpho(index: &Index, http: &reqwest::Client) -> anyhow::Result<usize> {
    // The list routes return only vaults Morpho lists, which is the verification we want.
    let mut vaults: Vec<(String, i64, String)> = Vec::new(); // (version, chain, address)
    for version in ["v1", "v2"] {
        let mut cursor: Option<String> = None;
        for _page in 0..20 {
            let chains = MORPHO_CHAINS.iter().map(|c| c.to_string()).collect::<Vec<_>>().join(",");
            let url = format!("{MORPHO}/v0/vaults-{version}?chain_ids={chains}&limit=100{}", cursor.as_ref().map(|c| format!("&cursor={c}")).unwrap_or_default());
            let page = get_json(http, &url).await?;
            let rows = page["data"].as_array().cloned().unwrap_or_default();
            for v in &rows {
                if let (Some(c), Some(a)) = (v["chain_id"].as_i64(), v["vault_address"].as_str()) {
                    vaults.push((version.to_string(), c, a.to_string()));
                }
            }
            cursor = page["cursor"].as_str().map(String::from);
            if cursor.is_none() || rows.is_empty() {
                break;
            }
        }
    }
    if vaults.is_empty() {
        anyhow::bail!("Morpho listed no vaults");
    }
    // Asset prices, one call per asset.
    let prices: tokio::sync::Mutex<HashMap<String, f64>> = Default::default();
    let fresh: Vec<Market> = stream::iter(vaults)
        .map(|(version, chain, address)| {
            let prices = &prices;
            async move {
                let id = format!("{chain}:{address}");
                // V1 and V2 keep their routes under different API versions.
                let (detail_v, state_v, apy_v) = if version == "v1" { ("v0", "v0", "v0") } else { ("v0", "v1", "v1") };
                let detail = get_json(http, &format!("{MORPHO}/{detail_v}/vaults-{version}/{id}")).await.ok()?;
                let d = &detail["data"];
                let asset = &d["asset"];
                let decimals = asset["decimals"].as_i64().unwrap_or(18) as i32;
                let asset_address = asset["address"].as_str()?.to_string();
                let state = get_json(http, &format!("{MORPHO}/{state_v}/vaults-{version}/{id}/state")).await.ok()?;
                let total: f64 = state["data"]["total_assets"].as_str().and_then(|s| s.parse().ok()).unwrap_or(0.0);
                let apy = |lb: &'static str| {
                    let url = format!("{MORPHO}/{apy_v}/vaults-{version}/{id}/apy-averages?lookback={lb}");
                    async move { get_json(http, &url).await.ok().and_then(|v| v["data"]["apy"].as_f64()).map(|x| x * 100.0) }
                };
                let (a1, a7) = futures::join!(apy("one_day"), apy("seven_days"));
                let price = {
                    let key = format!("{chain}:{asset_address}");
                    let cached = prices.lock().await.get(&key).copied();
                    match cached {
                        Some(p) => p,
                        None => {
                            let p = get_json(http, &format!("{MORPHO}/v0/tokens/{key}/price")).await.ok().and_then(|v| v["data"]["price"].as_f64()).unwrap_or(0.0);
                            prices.lock().await.insert(key, p);
                            p
                        }
                    }
                };
                let tvl = total / 10f64.powi(decimals) * price;
                let base = a1.or(a7)?;
                Some(Market {
                    id: format!("vault:{chain}:{}", address.to_lowercase()),
                    kind: "vault".into(),
                    chain_id: chain,
                    chain: chain_name(chain).into(),
                    protocol: "Morpho".into(),
                    name: d["name"].as_str().unwrap_or("Morpho vault").to_string(),
                    address: Some(address.to_lowercase()),
                    asset_symbol: asset["symbol"].as_str().unwrap_or("?").to_string(),
                    asset_address: Some(asset_address.to_lowercase()),
                    curator: d["curator"].as_str().map(|c| c.to_lowercase()),
                    tvl_usd: tvl,
                    apy_base: base,
                    apy_reward: 0.0,
                    apy_1d: a1,
                    apy_7d: a7,
                    apy_30d: None,
                    listed: true,
                    source: "morpho".into(),
                    updated_at: now(),
                })
            }
        })
        .buffer_unordered(6)
        .filter_map(|x| async move { x })
        .collect()
        .await;
    let n = fresh.len();
    index.replace_source("morpho", fresh).await;
    Ok(n)
}

// ---- Aave V3: reserves read from the Pool on each chain (public RPCs, no keys) ----

/// (chainId, Pool address from the BTB registry, public RPC, DefiLlama price chain name)
const AAVE: &[(i64, &str, &str, &str)] = &[
    (1, "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", "https://ethereum-rpc.publicnode.com", "ethereum"),
    (8453, "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", "https://base-rpc.publicnode.com", "base"),
    (42161, "0x794a61358D6845594F94dc1DB02A252b5b4814aD", "https://arbitrum-one-rpc.publicnode.com", "arbitrum"),
    (10, "0x794a61358D6845594F94dc1DB02A252b5b4814aD", "https://optimism-rpc.publicnode.com", "optimism"),
    (137, "0x794a61358D6845594F94dc1DB02A252b5b4814aD", "https://polygon-bor-rpc.publicnode.com", "polygon"),
    (43114, "0x794a61358D6845594F94dc1DB02A252b5b4814aD", "https://avalanche-c-chain-rpc.publicnode.com", "avax"),
    (56, "0x6807dc923806fE8Fd134338EABCA509979a7e0cB", "https://bsc-rpc.publicnode.com", "bsc"),
];

/// Many eth_calls in one JSON-RPC batch. Returns each call's hex result (None on error).
async fn eth_calls(http: &reqwest::Client, rpc: &str, calls: &[(String, String)]) -> anyhow::Result<Vec<Option<String>>> {
    let mut out = vec![None; calls.len()];
    for (chunk_i, chunk) in calls.chunks(40).enumerate() {
        let body: Vec<Value> = chunk
            .iter()
            .enumerate()
            .map(|(i, (to, data))| json!({ "jsonrpc": "2.0", "id": chunk_i * 40 + i, "method": "eth_call", "params": [{ "to": to, "data": data }, "latest"] }))
            .collect();
        let r: Value = http.post(rpc).json(&body).timeout(Duration::from_secs(20)).send().await?.json().await?;
        for item in r.as_array().cloned().unwrap_or_default() {
            if let (Some(id), Some(res)) = (item["id"].as_u64(), item["result"].as_str()) {
                if let Some(slot) = out.get_mut(id as usize) {
                    *slot = Some(res.to_string());
                }
            }
        }
    }
    Ok(out)
}

fn words(hex: &str) -> Vec<&str> {
    let h = hex.trim_start_matches("0x");
    (0..h.len() / 64).map(|i| &h[i * 64..(i + 1) * 64]).collect()
}
fn word_u128(w: &str) -> f64 {
    // Rates fit in 128 bits; f64 keeps enough precision for an APY.
    u128::from_str_radix(&w[w.len().saturating_sub(32)..], 16).map(|x| x as f64).unwrap_or(0.0)
}
fn word_addr(w: &str) -> String {
    format!("0x{}", &w[24..])
}
/// An ERC-20 symbol: an ABI string, or bytes32 for a few old tokens.
fn decode_symbol(hex: &str) -> String {
    let w = words(hex);
    let bytes = |h: &str| (0..h.len() / 2).filter_map(|i| u8::from_str_radix(&h[i * 2..i * 2 + 2], 16).ok()).collect::<Vec<u8>>();
    if w.len() >= 3 {
        let len = u128::from_str_radix(w[1], 16).unwrap_or(0) as usize;
        let data: String = w[2..].concat();
        let b = bytes(&data);
        return String::from_utf8_lossy(&b[..len.min(b.len())]).to_string();
    }
    if let Some(first) = w.first() {
        return String::from_utf8_lossy(&bytes(first)).trim_end_matches('\0').to_string();
    }
    "?".into()
}
fn pad_addr(a: &str) -> String {
    format!("{:0>64}", a.trim_start_matches("0x").to_lowercase())
}
const SECONDS_PER_YEAR: f64 = 31_536_000.0;
fn ray_apy_pct(rate: f64) -> f64 {
    ((1.0 + rate / 1e27 / SECONDS_PER_YEAR).powf(SECONDS_PER_YEAR) - 1.0) * 100.0
}

async fn aave_chain(http: &reqwest::Client, chain: i64, pool: &str, rpc: &str, price_chain: &str) -> anyhow::Result<Vec<Market>> {
    // getReservesList()
    let list = eth_calls(http, rpc, &[(pool.to_string(), "0xd1946dbc".into())]).await?;
    let list = list.first().cloned().flatten().ok_or_else(|| anyhow::anyhow!("getReservesList failed"))?;
    let w = words(&list);
    let n = w.get(1).map(|x| u128::from_str_radix(x, 16).unwrap_or(0) as usize).unwrap_or(0);
    let assets: Vec<String> = w.iter().skip(2).take(n).map(|x| word_addr(x)).collect();
    // getReserveData(asset), symbol(), decimals() for each asset.
    let mut calls = Vec::new();
    for a in &assets {
        calls.push((pool.to_string(), format!("0x35ea6a75{}", pad_addr(a))));
        calls.push((a.clone(), "0x95d89b41".into()));
        calls.push((a.clone(), "0x313ce567".into()));
    }
    let res = eth_calls(http, rpc, &calls).await?;
    // aToken totalSupply() for the size of each market.
    let mut reserves = Vec::new();
    for (i, a) in assets.iter().enumerate() {
        let Some(rd) = res[i * 3].clone() else { continue };
        let rw = words(&rd);
        if rw.len() < 9 {
            continue;
        }
        let cfg = u128::from_str_radix(&rw[0][rw[0].len() - 32..], 16).unwrap_or(0);
        let bit = |n: u32| (cfg >> n) & 1 == 1;
        let (active, frozen, paused) = (bit(56), bit(57), bit(60));
        let symbol = res[i * 3 + 1].as_deref().map(decode_symbol).unwrap_or_else(|| "?".into());
        let decimals = res[i * 3 + 2].as_deref().map(|h| word_u128(words(h).first().copied().unwrap_or("0")) as i32).unwrap_or(18);
        reserves.push((a.clone(), symbol, decimals, word_u128(rw[2]), word_addr(rw[8]), active && !frozen && !paused));
    }
    let supply = eth_calls(http, rpc, &reserves.iter().map(|r| (r.4.clone(), "0x18160ddd".to_string())).collect::<Vec<_>>()).await?;
    // USD prices from DefiLlama's price API, all assets in one call.
    let keys = reserves.iter().map(|r| format!("{price_chain}:{}", r.0)).collect::<Vec<_>>().join(",");
    let prices = get_json(http, &format!("https://coins.llama.fi/prices/current/{keys}")).await.unwrap_or(Value::Null);
    let mut out = Vec::new();
    for (i, (asset, symbol, decimals, rate, _atoken, open)) in reserves.into_iter().enumerate() {
        if !open {
            continue;
        }
        let total = supply[i].as_deref().map(|h| word_u128(words(h).first().copied().unwrap_or("0"))).unwrap_or(0.0);
        let price = prices["coins"][format!("{price_chain}:{asset}")]["price"].as_f64().unwrap_or(0.0);
        out.push(Market {
            id: format!("lend:{chain}:aave-v3:{asset}"),
            kind: "lend".into(),
            chain_id: chain,
            chain: chain_name(chain).into(),
            protocol: "Aave V3".into(),
            name: format!("Aave V3 {symbol}"),
            address: Some(pool.to_lowercase()),
            asset_symbol: symbol,
            asset_address: Some(asset),
            curator: None,
            tvl_usd: total / 10f64.powi(decimals) * price,
            apy_base: ray_apy_pct(rate),
            apy_reward: 0.0,
            apy_1d: None,
            apy_7d: None,
            apy_30d: None,
            listed: true,
            source: "aave".into(),
            updated_at: now(),
        });
    }
    Ok(out)
}

pub async fn aave(index: &Index, http: &reqwest::Client) -> anyhow::Result<usize> {
    let all = futures::future::join_all(AAVE.iter().map(|(c, p, r, pc)| aave_chain(http, *c, p, r, pc))).await;
    let mut fresh = Vec::new();
    for (res, (chain, ..)) in all.into_iter().zip(AAVE) {
        match res {
            Ok(m) => fresh.extend(m),
            Err(e) => tracing::warn!(chain, error = %e, "aave chain skipped"),
        }
    }
    if fresh.is_empty() {
        anyhow::bail!("no Aave reserves read");
    }
    let n = fresh.len();
    index.replace_source("aave", fresh).await;
    Ok(n)
}

// ---- Everything else: DefiLlama yields (no contract addresses there) ----

/// DefiLlama project → (name, kind). Aave V3 and Morpho come from their own sources above.
fn llama_project(p: &str) -> Option<(&'static str, &'static str)> {
    Some(match p {
        "compound-v3" => ("Compound V3", "lend"),
        "sparklend" => ("SparkLend", "lend"),
        "spark-savings" => ("Spark Savings", "savings"),
        "euler-v2" => ("Euler", "lend"),
        "fluid-lending" => ("Fluid", "lend"),
        "moonwell-lending" => ("Moonwell", "lend"),
        "venus-core-pool" => ("Venus", "lend"),
        "silo-v2" => ("Silo", "lend"),
        "aave-v4" => ("Aave V4", "lend"),
        "lido" => ("Lido", "stake"),
        "ether.fi-stake" => ("ether.fi", "stake"),
        "rocket-pool" => ("Rocket Pool", "stake"),
        "coinbase-wrapped-staked-eth" => ("Coinbase", "stake"),
        "binance-staked-eth" => ("Binance", "stake"),
        "kelp" => ("Kelp", "stake"),
        "renzo" => ("Renzo", "stake"),
        "frax-ether" => ("Frax", "stake"),
        "stakewise-v3" => ("StakeWise", "stake"),
        "meth-protocol" => ("Mantle", "stake"),
        "liquid-collective" => ("Liquid Collective", "stake"),
        _ => return None,
    })
}

fn llama_chain_id(c: &str) -> i64 {
    match c {
        "Ethereum" => 1, "Base" => 8453, "BSC" => 56, "Arbitrum" => 42161, "OP Mainnet" => 10, "Polygon" => 137,
        "Avalanche" => 43114, "Unichain" => 130, "Robinhood Chain" => 4663, "Monad" => 143, _ => 0,
    }
}

pub async fn llama(index: &Index, http: &reqwest::Client) -> anyhow::Result<usize> {
    let r = http.get("https://yields.llama.fi/pools").timeout(Duration::from_secs(60)).send().await?;
    let body: Value = r.json().await?;
    let mut fresh = Vec::new();
    for p in body["data"].as_array().cloned().unwrap_or_default() {
        let Some((name, kind)) = p["project"].as_str().and_then(llama_project) else { continue };
        if p["exposure"].as_str() != Some("single") || p["outlier"].as_bool() == Some(true) {
            continue;
        }
        let chain = llama_chain_id(p["chain"].as_str().unwrap_or(""));
        let tvl = p["tvlUsd"].as_f64().unwrap_or(0.0);
        if chain == 0 || tvl < 100_000.0 {
            continue;
        }
        let symbol = p["symbol"].as_str().unwrap_or("?").to_string();
        let meta = p["poolMeta"].as_str();
        fresh.push(Market {
            id: format!("{kind}:{chain}:llama:{}", p["pool"].as_str().unwrap_or("")),
            kind: kind.into(),
            chain_id: chain,
            chain: chain_name(chain).into(),
            protocol: name.into(),
            name: meta.map(|m| format!("{name} {symbol} ({m})")).unwrap_or_else(|| format!("{name} {symbol}")),
            address: None,
            asset_symbol: symbol,
            asset_address: p["underlyingTokens"].as_array().and_then(|a| a.first()).and_then(|x| x.as_str()).map(|s| s.to_lowercase()),
            curator: None,
            tvl_usd: tvl,
            apy_base: p["apyBase"].as_f64().or(p["apy"].as_f64()).unwrap_or(0.0),
            apy_reward: p["apyReward"].as_f64().unwrap_or(0.0),
            apy_1d: None,
            apy_7d: None,
            apy_30d: p["apyMean30d"].as_f64(),
            listed: false,
            source: "llama".into(),
            updated_at: now(),
        });
    }
    let n = fresh.len();
    index.replace_source("llama", fresh).await;
    Ok(n)
}
