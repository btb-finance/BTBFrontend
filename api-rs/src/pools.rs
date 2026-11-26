//! Pool rows and the logic agents see: chain names, headline APR, fee tier, the risk grade, search and the brief
//! form of a pool. A line-for-line port of src/lib/mcp/data.ts (and mintTarget from src/lib/pools.ts), so both
//! servers give the same answer for the same snapshot.

use regex::Regex;
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::sync::OnceLock;

pub const SITE: &str = "https://btb.finance";

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct RangeYield {
    pub days: Option<f64>,
    pub net_pct: Option<f64>,
    pub in_range_pct: Option<f64>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Merkl {
    pub apr: Option<f64>,
    pub reward_symbols: Vec<String>,
    pub daily_rewards_usd: Option<f64>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Pool {
    pub id: String,
    pub project: String,
    pub dex: Option<String>,
    pub version: Option<String>,
    pub chain: String,
    pub chain_id: Option<f64>,
    pub pair: String,
    pub fee_tier: Option<f64>,
    pub hooks: Option<String>,
    pub tvl_usd: Option<f64>,
    pub apy: Option<f64>,
    pub apy_base: Option<f64>,
    pub apy_reward: Option<f64>,
    /// Set (possibly to a non-finite value) when the snapshot has a ±5 % range APR.
    pub apr_range: Option<f64>,
    pub range_yield: Option<RangeYield>,
    pub volume_24h_usd: Option<f64>,
    pub fees_24h_usd: Option<f64>,
    pub stablecoin: Option<bool>,
    pub underlying_tokens: Option<Vec<String>>,
    pub merkl: Option<Merkl>,
    pub apy_change_1d: Option<f64>,
    pub liquidity_model: Option<String>,
}

impl Pool {
    pub fn tvl(&self) -> f64 {
        self.tvl_usd.unwrap_or(0.0)
    }
    pub fn stable(&self) -> bool {
        self.stablecoin.unwrap_or(false)
    }
    pub fn tokens(&self) -> &[String] {
        self.underlying_tokens.as_deref().unwrap_or(&[])
    }
}

// ---- numbers: JSON exactly as JavaScript writes it ----

/// JavaScript's Math.round: halves go up.
pub fn js_round(x: f64) -> f64 {
    (x + 0.5).floor()
}
pub fn round2(x: f64) -> f64 {
    js_round(x * 100.0) / 100.0
}
/// A number as JSON.stringify would print it: whole numbers without ".0".
pub fn num(x: f64) -> Value {
    if !x.is_finite() {
        Value::Null
    } else if x.fract() == 0.0 && x.abs() < 9.0e15 {
        json!(x as i64)
    } else {
        json!(x)
    }
}
/// A number as JavaScript prints it inside a string.
pub fn num_text(x: f64) -> String {
    match num(x) {
        Value::Number(n) => n.to_string(),
        _ => "NaN".into(),
    }
}
pub fn opt_num(x: Option<f64>) -> Value {
    x.map(num).unwrap_or(Value::Null)
}

fn re(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).expect("valid regex"))
}

// ---- chains ----

/// src/lib/routes.ts chainSlug: lower case, letters and digits only.
pub fn chain_slug(chain: &str) -> String {
    chain.to_lowercase().chars().filter(|c| c.is_ascii_lowercase() || c.is_ascii_digit()).collect()
}

/// A chain name, slug or id as a user might type it → the slug the snapshot's chain names reduce to.
pub fn chain_key(input: &str) -> String {
    let s = chain_slug(input);
    let alias = match s.as_str() {
        "eth" | "mainnet" | "1" => "ethereum",
        "8453" => "base",
        "bsc" | "bnb" | "binance" | "56" => "bnbchain",
        "robinhood" | "4663" => "robinhoodchain",
        "5042" => "arc",
        "arb" | "42161" => "arbitrum",
        "op" | "10" => "optimism",
        "matic" | "137" => "polygon",
        "130" => "unichain",
        _ => return s,
    };
    alias.to_string()
}

pub fn chain_id_of(p: &Pool) -> Option<i64> {
    if let Some(id) = p.chain_id {
        return Some(id as i64);
    }
    match chain_key(&p.chain).as_str() {
        "ethereum" => Some(1),
        "base" => Some(8453),
        "bnbchain" => Some(56),
        "robinhoodchain" => Some(4663),
        "arc" => Some(5042),
        "arbitrum" => Some(42161),
        "optimism" => Some(10),
        "polygon" => Some(137),
        "unichain" => Some(130),
        _ => None,
    }
}

pub fn pool_key(p: &Pool) -> String {
    format!("{}:{}", chain_slug(&p.chain), p.id.to_lowercase())
}

