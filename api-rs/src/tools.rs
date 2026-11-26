//! The tools this server answers so far, with the same names, arguments and answers as the TypeScript connector
//! (src/lib/mcp/server.ts). Everything else stays on the TypeScript connector until it is moved here.

use crate::pools::{brief, chain_key, headline_apr, js_round, median, num, pool_risk, round2, search, Pool, Risk, LETTERS};
use crate::snapshot::Snapshot;
use serde_json::{json, Map, Value};

pub struct ToolError(pub String);

fn bad(msg: impl Into<String>) -> ToolError {
    ToolError(format!("Input validation error: {}", msg.into()))
}

const CHAIN_DESC: &str = "Chain name or id, e.g. \"base\", \"ethereum\", \"bnb\", \"robinhood\", 8453. Omit for all chains.";
const RISK_DESC: &str = "Worst risk grade to include (A safest). Default: all.";

/// tools/list entries: name, title, description, JSON Schema of the arguments, hints.
pub fn definitions() -> Vec<Value> {
    let read = json!({ "readOnlyHint": true, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true });
    vec![
        json!({
            "name": "top_pools",
            "title": "Top liquidity pools",
            "description": "Rank live liquidity pools by APR, TVL, 24h volume or 24h fees, filtered by chain, risk grade, TVL and stable pairs. Returns each pool with its risk grade and a btb.finance link.",
            "inputSchema": { "type": "object", "properties": {
                "chain": { "type": "string", "description": CHAIN_DESC },
                "maxRisk": { "type": "string", "enum": ["A", "B", "C", "D", "E"], "description": RISK_DESC },
                "minTvlUsd": { "type": "number", "minimum": 0, "description": "Minimum TVL in USD. Default 100000." },
                "stableOnly": { "type": "boolean", "description": "Only pairs of two stablecoins." },
                "sortBy": { "type": "string", "enum": ["apr", "tvl", "volume", "fees"], "description": "Default apr." },
                "limit": { "type": "integer", "minimum": 1, "maximum": 50, "description": "Default 10." }
            } },
            "annotations": read,
        }),
        json!({
            "name": "search_pools",
            "title": "Search pools",
            "description": "Find pools by token symbols (\"ETH USDC\"), a token address, or a DEX name (\"aerodrome\"). Sorted by TVL.",
            "inputSchema": { "type": "object", "properties": {
                "query": { "type": "string", "minLength": 1 },
                "chain": { "type": "string", "description": CHAIN_DESC },
                "limit": { "type": "integer", "minimum": 1, "maximum": 50, "description": "Default 10." }
            }, "required": ["query"] },
            "annotations": read,
        }),
        json!({
            "name": "chain_summary",
            "title": "Chain summary",
            "description": "Per chain: pool count, total TVL, median APR and TVL-weighted APR (all pools, and stable pairs only).",
            "inputSchema": { "type": "object", "properties": { "chain": { "type": "string", "description": CHAIN_DESC } } },
            "annotations": read,
        }),
    ]
}

pub fn has(name: &str) -> bool {
    matches!(name, "top_pools" | "search_pools" | "chain_summary")
}

// ---- arguments ----

fn opt_str(a: &Map<String, Value>, k: &str) -> Result<Option<String>, ToolError> {
    match a.get(k) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(s)) => Ok(Some(s.clone())),
        Some(Value::Number(n)) if k == "chain" => Ok(Some(n.to_string())),
        _ => Err(bad(format!("{k} must be a string"))),
    }
}
fn opt_num(a: &Map<String, Value>, k: &str) -> Result<Option<f64>, ToolError> {
    match a.get(k) {
        None | Some(Value::Null) => Ok(None),
        Some(v) => v.as_f64().map(Some).ok_or_else(|| bad(format!("{k} must be a number"))),
    }
}
fn opt_bool(a: &Map<String, Value>, k: &str) -> Result<Option<bool>, ToolError> {
    match a.get(k) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Bool(b)) => Ok(Some(*b)),
        _ => Err(bad(format!("{k} must be true or false"))),
    }
}
fn limit(a: &Map<String, Value>, max: f64, default: usize) -> Result<usize, ToolError> {
    match opt_num(a, "limit")? {
        None => Ok(default),
        Some(n) if n.fract() == 0.0 && (1.0..=max).contains(&n) => Ok(n as usize),
        Some(_) => Err(bad(format!("limit must be a whole number from 1 to {max}"))),
    }
}
fn max_risk(a: &Map<String, Value>) -> Result<usize, ToolError> {
    match opt_str(a, "maxRisk")? {
        None => Ok(4),
        Some(s) => LETTERS.iter().position(|l| s.len() == 1 && s.starts_with(*l)).ok_or_else(|| bad("maxRisk must be A, B, C, D or E")),
    }
}

fn iso(ms: f64) -> Value {
    chrono::DateTime::from_timestamp_millis(ms as i64)
        .map(|d| json!(d.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()))
        .unwrap_or(Value::Null)
}
fn updated(s: &Snapshot) -> Value {
    match s.updated_at {
        Some(ms) if ms != 0.0 => iso(ms),
        Some(_) => json!(0),
        None => Value::Null,
    }
}

