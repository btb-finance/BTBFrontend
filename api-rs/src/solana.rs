//! Solana wallets: SOL and every token (both token programs) from Jupiter's holdings API, prices and names from
//! Jupiter, grouped by the BTB protocols that live on Solana (Jupiter, Meteora, Pump, STKESOL), plus Pump creator
//! fees waiting to be claimed (bonding curve and PumpSwap vaults, read on chain). Read-only.

use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::time::Duration;

pub const SOL_MINT: &str = "So11111111111111111111111111111111111111112";
const PUMP_PROGRAM: &str = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const PUMP_AMM_PROGRAM: &str = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
const TOKEN_PROGRAM: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA_PROGRAM: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
/// Rent-exempt minimum of an account with no data: the part of a creator vault that is not fees.
const RENT_EMPTY: u64 = 890_880;
const STABLES: &[&str] = &["USDC", "USDT", "USDG", "PYUSD", "USDS", "USD1", "FDUSD"];

/// A Solana address: base58 that decodes to 32 bytes.
pub fn is_address(s: &str) -> bool {
    (32..=44).contains(&s.len()) && bs58::decode(s).into_vec().map(|b| b.len() == 32).unwrap_or(false)
}
fn key(s: &str) -> [u8; 32] {
    let mut k = [0u8; 32];
    k.copy_from_slice(&bs58::decode(s).into_vec().unwrap_or_else(|_| vec![0; 32])[..32]);
    k
}
/// A program-derived address: the first bump (from 255 down) whose hash is off the ed25519 curve.
pub fn pda(seeds: &[&[u8]], program: &str) -> String {
    let prog = key(program);
    for bump in (0u8..=255).rev() {
        let mut h = Sha256::new();
        for s in seeds {
            h.update(s);
        }
        h.update([bump]);
        h.update(prog);
        h.update(b"ProgramDerivedAddress");
        let out: [u8; 32] = h.finalize().into();
        if curve25519_dalek::edwards::CompressedEdwardsY(out).decompress().is_none() {
            return bs58::encode(out).into_string();
        }
    }
    String::new()
}
pub fn ata(owner: &str, mint: &str, token_program: &str) -> String {
    pda(&[&key(owner), &key(token_program), &key(mint)], ATA_PROGRAM)
}

fn rpc_url() -> String {
    std::env::var("SOLANA_RPC_URL").ok().filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "https://api.mainnet-beta.solana.com".into())
}
async fn rpc(http: &reqwest::Client, method: &str, params: Value) -> Result<Value, String> {
    let v: Value = http
        .post(rpc_url())
        .json(&json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params }))
        .timeout(Duration::from_secs(12))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    if let Some(e) = v.get("error") {
        return Err(e["message"].as_str().unwrap_or("RPC error").to_string());
    }
    Ok(v["result"].clone())
}
async fn get_json(http: &reqwest::Client, url: String) -> Result<Value, String> {
    let r = http.get(&url).header("user-agent", "btb-api").timeout(Duration::from_secs(12)).send().await.map_err(|e| e.to_string())?;
    if !r.status().is_success() {
        return Err(format!("HTTP {}", r.status().as_u16()));
    }
    r.json().await.map_err(|e| e.to_string())
}

/// Jupiter prices (USD) for mints, 50 per request.
pub async fn prices(http: &reqwest::Client, mints: &[String]) -> HashMap<String, f64> {
    let mut out = HashMap::new();
    let pages = futures::future::join_all(mints.chunks(50).map(|c| get_json(http, format!("https://lite-api.jup.ag/price/v3?ids={}", c.join(","))))).await;
    for p in pages.into_iter().flatten() {
        for (k, v) in p.as_object().into_iter().flatten() {
            if let Some(px) = v["usdPrice"].as_f64() {
                out.insert(k.clone(), px);
            }
        }
    }
    out
}
/// Jupiter token info (symbol, name, verified) for mints, 100 per request.
async fn token_info(http: &reqwest::Client, mints: &[String]) -> HashMap<String, Value> {
    let mut out = HashMap::new();
    let pages = futures::future::join_all(mints.chunks(100).map(|c| get_json(http, format!("https://lite-api.jup.ag/tokens/v2/search?query={}", c.join(","))))).await;
    for p in pages.into_iter().flatten() {
        for t in p.as_array().into_iter().flatten() {
            if let Some(id) = t["id"].as_str() {
                out.insert(id.to_string(), t.clone());
            }
        }
    }
    out
}

/// DefiLlama prices and symbols for Solana mints, 80 per request (no tight rate limit).
async fn llama(http: &reqwest::Client, mints: &[String]) -> (HashMap<String, f64>, HashMap<String, Value>) {
    let mut px = HashMap::new();
    let mut info = HashMap::new();
    let pages = futures::future::join_all(mints.chunks(80).map(|c| {
        get_json(http, format!("https://coins.llama.fi/prices/current/{}", c.iter().map(|m| format!("solana:{m}")).collect::<Vec<_>>().join(",")))
    }))
    .await;
    for p in pages.into_iter().flatten() {
        for (k, v) in p["coins"].as_object().into_iter().flatten() {
            let mint = k.trim_start_matches("solana:").to_string();
            if let Some(price) = v["price"].as_f64() {
                px.insert(mint.clone(), price);
                if let Some(sym) = v["symbol"].as_str() {
                    info.insert(mint, json!({ "symbol": sym.to_uppercase(), "isVerified": v["confidence"].as_f64().unwrap_or(0.0) >= 0.9 }));
                }
            }
        }
    }
    (px, info)
}

/// SOL of Pump creator fees the wallet can claim: (bonding curve, PumpSwap), its own vaults plus its share of
/// coins with a fee split (such as coins launched through BTB).
pub async fn creator_fees(http: &reqwest::Client, wallet: &str) -> Result<(f64, f64), String> {
    let (own, shared) = futures::join!(own_fees(http, wallet), shared_coins(http, wallet));
    let (mut curve, mut amm) = own?;
    for c in shared.unwrap_or_default() {
        curve += c.curve_sol * c.share;
        amm += c.amm_sol * c.share;
    }
    Ok((curve, amm))
}

/// SOL sitting in the wallet's own Pump creator vaults: (bonding curve, PumpSwap), in SOL.
async fn own_fees(http: &reqwest::Client, wallet: &str) -> Result<(f64, f64), String> {
    let curve_vault = pda(&[b"creator-vault", &key(wallet)], PUMP_PROGRAM);
    let amm_auth = pda(&[b"creator_vault", &key(wallet)], PUMP_AMM_PROGRAM);
    let amm_vault = ata(&amm_auth, SOL_MINT, TOKEN_PROGRAM);
    let r = rpc(http, "getMultipleAccounts", json!([[curve_vault, amm_vault], { "encoding": "jsonParsed" }])).await?;
    let accts = r["value"].as_array().cloned().unwrap_or_default();
    let curve = accts.first().and_then(|a| a["lamports"].as_u64()).map(|l| l.saturating_sub(RENT_EMPTY) as f64 / 1e9).unwrap_or(0.0);
    let amm = accts
        .get(1)
        .and_then(|a| a["data"]["parsed"]["info"]["tokenAmount"]["uiAmount"].as_f64())
        .unwrap_or(0.0);
    Ok((curve, amm))
}

