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

/// SOL sitting in the wallet's Pump creator vaults: (bonding curve, PumpSwap), in SOL.
pub async fn creator_fees(http: &reqwest::Client, wallet: &str) -> Result<(f64, f64), String> {
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
    let (curve, amm) = creator_fees(http, wallet).await?;
    let (px, _) = llama(http, &[SOL_MINT.to_string()]).await;
    let sol_px = px.get(SOL_MINT).copied().unwrap_or(0.0);
    if curve + amm < 0.000_001 {
        return Err("This wallet has no Pump creator fees to claim right now.".into());
    }
    let mut ixs = Vec::new();
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
    let blockhash = latest_blockhash(http).await?;
    let tx = legacy_tx(wallet, &ixs, &blockhash);
    let sim = simulate(http, &tx).await;
    let total = curve + amm;
    Ok(json!({
        "chain": "Solana", "wallet": wallet,
        "claim": { "sol": crate::pools::num((total * 1e6).round() / 1e6), "usd": r2(total * sol_px), "bondingCurveSol": crate::pools::num((curve * 1e6).round() / 1e6), "pumpSwapSol": crate::pools::num((amm * 1e6).round() / 1e6) },
        "btbFee": "None: claiming through BTB is free.",
        "steps": labels,
        "simulation": sim,
        "transaction": { "encoding": "base64", "format": "legacy", "signer": wallet, "data": tx, "recentBlockhash": blockhash,
            "expires": "About 60 to 90 seconds after it was built: sign and send right away, or call build_pump_claim again." },
        "notes": ["Fees go to the creator wallet that signs. Nothing was signed or sent. A wallet-signing page for Solana on btb.finance is coming; agents with a Solana wallet can sign this transaction now."],
    }))
}