// ---- numbers ----

/// The APR a liquidity provider sees first: the measured ±5 % range APR when there is one, else base plus rewards.
pub fn headline_apr(p: &Pool) -> f64 {
    if let Some(r) = p.apr_range.filter(|r| r.is_finite()) {
        return r;
    }
    if let Some(a) = p.apy.filter(|a| a.is_finite()) {
        return a;
    }
    p.apy_base.unwrap_or(0.0) + p.apy_reward.unwrap_or(0.0)
}

pub fn fee_pct(p: &Pool) -> Option<f64> {
    let f = p.fee_tier?;
    if (f as i64) & 0x800000 != 0 || f > 1_000_000.0 {
        return None;
    }
    Some(f / 10_000.0)
}

// ---- risk (same formula as BTB Chain's defi-yields contract, pool_risk) ----

pub struct Risk {
    pub score: i64,
    pub grade: char,
    pub reasons: Vec<String>,
}

pub fn letter(score: i64) -> char {
    match score {
        s if s >= 85 => 'A',
        s if s >= 70 => 'B',
        s if s >= 55 => 'C',
        s if s >= 40 => 'D',
        _ => 'E',
    }
}
pub const LETTERS: [char; 5] = ['A', 'B', 'C', 'D', 'E'];

/// The newest open safety scan of a token (data.ts TokenGrade).
#[derive(Clone)]
pub struct TokenGrade {
    pub token: String,
    pub symbol: String,
    pub score: Option<f64>,
    pub flags: Vec<String>,
    pub honeypot: bool,
    pub scanned_at: f64,
    pub proxy: bool,
    pub lp_locked_pct: Option<f64>,
}

/// The risk grade with no token scans (the list tools never read scans).
pub fn pool_risk(p: &Pool) -> Risk {
    pool_risk_with(p, &[])
}

/// The risk grade, with the tokens' safety scans when known (pool_details, compare_pools).
pub fn pool_risk_with(p: &Pool, grades: &[Option<TokenGrade>]) -> Risk {
    let mut score: i64 = 100;
    let mut reasons = Vec::new();
    let mut take = |n: i64, why: String| {
        score -= n;
        reasons.push(format!("\u{2212}{n}: {why}"));
    };
    let tvl = p.tvl();
    if tvl < 100_000.0 {
        take(30, "TVL under $100k, easy to move and to drain".into());
    } else if tvl < 1_000_000.0 {
        take(15, "TVL under $1M".into());
    } else if tvl < 10_000_000.0 {
        take(5, "TVL under $10M".into());
    }
    if !p.stable() {
        take(10, "not a stable pair, so impermanent loss applies".into());
    }
    if let Some(in_range) = p.range_yield.as_ref().and_then(|r| r.in_range_pct) {
        if in_range < 50.0 {
            take(15, format!("a ±5 % range was in range only {} % of the time", js_round(in_range)));
        } else if in_range < 80.0 {
            take(5, format!("a ±5 % range was in range {} % of the time", js_round(in_range)));
        }
    }
    let apr = headline_apr(p);
    if apr > 1_000.0 {
        take(20, format!("APR of {} % is very unlikely to last", js_round(apr)));
    } else if apr > 200.0 {
        take(10, format!("APR of {} % is unlikely to last", js_round(apr)));
    }
    let symbols: Vec<&str> = p.pair.split('-').collect();
    static BAD_FLAG: OnceLock<Regex> = OnceLock::new();
    for (i, t) in p.tokens().iter().take(2).enumerate() {
        let g = grades.get(i).and_then(|g| g.as_ref());
        let sym = g.map(|g| g.symbol.clone()).filter(|s| !s.is_empty())
            .or_else(|| symbols.get(i).filter(|s| !s.is_empty()).map(|s| s.to_string()))
            .unwrap_or_else(|| t.clone());
        let Some(g) = g.filter(|g| g.score.is_some()) else {
            take(5, format!("{sym} has no safety scan"));
            continue;
        };
        let score = g.score.unwrap_or(0.0);
        if score < 50.0 {
            take(25, format!("{sym} safety score {}/100", num_text(score)));
        } else if score < 70.0 {
            take(10, format!("{sym} safety score {}/100", num_text(score)));
        }
        if g.honeypot {
            take(40, format!("{sym} cannot be sold (honeypot)"));
        }
        for f in &g.flags {
            if re(&BAD_FLAG, r"(?i)mint|blacklist|tax can be changed|change balances").is_match(f) {
                take(10, format!("{sym}: {}", f.to_lowercase()));
            }
        }
        if g.proxy {
            take(5, format!("{sym} is an upgradeable proxy"));
        }
        if g.lp_locked_pct.is_some_and(|l| l < 50.0) {
            take(5, format!("{sym}: most of its liquidity is not locked"));
        }
    }
    let score = score.clamp(0, 100);
    Risk { score, grade: letter(score), reasons }
}

