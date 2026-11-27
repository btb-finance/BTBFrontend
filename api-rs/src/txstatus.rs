//! tx_status: whether a transaction landed, its fee, and the tokens that moved for its sender. A port of
//! src/lib/mcp/tokens.ts txStatus, reading the chain over public JSON-RPC.

use crate::lite::{format_units, token_chain_id};
use crate::tools::{bad, opt_str, ToolError};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

/// (public RPC, block explorer as src/lib/chainClient.ts's chains name it, native symbol).
fn chain(id: i64) -> Option<(&'static str, Option<&'static str>, &'static str)> {
    Some(match id {
        1 => ("https://ethereum-rpc.publicnode.com", Some("https://etherscan.io"), "ETH"),
        8453 => ("https://base-rpc.publicnode.com", Some("https://basescan.org"), "ETH"),
        56 => ("https://bsc-rpc.publicnode.com", Some("https://bscscan.com"), "BNB"),
        42161 => ("https://arbitrum-one-rpc.publicnode.com", Some("https://arbiscan.io"), "ETH"),
        10 => ("https://optimism-rpc.publicnode.com", Some("https://optimistic.etherscan.io"), "ETH"),
        137 => ("https://polygon-bor-rpc.publicnode.com", Some("https://polygonscan.com"), "POL"),
        43114 => ("https://avalanche-c-chain-rpc.publicnode.com", Some("https://snowtrace.io"), "AVAX"),
        130 => ("https://mainnet.unichain.org/", Some("https://uniscan.xyz"), "ETH"),
        4663 => ("https://rpc.mainnet.chain.robinhood.com/", None, "ETH"),
        5042 => ("https://rpc.mainnet.arc.io", None, "ETH"),
        59144 => ("https://rpc.linea.build", Some("https://lineascan.build"), "ETH"),
        80094 => ("https://rpc.berachain.com", Some("https://berascan.com"), "BERA"),
        2020 => ("https://api.roninchain.com/rpc", Some("https://app.roninchain.com"), "RON"),
        999 => ("https://rpc.hyperliquid.xyz/evm", Some("https://hyperevmscan.io"), "HYPE"),
        9745 => ("https://rpc.plasma.to", Some("https://plasmascan.to"), "XPL"),
        42793 => ("https://node.mainnet.etherlink.com", Some("https://explorer.etherlink.com"), "ETH"),
        143 => ("https://rpc.monad.xyz", Some("https://monadscan.com"), "MON"),
        4326 => ("https://mainnet.megaeth.com/rpc", Some("https://mega.etherscan.io"), "ETH"),
        146 => ("https://rpc.soniclabs.com", Some("https://sonicscan.org"), "ETH"),
        5000 => ("https://rpc.mantle.xyz", Some("https://mantlescan.xyz/"), "ETH"),
        534352 => ("https://rpc.scroll.io", Some("https://scrollscan.com"), "ETH"),
        250 => ("https://250.rpc.thirdweb.com", Some("https://ftmscan.com"), "ETH"),
        81457 => ("https://rpc.blast.io", Some("https://blastscan.io"), "ETH"),
        324 => ("https://mainnet.era.zksync.io", Some("https://explorer.zksync.io"), "ETH"),
        57073 => ("https://rpc-gel.inkonchain.com", Some("https://explorer.inkonchain.com"), "ETH"),
        25 => ("https://cronos-evm-rpc.publicnode.com", Some("https://explorer.cronos.org"), "CRO"),
        50 => ("https://rpc.xinfin.network", Some("https://xdcscan.com"), "XDC"),
        196 => ("https://rpc.xlayer.tech", Some("https://www.oklink.com/xlayer"), "OKB"),
        252 => ("https://fraxtal-rpc.publicnode.com", Some("https://fraxscan.com"), "FRAX"),
        480 => ("https://worldchain-mainnet.g.alchemy.com/public", Some("https://worldscan.org"), "ETH"),
        1135 => ("https://lisk.gateway.tenderly.co", Some("https://blockscout.lisk.com"), "ETH"),
        1329 => ("https://sei-evm-rpc.publicnode.com", Some("https://seitrace.com"), "SEI"),
        1776 => ("https://sentry.evm-rpc.injective.network/", Some("https://blockscout.injective.network"), "INJ"),
        1868 => ("https://soneium-rpc.publicnode.com", Some("https://soneium.blockscout.com"), "ETH"),
        2222 => ("https://kava-evm-rpc.publicnode.com", Some("https://kavascan.com"), "KAVA"),
        2818 => ("https://rpc.morphl2.io", Some("https://explorer.morphl2.io"), "ETH"),
        8217 => ("https://public-en.node.kaia.io", Some("https://kaiascan.io"), "KAIA"),
        34443 => ("https://mainnet.mode.network", Some("https://modescan.io"), "ETH"),
        42220 => ("https://celo-rpc.publicnode.com", Some("https://celoscan.io"), "CELO"),
        48900 => ("https://mainnet.zircuit.com", Some("https://explorer.zircuit.com"), "ETH"),
        98866 => ("https://rpc.plume.org", Some("https://explorer.plume.org"), "PLUME"),
        _ => return None,
    })
}

