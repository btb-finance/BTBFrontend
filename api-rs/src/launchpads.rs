//! EVM token launchpads: launch a coin from the creator's wallet with BTB's share of fees built in, and claim the
//! creator's fees. Nothing here signs or sends; every build returns transactions, a dry run and a sign link.

use crate::signlink::with_sign_link;
use crate::swap;
use serde_json::{json, Value};
use sha3::{Digest, Keccak256};
use std::time::Duration;

/// BTB's EVM wallet for its share of launchpad fees (override with BTB_EVM_TREASURY).
pub const BTB_EVM_TREASURY: &str = "0xfed2Ff614E0289D41937139730B49Ee158D02299";

pub fn treasury() -> String {
    std::env::var("BTB_EVM_TREASURY").ok().map(|s| s.trim().to_string()).filter(|s| is_addr(s)).unwrap_or_else(|| BTB_EVM_TREASURY.to_string())
}

/// BTB's share in basis points of what the creator would otherwise get (BTB_LAUNCH_SHARE_BPS, default 10%).
pub fn share_bps() -> u32 {
    std::env::var("BTB_LAUNCH_SHARE_BPS").ok().and_then(|s| s.trim().parse().ok()).unwrap_or(1000).min(5000)
}

pub fn is_addr(s: &str) -> bool {
    s.len() == 42 && s.starts_with("0x") && s[2..].chars().all(|c| c.is_ascii_hexdigit())
}

pub fn keccak(b: &[u8]) -> [u8; 32] {
    Keccak256::digest(b).into()
}

pub fn selector(sig: &str) -> String {
    hex(&keccak(sig.as_bytes())[..4])
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

pub(crate) fn unhex(s: &str) -> Vec<u8> {
    let s = s.trim_start_matches("0x");
    (0..s.len() / 2).filter_map(|i| u8::from_str_radix(&s[2 * i..2 * i + 2], 16).ok()).collect()
}

// ---- a small ABI encoder ----

#[derive(Clone)]
pub enum T {
    Addr(String),
    U(u128),
    Bool(bool),
    B32([u8; 32]),
    Str(String),
    Bytes(Vec<u8>),
    Arr(Vec<T>),
    Tup(Vec<T>),
}

impl T {
    fn dynamic(&self) -> bool {
        match self {
            T::Str(_) | T::Bytes(_) | T::Arr(_) => true,
            T::Tup(v) => v.iter().any(T::dynamic),
            _ => false,
        }
    }
}

fn word_u(x: u128) -> [u8; 32] {
    let mut w = [0u8; 32];
    w[16..].copy_from_slice(&x.to_be_bytes());
    w
}

fn enc_bytes(b: &[u8]) -> Vec<u8> {
    let mut out = word_u(b.len() as u128).to_vec();
    out.extend_from_slice(b);
    out.resize(32 + b.len().div_ceil(32) * 32, 0);
    out
}

/// abi.encode of a list of values (a tuple's fields).
pub fn encode(items: &[T]) -> Vec<u8> {
    let head_len: usize = items.iter().map(|t| if t.dynamic() { 32 } else { static_len(t) }).sum();
    let (mut head, mut tail) = (Vec::new(), Vec::new());
    for t in items {
        if t.dynamic() {
            head.extend_from_slice(&word_u((head_len + tail.len()) as u128));
            tail.extend(enc_one(t));
        } else {
            head.extend(enc_one(t));
        }
    }
    head.extend(tail);
    head
}

fn static_len(t: &T) -> usize {
    match t {
        T::Tup(v) => v.iter().map(static_len).sum(),
        _ => 32,
    }
}

fn enc_one(t: &T) -> Vec<u8> {
    match t {
        T::Addr(a) => {
            let mut w = [0u8; 32];
            let b = unhex(a);
            w[32 - b.len().min(20)..].copy_from_slice(&b[..b.len().min(20)]);
            w.to_vec()
        }
        T::U(x) => word_u(*x).to_vec(),
        T::Bool(b) => word_u(*b as u128).to_vec(),
        T::B32(b) => b.to_vec(),
        T::Str(s) => enc_bytes(s.as_bytes()),
        T::Bytes(b) => enc_bytes(b),
        T::Arr(v) => {
            let mut out = word_u(v.len() as u128).to_vec();
            out.extend(encode(v));
            out
        }
        T::Tup(v) => encode(v),
    }
}

pub fn calldata(sig: &str, args: &[T]) -> String {
    format!("0x{}{}", selector(sig), hex(&encode(args)))
}

// ---- chain reads ----

pub(crate) async fn call(http: &reqwest::Client, chain: i64, to: &str, data: &str) -> Result<Vec<u8>, String> {
    swap::eth_call(http, chain, to, data, None).await.map(|h| unhex(&h))
}

pub(crate) fn word(b: &[u8], i: usize) -> u128 {
    b.get(i * 32 + 16..i * 32 + 32).map(|s| u128::from_be_bytes(s.try_into().unwrap())).unwrap_or(0)
}

pub(crate) fn word_addr(b: &[u8], i: usize) -> String {
    b.get(i * 32 + 12..i * 32 + 32).map(|s| format!("0x{}", hex(s))).unwrap_or_default()
}

pub(crate) fn eth(wei: u128) -> String {
    crate::lite::format_units(&wei.to_string(), 18)
}

/// A dry run from the wallet: "passed", or "reverted" with the revert data so a custom error can be read.
pub(crate) async fn simulate(http: &reqwest::Client, chain: i64, from: &str, to: &str, data: &str, value: u128) -> Value {
    let Some(url) = swap::rpc_url(chain) else { return json!({ "status": "reverted", "reason": "no RPC for this chain" }) };
    let mut c = json!({ "from": from, "to": to, "data": data });
    if value > 0 {
        c["value"] = json!(format!("0x{value:x}"));
    }
    let r: Result<Value, String> = async {
        http.post(url).json(&json!({ "jsonrpc": "2.0", "id": 1, "method": "eth_call", "params": [c, "latest"] })).timeout(Duration::from_secs(20)).send().await.map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())
    }
    .await;
    match r {
        Ok(v) if v.get("error").is_none() => json!({ "status": "passed", "result": v["result"] }),
        Ok(v) => {
            let msg = v["error"]["message"].as_str().unwrap_or("reverted");
            let reason = if msg.contains("insufficient funds") || msg.contains("OutOfFunds") { "The wallet does not hold enough ETH (or BNB) for this and gas.".to_string() } else { msg.chars().take(200).collect() };
            json!({ "status": "reverted", "reason": reason, "data": v["error"]["data"] })
        }
        Err(e) => json!({ "status": "reverted", "reason": e }),
    }
}