fn protocol_of(mint: &str) -> Option<(&'static str, &'static str, &'static str)> {
    // (protocol, slug, category); registry mints first, then Pump's vanity "pump" mints.
    match mint {
        "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" => Some(("Jupiter Aggregator", "jupiter-aggregator", "DEX Aggregator")),
        "METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL" => Some(("Meteora DAMM V1", "meteora-damm-v1", "Dexs")),
        "stke7uu3fXHsGqKVVjKnkmj65LRPVrqr4bLG2SJg7rh" => Some(("STKESOL by SOL Strategies", "stkesol-by-sol-strategies", "Liquid Staking")),
        m if m.ends_with("pump") => Some(("Pump", "pump", "Launchpad")),
        _ => None,
    }
}
fn r2(x: f64) -> Value {
    crate::pools::num((x * 100.0).round() / 100.0)
}

/// SOL and token balances from the Solana RPC (both token programs), shaped like Jupiter's holdings answer.
async fn holdings_rpc(http: &reqwest::Client, wallet: &str) -> Result<Value, String> {
    let (bal, t1, t2) = futures::join!(
        rpc(http, "getBalance", json!([wallet])),
        rpc(http, "getTokenAccountsByOwner", json!([wallet, { "programId": TOKEN_PROGRAM }, { "encoding": "jsonParsed" }])),
        rpc(http, "getTokenAccountsByOwner", json!([wallet, { "programId": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" }, { "encoding": "jsonParsed" }])),
    );
    let lamports = bal?["value"].as_u64().unwrap_or(0);
    let mut tokens = Map::new();
    for acct in t1?["value"].as_array().into_iter().flatten().chain(t2.unwrap_or(Value::Null)["value"].as_array().into_iter().flatten()) {
        let info = &acct["account"]["data"]["parsed"]["info"];
        if let (Some(mint), Some(ui)) = (info["mint"].as_str(), info["tokenAmount"]["uiAmount"].as_f64()) {
            let list = tokens.entry(mint.to_string()).or_insert_with(|| json!([]));
            if let Some(arr) = list.as_array_mut() {
                arr.push(json!({ "uiAmount": ui }));
            }
        }
    }
    Ok(json!({ "uiAmount": lamports as f64 / 1e9, "tokens": tokens }))
}

pub async fn portfolio(http: &reqwest::Client, wallet: &str) -> Result<Value, String> {
    let (holdings, fees) = futures::join!(get_json(http, format!("https://lite-api.jup.ag/ultra/v1/holdings/{wallet}")), creator_fees(http, wallet));
    // Jupiter's free API throttles quickly; the Solana RPC gives the same balances in three calls.
    let holdings = match holdings {
        Ok(h) => h,
        Err(_) => holdings_rpc(http, wallet).await.map_err(|e| format!("Could not read the Solana wallet: {e}"))?,
    };
    let sol = holdings["uiAmount"].as_f64().unwrap_or(0.0);
    let mut balances: Vec<(String, f64)> = Vec::new();
    for (mint, accts) in holdings["tokens"].as_object().into_iter().flatten() {
        let amount: f64 = accts.as_array().into_iter().flatten().filter(|a| a["excludeFromNetWorth"].as_bool() != Some(true)).filter_map(|a| a["uiAmount"].as_f64()).sum();
        if amount > 0.0 {
            balances.push((mint.clone(), amount));
        }
    }
    let mut mints: Vec<String> = balances.iter().map(|b| b.0.clone()).collect();
    mints.push(SOL_MINT.into());
    let (mut px, mut info) = llama(http, &mints).await;
    let missing: Vec<String> = mints.iter().filter(|m| !px.contains_key(*m)).cloned().collect();
    if !missing.is_empty() {
        let (jp, ji) = futures::join!(prices(http, &missing), token_info(http, &missing));
        px.extend(jp);
        for (k, v) in ji {
            info.entry(k).or_insert(v);
        }
    }
    let sol_px = px.get(SOL_MINT).copied().unwrap_or(0.0);

    let mut groups: HashMap<&'static str, (&'static str, &'static str, f64, Vec<Value>)> = HashMap::new();
    let mut wallet_tokens = Vec::new();
    let mut by_kind: Map<String, Value> = Map::new();
    let mut add_kind = |k: &str, v: f64| {
        let cur = by_kind.get(k).and_then(|x| x.as_f64()).unwrap_or(0.0);
        by_kind.insert(k.into(), r2(cur + v));
    };
    let mut total_protocols = 0.0;
    let mut total_wallet = sol * sol_px;
    if sol > 0.0 {
        wallet_tokens.push(json!({ "chain": "Solana", "chainId": "solana", "symbol": "SOL", "name": "Solana", "address": "SOL", "amount": format!("{sol}"), "usd": r2(sol * sol_px) }));
        add_kind("wallet", sol * sol_px);
    }
    let mut hidden = 0usize;
    for (mint, amount) in &balances {
        let Some(price) = px.get(mint).copied() else {
            hidden += 1;
            continue;
        };
        let usd = amount * price;
        if usd < 0.01 {
            hidden += 1;
            continue;
        }
        let t = info.get(mint);
        let symbol = t.and_then(|t| t["symbol"].as_str()).unwrap_or("?").to_string();
        let row = json!({
            "chain": "Solana", "chainId": "solana", "symbol": symbol, "name": t.and_then(|t| t["name"].as_str()), "address": mint,
            "amount": format!("{amount}"), "usd": r2(usd), "verified": t.and_then(|t| t["isVerified"].as_bool()).unwrap_or(false),
        });
        if let Some((proto, slug, cat)) = protocol_of(mint) {
            let kind = if cat == "Liquid Staking" { "staked" } else if proto == "Pump" { "coin" } else { "token" };
            let mut r = row.clone();
            r["kind"] = json!(kind);
            let g = groups.entry(proto).or_insert((slug, cat, 0.0, vec![]));
            g.2 += usd;
            g.3.push(r);
            total_protocols += usd;
            add_kind(kind, usd);
        } else {
            let stable = STABLES.contains(&symbol.to_uppercase().as_str());
            total_wallet += usd;
            add_kind(if stable { "stablecoin" } else { "wallet" }, usd);
            wallet_tokens.push(row);
        }
    }
    let (curve_fees, amm_fees) = fees.unwrap_or((0.0, 0.0));
    let fees_sol = curve_fees + amm_fees;
    if fees_sol > 0.0 {
        let g = groups.entry("Pump").or_insert(("pump", "Launchpad", 0.0, vec![]));
        g.2 += fees_sol * sol_px;
        g.3.push(json!({ "chain": "Solana", "chainId": "solana", "kind": "fees", "name": "Creator fees to claim", "symbol": "SOL", "amount": format!("{fees_sol:.6}"), "usd": r2(fees_sol * sol_px),
            "detail": { "bondingCurveSol": r2(curve_fees), "pumpSwapSol": r2(amm_fees) } }));
        total_protocols += fees_sol * sol_px;
        add_kind("fees", fees_sol * sol_px);
    }
    let mut protocols: Vec<Value> = groups
        .into_iter()
        .map(|(name, (slug, cat, usd, mut positions))| {
            positions.sort_by(|a, b| b["usd"].as_f64().unwrap_or(0.0).total_cmp(&a["usd"].as_f64().unwrap_or(0.0)));
            json!({ "protocol": name, "slug": slug, "category": cat, "usd": r2(usd), "positions": positions })
        })
        .collect();
    protocols.sort_by(|a, b| b["usd"].as_f64().unwrap_or(0.0).total_cmp(&a["usd"].as_f64().unwrap_or(0.0)));
    wallet_tokens.sort_by(|a, b| b["usd"].as_f64().unwrap_or(0.0).total_cmp(&a["usd"].as_f64().unwrap_or(0.0)));
    Ok(json!({
        "wallet": wallet, "chain": "Solana",
        "totalUsd": r2(total_protocols), "debtUsd": 0, "walletUsd": r2(total_wallet), "netUsd": r2(total_protocols + total_wallet),
        "byKind": by_kind,
        "protocols": protocols,
        "walletTokens": wallet_tokens,
        "pumpCreatorFees": { "sol": r2(fees_sol), "usd": r2(fees_sol * sol_px), "bondingCurveSol": r2(curve_fees), "pumpSwapSol": r2(amm_fees), "claim": "Claiming through BTB is coming; for now claim on pump.fun." },
        "coverage": { "chain": "Solana", "protocols": ["Jupiter (JUP)", "Meteora (MET)", "Pump (coins and creator fees)", "STKESOL"], "hiddenTokens": hidden, "notReadHereYet": ["Meteora liquidity positions"] },
        "notes": ["Public on-chain data, read-only. Balances from Jupiter's holdings API, prices from Jupiter; tokens without a price or worth under a cent are hidden (often spam)."],
    }))
}

#[cfg(test)]
mod tests {
    #[test]
    fn ata_matches_chain() {
        // From Jupiter's holdings for this owner: its associated token account for this mint.
        assert_eq!(
            super::ata("JUPhop9E8ZfdJ5FNHhxQt4uAih822Vs4QpqsWcewFbq", "JxxWsvm9jHt4ah7DT9NuLyVLYZcZLUdPD93PcPQ71Ka", super::TOKEN_PROGRAM),
            "KgRjF5h49DU8URPpSfhMfwosfgvYYhAPUikMvJG3NYh"
        );
        assert!(super::is_address("JUPhop9E8ZfdJ5FNHhxQt4uAih822Vs4QpqsWcewFbq"));
        assert!(!super::is_address("0xA6a1f137D07bE21A0BF4d15B11D295A09DF04d22"));
    }
}

// ---- building unsigned transactions ----

pub struct Meta {
    pub key: String,
    pub signer: bool,
    pub writable: bool,
}
pub fn m(key: &str, signer: bool, writable: bool) -> Meta {
    Meta { key: key.to_string(), signer, writable }
}
pub struct Ix {
    pub program: String,
    pub accounts: Vec<Meta>,
    pub data: Vec<u8>,
}

fn compact(n: usize, out: &mut Vec<u8>) {
    let mut v = n;
    loop {
        let mut b = (v & 0x7f) as u8;
        v >>= 7;
        if v != 0 {
            b |= 0x80;
        }
        out.push(b);
        if v == 0 {
            break;
        }
    }
}

/// A legacy transaction with one signer (the fee payer), signature left empty, as base64.
pub fn legacy_tx(payer: &str, ixs: &[Ix], blockhash: &str) -> String {
    // Unique accounts with merged flags; the payer first, then signers, writables, read-only, programs last.
    let mut keys: Vec<(String, bool, bool)> = vec![(payer.to_string(), true, true)];
    let mut upsert = |k: &str, s: bool, w: bool| {
        if let Some(e) = keys.iter_mut().find(|e| e.0 == k) {
            e.1 |= s;
            e.2 |= w;
        } else {
            keys.push((k.to_string(), s, w));
        }
    };
    for ix in ixs {
        for a in &ix.accounts {
            upsert(&a.key, a.signer, a.writable);
        }
    }
    for ix in ixs {
        upsert(&ix.program, false, false);
    }
    let rank = |e: &(String, bool, bool)| match (e.1, e.2) { (true, true) => 0, (true, false) => 1, (false, true) => 2, (false, false) => 3 };
    let payer_entry = keys.remove(0);
    keys.sort_by_key(|e| rank(e));
    keys.insert(0, payer_entry);
    let signers = keys.iter().filter(|e| e.1).count();
    let ro_signed = keys.iter().filter(|e| e.1 && !e.2).count();
    let ro_unsigned = keys.iter().filter(|e| !e.1 && !e.2).count();
    let idx = |k: &str| keys.iter().position(|e| e.0 == k).unwrap() as u8;
    let mut msg = vec![signers as u8, ro_signed as u8, ro_unsigned as u8];
    compact(keys.len(), &mut msg);
    for e in &keys {
        msg.extend_from_slice(&key(&e.0));
    }
    msg.extend_from_slice(&key(blockhash));
    compact(ixs.len(), &mut msg);
    for ix in ixs {
        msg.push(idx(&ix.program));
        compact(ix.accounts.len(), &mut msg);
        for a in &ix.accounts {
            msg.push(idx(&a.key));
        }
        compact(ix.data.len(), &mut msg);
        msg.extend_from_slice(&ix.data);
    }
    let mut tx = Vec::new();
    compact(signers, &mut tx);
    tx.extend(std::iter::repeat(0u8).take(64 * signers));
    tx.extend(msg);
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, tx)
}

/// A sent transaction: ("confirmed" | "failed" | "pending", whether `wallet` paid for it).
pub async fn signature_status(http: &reqwest::Client, sig: &str, wallet: &str) -> Result<(&'static str, bool), String> {
    let t = rpc(http, "getTransaction", json!([sig, { "encoding": "json", "maxSupportedTransactionVersion": 0, "commitment": "confirmed" }])).await?;
    if t.is_null() {
        return Ok(("pending", true));
    }
    let payer = t["transaction"]["message"]["accountKeys"][0].as_str().unwrap_or("");
    Ok((if t["meta"]["err"].is_null() { "confirmed" } else { "failed" }, payer == wallet))
}

pub async fn latest_blockhash(http: &reqwest::Client) -> Result<String, String> {
    let r = rpc(http, "getLatestBlockhash", json!([{ "commitment": "confirmed" }])).await?;
    r["value"]["blockhash"].as_str().map(String::from).ok_or_else(|| "no blockhash".into())
}

/// Dry run on the cluster without signatures: passed, or the program's error and its last log lines.
pub async fn simulate(http: &reqwest::Client, tx_b64: &str) -> Value {
    match rpc(http, "simulateTransaction", json!([tx_b64, { "encoding": "base64", "sigVerify": false, "replaceRecentBlockhash": true, "commitment": "confirmed" }])).await {
        Ok(r) => {
            let v = &r["value"];
            if v["err"].is_null() {
                json!({ "status": "passed", "computeUnits": v["unitsConsumed"] })
            } else {
                let logs: Vec<Value> = v["logs"].as_array().cloned().unwrap_or_default();
                let tail: Vec<Value> = logs.iter().rev().take(4).rev().cloned().collect();
                json!({ "status": "reverted", "error": v["err"], "logs": tail })
            }
        }
        Err(e) => json!({ "status": "not_run", "reason": e }),
    }
}

const SYSTEM_PROGRAM: &str = "11111111111111111111111111111111";

/// Claim every Pump creator fee the wallet has: bonding curve (SOL) and PumpSwap (wrapped SOL, unwrapped here).
pub async fn build_pump_claim(http: &reqwest::Client, wallet: &str) -> Result<Value, String> {
    let (own, shared) = futures::join!(own_fees(http, wallet), shared_coins(http, wallet));
    let (curve, amm) = own?;
    let shared: Vec<SharedCoin> = shared.unwrap_or_default().into_iter().filter(|c| c.curve_sol + c.amm_sol > 0.000_001).take(4).collect();
    let shared_mine: f64 = shared.iter().map(|c| (c.curve_sol + c.amm_sol) * c.share).sum();
    let (px, _) = llama(http, &[SOL_MINT.to_string()]).await;
    let sol_px = px.get(SOL_MINT).copied().unwrap_or(0.0);
    if curve + amm + shared_mine < 0.000_001 {
        return Err("This wallet has no Pump creator fees to claim right now.".into());
    }
    let mut ixs = Vec::new();
    let (curve, amm) = (if curve > 0.000_001 { curve } else { 0.0 }, if amm > 0.000_001 { amm } else { 0.0 });
    let mut labels = Vec::new();
    if curve > 0.0 {
        let vault = pda(&[b"creator-vault", &key(wallet)], PUMP_PROGRAM);
        let ev = pda(&[b"__event_authority"], PUMP_PROGRAM);
        ixs.push(Ix {
            program: PUMP_PROGRAM.into(),
            accounts: vec![m(wallet, false, true), m(&vault, false, true), m(SYSTEM_PROGRAM, false, false), m(&ev, false, false), m(PUMP_PROGRAM, false, false)],
            data: vec![20, 22, 86, 123, 198, 28, 219, 132],
        });
        labels.push(format!("Claim {curve:.6} SOL of bonding-curve creator fees"));
    }
    if amm > 0.0 {
        let auth = pda(&[b"creator_vault", &key(wallet)], PUMP_AMM_PROGRAM);
        let vault_ata = ata(&auth, SOL_MINT, TOKEN_PROGRAM);
        let my_wsol = ata(wallet, SOL_MINT, TOKEN_PROGRAM);
        let exists = rpc(http, "getAccountInfo", json!([my_wsol, { "encoding": "base64" }])).await.map(|r| !r["value"].is_null()).unwrap_or(false);
        // Create the wrapped-SOL account if needed (idempotent), collect into it, then close it to unwrap to SOL.
        ixs.push(Ix {
            program: ATA_PROGRAM.into(),
            accounts: vec![m(wallet, true, true), m(&my_wsol, false, true), m(wallet, false, false), m(SOL_MINT, false, false), m(SYSTEM_PROGRAM, false, false), m(TOKEN_PROGRAM, false, false)],
            data: vec![1],
        });
        let ev = pda(&[b"__event_authority"], PUMP_AMM_PROGRAM);
        ixs.push(Ix {
            program: PUMP_AMM_PROGRAM.into(),
            accounts: vec![
                m(SOL_MINT, false, false), m(TOKEN_PROGRAM, false, false), m(wallet, false, false), m(&auth, false, false),
                m(&vault_ata, false, true), m(&my_wsol, false, true), m(&ev, false, false), m(PUMP_AMM_PROGRAM, false, false),
            ],
            data: vec![160, 57, 89, 42, 181, 139, 43, 66],
        });
        if !exists {
            ixs.push(Ix { program: TOKEN_PROGRAM.into(), accounts: vec![m(&my_wsol, false, true), m(wallet, false, true), m(wallet, true, false)], data: vec![9] });
        }
        labels.push(format!("Claim {amm:.6} SOL of PumpSwap creator fees{}", if exists { " (kept as wrapped SOL in your existing account)" } else { "" }));
    }
    let mut shared_out = Vec::new();
    for c in &shared {
        ixs.extend(distribute_ixs(wallet, c));
        let mine = (c.curve_sol + c.amm_sol) * c.share;
        labels.push(format!("Pay out {:.6} SOL of creator fees on {} to its {} shareholders ({:.6} SOL to you)", c.curve_sol + c.amm_sol, c.mint, c.shareholders.len(), mine));
        shared_out.push(json!({ "mint": c.mint, "totalSol": crate::pools::num(((c.curve_sol + c.amm_sol) * 1e6).round() / 1e6), "yourShareBps": (c.share * 10_000.0).round(), "yourSol": crate::pools::num((mine * 1e6).round() / 1e6), "graduated": c.complete }));
    }
    let blockhash = latest_blockhash(http).await?;
    let (tx, format) = if shared.is_empty() {
        (legacy_tx(wallet, &ixs, &blockhash), "legacy")
    } else {
        let lut_addr = env_or("PUMP_LOOKUP_TABLE", PUMP_LUT);
        let lut_keys = lookup_table(http, &lut_addr).await;
        let lut = (!lut_keys.is_empty()).then(|| (lut_addr.as_str(), lut_keys.as_slice()));
        let (msg, signers) = v0_message(wallet, &ixs, &blockhash, lut);
        (with_signatures(&msg, &signers, &[]), "v0")
    };
    let sim = simulate(http, &tx).await;
    let total = curve + amm + shared_mine;
    let out: Result<Value, String> = Ok(json!({
        "chain": "Solana", "wallet": wallet,
        "claim": { "sol": crate::pools::num((total * 1e6).round() / 1e6), "usd": r2(total * sol_px), "bondingCurveSol": crate::pools::num((curve * 1e6).round() / 1e6), "pumpSwapSol": crate::pools::num((amm * 1e6).round() / 1e6), "sharedCoins": shared_out },
        "btbFee": "None: claiming through BTB is free.",
        "steps": labels,
        "simulation": sim,
        "transaction": { "encoding": "base64", "format": format, "signer": wallet, "data": tx, "recentBlockhash": blockhash,
            "expires": "About 60 to 90 seconds after it was built: sign and send right away, or call build_pump_claim again." },
        "notes": ["Fees go to the wallets in each split (for your own coins, the wallet that signs). Nothing was signed or sent. Give a person the signLink to sign on btb.finance; agents with a Solana wallet can sign the transaction directly."],
    }));
    Ok(crate::signlink::with_solana_sign_link(out?, &format!("Claim {:.4} SOL of Pump creator fees", total), wallet, "Claim creator fees", "build_pump_claim", json!({ "wallet": wallet })))
}

// ---- versioned (v0) transactions: lookup tables keep big launches under the 1232-byte limit ----

/// A v0 message: signers and invoked programs stay in the message, every other account found in the lookup
/// table is loaded from it. Returns the message bytes and the signer keys in signature order.
pub fn v0_message(payer: &str, ixs: &[Ix], blockhash: &str, lut: Option<(&str, &[String])>) -> (Vec<u8>, Vec<String>) {
    let mut keys: Vec<(String, bool, bool)> = vec![(payer.to_string(), true, true)];
    let mut upsert = |k: &str, s: bool, w: bool| {
        if let Some(e) = keys.iter_mut().find(|e| e.0 == k) {
            e.1 |= s;
            e.2 |= w;
        } else {
            keys.push((k.to_string(), s, w));
        }
    };
    for ix in ixs {
        for a in &ix.accounts {
            upsert(&a.key, a.signer, a.writable);
        }
    }
    for ix in ixs {
        upsert(&ix.program, false, false);
    }
    let programs: Vec<&str> = ixs.iter().map(|i| i.program.as_str()).collect();
    let in_lut = |k: &str| lut.and_then(|(_, list)| list.iter().position(|x| x == k));
    let (mut stat, mut looked): (Vec<_>, Vec<_>) = keys.into_iter().partition(|e| e.1 || programs.contains(&e.0.as_str()) || in_lut(&e.0).is_none());
    let rank = |e: &(String, bool, bool)| match (e.1, e.2) { (true, true) => 0, (true, false) => 1, (false, true) => 2, (false, false) => 3 };
    let payer_entry = stat.remove(0);
    stat.sort_by_key(|e| rank(e));
    stat.insert(0, payer_entry);
    looked.sort_by_key(|e| !e.2);
    let lut_w: Vec<&(String, bool, bool)> = looked.iter().filter(|e| e.2).collect();
    let lut_r: Vec<&(String, bool, bool)> = looked.iter().filter(|e| !e.2).collect();
    let order: Vec<&str> = stat.iter().map(|e| e.0.as_str()).chain(lut_w.iter().map(|e| e.0.as_str())).chain(lut_r.iter().map(|e| e.0.as_str())).collect();
    let idx = |k: &str| order.iter().position(|x| *x == k).unwrap() as u8;
    let signers: Vec<String> = stat.iter().filter(|e| e.1).map(|e| e.0.clone()).collect();
    let mut msg = vec![0x80, signers.len() as u8, stat.iter().filter(|e| e.1 && !e.2).count() as u8, stat.iter().filter(|e| !e.1 && !e.2).count() as u8];
    compact(stat.len(), &mut msg);
    for e in &stat {
        msg.extend_from_slice(&key(&e.0));
    }
    msg.extend_from_slice(&key(blockhash));
    compact(ixs.len(), &mut msg);
    for ix in ixs {
        msg.push(idx(&ix.program));
        compact(ix.accounts.len(), &mut msg);
        for a in &ix.accounts {
            msg.push(idx(&a.key));
        }
        compact(ix.data.len(), &mut msg);
        msg.extend_from_slice(&ix.data);
    }
    match lut {
        Some((addr, list)) if !looked.is_empty() => {
            msg.push(1);
            msg.extend_from_slice(&key(addr));
            for group in [&lut_w, &lut_r] {
                compact(group.len(), &mut msg);
                for e in group.iter() {
                    msg.push(list.iter().position(|x| *x == e.0).unwrap() as u8);
                }
            }
        }
        _ => msg.push(0),
    }
    (msg, signers)
}

/// Signature slots in signer order, with the given signatures filled in (others left empty for the wallet).
pub fn with_signatures(msg: &[u8], signers: &[String], sigs: &[(String, [u8; 64])]) -> String {
    let mut tx = Vec::new();
    compact(signers.len(), &mut tx);
    for s in signers {
        match sigs.iter().find(|(k, _)| k == s) {
            Some((_, sig)) => tx.extend_from_slice(sig),
            None => tx.extend_from_slice(&[0u8; 64]),
        }
    }
    tx.extend_from_slice(msg);
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, tx)
}

/// The addresses stored in an address lookup table (empty if it is missing or deactivated).
pub async fn lookup_table(http: &reqwest::Client, addr: &str) -> Vec<String> {
    let Ok(r) = rpc(http, "getAccountInfo", json!([addr, { "encoding": "base64" }])).await else { return vec![] };
    let Some(b64) = r["value"]["data"][0].as_str() else { return vec![] };
    let Ok(d) = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, b64) else { return vec![] };
    if d.len() < 56 || u64::from_le_bytes(d[4..12].try_into().unwrap()) != u64::MAX {
        return vec![];
    }
    d[56..].chunks_exact(32).map(|c| bs58::encode(c).into_string()).collect()
}

async fn account_data(http: &reqwest::Client, addr: &str) -> Result<Vec<u8>, String> {
    let r = rpc(http, "getAccountInfo", json!([addr, { "encoding": "base64" }])).await?;
    let b64 = r["value"]["data"][0].as_str().ok_or("account not found")?;
    base64::Engine::decode(&base64::engine::general_purpose::STANDARD, b64).map_err(|e| e.to_string())
}

// ---- launching a Pump coin ----

const TOKEN_2022: &str = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const MAYHEM_PROGRAM: &str = "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e";
const PUMP_FEES_PROGRAM: &str = "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";
/// BTB's Solana wallet: receives BTB's share of creator fees on coins launched through BTB.
const BTB_SOLANA_TREASURY: &str = "6rwjqXtsz8m8b6ufMEAGfqEAaSdsGEQ9bDjP1fjDJ5fv";
/// A public lookup table holding Pump's programs, global accounts and fee recipients.
const PUMP_LUT: &str = "Hyif6eWb8x88RVrvjPfabsgRYnwkVnyByEXTVTXbUcyP";

fn env_or(k: &str, d: &str) -> String {
    std::env::var(k).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).unwrap_or_else(|| d.to_string())
}
fn borsh_str(s: &str, out: &mut Vec<u8>) {
    out.extend_from_slice(&(s.len() as u32).to_le_bytes());
    out.extend_from_slice(s.as_bytes());
}

