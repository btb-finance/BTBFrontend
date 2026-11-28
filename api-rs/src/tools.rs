//! The tools this server answers so far, with the same names, arguments and answers as the TypeScript connector
//! (src/lib/mcp/server.ts). Everything else stays on the TypeScript connector until it is moved here.

use crate::pools::{
    addable, brief, chain_id_of, chain_key, chain_slug, fee_pct, find_pool, headline_apr, js_round, median, mint_dex, num, opt_num as jnum,
    pool_key, pool_link, pool_risk, pool_risk_with, round2, scan_link, search, Pool, Risk, TokenGrade, LETTERS,
};
use crate::snapshot::Snapshot;
use serde_json::{json, Map, Value};

pub struct ToolError(pub String);

pub fn bad(msg: impl Into<String>) -> ToolError {
    ToolError(format!("Input validation error: {}", msg.into()))
}

const CHAIN_DESC: &str = "Chain name or id, e.g. \"base\", \"ethereum\", \"bnb\", \"robinhood\", 8453. Omit for all chains.";
const RISK_DESC: &str = "Worst risk grade to include (A safest). Default: all.";

/// tools/list entries: name, title, description, JSON Schema of the arguments, hints.
pub fn definitions() -> Vec<Value> {
    let read = json!({ "readOnlyHint": true, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true });
    let mut more = crate::registry::definitions(&read);
    more.extend(crate::lite::definitions(&read));
    more.extend(crate::rates::definitions(&read));
    more.extend(crate::txstatus::definitions(&read));
    more.extend(crate::swap::definitions(&read));
    more.extend(crate::signlink::definitions(&read));
    more.extend(crate::builders::definitions());
    more.extend(crate::portfolio::definitions(&read));
    more.extend(crate::overview::definitions(&read));
    more.push(json!({
        "name": "build_pump_claim",
        "title": "Claim Pump creator fees (ready to sign)",
        "description": "For a Pump coin creator's Solana wallet: one unsigned transaction that claims every creator fee waiting for it, from the bonding curve and from PumpSwap (unwrapped to SOL), with the amount, a dry run on Solana, and the transaction to sign. Free: BTB takes no fee on claims. The transaction expires about a minute after it is built. wallet_portfolio shows the fees before claiming.",
        "inputSchema": { "type": "object", "properties": { "wallet": { "type": "string", "pattern": "^[1-9A-HJ-NP-Za-km-z]{32,44}$", "description": "The creator's Solana address." } }, "required": ["wallet"] },
        "annotations": read,
    }));
    more.push(json!({
        "name": "build_pump_launch",
        "title": "Launch a Pump coin (ready to sign)",
        "description": "Launch a new coin on Pump (Solana) from the creator's wallet: one transaction that creates the coin, sets the creator-fee split (BTB keeps a share of creator fees on coins launched through BTB; the creator gets the rest), and optionally makes the creator's first buy in the same transaction so nobody can buy before them. Returns the new mint address, the split, a dry run on Solana and the transaction, already signed by the new coin's mint key; the creator's wallet signs as fee payer and must send it within about a minute without changing the blockhash. Send the coin's picture (imageUrl or imageBase64), description and optional links, and BTB pins them to IPFS; or pass metadataUri if you host it yourself. Cost: about 0.02 to 0.03 SOL plus the first buy. Most new coins lose almost all their value.",
        "inputSchema": { "type": "object", "properties": {
            "wallet": { "type": "string", "pattern": "^[1-9A-HJ-NP-Za-km-z]{32,44}$", "description": "The creator's Solana address: pays, signs and receives the creator's fee share." },
            "name": { "type": "string", "minLength": 1, "maxLength": 32, "description": "Coin name, up to 32 characters." },
            "symbol": { "type": "string", "minLength": 1, "maxLength": 10, "description": "Ticker, up to 10 characters, without the $." },
            "description": { "type": "string", "maxLength": 500, "description": "What the coin is about, shown on Pump." },
            "imageUrl": { "type": "string", "description": "https or ipfs link to the coin's picture." },
            "imageBase64": { "type": "string", "description": "Or the picture itself: PNG, JPEG, GIF or WebP, up to 1000 KB, base64 (a data: URL works)." },
            "twitter": { "type": "string", "description": "Optional https link." },
            "telegram": { "type": "string", "description": "Optional https link." },
            "website": { "type": "string", "description": "Optional https link." },
            "metadataUri": { "type": "string", "maxLength": 200, "description": "Only if you host the metadata JSON yourself (https or ipfs). Otherwise leave it out and BTB pins it from the fields above." },
            "devBuySol": { "type": "number", "minimum": 0, "maximum": 85, "description": "SOL to spend on the creator's first buy, in the same transaction. Default 0." }
        }, "required": ["wallet", "name", "symbol"] },
        "annotations": read,
    }));
    more.push(json!({
        "name": "build_token_launch",
        "title": "Launch a coin on an EVM launchpad (ready to sign)",
        "description": "Launch a new coin from the creator's wallet on an EVM launchpad, with BTB's share of fees built in where the launchpad allows it. launchpad: clanker (Base, BNB Chain, Robinhood Chain or Monad; Uniswap v4 pool with a 1-10% buy/sell tax; BTB is the integrator and keeps a share of the creator's part of the tax; claim with build_launch_claim), zora (Base; 1% pool fee, creator 0.5% of each trade, BTB 0.2% as platform referrer, paid automatically), pons (Robinhood Chain bonding curve, 0.0005 ETH launch fee, optional extra creator tax up to 10%; Pons pays creator fees to one address so BTB takes no share; optional first buy in the same transaction), flap (BNB Chain bonding curve tax token, 1-10% tax paid to the creator; BTB is the commission receiver; optional first buy). Send the picture (imageUrl or imageBase64), description and links; BTB pins them. Returns the coin address, the fee split, a dry run, the transaction and a sign link. Pump on Solana is build_pump_launch. Most new coins lose almost all their value.",
        "inputSchema": { "type": "object", "properties": {
            "wallet": { "type": "string", "pattern": "^0x[0-9a-fA-F]{40}$", "description": "The creator's EVM address: pays, signs and receives the creator's fees." },
            "launchpad": { "type": "string", "enum": ["clanker", "zora", "pons", "flap"] },
            "chain": { "type": "string", "description": "Clanker only: base (default), bsc, robinhood or monad. The others have one chain each." },
            "name": { "type": "string", "minLength": 1, "maxLength": 32 },
            "symbol": { "type": "string", "minLength": 1, "maxLength": 10, "description": "Ticker without the $." },
            "description": { "type": "string", "maxLength": 500 },
            "imageUrl": { "type": "string", "description": "https or ipfs link to the coin's picture." },
            "imageBase64": { "type": "string", "description": "Or the picture itself: PNG, JPEG, GIF or WebP, up to 1000 KB, base64." },
            "twitter": { "type": "string" }, "telegram": { "type": "string" }, "website": { "type": "string" },
            "taxPct": { "type": "number", "minimum": 0, "maximum": 10, "description": "clanker and flap: buy/sell tax in percent, 1 to 10 (default 3). pons: extra creator tax, 0 to 10 (default 0). Ignored for zora." },
            "devBuy": { "type": "number", "minimum": 0, "maximum": 10, "description": "pons and flap: native coin (ETH or BNB) for the creator's first buy in the same transaction. Default 0." }
        }, "required": ["wallet", "launchpad", "name", "symbol"] },
        "annotations": read,
    }));
    more.push(json!({
        "name": "build_launch_claim",
        "title": "Claim launchpad creator fees (ready to sign)",
        "description": "Find a creator's unclaimed fees on Clanker (Base, BNB Chain, Robinhood Chain, Monad) and Pons (Robinhood Chain) and build the claim transactions, one per chain, each with a dry run. Zora and Flap pay creators automatically. Claiming through BTB is free. Pump on Solana is build_pump_claim.",
        "inputSchema": { "type": "object", "properties": { "wallet": { "type": "string", "pattern": "^0x[0-9a-fA-F]{40}$" } }, "required": ["wallet"] },
        "annotations": read,
    }));
    let mut list = vec![
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
            "name": "pool_details",
            "title": "Pool details and risk",
            "description": "Everything about one pool: TVL, APRs (measured range APR, base, rewards), volume, fees, in-range share, result against holding, both tokens' safety scans, the risk grade with each deduction, and the btb.finance link.",
            "inputSchema": { "type": "object", "properties": pool_props(), "required": ["pool"] },
            "annotations": read,
        }),
        json!({
            "name": "compare_pools",
            "title": "Compare pools",
            "description": "Compare 2 to 6 pools side by side (APR, TVL, fees, risk with reasons, stable or not) and say which leads on each measure.",
            "inputSchema": { "type": "object", "properties": {
                "pools": { "type": "array", "items": { "type": "string" }, "minItems": 2, "maxItems": 6, "description": "Pool keys, e.g. [\"base:0x…\", \"ethereum:0x…\"]." }
            }, "required": ["pools"] },
            "annotations": read,
        }),
        json!({
            "name": "best_pools_for",
            "title": "Best pools for an amount",
            "description": "The highest-APR pools that can take a position of this size without it being more than 2 % of the pool (TVL at least 50× the amount).",
            "inputSchema": { "type": "object", "properties": {
                "amountUsd": { "type": "number", "exclusiveMinimum": 0 },
                "chain": { "type": "string", "description": CHAIN_DESC },
                "maxRisk": { "type": "string", "enum": ["A", "B", "C", "D", "E"], "description": RISK_DESC },
                "stableOnly": { "type": "boolean" },
                "limit": { "type": "integer", "minimum": 1, "maximum": 20, "description": "Default 5." }
            }, "required": ["amountUsd"] },
            "annotations": read,
        }),
        json!({
            "name": "estimate_lp_earnings",
            "title": "Estimate LP earnings",
            "description": "What an amount in one pool might earn over a number of days, from its APR and from its last 24 hours of fees, with the caveats.",
            "inputSchema": { "type": "object", "properties": {
                "chain": pool_props()["chain"].clone(), "pool": pool_props()["pool"].clone(),
                "amountUsd": { "type": "number", "exclusiveMinimum": 0 },
                "days": { "type": "integer", "minimum": 1, "maximum": 3650, "description": "Default 30." }
            }, "required": ["pool", "amountUsd"] },
            "annotations": read,
        }),
        json!({
            "name": "token_safety",
            "title": "Token safety",
            "description": "The newest btb.finance safety scan of a token (score 0-100, honeypot, taxes, owner powers), if one ran in the last 24 hours, else a link to run one.",
            "inputSchema": { "type": "object", "properties": {
                "chain": { "type": "string", "description": "Chain name or id." },
                "token": { "type": "string", "pattern": "^0x[0-9a-fA-F]{40}$", "description": "Token address." }
            }, "required": ["chain", "token"] },
            "annotations": read,
        }),
        json!({
            "name": "lp_plan",
            "title": "Plan an LP portfolio",
            "description": "Split an amount across several pools on different pairs (at most one pool per pair, no more than 2 % of any pool), within a risk limit, with expected yearly earnings and the cost of auto-management. A starting point for the user to review, not advice.",
            "inputSchema": { "type": "object", "properties": {
                "amountUsd": { "type": "number", "exclusiveMinimum": 0 },
                "chain": { "type": "string", "description": CHAIN_DESC },
                "maxRisk": { "type": "string", "enum": ["A", "B", "C", "D", "E"], "description": "Worst risk grade to include. Default B." },
                "stableOnly": { "type": "boolean" },
                "pools": { "type": "integer", "minimum": 1, "maximum": 8, "description": "How many pools to spread across. Default 3." }
            }, "required": ["amountUsd"] },
            "annotations": read,
        }),
        json!({
            "name": "add_liquidity_link",
            "title": "Add liquidity (link to sign)",
            "description": "A btb.finance link that opens the Add-liquidity flow for a pool, where the user picks the amount and range and signs in their own wallet. Says whether the app can add to this pool directly.",
            "inputSchema": { "type": "object", "properties": {
                "chain": pool_props()["chain"].clone(), "pool": pool_props()["pool"].clone(),
                "amountUsd": { "type": "number", "exclusiveMinimum": 0, "description": "For the estimate shown with the link." }
            }, "required": ["pool"] },
            "annotations": read,
        }),
        json!({
            "name": "compare_yield",
            "title": "Compare every way to earn on a token",
            "description": "Every place to earn on a token, side by side: lending (Aave V3 read from its contracts, Compound, Fluid, Euler, Spark, Moonwell, Venus), Morpho vaults (only vaults Morpho lists, with address and curator), savings, ETH staking, and BTB's liquidity pools. Ranked by base yield (paid in the token itself), with rewards shown apart, 1-day and 7-day rates, a stability flag, TVL, the contract to deposit into, and which tool builds the deposit. From BTB's own index, refreshed every 30 to 60 minutes.",
            "inputSchema": { "type": "object", "properties": {
                "token": { "type": "string", "description": "Symbol or address, e.g. \"USDC\", \"ETH\" (includes staking), \"WBTC\"." },
                "chain": { "type": "string", "description": CHAIN_DESC },
                "kinds": { "type": "array", "items": { "type": "string", "enum": ["lend", "vault", "savings", "stake", "lp"] }, "description": "Only these kinds. Default all." },
                "minTvlUsd": { "type": "number", "minimum": 0, "description": "Skip smaller markets. Default 1000000." },
                "stableOnly": { "type": "boolean", "description": "Only markets whose rate has been steady (1 day vs 7 days, or now vs 30 days)." },
                "limit": { "type": "integer", "minimum": 1, "maximum": 50, "description": "Default 15." }
            }, "required": ["token"] },
            "annotations": read,
        }),
        json!({
            "name": "chain_summary",
            "title": "Chain summary",
            "description": "Per chain: pool count, total TVL, median APR and TVL-weighted APR (all pools, and stable pairs only).",
            "inputSchema": { "type": "object", "properties": { "chain": { "type": "string", "description": CHAIN_DESC } } },
            "annotations": read,
        }),
    ];
    list.extend(more);
    list
}