fn by_desc(a: f64, b: f64) -> std::cmp::Ordering {
    b.partial_cmp(&a).unwrap_or(std::cmp::Ordering::Equal)
}

// ---- tools ----

pub fn call(name: &str, args: &Map<String, Value>, snap: &Snapshot) -> Result<Value, ToolError> {
    match name {
        "top_pools" => top_pools(args, snap),
        "search_pools" => search_pools(args, snap),
        "chain_summary" => chain_summary(args, snap),
        _ => Err(ToolError(format!("Tool {name} not found"))),
    }
}

fn top_pools(a: &Map<String, Value>, snap: &Snapshot) -> Result<Value, ToolError> {
    let chain = opt_str(a, "chain")?.map(|c| chain_key(&c));
    let worst = max_risk(a)?;
    let min_tvl = opt_num(a, "minTvlUsd")?.unwrap_or(100_000.0);
    if min_tvl < 0.0 {
        return Err(bad("minTvlUsd must be 0 or more"));
    }
    let stable_only = opt_bool(a, "stableOnly")?.unwrap_or(false);
    let sort = opt_str(a, "sortBy")?.unwrap_or_else(|| "apr".into());
    let key: fn(&Pool) -> f64 = match sort.as_str() {
        "apr" => headline_apr,
        "tvl" => |p| p.tvl(),
        "volume" => |p| p.volume_24h_usd.unwrap_or(0.0),
        "fees" => |p| p.fees_24h_usd.unwrap_or(0.0),
        _ => return Err(bad("sortBy must be apr, tvl, volume or fees")),
    };
    let n = limit(a, 50.0, 10)?;
    let mut rows: Vec<(&Pool, Risk)> = snap
        .pools
        .iter()
        .filter(|p| chain.as_ref().map_or(true, |c| &chain_key(&p.chain) == c) && p.tvl() >= min_tvl && (!stable_only || p.stable()))
        .map(|p| (p, pool_risk(p)))
        .filter(|(_, r)| LETTERS.iter().position(|l| *l == r.grade).unwrap_or(4) <= worst)
        .collect();
    rows.sort_by(|x, y| by_desc(key(x.0), key(y.0)));
    rows.truncate(n);
    Ok(json!({ "updatedAt": updated(snap), "count": rows.len(), "pools": rows.iter().map(|(p, r)| brief(p, r)).collect::<Vec<_>>() }))
}

fn search_pools(a: &Map<String, Value>, snap: &Snapshot) -> Result<Value, ToolError> {
    let query = opt_str(a, "query")?.filter(|q| !q.is_empty()).ok_or_else(|| bad("query is required"))?;
    let chain = opt_str(a, "chain")?.map(|c| chain_key(&c));
    let n = limit(a, 50.0, 10)?;
    let mut hits: Vec<&Pool> = search(&snap.pools, &query).into_iter().filter(|p| chain.as_ref().map_or(true, |c| &chain_key(&p.chain) == c)).collect();
    hits.sort_by(|x, y| by_desc(x.tvl(), y.tvl()));
    let matches = hits.len();
    Ok(json!({ "matches": matches, "pools": hits.iter().take(n).map(|p| brief(p, &pool_risk(p))).collect::<Vec<_>>() }))
}

fn chain_summary(a: &Map<String, Value>, snap: &Snapshot) -> Result<Value, ToolError> {
    let want = opt_str(a, "chain")?;
    let c = want.as_ref().map(|c| chain_key(c));
    let mut groups: indexmap::IndexMap<&str, Vec<&Pool>> = indexmap::IndexMap::new();
    for p in &snap.pools {
        if c.as_ref().map_or(true, |c| &chain_key(&p.chain) == c) {
            groups.entry(p.chain.as_str()).or_default().push(p);
        }
    }
    let sum = |ps: &[&Pool]| {
        let tvl: f64 = ps.iter().map(|p| p.tvl()).sum();
        let mut aprs: Vec<f64> = ps.iter().map(|p| headline_apr(p)).collect();
        json!({
            "pools": ps.len(),
            "tvlUsd": num(js_round(tvl)),
            "medianAprPct": num(round2(median(&mut aprs).unwrap_or(0.0))),
            "tvlWeightedAprPct": if tvl != 0.0 { num(round2(ps.iter().map(|p| headline_apr(p) * p.tvl()).sum::<f64>() / tvl)) } else { Value::Null },
        })
    };
    let mut list: Vec<(&str, Vec<&Pool>)> = groups.into_iter().collect();
    list.sort_by(|x, y| y.1.len().cmp(&x.1.len()));
    if list.is_empty() {
        return Err(ToolError(format!("No pools on \"{}\". Chains: {}.", want.unwrap_or_default(), snap.chains.join(", "))));
    }
    let chains: Vec<Value> = list
        .iter()
        .map(|(chain, ps)| {
            let stable: Vec<&Pool> = ps.iter().copied().filter(|p| p.stable()).collect();
            json!({ "chain": chain, "all": sum(ps), "stablePairs": sum(&stable) })
        })
        .collect();
    Ok(json!({ "updatedAt": updated(snap), "chains": chains }))
}