pub struct Launch {
    pub wallet: String,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub dev_buy_sol: f64,
}

/// One transaction that creates a Pump coin (Token-2022, SOL curve), sets the creator-fee split with BTB's
/// share, and makes the creator's first buy, so nobody can buy before them. A fresh mint key is made here and
/// signs only for the new coin; the creator's wallet signs as fee payer.
pub async fn build_pump_launch(http: &reqwest::Client, l: Launch) -> Result<Value, String> {
    let wallet = l.wallet.as_str();
    let treasury = env_or("BTB_SOLANA_TREASURY", BTB_SOLANA_TREASURY);
    let share_bps: u16 = env_or("BTB_PUMP_SHARE_BPS", "1000").parse().unwrap_or(1000).min(5000);
    let sharing = share_bps > 0 && is_address(&treasury) && treasury != wallet;

    // The coin's mint key: random, used once to sign this transaction, never stored.
    let mut seed = [0u8; 32];
    getrandom::getrandom(&mut seed).map_err(|e| e.to_string())?;
    let mint_key = ed25519_dalek::SigningKey::from_bytes(&seed);
    let mint = bs58::encode(mint_key.verifying_key().to_bytes()).into_string();

    let global = pda(&[b"global"], PUMP_PROGRAM);
    let g = account_data(http, &global).await?;
    if g.len() < 1005 {
        return Err("Pump's global account has an unexpected layout; launches are paused until BTB updates.".into());
    }
    let pk = |o: usize| bs58::encode(&g[o..o + 32]).into_string();
    let u64at = |o: usize| u64::from_le_bytes(g[o..o + 8].try_into().unwrap());
    let fee_recipient = pk(41);
    let (vtr, vsr) = (u64at(73), u64at(81));
    let buyback = pk(741);

    let mint_auth = pda(&[b"mint-authority"], PUMP_PROGRAM);
    let curve = pda(&[b"bonding-curve", &key(&mint)], PUMP_PROGRAM);
    let curve_ata = ata(&curve, &mint, TOKEN_2022);
    let ev = pda(&[b"__event_authority"], PUMP_PROGRAM);
    let sol_vault = pda(&[b"sol-vault"], MAYHEM_PROGRAM);
    let mut ixs = Vec::new();

    let mut data = vec![214, 144, 76, 236, 95, 139, 49, 180];
    borsh_str(&l.name, &mut data);
    borsh_str(&l.symbol, &mut data);
    borsh_str(&l.uri, &mut data);
    data.extend_from_slice(&key(wallet));
    data.extend_from_slice(&[0, 0]); // not mayhem mode, no cashback
    data.extend_from_slice(&0u64.to_le_bytes()); // creator fee from the standard schedule
    data.push(0); // not a holder-reward coin
    ixs.push(Ix {
        program: PUMP_PROGRAM.into(),
        accounts: vec![
            m(&mint, true, true), m(&mint_auth, false, false), m(&curve, false, true), m(&curve_ata, false, true),
            m(&global, false, false), m(wallet, true, true), m(SYSTEM_PROGRAM, false, false), m(TOKEN_2022, false, false),
            m(ATA_PROGRAM, false, false), m(MAYHEM_PROGRAM, false, true), m(&pda(&[b"global-params"], MAYHEM_PROGRAM), false, false),
            m(&sol_vault, false, true), m(&pda(&[b"mayhem-state", &key(&mint)], MAYHEM_PROGRAM), false, true),
            m(&ata(&sol_vault, &mint, TOKEN_2022), false, true), m(&ev, false, false), m(PUMP_PROGRAM, false, false),
        ],
        data,
    });

    let mut creator = wallet.to_string();
    if sharing {
        let fee_ev = pda(&[b"__event_authority"], PUMP_FEES_PROGRAM);
        let amm_ev = pda(&[b"__event_authority"], PUMP_AMM_PROGRAM);
        let config = pda(&[b"sharing-config", &key(&mint)], PUMP_FEES_PROGRAM);
        ixs.push(Ix {
            program: PUMP_FEES_PROGRAM.into(),
            accounts: vec![
                m(&fee_ev, false, false), m(PUMP_FEES_PROGRAM, false, false), m(wallet, true, true), m(&global, false, false),
                m(&mint, false, false), m(&config, false, true), m(SYSTEM_PROGRAM, false, false), m(&curve, false, true),
                m(PUMP_PROGRAM, false, false), m(&ev, false, false), m(PUMP_FEES_PROGRAM, false, false), // no pool yet
                m(PUMP_AMM_PROGRAM, false, false), m(&amm_ev, false, false),
            ],
            data: vec![195, 78, 86, 76, 111, 52, 251, 213],
        });
        let vault_auth = pda(&[b"creator_vault", &key(&config)], PUMP_AMM_PROGRAM);
        let mut data = vec![189, 13, 136, 99, 187, 164, 237, 35];
        data.extend_from_slice(&2u32.to_le_bytes());
        data.extend_from_slice(&key(wallet));
        data.extend_from_slice(&(10_000 - share_bps).to_le_bytes());
        data.extend_from_slice(&key(&treasury));
        data.extend_from_slice(&share_bps.to_le_bytes());
        ixs.push(Ix {
            program: PUMP_FEES_PROGRAM.into(),
            accounts: vec![
                m(&fee_ev, false, false), m(PUMP_FEES_PROGRAM, false, false), m(wallet, true, false), m(&global, false, false),
                m(&mint, false, false), m(&config, false, true), m(&curve, false, false),
                m(&pda(&[b"creator-vault", &key(&config)], PUMP_PROGRAM), false, true), m(SYSTEM_PROGRAM, false, false),
                m(PUMP_PROGRAM, false, false), m(&ev, false, false), m(PUMP_AMM_PROGRAM, false, false), m(&amm_ev, false, false),
                m(SOL_MINT, false, false), m(TOKEN_PROGRAM, false, false), m(ATA_PROGRAM, false, false),
                m(&vault_auth, false, true), m(&ata(&vault_auth, SOL_MINT, TOKEN_PROGRAM), false, true),
                m(wallet, false, true), // the current shareholder (the creator, 100%)
            ],
            data,
        });
        creator = config;
    }

    let mut tokens_ui = 0.0;
    let buy_lamports = (l.dev_buy_sol * 1e9).round() as u64;
    if buy_lamports > 0 {
        // Tokens for the SOL after fees, assuming fees of at most 3% so the buy never costs more than asked.
        let net = (buy_lamports as u128) * 10_000 / 10_300;
        let tokens = (net.saturating_sub(1) * vtr as u128 / (vsr as u128 + net.saturating_sub(1))) as u64;
        tokens_ui = tokens as f64 / 1e6;
        let my_ata = ata(wallet, &mint, TOKEN_2022);
        ixs.push(Ix {
            program: ATA_PROGRAM.into(),
            accounts: vec![m(wallet, true, true), m(&my_ata, false, true), m(wallet, false, false), m(&mint, false, false), m(SYSTEM_PROGRAM, false, false), m(TOKEN_2022, false, false)],
            data: vec![1],
        });
        let mut data = vec![102, 6, 61, 18, 1, 218, 235, 234];
        data.extend_from_slice(&tokens.to_le_bytes());
        data.extend_from_slice(&buy_lamports.to_le_bytes());
        data.extend_from_slice(&[1, 0]); // track volume, no partial fill
        ixs.push(Ix {
            program: PUMP_PROGRAM.into(),
            accounts: vec![
                m(&global, false, false), m(&fee_recipient, false, true), m(&mint, false, false), m(&curve, false, true),
                m(&curve_ata, false, true), m(&my_ata, false, true), m(wallet, true, true), m(SYSTEM_PROGRAM, false, false),
                m(TOKEN_2022, false, false), m(&pda(&[b"creator-vault", &key(&creator)], PUMP_PROGRAM), false, true), m(&ev, false, false),
                m(PUMP_PROGRAM, false, false), m(&pda(&[b"global_volume_accumulator"], PUMP_PROGRAM), false, false),
                m(&pda(&[b"user_volume_accumulator", &key(wallet)], PUMP_PROGRAM), false, true),
                m(&pda(&[b"fee_config", &key(PUMP_PROGRAM)], PUMP_FEES_PROGRAM), false, false), m(PUMP_FEES_PROGRAM, false, false),
                m(&pda(&[b"bonding-curve-v2", &key(&mint)], PUMP_PROGRAM), false, false), m(&buyback, false, true),
            ],
            data,
        });
    }

    let lut_addr = env_or("PUMP_LOOKUP_TABLE", PUMP_LUT);
    let lut_keys = lookup_table(http, &lut_addr).await;
    let blockhash = latest_blockhash(http).await?;
    let lut = (!lut_keys.is_empty()).then(|| (lut_addr.as_str(), lut_keys.as_slice()));
    let (msg, signers) = v0_message(wallet, &ixs, &blockhash, lut);
    use ed25519_dalek::Signer;
    let mint_sig = mint_key.sign(&msg).to_bytes();
    let tx = with_signatures(&msg, &signers, &[(mint.clone(), mint_sig)]);
    let size = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &tx).map(|b| b.len()).unwrap_or(0);
    if size > 1232 {
        return Err(format!("The launch transaction is {size} bytes, over Solana's 1232 limit (lookup table {}). Try a shorter name, symbol or metadata link.", if lut.is_some() { "used" } else { "unavailable" }));
    }
    let sim = simulate(http, &tx).await;

    let mut steps = vec![format!("Create {} (${}) on Pump, with your wallet as creator", l.name, l.symbol)];
    if sharing {
        steps.push(format!("Split creator fees: {}% to you, {}% to BTB. Pump allows this split to be set only once.", (10_000 - share_bps) as f64 / 100.0, share_bps as f64 / 100.0));
    }
    if buy_lamports > 0 {
        steps.push(format!("First buy: up to {} SOL for about {} tokens, in the same transaction so nobody buys before you", l.dev_buy_sol, (tokens_ui as u64)));
    }
    let out = json!({
        "chain": "Solana", "wallet": wallet,
        "coin": { "mint": mint, "name": l.name, "symbol": l.symbol, "metadataUri": l.uri, "pumpUrl": format!("https://pump.fun/coin/{mint}") },
        "creatorFees": if sharing {
            json!({ "creatorBps": 10_000 - share_bps, "btbBps": share_bps, "btbWallet": treasury, "how": "Pump sends creator fees to a sharing config for this coin; anyone can distribute them to the shareholders." })
        } else { json!({ "creatorBps": 10_000, "btbBps": 0 }) },
        "firstBuy": if buy_lamports > 0 { json!({ "maxSol": l.dev_buy_sol, "tokens": crate::pools::num(tokens_ui.round()) }) } else { Value::Null },
        "cost": format!("Network fees and rent, about 0.02 to 0.03 SOL{}", if buy_lamports > 0 { format!(", plus the first buy of up to {} SOL", l.dev_buy_sol) } else { String::new() }),
        "steps": steps,
        "simulation": sim,
        "transaction": { "encoding": "base64", "format": "v0", "signers": signers, "signedBy": [mint], "data": tx, "recentBlockhash": blockhash, "bytes": size,
            "expires": "About 60 to 90 seconds after it was built. It is already signed by the new coin's mint key, so the wallet must not change the blockhash: sign and send right away, or call build_pump_launch again (that makes a new mint address)." },
        "notes": [
            "Nothing was sent. The creator's wallet signs as fee payer; the mint key was made for this coin only and is not kept.",
            "Most new Pump coins lose almost all their value. Launch only with SOL you can afford to lose.",
        ],
    });
    // The sign page rebuilds at signing time (new mint key and blockhash), so the link carries the arguments.
    let args = json!({ "wallet": wallet, "name": l.name, "symbol": l.symbol, "metadataUri": l.uri, "devBuySol": l.dev_buy_sol });
    Ok(crate::signlink::with_solana_sign_link(out, &format!("Launch {} (${}) on Pump", l.name, l.symbol), wallet, "Launch the coin", "build_pump_launch", args))
}