pub fn has(name: &str) -> bool {
    matches!(
        name,
        "top_pools" | "search_pools" | "chain_summary" | "pool_details" | "compare_pools" | "best_pools_for" | "estimate_lp_earnings"
            | "token_safety" | "lp_plan" | "add_liquidity_link" | "compare_yield"
            | "list_protocols" | "get_protocol" | "quick_token_check" | "bridge_status"
            | "lending_rates" | "staking_rates" | "tx_status"
            | "find_token" | "quote_swap" | "sign_status"
            | "wallet_portfolio" | "wallet_overview" | "build_pump_claim" | "build_pump_launch" | "build_token_launch" | "build_launch_claim"
            | "build_swap" | "build_lend" | "build_withdraw" | "build_vault_deposit" | "build_vault_withdraw" | "build_bridge"
    )
}

/// What a tool call can reach: the warm snapshot, and Convex for token safety scans (a public read query).
pub struct Ctx<'a> {
    pub snap: &'a Snapshot,
    pub http: &'a reqwest::Client,
    pub convex: &'a str,
    pub index: &'a crate::store::Index,
    pub rates: &'a crate::rates::Feed,
    pub catalog: &'a crate::txstatus::Catalog,
    pub tokens: &'a crate::swap::Catalog,
    pub signed: &'a crate::signlink::Signed,
}