// ---- links ----

fn norm_symbol(s: &str) -> String {
    let s = s.to_lowercase();
    if s == "weth" { "eth".into() } else { s }
}

/// src/lib/routes.ts pairSlug: "CASHCAT-WETH" → "cashcat-eth".
pub fn pair_slug(pair: &str) -> String {
    pair.split(['-', '/']).map(norm_symbol).filter(|s| !s.is_empty()).collect::<Vec<_>>().join("-")
}

fn encode_uri_component(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        let c = b as char;
        if c.is_ascii_alphanumeric() || "-_.!~*'()".contains(c) {
            out.push(c);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

pub fn pool_link(p: &Pool) -> String {
    format!("{SITE}/discover/{}/{}?id={}", chain_slug(&p.chain), pair_slug(&p.pair), encode_uri_component(&p.id))
}

/// Whether btb.finance can open this pool's Add-liquidity flow.
pub fn addable(p: &Pool) -> bool {
    mint_dex(p).is_some()
}

/// The DEX btb.finance would add liquidity with (src/lib/pools.ts mintTarget), or None.
pub fn mint_dex(p: &Pool) -> Option<&'static str> {
    static V3_CL_SLIP: OnceLock<Regex> = OnceLock::new();
    static V3_CL: OnceLock<Regex> = OnceLock::new();
    static V3: OnceLock<Regex> = OnceLock::new();
    static V4_ID: OnceLock<Regex> = OnceLock::new();
    static ZERO: OnceLock<Regex> = OnceLock::new();
    let chain = p.chain.to_lowercase();
    let tokens = p.tokens().len();
    let chain_id = match chain.as_str() {
        "ethereum" => 1,
        "base" => 8453,
        "bnb chain" | "bsc" | "binance" => 56,
        "robinhood chain" => 4663,
        "arc" => 5042,
        _ => return None,
    };
    let project = p.project.as_str();
    let lower = project.to_lowercase();
    let version = p.version.clone().unwrap_or_default();
    let clmm = p.liquidity_model.as_deref() == Some("CLMM");
    if project == "aero" && clmm && (chain_id == 8453 || chain_id == 4663) && tokens >= 2 {
        return Some("aero");
    }
    if chain_id == 8453 || chain_id == 5042 {
        let slip = project == "aerodrome-slipstream"
            || (lower.starts_with("aerodrome") && (clmm || re(&V3_CL_SLIP, r"(?i)v3|slipstream|cl").is_match(&version)));
        if slip && tokens >= 2 {
            return Some("aerodrome");
        }
    }
    if chain_id == 4663 && tokens >= 2 {
        let cl = clmm || re(&V3_CL, r"(?i)v3|cl").is_match(&version);
        let up = lower == "up" || lower.starts_with("up-") || lower.starts_with("up_");
        if cl {
            if lower.starts_with("giga") { return Some("giga"); }
            if lower.starts_with("ramses") { return Some("ramses"); }
            if up { return Some("up"); }
            if lower.starts_with("sushi") { return Some("sushiswap"); }
            if lower.starts_with("alandale-cl") || lower.starts_with("alandale_cl") { return Some("alandale"); }
        }
    }
    let v3 = re(&V3, r"(?i)v3");
    if chain_id == 1 && tokens >= 2 && lower.starts_with("sushi") && (v3.is_match(project) || v3.is_match(&version)) {
        return Some("sushiswap");
    }
    if lower.starts_with("uniswap") && !p.dex.as_deref().unwrap_or("").to_lowercase().contains("uniswap") {
        return None;
    }
    let uni_v3 = project == "uniswap-v3" || (lower.starts_with("uniswap") && version == "V3");
    let cake_v3 = project == "pancakeswap-v3" || (lower.starts_with("pancake") && version == "V3");
    if uni_v3 && tokens >= 2 {
        return Some("uniswap");
    }
    if cake_v3 && tokens >= 2 {
        return Some("pancakeswap");
    }
    let uni_v4 = (project == "uniswap-v4" || (lower.starts_with("uniswap") && version == "V4"))
        && re(&V4_ID, r"(?i)^0x[0-9a-f]{64}$").is_match(&p.id);
    (uni_v4 && p.hooks.as_deref().map_or(true, |h| h.is_empty() || re(&ZERO, r"^0x0+$").is_match(h))).then_some("uniswap")
}

// ---- finding pools ----

fn norm_word(s: &str) -> String {
    let s = s.to_lowercase();
    match s.as_str() {
        "weth" => "eth".into(),
        "wbnb" => "bnb".into(),
        _ => s,
    }
}

/// Pools whose pair, DEX or token addresses match every word of the query.
pub fn search<'a>(pools: &'a [Pool], query: &str) -> Vec<&'a Pool> {
    let q = query.to_lowercase();
    let words: Vec<&str> = q.split(|c: char| c.is_whitespace() || c == '/' || c == ',' || c == '-').filter(|w| !w.is_empty()).collect();
    pools
        .iter()
        .filter(|p| {
            let syms: Vec<String> = p.pair.split('-').map(norm_word).collect();
            let hay = format!("{} {} {}", p.project, p.dex.as_deref().unwrap_or(""), p.version.as_deref().unwrap_or("")).to_lowercase();
            let toks: Vec<String> = p.tokens().iter().map(|t| t.to_lowercase()).collect();
            words.iter().all(|w| {
                let nw = norm_word(w);
                syms.contains(&nw) || toks.iter().any(|t| t == w) || syms.iter().any(|s| s.starts_with(&nw) && w.len() >= 3) || hay.contains(w)
            })
        })
        .collect()
}