#[cfg(test)]
mod launch_live {
    /// Dry run against mainnet: `cargo test launch_live -- --ignored --nocapture` with LAUNCH_WALLET set to a funded wallet.
    #[tokio::test]
    #[ignore]
    async fn launch_dry_run() {
        let http = reqwest::Client::new();
        let wallet = std::env::var("LAUNCH_WALLET").unwrap();
        for dev in [0.0, 0.05] {
            let v = super::build_pump_launch(&http, super::Launch { wallet: wallet.clone(), name: "Test Coin".into(), symbol: "TEST".into(), uri: "https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG".into(), dev_buy_sol: dev }).await;
            match v {
                Ok(v) => {
                    println!("dev {dev}: bytes {} sim {}", v["transaction"]["bytes"], v["simulation"]);
                    let mint = v["coin"]["mint"].as_str().unwrap();
                    let config = super::pda(&[b"sharing-config", &super::key(mint)], super::PUMP_FEES_PROGRAM);
                    let curve = super::pda(&[b"bonding-curve", &super::key(mint)], super::PUMP_PROGRAM);
                    let r = super::rpc(&http, "simulateTransaction", serde_json::json!([v["transaction"]["data"], { "encoding": "base64", "sigVerify": false, "replaceRecentBlockhash": true, "accounts": { "addresses": [config, curve], "encoding": "base64" } }])).await.unwrap();
                    for (i, a) in r["value"]["accounts"].as_array().unwrap().iter().enumerate() {
                        let d = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, a["data"][0].as_str().unwrap()).unwrap();
                        println!("account {i}: {} bytes", d.len());
                        if i == 0 {
                            let n = u32::from_le_bytes(d[76..80].try_into().unwrap()) as usize;
                            for j in 0..n { let o = 80 + j * 34; println!("  shareholder {} {}", bs58::encode(&d[o..o + 32]).into_string(), u16::from_le_bytes(d[o + 32..o + 34].try_into().unwrap())); }
                        } else {
                            println!("  curve creator {}", bs58::encode(&d[49..81]).into_string());
                        }
                    }
                }
                Err(e) => println!("dev {dev}: error {e}"),
            }
        }
    }
}