pub(crate) fn tx(chain: i64, from: &str, to: &str, data: &str, value: u128, label: &str) -> Value {
    json!({ "step": 1, "label": label, "chainId": chain, "from": from, "to": to, "data": data, "value": format!("0x{value:x}") })
}

// ---- Clanker v5 ----

struct ClankerChain {
    id: i64,
    name: &'static str,
    factory: &'static str,
    escrow: &'static str,
    native: &'static str,
}

const CLANKER: &[ClankerChain] = &[
    ClankerChain { id: 8453, name: "base", factory: "0x572e88D3cD7f23E4241EB6ceDD96667271bF09A0", escrow: "0x5dd237d1f716C65426CCd2FAe82B95109825FA61", native: "ETH" },
    ClankerChain { id: 56, name: "bsc", factory: "0xcA111dcdd2cE924c3378d6514fDCbC46217bcA16", escrow: "0xFBB6e837A2eA96d6b4beb4788c2749Cf34A997e7", native: "BNB" },
    ClankerChain { id: 4663, name: "robinhood", factory: "0xcA111dcdd2cE924c3378d6514fDCbC46217bcA16", escrow: "0xFBB6e837A2eA96d6b4beb4788c2749Cf34A997e7", native: "ETH" },
    ClankerChain { id: 143, name: "monad", factory: "0xcA111dcdd2cE924c3378d6514fDCbC46217bcA16", escrow: "0xFBB6e837A2eA96d6b4beb4788c2749Cf34A997e7", native: "MON" },
];

const CLANKER_PARAMS: &str = "(address,(address,address,uint16,bool)[],string,string,string,bytes32,address,uint64,uint64,bool,string[],string[],(uint32,uint32,uint32,uint32,uint32,uint32,uint256),address,address,bool)";

pub struct Launch {
    pub wallet: String,
    pub chain: String,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub image: String,
    pub description: String,
    pub tax_pct: f64,
}

fn clanker_chain(chain: &str) -> Option<&'static ClankerChain> {
    let id = crate::lite::token_chain_id(chain)?;
    CLANKER.iter().find(|c| c.id == id)
}

