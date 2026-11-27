//! lending_rates and staking_rates from DefiLlama's yields feed, kept 30 minutes. A port of src/lib/mcp/lending.ts:
//! same filters, same order, same JSON.

use crate::pools::{js_round, num};
use crate::tools::{limit, opt_num, opt_str, ToolError};
use serde_json::{json, Map, Value};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const PROJECTS: &[(&str, &str)] = &[
    ("aave-v3", "Aave V3"), ("aave-v4", "Aave V4"), ("compound-v3", "Compound V3"), ("compound-v2", "Compound V2"), ("morpho-blue", "Morpho"),
    ("sparklend", "SparkLend"), ("spark-savings", "Spark Savings"), ("euler-v2", "Euler"), ("fluid-lending", "Fluid"), ("moonwell-lending", "Moonwell"),
    ("venus-core-pool", "Venus"), ("silo-v2", "Silo"), ("kamino-lend", "Kamino"),
];
/// project → (name, token, aliases), in the TypeScript file's order.
const STAKING: &[(&str, &str, &str, &[&str])] = &[
    ("lido", "Lido", "stETH", &["steth", "wsteth"]),
    ("ether.fi-stake", "ether.fi", "weETH", &["eeth", "weeth"]),
    ("binance-staked-eth", "Binance", "wBETH", &["wbeth"]),
    ("rocket-pool", "Rocket Pool", "rETH", &["reth"]),
    ("coinbase-wrapped-staked-eth", "Coinbase", "cbETH", &["cbeth"]),
    ("kelp", "Kelp", "rsETH", &["rseth", "wrseth"]),
    ("liquid-collective", "Liquid Collective", "LsETH", &["lseth"]),
    ("meth-protocol", "Mantle", "mETH", &["meth", "cmeth"]),
    ("stakewise-v3", "StakeWise", "osETH", &["oseth"]),
    ("renzo", "Renzo", "ezETH", &["ezeth"]),
    ("frax-ether", "Frax", "sfrxETH", &["sfrxeth", "frxeth"]),
    ("swell-liquid-staking", "Swell", "swETH", &["sweth"]),
    ("stader", "Stader", "ETHx", &["ethx"]),
];
const REGISTRY: &[(&str, &str)] = &[("aave-v3", "aave-v3"), ("morpho-blue", "morpho")];

fn project_name(p: &str) -> Option<&'static str> {
    PROJECTS.iter().find(|(k, _)| *k == p).map(|(_, n)| *n)
}
fn staking(p: &str) -> Option<&'static (&'static str, &'static str, &'static str, &'static [&'static str])> {
    STAKING.iter().find(|s| s.0 == p)
}
fn norm(s: &str) -> String {
    s.to_lowercase().chars().filter(|c| c.is_ascii_alphanumeric()).collect()
}
fn chain_norm(c: &str) -> String {
    let n = norm(c);
    match n.as_str() {
        "eth" | "mainnet" | "1" => "ethereum", "8453" => "base", "bsc" | "bnb" | "bnbchain" | "56" => "bsc",
        "arb" | "42161" => "arbitrum", "op" | "optimism" | "10" => "opmainnet", "robinhood" | "4663" => "robinhoodchain",
        "matic" | "137" => "polygon", "avax" | "43114" => "avalanche", "130" => "unichain",
        _ => return n,
    }
    .to_string()
}
fn r2(v: &Value) -> Value {
    v.as_f64().map(|x| num(js_round(x * 100.0) / 100.0)).unwrap_or(Value::Null)
}

#[derive(Clone, Default)]
pub struct Feed(Arc<Mutex<Option<(Instant, Arc<Vec<Value>>)>>>);

impl Feed {
    async fn rows(&self, http: &reqwest::Client) -> Result<Arc<Vec<Value>>, ToolError> {
        let mut g = self.0.lock().await;
        if let Some((at, rows)) = g.as_ref() {
            if at.elapsed() < Duration::from_secs(1800) {
                return Ok(rows.clone());
            }
        }
        let body: Value = http
            .get("https://yields.llama.fi/pools")
            .timeout(Duration::from_secs(20))
            .send()
            .await
            .map_err(|e| ToolError(format!("rates feed: {e}")))?
            .json()
            .await
            .map_err(|e| ToolError(format!("rates feed: {e}")))?;
        // Single-asset rows of the lending and liquid-staking projects only.
        let rows: Vec<Value> = body["data"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|p| {
                let pr = p["project"].as_str().unwrap_or("");
                (project_name(pr).is_some() || staking(pr).is_some()) && p["exposure"].as_str() == Some("single") && p["apy"].is_number()
            })
            .cloned()
            .collect();
        let rows = Arc::new(rows);
        *g = Some((Instant::now(), rows.clone()));
        Ok(rows)
    }
}