// ---- arguments ----

pub fn opt_str(a: &Map<String, Value>, k: &str) -> Result<Option<String>, ToolError> {
    match a.get(k) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(s)) => Ok(Some(s.clone())),
        Some(Value::Number(n)) if k == "chain" => Ok(Some(n.to_string())),
        _ => Err(bad(format!("{k} must be a string"))),
    }
}
pub fn opt_num(a: &Map<String, Value>, k: &str) -> Result<Option<f64>, ToolError> {
    match a.get(k) {
        None | Some(Value::Null) => Ok(None),
        Some(v) => v.as_f64().map(Some).ok_or_else(|| bad(format!("{k} must be a number"))),
    }
}
pub fn opt_bool(a: &Map<String, Value>, k: &str) -> Result<Option<bool>, ToolError> {
    match a.get(k) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Bool(b)) => Ok(Some(*b)),
        _ => Err(bad(format!("{k} must be true or false"))),
    }
}
pub fn limit(a: &Map<String, Value>, max: f64, default: usize) -> Result<usize, ToolError> {
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

pub async fn call(name: &str, args: &Map<String, Value>, ctx: &Ctx<'_>) -> Result<Value, ToolError> {
    let snap = ctx.snap;
    match name {
        "top_pools" => top_pools(args, snap),
        "search_pools" => search_pools(args, snap),
        "chain_summary" => chain_summary(args, snap),
        "pool_details" => {
            let p = pool_arg(args, snap)?;
            Ok(details(p, ctx).await)
        }
        "compare_pools" => compare_pools(args, ctx).await,
        "best_pools_for" => best_pools_for(args, snap),
        "estimate_lp_earnings" => {
            let p = pool_arg(args, snap)?;
            let amount = positive(args, "amountUsd")?.ok_or_else(|| bad("amountUsd is required"))?;
            let days = match opt_num(args, "days")? {
                None => 30.0,
                Some(d) if d.fract() == 0.0 && (1.0..=3650.0).contains(&d) => d,
                Some(_) => return Err(bad("days must be a whole number from 1 to 3650")),
            };
            Ok(estimate(p, amount, days))
        }
        "token_safety" => token_safety(args, ctx).await,
        "lp_plan" => lp_plan(args, snap),
        "add_liquidity_link" => add_liquidity_link(args, snap),
        "compare_yield" => crate::yields::compare(args, ctx).await,
        "list_protocols" => crate::registry::list(args),
        "get_protocol" => crate::registry::detail(args),
        "quick_token_check" => crate::lite::quick_token_check(args, ctx.http).await,
        "bridge_status" => crate::lite::bridge_status(args, ctx.http).await,
        "lending_rates" => crate::rates::lending(args, ctx.rates, ctx.http).await,
        "staking_rates" => crate::rates::staking_rates(args, ctx.rates, ctx.http).await,
        "tx_status" => crate::txstatus::tx_status(args, ctx.http, ctx.catalog).await,
        "find_token" => crate::swap::find_token(args, ctx.http, ctx.tokens).await,
        "quote_swap" => crate::swap::quote_swap(args, ctx.http, ctx.tokens).await,
        "sign_status" => crate::signlink::sign_status(args, ctx.http, ctx.catalog, ctx.signed).await,
        "wallet_portfolio" => crate::portfolio::wallet_portfolio(args, ctx).await,
        "wallet_overview" => crate::overview::wallet_overview(args, ctx).await,
        "build_pump_claim" => {
            let w = opt_str(args, "wallet")?.ok_or_else(|| bad("wallet is required"))?;
            if !crate::solana::is_address(w.trim()) {
                return Err(bad("wallet must be a Solana address (the coin's creator)"));
            }
            crate::solana::build_pump_claim(ctx.http, w.trim()).await.map_err(ToolError)
        }
        "build_pump_launch" => {
            let w = opt_str(args, "wallet")?.ok_or_else(|| bad("wallet is required"))?;
            if !crate::solana::is_address(w.trim()) {
                return Err(bad("wallet must be a Solana address (the coin's creator)"));
            }
            let name = opt_str(args, "name")?.unwrap_or_default().trim().to_string();
            let symbol = opt_str(args, "symbol")?.unwrap_or_default().trim().trim_start_matches('$').to_string();
            let mut uri = opt_str(args, "metadataUri")?.unwrap_or_default().trim().to_string();
            if name.is_empty() || name.len() > 32 {
                return Err(bad("name is required, up to 32 bytes"));
            }
            if symbol.is_empty() || symbol.len() > 10 {
                return Err(bad("symbol is required, up to 10 bytes"));
            }
            if uri.is_empty() {
                let (link, _) = crate::pumpmeta::save(
                    ctx.http,
                    ctx.index.db.as_ref(),
                    crate::pumpmeta::Meta {
                        name: name.clone(),
                        symbol: symbol.clone(),
                        description: opt_str(args, "description")?.unwrap_or_default().chars().take(500).collect(),
                        image_url: opt_str(args, "imageUrl")?,
                        image_base64: opt_str(args, "imageBase64")?,
                        twitter: opt_str(args, "twitter")?,
                        telegram: opt_str(args, "telegram")?,
                        website: opt_str(args, "website")?,
                    },
                )
                .await
                .map_err(ToolError)?;
                uri = link;
            }
            if uri.len() > 200 || !(uri.starts_with("https://") || uri.starts_with("ipfs://")) {
                return Err(bad("metadataUri must be an https:// or ipfs:// link to the metadata JSON, up to 200 characters"));
            }
            let dev = opt_num(args, "devBuySol")?.unwrap_or(0.0);
            if !(0.0..=85.0).contains(&dev) {
                return Err(bad("devBuySol must be between 0 and 85"));
            }
            crate::solana::build_pump_launch(ctx.http, crate::solana::Launch { wallet: w.trim().to_string(), name, symbol, uri, dev_buy_sol: dev })
                .await
                .map_err(ToolError)
        }
        "build_token_launch" => {
            let w = opt_str(args, "wallet")?.unwrap_or_default().trim().to_string();
            if !crate::launchpads::is_addr(&w) {
                return Err(bad("wallet must be a 0x address (the coin's creator)"));
            }
            let pad = opt_str(args, "launchpad")?.unwrap_or_default().trim().to_lowercase();
            let name = opt_str(args, "name")?.unwrap_or_default().trim().to_string();
            let symbol = opt_str(args, "symbol")?.unwrap_or_default().trim().trim_start_matches('$').to_string();
            if name.is_empty() || name.len() > 32 {
                return Err(bad("name is required, up to 32 bytes"));
            }
            if symbol.is_empty() || symbol.len() > 10 {
                return Err(bad("symbol is required, up to 10 bytes"));
            }
            let meta = crate::pumpmeta::Meta {
                name: name.clone(),
                symbol: symbol.clone(),
                description: opt_str(args, "description")?.unwrap_or_default().chars().take(500).collect(),
                image_url: opt_str(args, "imageUrl")?,
                image_base64: opt_str(args, "imageBase64")?,
                twitter: opt_str(args, "twitter")?,
                telegram: opt_str(args, "telegram")?,
                website: opt_str(args, "website")?,
            };
            if meta.image_url.as_deref().unwrap_or("").trim().is_empty() && meta.image_base64.as_deref().unwrap_or("").trim().is_empty() {
                return Err(bad("send the coin's picture as imageUrl or imageBase64"));
            }
            let tax = opt_num(args, "taxPct")?;
            let dev = opt_num(args, "devBuy")?.unwrap_or(0.0);
            if !(0.0..=10.0).contains(&dev) {
                return Err(bad("devBuy must be between 0 and 10"));
            }
            let desc = meta.description.clone();
            let chain = opt_str(args, "chain")?.unwrap_or_else(|| "base".into());
            let base = |uri: String, image: String, tax_pct: f64| crate::launchpads::Launch {
                wallet: w.clone(),
                chain: chain.clone(),
                name: name.clone(),
                symbol: symbol.clone(),
                uri,
                image,
                description: desc.clone(),
                tax_pct,
            };
            match pad.as_str() {
                "flap" => crate::launchpads::build_flap_launch(ctx.http, base(String::new(), String::new(), tax.unwrap_or(3.0)), meta, dev).await.map_err(ToolError),
                "clanker" | "zora" | "pons" => {
                    let socials = crate::launchpads::Socials { twitter: meta.twitter.clone().unwrap_or_default(), telegram: meta.telegram.clone().unwrap_or_default(), website: meta.website.clone().unwrap_or_default() };
                    let (uri, image) = crate::pumpmeta::save(ctx.http, ctx.index.db.as_ref(), meta).await.map_err(ToolError)?;
                    match pad.as_str() {
                        "clanker" => crate::launchpads::build_clanker_launch(ctx.http, base(uri, image, tax.unwrap_or(3.0))).await,
                        "zora" => crate::launchpads::build_zora_launch(ctx.http, base(uri, image, 0.0)).await,
                        _ => crate::launchpads::build_pons_launch(ctx.http, base(uri, image, tax.unwrap_or(0.0)), socials, dev).await,
                    }
                    .map_err(ToolError)
                }
                _ => Err(bad("launchpad must be clanker, zora, pons or flap (Pump on Solana is build_pump_launch)")),
            }
        }
        "build_launch_claim" => {
            let w = opt_str(args, "wallet")?.unwrap_or_default().trim().to_string();
            if !crate::launchpads::is_addr(&w) {
                return Err(bad("wallet must be a 0x address"));
            }
            Ok(crate::launchpads::build_launch_claim(ctx.http, &w).await)
        }
        "build_swap" => crate::builders::build_swap(args, ctx).await,
        "build_lend" => crate::builders::build_lend(args, ctx).await,
        "build_withdraw" => crate::builders::build_withdraw(args, ctx).await,
        "build_vault_deposit" => crate::builders::build_vault_deposit(args, ctx).await,
        "build_vault_withdraw" => crate::builders::build_vault_withdraw(args, ctx).await,
        "build_bridge" => crate::builders::build_bridge(args, ctx).await,
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


// ---- one pool ----

fn pool_props() -> Value {
    json!({
        "chain": { "type": "string", "description": "Chain of the pool (not needed when pool is a key like \"base:0x…\")." },
        "pool": { "type": "string", "description": "The pool: its key from another tool (\"base:0x…\") or its address / Uniswap V4 pool id." }
    })
}

const NOT_FOUND: &str = "Pool not found. Use search_pools or top_pools to get its key.";

fn pool_arg<'a>(a: &Map<String, Value>, snap: &'a Snapshot) -> Result<&'a Pool, ToolError> {
    let id = opt_str(a, "pool")?.ok_or_else(|| bad("pool is required"))?;
    let chain = opt_str(a, "chain")?;
    find_pool(&snap.pools, chain.as_deref(), &id).ok_or_else(|| ToolError(NOT_FOUND.into()))
}

fn positive(a: &Map<String, Value>, k: &str) -> Result<Option<f64>, ToolError> {
    match opt_num(a, k)? {
        Some(n) if n <= 0.0 => Err(bad(format!("{k} must be above 0"))),
        other => Ok(other),
    }
}

/// data.ts tokenGrade: the newest open scan from Convex (tokenScan:forToken), or None.
pub async fn token_grade(ctx: &Ctx<'_>, chain_id: Option<i64>, token: &str) -> Option<TokenGrade> {
    let chain_id = chain_id?;
    if token.len() != 42 || !token.starts_with("0x") || !token[2..].chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    let token = token.to_lowercase();
    let reply: Value = ctx
        .http
        .post(format!("{}/api/query", ctx.convex))
        .json(&json!({ "path": "tokenScan:forToken", "args": { "chainId": chain_id as f64, "token": token }, "format": "json" }))
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;
    let row = reply.get("value")?;
    if row.is_null() || row["fresh"] != json!(true) {
        return None;
    }
    let data: Value = serde_json::from_str(row["data"].as_str()?).ok()?;
    let safety = &data["safety"];
    Some(TokenGrade {
        token,
        symbol: row["symbol"].as_str().unwrap_or("").to_string(),
        score: data["grade"]["score"].as_f64().or_else(|| row["score"].as_f64()),
        flags: safety["flags"].as_array().map(|f| f.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default(),
        honeypot: safety["honeypot"].as_bool().unwrap_or(false),
        scanned_at: row["createdAt"].as_f64().unwrap_or(0.0),
        proxy: safety["details"]["proxy"].as_bool().unwrap_or(false),
        lp_locked_pct: safety["details"]["lpLockedPct"].as_f64(),
    })
}

async fn details(p: &Pool, ctx: &Ctx<'_>) -> Value {
    let chain_id = chain_id_of(p);
    let tokens: Vec<String> = p.tokens().iter().take(2).cloned().collect();
    let grades: Vec<Option<TokenGrade>> = futures::future::join_all(tokens.iter().map(|t| token_grade(ctx, chain_id, t))).await;
    let risk = pool_risk_with(p, &grades);
    let symbols: Vec<&str> = p.pair.split('-').collect();
    let mut out = brief(p, &risk);
    let m = out.as_object_mut().expect("object");
    m.insert("riskReasons".into(), json!(if risk.reasons.is_empty() { vec!["no deductions".to_string()] } else { risk.reasons.clone() }));
    m.insert(
        "tokens".into(),
        Value::Array(
            tokens
                .iter()
                .enumerate()
                .map(|(i, t)| {
                    let safety = match &grades[i] {
                        Some(g) => json!({ "score": jnum(g.score), "honeypot": g.honeypot, "flags": g.flags, "scannedAt": iso(g.scanned_at) }),
                        None => json!({
                            "score": null,
                            "note": "Not scanned in the last 24 hours. A scan on btb.finance checks contract powers, taxes, holders and liquidity.",
                            "scanLink": scan_link(&chain_slug(&p.chain), t),
                        }),
                    };
                    json!({ "address": t, "symbol": symbols.get(i).map(|s| json!(s)).unwrap_or(Value::Null), "safety": safety })
                })
                .collect(),
        ),
    );
    m.insert(
        "merklRewards".into(),
        match &p.merkl {
            Some(k) => json!({ "aprPct": num(round2(k.apr.unwrap_or(f64::NAN))), "rewards": k.reward_symbols, "dailyRewardsUsd": num(js_round(k.daily_rewards_usd.unwrap_or(f64::NAN))) }),
            None => Value::Null,
        },
    );
    m.insert("apyChange1dPct".into(), jnum(p.apy_change_1d));
    m.insert("poolAddressOrId".into(), json!(p.id));
    m.insert("chainId".into(), chain_id.map(|c| json!(c)).unwrap_or(Value::Null));
    out
}

async fn compare_pools(a: &Map<String, Value>, ctx: &Ctx<'_>) -> Result<Value, ToolError> {
    let keys: Vec<String> = match a.get("pools") {
        Some(Value::Array(v)) if v.iter().all(Value::is_string) => v.iter().map(|x| x.as_str().unwrap_or("").to_string()).collect(),
        _ => return Err(bad("pools must be a list of pool keys")),
    };
    if !(2..=6).contains(&keys.len()) {
        return Err(bad("pools must list 2 to 6 pool keys"));
    }
    let found: Vec<Option<&Pool>> = keys.iter().map(|k| find_pool(&ctx.snap.pools, None, k)).collect();
    let missing: Vec<&str> = keys.iter().zip(&found).filter(|(_, f)| f.is_none()).map(|(k, _)| k.as_str()).collect();
    if !missing.is_empty() {
        return Err(ToolError(format!("Not found: {}. Use keys from search_pools or top_pools.", missing.join(", "))));
    }
    let rows: Vec<Value> = futures::future::join_all(found.iter().map(|p| details(p.expect("found"), ctx))).await;
    let f = |r: &Value, k: &str| r[k].as_f64().unwrap_or(0.0);
    let best = |score: &dyn Fn(&Value) -> f64| {
        let mut b = &rows[0];
        for r in &rows[1..] {
            if score(r) > score(b) {
                b = r;
            }
        }
        b["key"].clone()
    };
    let leaders = json!({
        "highestApr": best(&|r| f(r, "aprPct")),
        "lowestRisk": best(&|r| f(r, "riskScore")),
        "deepestTvl": best(&|r| f(r, "tvlUsd")),
        "mostFees24h": best(&|r| f(r, "fees24hUsd")),
        "bestAprPerRisk": best(&|r| f(r, "aprPct") * (f(r, "riskScore") / 100.0)),
    });
    Ok(json!({ "pools": rows, "leaders": leaders }))
}

/// What `amount_usd` in this pool might earn over `days`, from its APR and, separately, from its last day of fees.
fn estimate(p: &Pool, amount_usd: f64, days: f64) -> Value {
    let apr = headline_apr(p);
    let by_apr = amount_usd * (apr / 100.0) * (days / 365.0);
    let share = amount_usd / (p.tvl() + amount_usd);
    let by_fees = p.fees_24h_usd.map(|f| f * share * days);
    json!({
        "pool": pool_key(p), "pair": p.pair, "amountUsd": num(amount_usd), "days": num(days), "aprPct": num(round2(apr)),
        "earnUsdAtApr": num(round2(by_apr)),
        "earnUsdFromLast24hFeesFullRange": by_fees.map(|x| num(round2(x))).unwrap_or(Value::Null),
        "yourShareOfPoolPct": num(round2(share * 100.0)),
        "vsHoldPctOverMeasuredWindow": p.range_yield.as_ref().map(|r| num(round2(r.net_pct.unwrap_or(f64::NAN)))).unwrap_or(Value::Null),
        "notes": [
            "The APR figure assumes the APR holds and, for a range APR, that a ±5 % range is reset when price leaves it (auto-management does this).",
            "The fee figure is a full-range position sharing the last 24 h of fees pro rata; a concentrated range earns more while in range.",
            if p.stable() { "Stable pair: little impermanent loss." } else { "Not a stable pair: price moves can lose more than the fees earn (impermanent loss)." },
            "Estimates, not promises, and not financial advice.",
        ],
    })
}

/// top_pools' filter (server.ts filtered).
fn filtered<'a>(snap: &'a Snapshot, chain: Option<&str>, worst: usize, min_tvl: f64, stable_only: bool) -> Vec<(&'a Pool, Risk)> {
    let c = chain.map(chain_key);
    snap.pools
        .iter()
        .filter(|p| c.as_ref().map_or(true, |c| &chain_key(&p.chain) == c) && p.tvl() >= min_tvl && (!stable_only || p.stable()))
        .map(|p| (p, pool_risk(p)))
        .filter(|(_, r)| LETTERS.iter().position(|l| *l == r.grade).unwrap_or(4) <= worst)
        .collect()
}

fn best_pools_for(a: &Map<String, Value>, snap: &Snapshot) -> Result<Value, ToolError> {
    let amount = positive(a, "amountUsd")?.ok_or_else(|| bad("amountUsd is required"))?;
    let chain = opt_str(a, "chain")?;
    let worst = max_risk(a)?;
    let stable_only = opt_bool(a, "stableOnly")?.unwrap_or(false);
    let n = limit(a, 20.0, 5)?;
    let mut rows = filtered(snap, chain.as_deref(), worst, f64::max(100_000.0, amount * 50.0), stable_only);
    rows.sort_by(|x, y| by_desc(headline_apr(x.0), headline_apr(y.0)));
    rows.truncate(n);
    let pools: Vec<Value> = rows
        .iter()
        .map(|(p, r)| {
            let mut b = brief(p, r);
            b["yearlyEarnUsdAtApr"] = num(round2(amount * headline_apr(p) / 100.0));
            b
        })
        .collect();
    Ok(json!({ "amountUsd": num(amount), "pools": pools }))
}

async fn token_safety(a: &Map<String, Value>, ctx: &Ctx<'_>) -> Result<Value, ToolError> {
    let chain = opt_str(a, "chain")?.ok_or_else(|| bad("chain is required"))?;
    let token = opt_str(a, "token")?.ok_or_else(|| bad("token is required"))?;
    if token.len() != 42 || !token.starts_with("0x") || !token[2..].chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(bad("token must be a 0x address"));
    }
    let chain_id: Option<i64> = if !chain.is_empty() && chain.chars().all(|c| c.is_ascii_digit()) {
        chain.parse().ok()
    } else {
        match chain_key(&chain).as_str() {
            "ethereum" => Some(1), "base" => Some(8453), "bnbchain" => Some(56), "robinhoodchain" => Some(4663),
            "arbitrum" => Some(42161), "optimism" => Some(10), "polygon" => Some(137), "unichain" => Some(130), _ => None,
        }
    };
    let slug = match chain_id {
        Some(1) => "ethereum".to_string(), Some(8453) => "base".into(), Some(56) => "bsc".into(), Some(4663) => "robinhood".into(),
        _ => chain_slug(&chain),
    };
    let link = scan_link(&slug, &token);
    Ok(match token_grade(ctx, chain_id, &token).await {
        Some(g) => json!({
            "token": g.token, "symbol": g.symbol, "score": jnum(g.score), "flags": g.flags, "honeypot": g.honeypot,
            "scannedAt": iso(g.scanned_at), "proxy": g.proxy, "lpLockedPct": jnum(g.lp_locked_pct), "link": link,
        }),
        None => json!({ "scanned": false, "note": "No scan in the last 24 hours. Running one on btb.finance costs a little BTB; anyone can then read it free for 24 hours.", "link": link }),
    })
}