/// A pool by `chain` + pool address / V4 id, or by its key `chain:id`.
pub fn find_pool<'a>(pools: &'a [Pool], chain: Option<&str>, id: &str) -> Option<&'a Pool> {
    let mut c = chain.map(chain_key);
    let mut want = id.trim().to_lowercase();
    if let Some((a, b)) = want.clone().split_once(':') {
        c = Some(chain_key(a));
        want = b.split(':').next().unwrap_or(b).to_string();
    }
    let mut hits: Vec<&Pool> = pools.iter().filter(|p| p.id.to_lowercase() == want && c.as_ref().map_or(true, |c| &chain_key(&p.chain) == c)).collect();
    hits.sort_by(|a, b| b.tvl().partial_cmp(&a.tvl()).unwrap_or(std::cmp::Ordering::Equal));
    hits.first().copied()
}

pub fn scan_link(chain_slug_name: &str, token: &str) -> String {
    format!("{SITE}/scan?chain={chain_slug_name}&token={token}")
}

/// The fields an agent needs to compare pools, as plain JSON (data.ts brief).
pub fn brief(p: &Pool, risk: &Risk) -> Value {
    let dex = [p.dex.clone().unwrap_or_else(|| p.project.clone()), p.version.clone().unwrap_or_default()]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    let apr_kind = if p.apr_range.is_some() {
        if p.range_yield.is_some() { "measured ±5% range APR" } else { "estimated ±5% range APR" }
    } else {
        "base + reward APR"
    };
    let ry = p.range_yield.as_ref();
    let mut m = Map::new();
    m.insert("key".into(), json!(pool_key(p)));
    m.insert("pair".into(), json!(p.pair));
    m.insert("chain".into(), json!(p.chain));
    m.insert("dex".into(), json!(dex));
    m.insert("feePct".into(), opt_num(fee_pct(p)));
    m.insert("tvlUsd".into(), num(js_round(p.tvl())));
    m.insert("aprPct".into(), num(round2(headline_apr(p))));
    m.insert("aprKind".into(), json!(apr_kind));
    m.insert("baseAprPct".into(), opt_num(p.apy_base.map(round2)));
    m.insert("rewardAprPct".into(), opt_num(p.apy_reward.map(round2)));
    m.insert("volume24hUsd".into(), opt_num(p.volume_24h_usd.map(js_round)));
    m.insert("fees24hUsd".into(), opt_num(p.fees_24h_usd.map(js_round)));
    m.insert("stablePair".into(), json!(p.stable()));
    m.insert("inRangePct".into(), opt_num(ry.and_then(|r| r.in_range_pct)));
    m.insert("vsHoldPct".into(), opt_num(ry.and_then(|r| r.net_pct).map(round2)));
    m.insert("measuredDays".into(), opt_num(ry.and_then(|r| r.days)));
    m.insert("risk".into(), json!(risk.grade.to_string()));
    m.insert("riskScore".into(), json!(risk.score));
    m.insert("canAddOnBtb".into(), json!(addable(p)));
    m.insert("link".into(), json!(pool_link(p)));
    Value::Object(m)
}

pub fn median(xs: &mut [f64]) -> Option<f64> {
    if xs.is_empty() {
        return None;
    }
    xs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let m = xs.len() / 2;
    Some(if xs.len() % 2 == 1 { xs[m] } else { (xs[m - 1] + xs[m]) / 2.0 })
}