pub async fn lending(a: &Map<String, Value>, feed: &Feed, http: &reqwest::Client) -> Result<Value, ToolError> {
    let token = opt_str(a, "token")?.map(|t| t.trim().to_lowercase());
    let chain = opt_str(a, "chain")?.map(|c| chain_norm(&c));
    let proto = opt_str(a, "protocol")?.map(|p| norm(&p));
    let min_tvl = opt_num(a, "minTvlUsd")?.unwrap_or(1_000_000.0);
    let n = limit(a, 50.0, 15)?;
    let rows = feed.rows(http).await?;
    let mut hits: Vec<&Value> = rows
        .iter()
        .filter(|p| project_name(p["project"].as_str().unwrap_or("")).is_some())
        .filter(|p| chain.as_ref().map_or(true, |c| &chain_norm(p["chain"].as_str().unwrap_or("")) == c))
        .filter(|p| {
            proto.as_ref().map_or(true, |pr| {
                let project = p["project"].as_str().unwrap_or("");
                norm(project).starts_with(pr.as_str()) || norm(project_name(project).unwrap_or("")).starts_with(pr.as_str())
            })
        })
        .filter(|p| {
            let Some(t) = &token else { return true };
            let sym = p["symbol"].as_str().unwrap_or("").to_lowercase();
            sym == *t
                || (t.len() >= 3 && !t.starts_with("0x") && sym.ends_with(t.as_str()))
                || p["underlyingTokens"].as_array().into_iter().flatten().any(|u| u.as_str().map(|s| s.to_lowercase()) == Some(t.clone()))
                || (t == "eth" && (sym == "eth" || sym == "weth"))
                || (t == "stable" && p["stablecoin"].as_bool() == Some(true))
        })
        .filter(|p| p["tvlUsd"].as_f64().unwrap_or(0.0) >= min_tvl && p["outlier"].as_bool() != Some(true))
        .collect();
    hits.sort_by(|x, y| y["apy"].as_f64().unwrap_or(0.0).partial_cmp(&x["apy"].as_f64().unwrap_or(0.0)).unwrap_or(std::cmp::Ordering::Equal));
    hits.truncate(n);
    let markets: Vec<Value> = hits
        .iter()
        .map(|p| {
            let project = p["project"].as_str().unwrap_or("");
            let sym = p["symbol"].as_str().unwrap_or("");
            let mut m = Map::new();
            m.insert("protocol".into(), json!(project_name(project)));
            m.insert("chain".into(), p["chain"].clone());
            m.insert("token".into(), json!(sym));
            // TypeScript: poolMeta ?? ((token && symbol !== token) ? "X vault" : null).
            let market = match (&p["poolMeta"], &token) {
                (Value::String(meta), _) => json!(meta),
                (_, Some(t)) if sym.to_lowercase() != *t => json!(format!("{sym} vault")),
                _ => Value::Null,
            };
            m.insert("market".into(), market);
            m.insert("supplyApyPct".into(), r2(&p["apy"]));
            m.insert("baseApyPct".into(), r2(&p["apyBase"]));
            m.insert("rewardApyPct".into(), r2(&p["apyReward"]));
            m.insert("avg30dApyPct".into(), r2(&p["apyMean30d"]));
            m.insert("tvlUsd".into(), num(js_round(p["tvlUsd"].as_f64().unwrap_or(0.0))));
            m.insert("tokenAddresses".into(), if p["underlyingTokens"].is_array() { p["underlyingTokens"].clone() } else { json!([]) });
            if let Some((_, r)) = REGISTRY.iter().find(|(k, _)| *k == project) {
                m.insert("registry".into(), json!(r));
            }
            Value::Object(m)
        })
        .collect();
    Ok(json!({
        "count": markets.len(), "markets": markets,
        "notes": [
            "Supply APY: what lending the token earns now, variable. Rewards (if any) are paid in another token and can stop.",
            "To lend for a person: get_protocol(registry) for the official contract on that chain, then build_tx with steps [approve on the token, the supply call] and give them the signLink.",
            "Source: DefiLlama yields, refreshed about hourly. Markets under the TVL floor are left out (minTvlUsd, default 1000000). Not financial advice.",
        ],
    }))
}