// ---- coins with a creator-fee split (Pump fee sharing) ----

pub struct SharedCoin {
    pub config: String,
    pub mint: String,
    pub shareholders: Vec<String>,
    /// This wallet's fraction of the coin's creator fees.
    pub share: f64,
    pub complete: bool,
    /// SOL waiting: in the bonding-curve vault (plus unswept fees on the curve), and in the PumpSwap vault.
    pub curve_sol: f64,
    pub amm_sol: f64,
    pub curve_bucket: u64,
}

/// Coins whose fee split names the wallet as first or second shareholder, with the fees waiting on each.
pub async fn shared_coins(http: &reqwest::Client, wallet: &str) -> Result<Vec<SharedCoin>, String> {
    let disc = bs58::encode([216u8, 74, 9, 0, 56, 140, 93, 75]).into_string();
    let query = |offset: usize| {
        rpc(http, "getProgramAccounts", json!([PUMP_FEES_PROGRAM, { "encoding": "base64", "filters": [
            { "memcmp": { "offset": 0, "bytes": disc } }, { "memcmp": { "offset": offset, "bytes": wallet } } ] }]))
    };
    let (a, b) = futures::join!(query(80), query(114));
    let mut configs: Vec<(String, Vec<u8>)> = Vec::new();
    for list in [a?, b.unwrap_or(Value::Null)] {
        for acct in list.as_array().cloned().unwrap_or_default() {
            let Some(addr) = acct["pubkey"].as_str() else { continue };
            let Some(d) = acct["account"]["data"][0].as_str().and_then(|x| base64::Engine::decode(&base64::engine::general_purpose::STANDARD, x).ok()) else { continue };
            if d.len() >= 80 && !configs.iter().any(|(k, _)| k == addr) {
                configs.push((addr.to_string(), d));
            }
        }
    }
    let mut out = Vec::new();
    for (config, d) in configs.into_iter().take(20) {
        let mint = bs58::encode(&d[11..43]).into_string();
        let n = (u32::from_le_bytes(d[76..80].try_into().unwrap()) as usize).min(10);
        let mut holders = Vec::new();
        let mut share = 0.0;
        for j in 0..n {
            let o = 80 + j * 34;
            if d.len() < o + 34 {
                break;
            }
            let h = bs58::encode(&d[o..o + 32]).into_string();
            if h == wallet {
                share += u16::from_le_bytes(d[o + 32..o + 34].try_into().unwrap()) as f64 / 10_000.0;
            }
            holders.push(h);
        }
        let curve = pda(&[b"bonding-curve", &key(&mint)], PUMP_PROGRAM);
        let vault = pda(&[b"creator-vault", &key(&config)], PUMP_PROGRAM);
        let amm_auth = pda(&[b"creator_vault", &key(&config)], PUMP_AMM_PROGRAM);
        let amm_vault = ata(&amm_auth, SOL_MINT, TOKEN_PROGRAM);
        let r = rpc(http, "getMultipleAccounts", json!([[curve, vault, amm_vault], { "encoding": "base64" }])).await?;
        let accts = r["value"].as_array().cloned().unwrap_or_default();
        let raw = |i: usize| accts.get(i).and_then(|a| a["data"][0].as_str()).and_then(|x| base64::Engine::decode(&base64::engine::general_purpose::STANDARD, x).ok()).unwrap_or_default();
        let c = raw(0);
        let complete = c.get(48).copied().unwrap_or(0) == 1;
        let bucket = if c.len() >= 133 { u64::from_le_bytes(c[125..133].try_into().unwrap()) } else { 0 };
        let vault_sol = accts.get(1).and_then(|a| a["lamports"].as_u64()).map(|l| l.saturating_sub(RENT_EMPTY)).unwrap_or(0);
        let a = raw(2);
        let amm = if a.len() >= 72 { u64::from_le_bytes(a[64..72].try_into().unwrap()) } else { 0 };
        out.push(SharedCoin { config, mint, shareholders: holders, share, complete, curve_sol: (vault_sol + bucket) as f64 / 1e9, amm_sol: amm as f64 / 1e9, curve_bucket: bucket });
    }
    Ok(out)
}

