//! Sign links, in the same format as src/lib/signLink.ts so links made here open on btb.finance/sign and the other
//! way round: the plan as gzip JSON in base64url, sealed with HMAC-SHA256 under sha256("btb-sign-link:" + secret).
//! Also sign_status: which steps of a link were signed, each checked on chain.

use base64::Engine;
use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use hmac::{Hmac, Mac};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::io::{Read, Write};

pub const TTL_MS: i64 = 15 * 60_000;
const B64: base64::engine::GeneralPurpose = base64::engine::general_purpose::URL_SAFE_NO_PAD;

fn key() -> Option<[u8; 32]> {
    let secret = std::env::var("SIGN_LINK_SECRET").or_else(|_| std::env::var("BTB_API_SECRET")).ok()?;
    Some(Sha256::digest(format!("btb-sign-link:{secret}").as_bytes()).into())
}

fn mac(k: &[u8; 32], body: &str) -> String {
    let mut m = <Hmac<Sha256>>::new_from_slice(k).expect("hmac key");
    m.update(body.as_bytes());
    B64.encode(m.finalize().into_bytes())
}

/// A btb.finance/sign link for these steps and its id, or None when this server has no secret.
pub fn seal(title: &str, chain_id: i64, wallet: &str, steps: Vec<Value>) -> Option<(String, String)> {
    let k = key()?;
    if steps.is_empty() {
        return None;
    }
    let mut idb = [0u8; 12];
    getrandom::getrandom(&mut idb).ok()?;
    let id: String = idb.iter().map(|b| format!("{b:02x}")).collect();
    let exp = chrono::Utc::now().timestamp_millis() + TTL_MS;
    // Same field order as the TypeScript plan: v, title, chainId, wallet, steps, exp, id.
    let plan = json!({ "v": 1, "title": title, "chainId": chain_id, "wallet": wallet, "steps": steps, "exp": exp, "id": id });
    let mut gz = GzEncoder::new(Vec::new(), Compression::default());
    gz.write_all(serde_json::to_string(&plan).ok()?.as_bytes()).ok()?;
    let body = B64.encode(gz.finish().ok()?);
    let sig = mac(&k, &body);
    Some((format!("https://btb.finance/sign#{body}.{sig}"), id))
}

pub enum Opened {
    Ok(Value),
    Invalid,
    Unavailable,
}

/// The plan inside a link (expired ones too: sign_status checks what was signed after the fact).
pub fn open(link: &str) -> Opened {
    let Some(k) = key() else { return Opened::Unavailable };
    let token = link.split_once('#').map(|x| x.1).unwrap_or(link).trim();
    let Some((body, sig)) = token.split_once('.') else { return Opened::Invalid };
    if body.is_empty() || body.len() > 60_000 {
        return Opened::Invalid;
    }
    let mut m = <Hmac<Sha256>>::new_from_slice(&k).expect("hmac key");
    m.update(body.as_bytes());
    let Ok(sig_bytes) = B64.decode(sig) else { return Opened::Invalid };
    if m.verify_slice(&sig_bytes).is_err() {
        return Opened::Invalid;
    }
    let plan = B64.decode(body).ok().and_then(|z| {
        let mut s = String::new();
        GzDecoder::new(&z[..]).read_to_string(&mut s).ok()?;
        serde_json::from_str::<Value>(&s).ok()
    });
    match plan {
        Some(p) if p["v"] == json!(1) && p["steps"].is_array() => Opened::Ok(p),
        _ => Opened::Invalid,
    }
}

/// Adds signLink and signLinkNote to a build result (src/lib/mcp/server.ts withSignLink). `sims` holds each step's dry
/// run, or None; `swap` is attached to the last step so the sign page can refresh the quote.
pub fn with_sign_link(mut r: Value, title: &str, wallet: &str, sims: &[Option<Value>], swap: Option<Value>) -> Value {
    let chain_id = r["chainId"].as_i64().unwrap_or(0);
    let txs = r["transactions"].as_array().cloned().unwrap_or_default();
    let n = txs.len();
    let built_at = chrono::Utc::now().timestamp_millis();
    let steps: Vec<Value> = txs
        .iter()
        .enumerate()
        .map(|(i, t)| {
            let mut s = Map::new();
            for k in ["label", "to", "data", "value"] {
                s.insert(k.into(), t[k].clone());
            }
            match sims.get(i).and_then(|x| x.as_ref()) {
                Some(sim) => {
                    let status = sim["status"].as_str().unwrap_or("");
                    // A later step that reverts only because an earlier approval is not on chain yet is expected.
                    let waits = status == "skipped" || (status == "reverted" && i > 0);
                    s.insert("dryRun".into(), json!(if status == "passed" { "passed" } else if waits { "after-previous" } else { status }));
                    if let Some(reason) = sim.get("reason").filter(|x| !x.is_null()) {
                        s.insert("dryRunNote".into(), reason.clone());
                    }
                }
                None => {
                    s.insert("dryRun".into(), json!("none"));
                }
            }
            if let (Some(sw), true) = (&swap, i + 1 == n) {
                s.insert("swap".into(), sw.clone());
                s.insert("builtAt".into(), json!(built_at));
            }
            Value::Object(s)
        })
        .collect();
    if let Some((url, _id)) = seal(title, chain_id, wallet, steps) {
        r["signLink"] = json!(url);
        r["signLinkNote"] = json!("For a person: give them this link. It opens btb.finance with these steps to sign in their own wallet, in order. Valid 15 minutes, only for this wallet. Afterwards, sign_status with this link tells you what they signed; no need to ask them for hashes.");
    }
    r
}