#[allow(clippy::too_many_arguments)]
fn clanker_params(l: &Launch, salt: [u8; 32], version: u128, deadline: u128, tax: u128, btb_share: u128, btb: &str) -> T {
    let mut keys = Vec::new();
    let mut vals = Vec::new();
    for (k, v) in [("image", &l.image), ("description", &l.description)] {
        if !v.is_empty() {
            keys.push(T::Str(k.into()));
            vals.push(T::Str(v.clone()));
        }
    }
    T::Tup(vec![
        T::Addr(l.wallet.clone()),
        T::Arr(vec![]),
        T::Str(l.name.clone()),
        T::Str(l.symbol.clone()),
        T::Str(l.uri.clone()),
        T::B32(salt),
        T::Addr("0x0000000000000000000000000000000000000000".into()),
        T::U(version),
        T::U(deadline),
        T::Bool(true),
        T::Arr(keys),
        T::Arr(vals),
        T::Tup(vec![T::U(tax), T::U(tax), T::U(100_000_000 - btb_share), T::U(0), T::U(0), T::U(btb_share), T::U(0)]),
        T::Addr(l.wallet.clone()),
        T::Addr(if btb_share > 0 { btb.to_string() } else { "0x0000000000000000000000000000000000000000".into() }),
        T::Bool(true),
    ])
}

/// Finds a creatorSalt whose token address ends in cccc: CREATE2(deployer, keccak(abi.encode(creator, salt)), initCodeHash).
fn mine_salt(creator: &str, deployer: &str, init_hash: &[u8]) -> Option<([u8; 32], String)> {
    let mut seed = [0u8; 16];
    getrandom::getrandom(&mut seed).ok()?;
    let dep = unhex(deployer);
    let mut pre = vec![0xffu8];
    pre.extend_from_slice(&dep);
    for i in 0u64..4_000_000 {
        let mut salt = [0u8; 32];
        salt[..16].copy_from_slice(&seed);
        salt[24..].copy_from_slice(&i.to_be_bytes());
        let scoped = keccak(&encode(&[T::Addr(creator.into()), T::B32(salt)]));
        let mut buf = pre.clone();
        buf.extend_from_slice(&scoped);
        buf.extend_from_slice(init_hash);
        let h = keccak(&buf);
        if h[30] == 0xcc && h[31] == 0xcc {
            return Some((salt, format!("0x{}", hex(&h[12..]))));
        }
    }
    None
}

pub async fn build_clanker_launch(http: &reqwest::Client, l: Launch) -> Result<Value, String> {
    let c = clanker_chain(&l.chain).ok_or("Clanker launches are available on base, bsc, robinhood and monad.")?;
    let f = c.factory;
    let q: Vec<String> = ["configVersion()", "nativeLaunchFee()", "launchCreationEnabled()", "tokenDeployer()"].iter().map(|s| format!("0x{}", selector(s))).collect();
    let (version, fee, enabled, deployer) = futures::join!(call(http, c.id, f, &q[0]), call(http, c.id, f, &q[1]), call(http, c.id, f, &q[2]), call(http, c.id, f, &q[3]));
    let (version, fee, deployer) = (word(&version?, 0), word(&fee?, 0), word_addr(&deployer?, 0));
    if word(&enabled?, 0) == 0 {
        return Err("Clanker has paused new launches on this chain right now.".into());
    }
    let tax_pct = l.tax_pct.clamp(1.0, 10.0);
    let tax = (tax_pct * 1_000_000.0).round() as u128;
    let bps = share_bps() as u128;
    let btb_share = bps * 10_000;
    let btb = treasury();
    let deadline = (chrono::Utc::now().timestamp() + 1800) as u128;
    let probe = clanker_params(&l, [0u8; 32], version, deadline, tax, btb_share, &btb);
    let h = call(http, c.id, f, &calldata(&format!("launchTokenInitCodeHash({CLANKER_PARAMS})"), &[probe])).await?;
    let init_hash = h.get(..32).ok_or("Clanker did not return the token init code hash.")?.to_vec();
    let (salt, token) = tokio::task::spawn_blocking({
        let (w, d) = (l.wallet.clone(), deployer.clone());
        move || mine_salt(&w, &d, &init_hash)
    })
    .await
    .map_err(|e| e.to_string())?
    .ok_or("Could not find a token address ending in cccc; try again.")?;
    let params = clanker_params(&l, salt, version, deadline, tax, btb_share, &btb);
    let data = calldata(&format!("createLaunch({CLANKER_PARAMS})"), &[params]);
    let sim = simulate(http, c.id, &l.wallet, f, &data, fee).await;
    let sim_out = json!({ "status": sim["status"], "reason": sim.get("reason") });
    let label = format!("Launch {} on Clanker ({})", l.symbol, c.name);
    let r = json!({
        "launchpad": "clanker", "chain": c.name, "chainId": c.id, "factory": f,
        "coin": { "address": token, "name": l.name, "symbol": l.symbol, "metadataUri": l.uri, "image": l.image, "link": format!("https://www.clanker.world/clanker/{token}") },
        "tax": { "buyPct": tax_pct, "sellPct": tax_pct, "note": "Every buy and sell pays this tax. Clanker keeps its protocol cut (10% of the tax, at least 0.5% of the trade); the rest goes to the creator and BTB." },
        "creatorFees": { "creator": l.wallet, "creatorPct": 100.0 - bps as f64 / 100.0, "btb": btb, "btbPct": bps as f64 / 100.0, "claim": "build_launch_claim with launchpad clanker" },
        "launchFee": format!("{} {}", eth(fee), c.native), "deadline": deadline as u64,
        "simulation": sim_out, "transactions": [tx(c.id, &l.wallet, f, &data, fee, &label)],
        "warnings": ["Send within 30 minutes (the launch has a deadline).", "Most new coins lose almost all their value."],
    });
    let sims = vec![Some(r["simulation"].clone())];
    Ok(with_sign_link(r, &format!("Launch {} on Clanker", l.symbol), &l.wallet, &sims, None))
}