/// convex/autoRebalanceConfig.ts: rebalance price per chain (USD) and checks per day at the hourly default.
fn rebalance_usd(chain_id: Option<i64>) -> Option<f64> {
    match chain_id {
        Some(8453) => Some(0.1),
        Some(4663) => Some(0.5),
        _ => None,
    }
}

fn lp_plan(a: &Map<String, Value>, snap: &Snapshot) -> Result<Value, ToolError> {
    let amount = positive(a, "amountUsd")?.ok_or_else(|| bad("amountUsd is required"))?;
    let chain = opt_str(a, "chain")?;
    let worst = match opt_str(a, "maxRisk")? {
        None => 1,
        Some(_) => max_risk(a)?,
    };
    let stable_only = opt_bool(a, "stableOnly")?.unwrap_or(false);
    let n = match opt_num(a, "pools")? {
        None => 3.0,
        Some(x) if x.fract() == 0.0 && (1.0..=8.0).contains(&x) => x,
        Some(_) => return Err(bad("pools must be a whole number from 1 to 8")),
    };
    let per = amount / n;
    let mut rows = filtered(snap, chain.as_deref(), worst, f64::max(250_000.0, per * 50.0), stable_only);
    rows.sort_by(|x, y| by_desc(headline_apr(x.0) * x.1.score as f64, headline_apr(y.0) * y.1.score as f64));
    let mut seen = std::collections::HashSet::new();
    let picks: Vec<(&Pool, Risk)> = rows
        .into_iter()
        .filter(|(p, _)| {
            let mut syms: Vec<String> = p.pair.split('-').map(|s| s.to_uppercase()).collect();
            syms.sort();
            seen.insert(syms.join("-"))
        })
        .take(n as usize)
        .collect();
    if picks.is_empty() {
        return Err(ToolError("No pools pass these limits. Allow a worse risk grade, another chain, or a smaller amount.".into()));
    }
    let each = amount / picks.len() as f64;
    let rows: Vec<Value> = picks
        .iter()
        .map(|(p, r)| {
            let mut b = brief(p, r);
            b["allocateUsd"] = num(round2(each));
            b["yearlyEarnUsdAtApr"] = num(round2(each * headline_apr(p) / 100.0));
            b["autoManage"] = match rebalance_usd(chain_id_of(p)) {
                Some(usd) => json!({ "available": true, "checkBtbPerDayHourly": 24, "rebalanceUsd": num(usd) }),
                None => json!({ "available": false }),
            };
            b
        })
        .collect();
    let yearly: f64 = rows.iter().map(|r| r["yearlyEarnUsdAtApr"].as_f64().unwrap_or(0.0)).sum();
    Ok(json!({
        "amountUsd": num(amount), "pools": rows,
        "blendedAprPct": num(round2((yearly / amount) * 100.0)), "yearlyEarnUsdAtApr": num(round2(yearly)),
        "nextSteps": [
            "Open each pool link and add liquidity with your own wallet (btb.finance shows the range and the transactions before you sign).",
            "Then turn on auto-management for each position (auto_manage_setup explains costs) so the range is reset when price leaves it.",
        ],
        "disclaimer": "Estimates from current APRs, which change. Not financial advice.",
    }))
}

fn add_liquidity_link(a: &Map<String, Value>, snap: &Snapshot) -> Result<Value, ToolError> {
    let p = pool_arg(a, snap)?;
    let amount = positive(a, "amountUsd")?;
    let dex = mint_dex(p);
    let ok = addable(p);
    let mut out = json!({
        "pool": pool_key(p), "pair": p.pair, "chain": p.chain, "link": pool_link(p), "canAddOnBtb": ok, "dex": dex,
        "feePct": jnum(fee_pct(p)), "risk": pool_risk(p).grade.to_string(),
        "steps": if ok {
            json!(["Open the link and connect your wallet.", "Enter the amount; btb.finance suggests a range and shows the APR for it.", "Review and sign the approval and mint transactions in your wallet.", "Optional: turn on auto-management for the new position."])
        } else {
            json!(["btb.finance cannot add to this pool directly yet; the link opens its page with the simulator and the DEX's own page."])
        },
    });
    if let Some(amount) = amount {
        out["estimate"] = estimate(p, amount, 30.0);
    }
    out["safety"] = json!("Nothing is signed or sent by this tool. Check the pool, the tokens and the amounts in your wallet before signing.");
    Ok(out)
}