pub type Signed = std::sync::Mutex<std::collections::HashMap<String, Vec<(u32, String, i64)>>>;

pub async fn sign_status(a: &Map<String, Value>, http: &reqwest::Client, catalog: &crate::txstatus::Catalog, signed: &Signed) -> Result<Value, crate::tools::ToolError> {
    use crate::tools::ToolError;
    let link = crate::tools::opt_str(a, "signLink")?.ok_or_else(|| crate::tools::bad("signLink is required"))?;
    let plan = match open(&link) {
        Opened::Ok(p) => p,
        Opened::Invalid => return Err(ToolError("That is not a sign link BTB made (or it was changed).".into())),
        Opened::Unavailable => return Err(ToolError("Sign links are not available on this server.".into())),
    };
    let Some(id) = plan["id"].as_str().map(String::from) else {
        return Err(ToolError("This link was made before sign tracking existed: ask the person for the transaction hash and use tx_status.".into()));
    };
    let reported = signed.lock().ok().and_then(|m| m.get(&id.to_lowercase()).cloned()).unwrap_or_default();
    let wallet = plan["wallet"].as_str().unwrap_or("").to_lowercase();
    let chain_id = plan["chainId"].as_i64().unwrap_or(0);
    let mut steps = Vec::new();
    for (i, s) in plan["steps"].as_array().cloned().unwrap_or_default().iter().enumerate() {
        let n = (i + 1) as u32;
        let label = s["label"].clone();
        let Some(hash) = reported.iter().find(|r| r.0 == n).map(|r| r.1.clone()) else {
            steps.push(json!({ "step": n, "label": label, "status": "not_signed_yet" }));
            continue;
        };
        let mut args = Map::new();
        args.insert("chain".into(), json!(chain_id));
        args.insert("hash".into(), json!(hash));
        match crate::txstatus::tx_status(&args, http, catalog).await {
            Ok(t) => {
                let status = t["status"].as_str().unwrap_or("unknown");
                let matches = t["from"].as_str().map(str::to_lowercase).as_deref() == Some(wallet.as_str())
                    && t["to"].as_str().map(str::to_lowercase) == s["to"].as_str().map(str::to_lowercase);
                if status == "confirmed" || status == "failed" {
                    steps.push(if matches {
                        json!({ "step": n, "label": label, "status": status, "hash": hash, "tokenTransfers": t["tokenTransfers"], "link": t["link"] })
                    } else {
                        json!({ "step": n, "label": label, "status": "not_signed_yet", "note": "A report for this step did not match the link (other wallet or contract) and was ignored." })
                    });
                } else {
                    steps.push(json!({ "step": n, "label": label, "status": status, "hash": hash }));
                }
            }
            Err(_) => steps.push(json!({ "step": n, "label": label, "status": "unknown", "hash": hash })),
        }
    }
    let done = steps.iter().all(|s| s["status"] == "confirmed");
    let failed = steps.iter().any(|s| s["status"] == "failed");
    Ok(json!({
        "title": plan["title"], "wallet": plan["wallet"], "chainId": plan["chainId"], "done": done, "steps": steps,
        "linkExpired": chrono::Utc::now().timestamp_millis() > plan["exp"].as_i64().unwrap_or(0),
        "next": if done { "All steps confirmed." } else if failed { "A step failed on chain: rebuild it and check the dry run." } else { "Not finished yet: the person can keep signing from the same link while it is valid." },
    }))
}

pub fn definitions(read: &Value) -> Vec<Value> {
    vec![json!({
        "name": "sign_status",
        "title": "What was signed from a sign link",
        "description": "After giving a person a btb.finance/sign link: which steps they have signed and whether each confirmed on chain, with the hashes and the tokens that moved. Each reported hash is checked on chain (sent from the link's wallet, to the step's contract). Call it when they say they are done, instead of asking for hashes.",
        "inputSchema": { "type": "object", "properties": { "signLink": { "type": "string", "description": "The signLink a build tool returned." } }, "required": ["signLink"] },
        "annotations": read,
    })]
}
