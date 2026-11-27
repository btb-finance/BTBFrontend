//! The protocol registry (registry/protocols/*.json, compiled in from api-rs/data/registry.json, which
//! `node scripts/registry.mjs index` writes). A port of src/lib/mcp/registry.ts: same matching, same answers.

use crate::pools::chain_key;
use crate::tools::{bad, opt_str, ToolError};
use serde_json::{json, Map, Value};
use std::sync::OnceLock;

fn protocols() -> &'static [Value] {
    static P: OnceLock<Vec<Value>> = OnceLock::new();
    P.get_or_init(|| serde_json::from_str(include_str!("../data/registry.json")).expect("registry.json"))
}

fn norm(s: &str) -> String {
    s.to_lowercase().chars().filter(|c| c.is_ascii_alphanumeric()).collect()
}
fn s(v: &Value, k: &str) -> String {
    v[k].as_str().unwrap_or("").to_string()
}
fn same_chain(a: &str, b: &str) -> bool {
    chain_key(a) == chain_key(b) || norm(a) == norm(b)
}

/// Exact slug or name; else the closest name that one starts with the other ("aave" finds Aave V3).
fn find(q: &str) -> Option<&'static Value> {
    let n = norm(q);
    if n.is_empty() {
        return None;
    }
    let all = protocols();
    if let Some(p) = all.iter().find(|p| norm(&s(p, "slug")) == n || norm(&s(p, "name")) == n) {
        return Some(p);
    }
    if n.len() < 3 {
        return None;
    }
    let mut near: Vec<&Value> = all
        .iter()
        .filter(|p| [norm(&s(p, "slug")), norm(&s(p, "name"))].iter().any(|k| k.starts_with(&n) || n.starts_with(k.as_str())))
        .collect();
    near.sort_by_key(|p| (norm(&s(p, "slug")).len() as i64 - n.len() as i64).abs());
    near.first().copied()
}

fn contract_chains(p: &Value) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for c in p["contracts"].as_array().into_iter().flatten() {
        let ch = s(c, "chain");
        if !out.contains(&ch) {
            out.push(ch);
        }
    }
    out
}

pub fn list(a: &Map<String, Value>) -> Result<Value, ToolError> {
    let category = opt_str(a, "category")?;
    let chain = opt_str(a, "chain")?;
    let search = opt_str(a, "search")?.map(|q| q.to_lowercase());
    let rows: Vec<Value> = protocols()
        .iter()
        .filter(|p| category.as_ref().map_or(true, |c| s(p, "category").to_lowercase().contains(&c.to_lowercase())))
        .filter(|p| {
            chain.as_ref().map_or(true, |c| {
                p["chains"].as_array().into_iter().flatten().any(|x| same_chain(x.as_str().unwrap_or(""), c))
                    || p["contracts"].as_array().into_iter().flatten().any(|x| same_chain(&s(x, "chain"), c))
            })
        })
        .filter(|p| search.as_ref().map_or(true, |q| format!("{} {} {} {}", s(p, "name"), s(p, "slug"), s(p, "description"), s(p, "category")).to_lowercase().contains(q)))
        .map(|p| {
            json!({
                "slug": p["slug"], "name": p["name"], "category": p["category"], "description": p["description"],
                "chains": if p["chains"].is_array() { p["chains"].clone() } else { json!(contract_chains(p)) },
                "vm": p["vm"], "access": p["agentAccess"],
                "contracts": p["contracts"].as_array().map_or(0, |c| c.len()),
                "apis": p["offchainApis"].as_array().map_or(0, |c| c.len()),
            })
        })
        .collect();
    Ok(json!({ "count": rows.len(), "protocols": rows, "next": "get_protocol for contracts, functions, APIs and risks; get_abi for a full ABI." }))
}

pub fn detail(a: &Map<String, Value>) -> Result<Value, ToolError> {
    let q = opt_str(a, "protocol")?.ok_or_else(|| bad("protocol is required"))?;
    let chain = opt_str(a, "chain")?.filter(|c| !c.is_empty());
    let Some(p) = find(&q) else {
        return Err(ToolError(format!("\"{q}\" is not in the BTB registry yet. Use list_protocols to see what is, or get_abi on a contract address directly.")));
    };
    let mut out = p.as_object().cloned().unwrap_or_default();
    let contracts: Vec<Value> = p["contracts"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|c| chain.as_ref().map_or(true, |ch| same_chain(&s(c, "chain"), ch)))
        .cloned()
        .collect();
    let empty = contracts.is_empty();
    out.insert("contracts".into(), Value::Array(contracts));
    if let (Some(ch), true) = (&chain, empty) {
        let recorded = contract_chains(p);
        let list = if recorded.is_empty() { "none".to_string() } else { recorded.join(", ") };
        out.insert("chainNote".into(), json!(format!("No {} contracts recorded on {ch}. Recorded chains: {list}.", s(p, "name"))));
    }
    let vm = s(p, "vm");
    out.insert(
        "howToUse".into(),
        json!(if vm == "evm" || vm == "mixed" {
            "EVM contracts: get_abi(chain, address) for the full ABI, read_contract for reads, build_tx for unsigned writes. Integers in base units."
        } else {
            "Not EVM: use the offchainApis or the program ids with a client for that chain; BTB build tools do not cover it yet."
        }),
    );
    Ok(Value::Object(out))
}

pub fn definitions(read: &Value) -> Vec<Value> {
    vec![
        json!({
            "name": "list_protocols",
            "title": "Protocols in the BTB registry",
            "description": "DeFi protocols BTB has researched for agents (stablecoin issuers, DEXes, lending, staking, prediction markets, perps…), filterable by category, chain or text: name, category, chains, how agents access it (on-chain or API) and how many contracts and APIs are recorded.",
            "inputSchema": { "type": "object", "properties": {
                "category": { "type": "string", "description": "e.g. \"Liquid Staking\", \"Dexs\", \"Lending\", \"Stablecoin\"." },
                "chain": { "type": "string", "description": "Only protocols on this chain, e.g. \"base\", \"ethereum\", \"solana\"." },
                "search": { "type": "string", "description": "Text in the name or description." }
            } },
            "annotations": read,
        }),
        json!({
            "name": "get_protocol",
            "title": "Protocol contracts, functions and APIs",
            "description": "One protocol from the BTB registry: its official contract addresses per chain (each with the official page it came from), the functions an agent would call, off-chain APIs, supported actions and risks. Then use get_abi / read_contract / build_tx on its contracts.",
            "inputSchema": { "type": "object", "properties": {
                "protocol": { "type": "string", "description": "Name or slug, e.g. \"lido\", \"uniswap\", \"maple-finance\"." },
                "chain": { "type": "string", "description": "Only contracts on this chain." }
            }, "required": ["protocol"] },
            "annotations": read,
        }),
    ]
}