/// The public RPC for a chain.
pub fn rpc_for(id: i64) -> Option<&'static str> {
    chain(id).map(|c| c.0)
}

const TRANSFER: &str = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/// The LI.FI swap catalog per chain (symbols and decimals), kept an hour: the same list find_token reads.
#[derive(Clone, Default)]
pub struct Catalog(Arc<Mutex<HashMap<i64, (Instant, Arc<HashMap<String, (String, usize)>>)>>>);

impl Catalog {
    async fn get(&self, http: &reqwest::Client, chain_id: i64) -> Arc<HashMap<String, (String, usize)>> {
        if let Some((at, m)) = self.0.lock().await.get(&chain_id) {
            if at.elapsed() < Duration::from_secs(3600) {
                return m.clone();
            }
        }
        let mut map = HashMap::new();
        if let Ok(r) = http.get(format!("https://li.quest/v1/tokens?chains={chain_id}")).timeout(Duration::from_secs(10)).send().await {
            if let Ok(b) = r.json::<Value>().await {
                for t in b["tokens"][chain_id.to_string()].as_array().into_iter().flatten() {
                    if t["verificationStatus"].as_str() == Some("flagged") {
                        continue;
                    }
                    if let (Some(a), Some(s), Some(d)) = (t["address"].as_str(), t["symbol"].as_str(), t["decimals"].as_u64()) {
                        map.insert(a.to_lowercase(), (s.to_string(), d as usize));
                    }
                }
            }
        }
        let m = Arc::new(map);
        self.0.lock().await.insert(chain_id, (Instant::now(), m.clone()));
        m
    }
}

async fn rpc(http: &reqwest::Client, url: &str, method: &str, params: Value) -> Option<Value> {
    let r: Value = http
        .post(url)
        .json(&json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params }))
        .timeout(Duration::from_secs(12))
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;
    let v = r.get("result")?.clone();
    (!v.is_null()).then_some(v)
}

fn hex_u128(v: &Value) -> u128 {
    v.as_str().and_then(|s| u128::from_str_radix(s.trim_start_matches("0x"), 16).ok()).unwrap_or(0)
}

/// Symbol and decimals: the catalog first, then the contract itself (src/lib/mcp/tokens.ts tokenMeta).
async fn token_meta(http: &reqwest::Client, url: &str, cat: &HashMap<String, (String, usize)>, token: &str) -> (String, usize) {
    if let Some(m) = cat.get(&token.to_lowercase()) {
        return m.clone();
    }
    let call = |data: &'static str| rpc(http, url, "eth_call", json!([{ "to": token, "data": data }, "latest"]));
    let (sym, dec) = futures::join!(call("0x95d89b41"), call("0x313ce567"));
    let Some(dec) = dec.as_ref().map(hex_u128) else { return (token[..8].to_string(), 18) };
    let symbol = sym
        .and_then(|v| v.as_str().map(String::from))
        .map(|h| {
            let h = h.trim_start_matches("0x");
            let bytes: Vec<u8> = (0..h.len() / 2).filter_map(|i| u8::from_str_radix(&h[i * 2..i * 2 + 2], 16).ok()).collect();
            if bytes.len() >= 96 {
                let len = u128::from_str_radix(&h[64..128], 16).unwrap_or(0) as usize;
                String::from_utf8_lossy(&bytes[64..(64 + len).min(bytes.len())]).to_string()
            } else {
                String::from_utf8_lossy(&bytes).trim_end_matches('\0').to_string()
            }
        })
        .unwrap_or_else(|| token[..8].to_string());
    (symbol, dec as usize)
}