/// The wallet's unclaimed Clanker v5 rewards (native coin) on every supported chain, with claim transactions.
pub async fn clanker_claims(http: &reqwest::Client, wallet: &str) -> Vec<Value> {
    let reads = CLANKER.iter().map(|c| async move {
        let d = calldata("owed(address,address)", &[T::Addr(wallet.into()), T::Addr("0x0000000000000000000000000000000000000000".into())]);
        let owed = call(http, c.id, c.escrow, &d).await.map(|b| word(&b, 0)).unwrap_or(0);
        (c, owed)
    });
    let mut out = Vec::new();
    for (c, owed) in futures::future::join_all(reads).await {
        if owed == 0 {
            continue;
        }
        let data = calldata("claimTo(address,address)", &[T::Addr("0x0000000000000000000000000000000000000000".into()), T::Addr(wallet.into())]);
        let sim = simulate(http, c.id, wallet, c.escrow, &data, 0).await;
        out.push(json!({
            "launchpad": "clanker", "chain": c.name, "chainId": c.id, "unclaimed": format!("{} {}", eth(owed), c.native),
            "simulation": { "status": sim["status"], "reason": sim.get("reason") },
            "transaction": tx(c.id, wallet, c.escrow, &data, 0, &format!("Claim {} {} of Clanker rewards", eth(owed), c.native)),
        }));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn selectors() {
        assert_eq!(selector("configVersion()"), "dd64d24d");
        assert_eq!(selector("transfer(address,uint256)"), "a9059cbb");
    }

    #[test]
    fn encodes_dynamic() {
        // abi.encode("a", [1,2]) known layout
        let e = hex(&encode(&[T::Str("a".into()), T::Arr(vec![T::U(1), T::U(2)])]));
        assert_eq!(&e[..128], "00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080");
    }

    #[tokio::test]
    #[ignore]
    async fn clanker_live() {
        let http = reqwest::Client::new();
        let r = build_clanker_launch(&http, Launch { wallet: "0x7a2e54e3aa9c4d02f6c9b950dcd33054d2043829".into(), chain: "base".into(), name: "BTB Test".into(), symbol: "BTBT".into(), uri: "ipfs://QmU1B1PXU9cGmieZ96vRLKTwKCAhMTJPXKWvMNyok6AupF".into(), image: "https://ipfs.io/ipfs/Qmd8SeZuTzJ74N26w4rHhmc6ZyrtqUR6GxbxBXngM1WADJ".into(), description: "test".into(), tax_pct: 2.0 }).await.unwrap();
        println!("{}", serde_json::to_string_pretty(&r["simulation"]).unwrap());
        println!("{}", r["coin"]);
        assert_eq!(r["simulation"]["status"], "passed");
    }

    #[tokio::test]
    #[ignore]
    async fn zora_live() {
        let http = reqwest::Client::new();
        let r = build_zora_launch(&http, Launch { wallet: "0xfed2Ff614E0289D41937139730B49Ee158D02299".into(), chain: "base".into(), name: "BTB Test".into(), symbol: "BTBT".into(), uri: "ipfs://QmU1B1PXU9cGmieZ96vRLKTwKCAhMTJPXKWvMNyok6AupF".into(), image: String::new(), description: String::new(), tax_pct: 0.0 }).await.unwrap();
        println!("zora: {} coin {}", r["simulation"], r["coin"]["address"]);
        assert_eq!(r["simulation"]["status"], "passed");
    }
}

// ---- Pons (Robinhood Chain) ----

const PONS_CHAIN: i64 = 4663;
const PONS_FACTORY: &str = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";
const PONS_ROUTER: &str = "0xe33e9e479df8802cb0866d5d05258bec4cf62948";
const PONS_ESCROW: &str = "0xd3afeb2a57f70ef218aa82451c51b2fb0416ac9e";
const PONS_PARAMS: &str = "(string,string,string,string,(string,string,string,string,string),address,uint16,bool,bytes32,bytes32)";

pub struct Socials {
    pub twitter: String,
    pub telegram: String,
    pub website: String,
}

fn random32() -> [u8; 32] {
    let mut s = [0u8; 32];
    let _ = getrandom::getrandom(&mut s);
    s
}

fn wei(amount: f64) -> u128 {
    (amount * 1e9).round() as u128 * 1_000_000_000
}

pub async fn build_pons_launch(http: &reqwest::Client, l: Launch, s: Socials, dev_buy: f64) -> Result<Value, String> {
    let q: Vec<String> = ["launchFee()", "launchEnabled()", "maxCreatorTaxBps()"].iter().map(|x| format!("0x{}", selector(x))).collect();
    let (fee, enabled, max_tax) = futures::join!(call(http, PONS_CHAIN, PONS_FACTORY, &q[0]), call(http, PONS_CHAIN, PONS_FACTORY, &q[1]), call(http, PONS_CHAIN, PONS_FACTORY, &q[2]));
    let (fee, max_tax) = (word(&fee?, 0), word(&max_tax?, 0));
    if word(&enabled?, 0) == 0 {
        return Err("Pons has paused public launches right now.".into());
    }
    let tax_bps = ((l.tax_pct * 100.0).round() as u128).min(max_tax);
    let params = T::Tup(vec![
        T::Str(l.name.clone()),
        T::Str(l.symbol.clone()),
        T::Str(l.image.clone()),
        T::Str(l.description.clone()),
        T::Tup(vec![T::Str(s.twitter.clone()), T::Str(s.telegram.clone()), T::Str(String::new()), T::Str(s.website.clone()), T::Str(String::new())]),
        T::Addr(l.wallet.clone()),
        T::U(tax_bps),
        T::Bool(true),
        T::B32([0u8; 32]),
        T::B32(random32()),
    ]);
    let buy = wei(dev_buy.max(0.0));
    let (to, data, value) = if buy > 0 {
        let d = calldata(&format!("launchAndBuy({PONS_PARAMS},uint256,address,uint256,uint256,address,address[])"), &[params, T::U(0), T::Addr(ZERO.into()), T::U(buy), T::U(0), T::Addr(l.wallet.clone()), T::Arr(vec![])]);
        (PONS_ROUTER, d, fee + buy)
    } else {
        (PONS_FACTORY, calldata(&format!("launchToken({PONS_PARAMS},uint256,address)"), &[params, T::U(0), T::Addr(ZERO.into())]), fee)
    };
    let sim = simulate(http, PONS_CHAIN, &l.wallet, to, &data, value).await;
    let coin = sim["result"].as_str().map(unhex).map(|b| word_addr(&b, 0)).filter(|a| a.len() == 42 && a != ZERO);
    let label = if buy > 0 { format!("Launch {} on Pons and buy {} ETH of it", l.symbol, eth(buy)) } else { format!("Launch {} on Pons", l.symbol) };
    let r = json!({
        "launchpad": "pons", "chain": "robinhood", "chainId": PONS_CHAIN, "factory": PONS_FACTORY,
        "coin": { "address": coin, "name": l.name, "symbol": l.symbol, "image": l.image, "explorer": coin.as_ref().map(|c| format!("https://robinhoodchain.blockscout.com/token/{c}")) },
        "creatorTax": { "pct": tax_bps as f64 / 100.0, "maxPct": max_tax as f64 / 100.0, "note": "Extra tax on every curve trade, on top of Pons's 1% fee, paid entirely to the creator." },
        "creatorFees": { "creator": l.wallet, "creatorPct": 100, "btbPct": 0, "note": "Pons pays creator fees to a single address, so BTB takes no share on Pons launches.", "claim": "build_launch_claim" },
        "launchFee": format!("{} ETH", eth(fee)), "firstBuy": if buy > 0 { json!(format!("{} ETH", eth(buy))) } else { Value::Null },
        "simulation": { "status": sim["status"], "reason": sim.get("reason") }, "transactions": [tx(PONS_CHAIN, &l.wallet, to, &data, value, &label)],
        "warnings": ["Most new coins lose almost all their value."],
    });
    let sims = vec![Some(r["simulation"].clone())];
    Ok(with_sign_link(r, &format!("Launch {} on Pons", l.symbol), &l.wallet, &sims, None))
}

async fn pons_claims(http: &reqwest::Client, wallet: &str) -> Vec<Value> {
    let owed = call(http, PONS_CHAIN, PONS_ESCROW, &calldata("balanceOf(address)", &[T::Addr(wallet.into())])).await.map(|b| word(&b, 0)).unwrap_or(0);
    if owed == 0 {
        return vec![];
    }
    let data = format!("0x{}", selector("claim()"));
    let sim = simulate(http, PONS_CHAIN, wallet, PONS_ESCROW, &data, 0).await;
    vec![json!({
        "launchpad": "pons", "chain": "robinhood", "chainId": PONS_CHAIN, "unclaimed": format!("{} ETH", eth(owed)),
        "simulation": { "status": sim["status"], "reason": sim.get("reason") },
        "transaction": tx(PONS_CHAIN, wallet, PONS_ESCROW, &data, 0, &format!("Claim {} ETH of Pons creator fees", eth(owed))),
    })]
}

// ---- flap.sh (BNB Chain) ----

const ZERO: &str = "0x0000000000000000000000000000000000000000";
const FLAP_CHAIN: i64 = 56;
const FLAP_PORTAL: &str = "0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0";
const FLAP_TAX_IMPL: &str = "0x024f18294970B5c76c0691b87f138A0317156422";
const FLAP_PARAMS: &str = "(string,string,string,uint8,bytes32,uint8,address,uint256,address,bytes,bytes32,bytes,uint8,uint8,uint16,uint16,uint64,uint64,uint16,uint16,uint16,uint16,uint256,address,address,uint8)";

/// Pins the picture and metadata with Flap's own upload API (its indexers read only Flap-pinned files). Returns the CID.
async fn flap_upload(http: &reqwest::Client, m: &crate::pumpmeta::Meta, wallet: &str) -> Result<String, String> {
    let (bytes, ct) = crate::pumpmeta::image_bytes(http, m).await?;
    let ops = json!({
        "query": "mutation Create($file: Upload!, $meta: MetadataInput!) { create(file: $file, meta: $meta) }",
        "variables": { "file": null, "meta": { "description": m.description, "website": m.website.clone().unwrap_or_default(), "twitter": m.twitter.clone().unwrap_or_default(), "telegram": m.telegram.clone().unwrap_or_default(), "creator": wallet } },
    });
    let part = reqwest::multipart::Part::bytes(bytes).file_name(format!("image.{}", ct.trim_start_matches("image/"))).mime_str(ct).map_err(|e| e.to_string())?;
    let form = reqwest::multipart::Form::new().text("operations", ops.to_string()).text("map", r#"{"0":["variables.file"]}"#).part("0", part);
    let r = http.post("https://funcs.flap.sh/api/upload").multipart(form).timeout(Duration::from_secs(45)).send().await.map_err(|e| format!("Flap upload is not reachable: {e}"))?;
    let status = r.status();
    let v: Value = r.json().await.unwrap_or(Value::Null);
    v["data"]["create"].as_str().map(String::from).ok_or_else(|| format!("Flap did not store the coin picture ({status}): {}", v["errors"]))
}

fn flap_salt() -> ([u8; 32], String) {
    let mut init = unhex("3d602d80600a3d3981f3363d3d373d3d3d363d73");
    init.extend(unhex(FLAP_TAX_IMPL));
    init.extend(unhex("5af43d82803e903d91602b57fd5bf3"));
    let ih = keccak(&init);
    let mut pre = vec![0xffu8];
    pre.extend(unhex(FLAP_PORTAL));
    let mut salt = keccak(&random32());
    loop {
        let mut b = pre.clone();
        b.extend_from_slice(&salt);
        b.extend_from_slice(&ih);
        let h = keccak(&b);
        if h[30] == 0x77 && h[31] == 0x77 {
            return (salt, format!("0x{}", hex(&h[12..])));
        }
        salt = keccak(&salt);
    }
}

pub async fn build_flap_launch(http: &reqwest::Client, l: Launch, meta: crate::pumpmeta::Meta, dev_buy: f64) -> Result<Value, String> {
    let cid = flap_upload(http, &meta, &l.wallet).await?;
    let tax = ((l.tax_pct.clamp(1.0, 10.0)) * 100.0).round() as u128;
    let (salt, token) = tokio::task::spawn_blocking(flap_salt).await.map_err(|e| e.to_string())?;
    let buy = wei(dev_buy.max(0.0));
    let btb = treasury();
    let params = T::Tup(vec![
        T::Str(l.name.clone()), T::Str(l.symbol.clone()), T::Str(cid.clone()), T::U(1), T::B32(salt), T::U(1), T::Addr(ZERO.into()), T::U(buy),
        T::Addr(l.wallet.clone()), T::Bytes(vec![]), T::B32([0u8; 32]), T::Bytes(vec![]), T::U(0), T::U(0), T::U(tax), T::U(tax),
        T::U(365 * 86400 * 100), T::U(3600), T::U(10_000), T::U(0), T::U(0), T::U(0), T::U(0), T::Addr(ZERO.into()), T::Addr(btb.clone()), T::U(6),
    ]);
    let data = calldata(&format!("newTokenV6({FLAP_PARAMS})"), &[params]);
    let sim = simulate(http, FLAP_CHAIN, &l.wallet, FLAP_PORTAL, &data, buy).await;
    let commission_pct = if tax <= 100 { 6.0 } else { (60_000 / tax) as f64 / 100.0 };
    let label = if buy > 0 { format!("Launch {} on Flap and buy {} BNB of it", l.symbol, eth(buy)) } else { format!("Launch {} on Flap", l.symbol) };
    let r = json!({
        "launchpad": "flap", "chain": "bsc", "chainId": FLAP_CHAIN, "portal": FLAP_PORTAL,
        "coin": { "address": token, "name": l.name, "symbol": l.symbol, "metadataCid": cid, "explorer": format!("https://bscscan.com/token/{token}") },
        "tax": { "buyPct": tax as f64 / 100.0, "sellPct": tax as f64 / 100.0, "note": "Every buy and sell pays this tax, in BNB, to the creator's wallet (after Flap's protocol cut and BTB's commission)." },
        "creatorFees": { "creator": l.wallet, "btb": btb, "btbCommissionPctOfTax": commission_pct, "note": "BTB is the launch's commission receiver (Flap's integrator commission, set by Flap's formula). Tax is paid out to the wallet automatically." },
        "firstBuy": if buy > 0 { json!(format!("{} BNB", eth(buy))) } else { Value::Null },
        "simulation": { "status": sim["status"], "reason": sim.get("reason") }, "transactions": [tx(FLAP_CHAIN, &l.wallet, FLAP_PORTAL, &data, buy, &label)],
        "warnings": ["Most new coins lose almost all their value."],
    });
    let sims = vec![Some(r["simulation"].clone())];
    Ok(with_sign_link(r, &format!("Launch {} on Flap", l.symbol), &l.wallet, &sims, None))
}

// ---- Zora coins (Base) ----

const ZORA_FACTORY: &str = "0x777777751622c0d3258f214F9DF38E35BF45baF3";

/// Builds a Zora coin through Zora's own create API with BTB as platform referrer, then checks the calldata before
/// returning it: the factory, the selector deploy(...), the creator as payout recipient and BTB as platform referrer.
pub async fn build_zora_launch(http: &reqwest::Client, l: Launch) -> Result<Value, String> {
    let btb = treasury();
    let body = json!({ "currency": "ETH", "chainId": 8453, "metadata": { "type": "RAW_URI", "uri": l.uri }, "creator": l.wallet, "name": l.name, "symbol": l.symbol, "platformReferrer": btb });
    let r = http.post("https://api-sdk.zora.engineering/create/content").json(&body).timeout(Duration::from_secs(30)).send().await.map_err(|e| format!("Zora is not reachable: {e}"))?;
    let status = r.status();
    let v: Value = r.json().await.unwrap_or(Value::Null);
    let c = v["calls"].get(0).filter(|_| v["calls"].as_array().map(|a| a.len()) == Some(1)).ok_or_else(|| format!("Zora did not build the coin ({status}): {}", v.to_string().chars().take(200).collect::<String>()))?;
    let (to, data) = (c["to"].as_str().unwrap_or(""), c["data"].as_str().unwrap_or(""));
    let value: u128 = c["value"].as_str().and_then(|x| x.parse().ok()).unwrap_or(0);
    let deploy_sel = selector("deploy(address,address[],string,string,string,bytes,address,address,bytes,bytes32)");
    let args = unhex(data.get(10..).unwrap_or(""));
    let ok = to.eq_ignore_ascii_case(ZORA_FACTORY)
        && data.get(2..10) == Some(deploy_sel.as_str())
        && word_addr(&args, 0).eq_ignore_ascii_case(&l.wallet)
        && word_addr(&args, 6).eq_ignore_ascii_case(&btb)
        && value == 0;
    if !ok {
        return Err("Zora returned a launch that does not match the request; not passing it on.".into());
    }
    let coin = v["predictedCoinAddress"].as_str().map(String::from);
    let sim = simulate(http, 8453, &l.wallet, ZORA_FACTORY, data, 0).await;
    let label = format!("Launch {} on Zora", l.symbol);
    let r = json!({
        "launchpad": "zora", "chain": "base", "chainId": 8453, "factory": ZORA_FACTORY,
        "coin": { "address": coin, "name": l.name, "symbol": l.symbol, "metadataUri": l.uri, "link": coin.as_ref().map(|c| format!("https://zora.co/coin/base:{c}")) },
        "creatorFees": { "creator": l.wallet, "btb": btb, "note": "Every trade pays a 1% pool fee. The creator gets 0.50% of each trade and BTB, as platform referrer, 0.20%; both are paid automatically on every trade, nothing to claim." },
        "launchFee": "0 ETH",
        "simulation": { "status": sim["status"], "reason": sim.get("reason") }, "transactions": [tx(8453, &l.wallet, ZORA_FACTORY, data, 0, &label)],
        "warnings": ["Most new coins lose almost all their value."],
    });
    let sims = vec![Some(r["simulation"].clone())];
    Ok(with_sign_link(r, &format!("Launch {} on Zora", l.symbol), &l.wallet, &sims, None))
}

/// Unclaimed launchpad fees for a wallet across Clanker and Pons, with claim transactions.
pub async fn build_launch_claim(http: &reqwest::Client, wallet: &str) -> Value {
    let (mut a, b) = futures::join!(clanker_claims(http, wallet), pons_claims(http, wallet));
    a.extend(b);
    json!({ "wallet": wallet, "claims": a, "note": if a.is_empty() { "Nothing to claim on Clanker or Pons right now. Flap pays tax to the creator's wallet automatically." } else { "Each claim is its own transaction on its chain. Claiming through BTB is free." } })
}

#[cfg(test)]
mod live2 {
    use super::*;

    fn l(wallet: &str, chain: &str) -> Launch {
        Launch { wallet: wallet.into(), chain: chain.into(), name: "BTB Test".into(), symbol: "BTBT".into(), uri: "ipfs://QmU1B1PXU9cGmieZ96vRLKTwKCAhMTJPXKWvMNyok6AupF".into(), image: "https://ipfs.io/ipfs/Qmd8SeZuTzJ74N26w4rHhmc6ZyrtqUR6GxbxBXngM1WADJ".into(), description: "test".into(), tax_pct: 3.0 }
    }

    #[tokio::test]
    #[ignore]
    async fn pons_live() {
        let http = reqwest::Client::new();
        let s = || Socials { twitter: String::new(), telegram: String::new(), website: "https://btb.finance".into() };
        for buy in [0.0, 0.001] {
            let r = build_pons_launch(&http, l("0xd3afeb2a57f70ef218aa82451c51b2fb0416ac9e", "robinhood"), s(), buy).await.unwrap();
            println!("pons buy {buy}: {} coin {}", r["simulation"], r["coin"]["address"]);
            assert_eq!(r["simulation"]["status"], "passed");
        }
    }

    #[tokio::test]
    #[ignore]
    async fn flap_live() {
        let http = reqwest::Client::new();
        let meta = crate::pumpmeta::Meta { name: "BTB Test".into(), symbol: "BTBT".into(), description: "test build, not sent".into(), image_url: Some("https://avatars.githubusercontent.com/u/9919?s=64".into()), image_base64: None, twitter: None, telegram: None, website: None };
        let r = build_flap_launch(&http, l("0xfed2Ff614E0289D41937139730B49Ee158D02299", "bsc"), meta, 0.0).await.unwrap();
        println!("flap: {} coin {} cid {}", r["simulation"], r["coin"]["address"], r["coin"]["metadataCid"]);
        assert_eq!(r["simulation"]["status"], "passed");
    }

    #[tokio::test]
    #[ignore]
    async fn zora_live() {
        let http = reqwest::Client::new();
        let r = build_zora_launch(&http, Launch { wallet: "0xfed2Ff614E0289D41937139730B49Ee158D02299".into(), chain: "base".into(), name: "BTB Test".into(), symbol: "BTBT".into(), uri: "ipfs://QmU1B1PXU9cGmieZ96vRLKTwKCAhMTJPXKWvMNyok6AupF".into(), image: String::new(), description: String::new(), tax_pct: 0.0 }).await.unwrap();
        println!("zora: {} coin {}", r["simulation"], r["coin"]["address"]);
        assert_eq!(r["simulation"]["status"], "passed");
    }
}