pub async fn staking_rates(a: &Map<String, Value>, feed: &Feed, http: &reqwest::Client) -> Result<Value, ToolError> {
    let want = opt_str(a, "token")?.map(|t| t.trim().to_lowercase());
    let rows = feed.rows(http).await?;
    // One row per project, first seen order: the deepest market is the protocol's own staking rate.
    let mut best: indexmap::IndexMap<&str, &Value> = indexmap::IndexMap::new();
    for p in rows.iter() {
        let project = p["project"].as_str().unwrap_or("");
        let Some(s) = staking(project) else { continue };
        if !s.3.contains(&p["symbol"].as_str().unwrap_or("").to_lowercase().as_str()) {
            continue;
        }
        let tvl = p["tvlUsd"].as_f64().unwrap_or(0.0);
        match best.get(project) {
            Some(had) if had["tvlUsd"].as_f64().unwrap_or(0.0) >= tvl => {}
            _ => { best.insert(s.0, p); }
        }
    }
    let mut list: Vec<(&'static (&str, &str, &str, &[&str]), &Value)> = best
        .into_iter()
        .filter_map(|(project, p)| staking(project).map(|s| (s, p)))
        .filter(|(s, _)| want.as_ref().map_or(true, |w| s.3.contains(&w.as_str()) || s.2.to_lowercase() == *w || norm(s.1).starts_with(&norm(w))))
        .collect();
    list.sort_by(|x, y| y.1["apy"].as_f64().unwrap_or(0.0).partial_cmp(&x.1["apy"].as_f64().unwrap_or(0.0)).unwrap_or(std::cmp::Ordering::Equal));
    let staking_rows: Vec<Value> = list
        .iter()
        .map(|(s, p)| json!({
            "protocol": s.1, "token": s.2,
            "alsoTradesAs": s.3.iter().filter(|x| **x != s.2.to_lowercase()).collect::<Vec<_>>(),
            "stakingApyPct": r2(&p["apy"]), "avg30dApyPct": r2(&p["apyMean30d"]), "tvlUsd": num(js_round(p["tvlUsd"].as_f64().unwrap_or(0.0))),
        }))
        .collect();
    Ok(json!({
        "count": staking_rows.len(), "staking": staking_rows,
        "notes": [
            "A pool with one of these tokens (wstETH-WETH, weETH-ETH...) earns the token's staking APY on that half, on top of the pool APR the pool tools show.",
            "Restaking tokens (ezETH, rsETH, weETH) add restaking risk on top of staking. Source: DefiLlama yields. Not financial advice.",
        ],
    }))
}

pub fn definitions(read: &Value) -> Vec<Value> {
    vec![
        json!({
            "name": "lending_rates",
            "title": "Lending and savings rates",
            "description": "Live supply APYs for lending a token on Aave, Compound, Morpho, Spark, Euler, Fluid, Moonwell, Venus and more, per chain, best first, with TVL and the 30-day average. Filter by token (symbol or address, \"stable\" for all stablecoins), chain and protocol. Use it for \"where do I earn most on my USDC\" and before suggesting any lending; never guess a rate.",
            "inputSchema": { "type": "object", "properties": {
                "token": { "type": "string", "description": "Symbol or address, e.g. \"USDC\", \"ETH\", or \"stable\"." },
                "chain": { "type": "string", "description": "Chain name or id. Omit for all chains." },
                "protocol": { "type": "string", "description": "e.g. \"aave\", \"morpho\", \"compound\"." },
                "minTvlUsd": { "type": "number", "minimum": 0, "description": "Skip smaller markets. Default 1000000." },
                "limit": { "type": "integer", "minimum": 1, "maximum": 50, "description": "Default 15." }
            } },
            "annotations": read,
        }),
        json!({
            "name": "staking_rates",
            "title": "ETH staking rates",
            "description": "What ETH earns staked through each liquid-staking token (Lido stETH/wstETH, ether.fi weETH, Rocket Pool rETH, Coinbase cbETH, Binance wBETH, Kelp, Renzo...), best first, with TVL and the 30-day average. Use it for \"where do I get the best staking APR\" and to add the staking yield to pools that hold these tokens.",
            "inputSchema": { "type": "object", "properties": { "token": { "type": "string", "description": "Only this token or protocol, e.g. \"wstETH\", \"rETH\", \"lido\"." } } },
            "annotations": read,
        }),
    ]
}