pub async fn tx_status(a: &Map<String, Value>, http: &reqwest::Client, catalog: &Catalog) -> Result<Value, ToolError> {
    let chain_in = opt_str(a, "chain")?.ok_or_else(|| bad("chain is required"))?;
    let hash = opt_str(a, "hash")?.ok_or_else(|| bad("hash is required"))?;
    let chain_id = token_chain_id(&chain_in).ok_or_else(|| ToolError(format!("Unknown chain \"{chain_in}\".")))?;
    if !(hash.len() == 66 && hash.starts_with("0x") && hash[2..].chars().all(|c| c.is_ascii_hexdigit())) {
        return Err(ToolError("hash must be a 0x transaction hash (66 characters).".into()));
    }
    let (url, explorer, native) = chain(chain_id).ok_or_else(|| ToolError(format!("Unknown chain \"{chain_in}\".")))?;
    let link = explorer.map(|e| json!(format!("{e}/tx/{hash}"))).unwrap_or(Value::Null);
    let Some(receipt) = rpc(http, url, "eth_getTransactionReceipt", json!([hash])).await else {
        let tx = rpc(http, url, "eth_getTransactionByHash", json!([hash])).await;
        return Ok(if tx.is_some() {
            json!({ "chainId": chain_id, "hash": hash, "status": "pending", "note": "Sent but not in a block yet. Check again in a few seconds.", "link": link })
        } else {
            json!({ "chainId": chain_id, "hash": hash, "status": "not_found", "note": "No transaction with this hash on this chain. Check the chain, or that it was sent.", "link": link })
        });
    };
    let (tx, block, cat) = futures::join!(
        rpc(http, url, "eth_getTransactionByHash", json!([hash])),
        rpc(http, url, "eth_getBlockByNumber", json!([receipt["blockNumber"].clone(), false])),
        catalog.get(http, chain_id),
    );
    let from = receipt["from"].as_str().unwrap_or("").to_lowercase();
    let pad = format!("0x{:0>64}", from.trim_start_matches("0x"));
    let logs: Vec<&Value> = receipt["logs"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|l| {
            let t = l["topics"].as_array();
            t.is_some_and(|t| t.len() == 3 && t[0].as_str() == Some(TRANSFER) && (t[1].as_str().map(str::to_lowercase) == Some(pad.clone()) || t[2].as_str().map(str::to_lowercase) == Some(pad.clone())))
        })
        .take(20)
        .collect();
    let mut transfers = Vec::new();
    for l in logs {
        let token = l["address"].as_str().unwrap_or("").to_lowercase();
        let (symbol, decimals) = token_meta(http, url, &cat, &token).await;
        let topics = l["topics"].as_array().unwrap();
        let out = topics[1].as_str().map(str::to_lowercase) == Some(pad.clone());
        let data = l["data"].as_str().unwrap_or("0x");
        let raw = if data == "0x" { "0".to_string() } else { u256_decimal(data) };
        let other = if out { topics[2].as_str() } else { topics[1].as_str() }.unwrap_or("");
        transfers.push(json!({
            "direction": if out { "out" } else { "in" }, "token": token, "symbol": symbol,
            "amount": format_units(&raw, decimals), "counterparty": format!("0x{}", &other[26.min(other.len())..]),
        }));
    }
    let gas = hex_big(&receipt["gasUsed"]) * hex_big(&receipt["effectiveGasPrice"]);
    let value = tx.as_ref().map(|t| hex_big(&t["value"])).unwrap_or(0);
    let ok = receipt["status"].as_str() == Some("0x1");
    let time = block.as_ref().map(|b| hex_u128(&b["timestamp"]) as i64).and_then(|t| chrono::DateTime::from_timestamp(t, 0)).map(|d| json!(d.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string())).unwrap_or(Value::Null);
    let mut out = Map::new();
    out.insert("chainId".into(), json!(chain_id));
    out.insert("hash".into(), json!(hash));
    out.insert("status".into(), json!(if ok { "confirmed" } else { "failed" }));
    if !ok {
        out.insert("note".into(), json!("The transaction reverted: nothing changed except the gas fee. Rebuild it and check the dry run."));
    }
    out.insert("block".into(), json!(hex_u128(&receipt["blockNumber"]) as u64));
    out.insert("time".into(), time);
    out.insert("from".into(), receipt["from"].clone());
    out.insert("to".into(), receipt["to"].clone());
    out.insert("nativeSent".into(), if value > 0 { json!(format!("{} {native}", format_units(&value.to_string(), 18))) } else { Value::Null });
    out.insert("fee".into(), json!(format!("{} {native}", format_units(&gas.to_string(), 18))));
    out.insert("tokenTransfers".into(), Value::Array(transfers));
    out.insert("link".into(), link);
    Ok(Value::Object(out))
}

fn hex_big(v: &Value) -> u128 {
    hex_u128(v)
}

/// A 32-byte hex word as a decimal string (amounts can exceed u128).
fn u256_decimal(hex: &str) -> String {
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

pub fn definitions(read: &Value) -> Vec<Value> {
    vec![json!({
        "name": "tx_status",
        "title": "Transaction status",
        "description": "Whether a transaction confirmed or failed, its fee, and the tokens that moved in and out of the sending wallet. Use it after a person signs (they can paste the hash, or the sign page shows it).",
        "inputSchema": { "type": "object", "properties": {
            "chain": { "type": "string", "description": "Chain name or id." },
            "hash": { "type": "string", "pattern": "^0x[0-9a-fA-F]{64}$", "description": "Transaction hash." }
        }, "required": ["chain", "hash"] },
        "annotations": read,
    })]
}