/// Permissionless payout of one coin's creator fees to every shareholder: move PumpSwap fees and unswept curve
/// fees into the coin's creator vault, then distribute it by the split.
fn distribute_ixs(payer: &str, c: &SharedCoin) -> Vec<Ix> {
    let curve = pda(&[b"bonding-curve", &key(&c.mint)], PUMP_PROGRAM);
    let vault = pda(&[b"creator-vault", &key(&c.config)], PUMP_PROGRAM);
    let ev = pda(&[b"__event_authority"], PUMP_PROGRAM);
    let mut ixs = Vec::new();
    if c.curve_bucket > 0 {
        let wsol_vault = ata(&vault, SOL_MINT, TOKEN_PROGRAM);
        ixs.push(Ix {
            program: PUMP_PROGRAM.into(),
            accounts: vec![
                m(payer, true, true), m(&pda(&[b"global"], PUMP_PROGRAM), false, false), m(&c.mint, false, false), m(SOL_MINT, false, false),
                m(TOKEN_PROGRAM, false, false), m(ATA_PROGRAM, false, false), m(SYSTEM_PROGRAM, false, false), m(&curve, false, true),
                m(&ata(&curve, SOL_MINT, TOKEN_PROGRAM), false, true), m(&vault, false, true), m(&wsol_vault, false, true), m(&ev, false, false), m(PUMP_PROGRAM, false, false),
            ],
            data: vec![32, 246, 191, 52, 8, 201, 73, 186],
        });
    }
    if c.amm_sol > 0.0 {
        let auth = pda(&[b"creator_vault", &key(&c.config)], PUMP_AMM_PROGRAM);
        ixs.push(Ix {
            program: PUMP_AMM_PROGRAM.into(),
            accounts: vec![
                m(SOL_MINT, false, false), m(TOKEN_PROGRAM, false, false), m(SYSTEM_PROGRAM, false, false), m(ATA_PROGRAM, false, false),
                m(&c.config, false, false), m(&auth, false, true), m(&ata(&auth, SOL_MINT, TOKEN_PROGRAM), false, true), m(&vault, false, true),
                m(&pda(&[b"__event_authority"], PUMP_AMM_PROGRAM), false, false), m(PUMP_AMM_PROGRAM, false, false),
            ],
            data: vec![139, 52, 134, 85, 228, 229, 108, 241],
        });
    }
    let mut accounts = vec![
        m(&c.mint, false, false), m(&curve, false, false), m(&c.config, false, false), m(&vault, false, true),
        m(SYSTEM_PROGRAM, false, false), m(&ev, false, false), m(PUMP_PROGRAM, false, false),
    ];
    accounts.extend(c.shareholders.iter().map(|h| m(h, false, true)));
    ixs.push(Ix { program: PUMP_PROGRAM.into(), accounts, data: vec![165, 114, 103, 0, 121, 206, 247, 81] });
    ixs
}

#[cfg(test)]
mod claim_live {
    /// `CLAIM_WALLETS=a,b cargo test claim_live -- --ignored --nocapture`
    #[tokio::test]
    #[ignore]
    async fn shared_claims() {
        let http = reqwest::Client::new();
        for w in std::env::var("CLAIM_WALLETS").unwrap().split(',') {
            match super::shared_coins(&http, w).await {
                Ok(list) => for c in &list { println!("{w}: {} share {} complete {} curve {} amm {} bucket {}", c.mint, c.share, c.complete, c.curve_sol, c.amm_sol, c.curve_bucket) },
                Err(e) => println!("{w}: shared error {e}"),
            }
            match super::build_pump_claim(&http, w).await {
                Ok(v) => println!("{w}: claim {} sim {}", v["claim"], v["simulation"]),
                Err(e) => println!("{w}: {e}"),
            }
        }
    }
}

#[cfg(test)]
mod distribute_live {
    #[tokio::test]
    #[ignore]
    async fn graduated_and_swept() {
        let http = reqwest::Client::new();
        let payer = "Gygj9QQby4j2jryqyqBHvLP7ctv2SaANgh4sCb69BUpA";
        for w in ["AT5FmMzA4an3YW6poso7bvfp8EkuTicwQ1oMF7MkRoyg", "7FHnro5P5UYwHso5LBbSWiDwpgoVCUf3yus1SB7zR7sz", "6Lkx4vwZAxtzvmxK6Q45nHCtHMtVRyZkeLY3PrJH1xHA"] {
            for c in super::shared_coins(&http, w).await.unwrap().iter().filter(|c| c.complete || c.curve_bucket > 0) {
                let ixs = super::distribute_ixs(payer, c);
                let keys = super::lookup_table(&http, super::PUMP_LUT).await;
                let bh = super::latest_blockhash(&http).await.unwrap();
                let (msg, signers) = super::v0_message(payer, &ixs, &bh, Some((super::PUMP_LUT, &keys)));
                let tx = super::with_signatures(&msg, &signers, &[]);
                println!("{} complete {} bucket {} amm {}: {}", c.mint, c.complete, c.curve_bucket, c.amm_sol, super::simulate(&http, &tx).await);
            }
        }
    }
}
