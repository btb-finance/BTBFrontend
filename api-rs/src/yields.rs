//! compare_yield: every way to earn on a token, from BTB's own index (src/store.rs, filled by src/indexers.rs) plus
//! the liquidity pools in the warm snapshot, ranked on the same terms.

use crate::pools::{chain_key, headline_apr, num, pool_key, pool_risk, round2};
use crate::tools::{bad, limit, opt_bool, opt_num, opt_str, Ctx, ToolError};
use serde_json::{json, Map, Value};

const ETH_STAKED: &[&str] = &["steth", "wsteth", "weeth", "eeth", "reth", "cbeth", "wbeth", "rseth", "lseth", "meth", "oseth", "ezeth", "sfrxeth", "frxeth", "sweth", "ethx"];

fn same_token(symbol: &str, want: &str) -> bool {
    let s = symbol.to_lowercase();
    s == want || (want == "eth" && (s == "weth" || s == "eth")) || (want == "weth" && s == "eth") || (want == "btc" && (s == "wbtc" || s == "cbbtc" || s == "tbtc"))
}

/// Whether a rate has been steady: 1 day against 7 days, or now against the 30-day average.
fn steady(now: f64, short: Option<f64>, long: Option<f64>) -> Option<bool> {
    let (a, b) = match (short, long) {
        (Some(s), Some(l)) => (s, l),
        (None, Some(l)) => (now, l),
        _ => return None,
    };
    Some((a - b).abs() <= f64::max(1.0, 0.3 * b.abs()))
}

pub async fn compare(a: &Map<String, Value>, ctx: &Ctx<'_>) -> Result<Value, ToolError> {
    let token = opt_str(a, "token")?.filter(|t| !t.trim().is_empty()).ok_or_else(|| bad("token is required"))?.trim().to_lowercase();
    let chain = opt_str(a, "chain")?.map(|c| chain_key(&c));
    let min_tvl = opt_num(a, "minTvlUsd")?.unwrap_or(1_000_000.0);
    let stable_only = opt_bool(a, "stableOnly")?.unwrap_or(false);
    let n = limit(a, 50.0, 15)?;
    let kinds: Option<Vec<String>> = a.get("kinds").and_then(|k| k.as_array()).map(|v| v.iter().filter_map(|x| x.as_str().map(String::from)).collect());
    let want_kind = |k: &str| kinds.as_ref().map_or(true, |ks| ks.iter().any(|x| x == k));
    let by_address = token.starts_with("0x") && token.len() == 42;

    let mut rows: Vec<(f64, Value)> = Vec::new();
    // Markets with no rate history from their source (Aave) use BTB's own hourly history: last 7 days.
    let own_7d = {
        let markets = ctx.index.markets.read().await;
        let ids: Vec<String> = markets.values().filter(|m| m.apy_7d.is_none() && m.apy_30d.is_none()).map(|m| m.id.clone()).collect();
        drop(markets);
        ctx.index.history_avg(&ids, 168).await
    };
    {
        let markets = ctx.index.markets.read().await;
        for m in markets.values() {
            if !want_kind(&m.kind) || m.tvl_usd < min_tvl {
                continue;
            }
            if chain.as_ref().is_some_and(|c| &chain_key(&m.chain) != c) {
                continue;
            }
            let hit = if by_address {
                m.asset_address.as_deref() == Some(token.as_str())
            } else {
                same_token(&m.asset_symbol, &token)
                    // ETH: staking tokens count too (staking ETH is a way to earn on it).
                    || (token == "eth" && m.kind == "stake" && ETH_STAKED.contains(&m.asset_symbol.to_lowercase().as_str()))
            };
            if !hit {
                continue;
            }
            let own = own_7d.get(&m.id).copied();
            let stable = steady(m.apy_base, m.apy_1d, m.apy_7d.or(m.apy_30d).or(own));
            if stable_only && stable != Some(true) {
                continue;
            }
            let how = match (m.kind.as_str(), m.protocol.as_str()) {
                ("lend", "Aave V3") => "build_lend (and build_withdraw later)".to_string(),
                ("vault", _) => format!("build_tx with steps: approve {} for the vault, then deposit(assets, receiver) on {}", m.asset_symbol, m.address.clone().unwrap_or_default()),
                ("stake", _) => format!("build_swap from ETH to {} (staking tokens trade like any token)", m.asset_symbol),
                _ => "get_protocol for the contracts, then build_tx".to_string(),
            };
            rows.push((m.apy_base, json!({
                "kind": m.kind, "protocol": m.protocol, "name": m.name, "chain": m.chain, "chainId": m.chain_id,
                "token": m.asset_symbol, "tokenAddress": m.asset_address, "address": m.address, "curator": m.curator,
                "baseApyPct": num(round2(m.apy_base)), "rewardApyPct": num(round2(m.apy_reward)),
                "apy1dPct": m.apy_1d.map(|x| num(round2(x))), "apy7dPct": m.apy_7d.map(|x| num(round2(x))), "apy30dPct": m.apy_30d.map(|x| num(round2(x))), "apy7dPctBtbHistory": own.map(|x| num(round2(x))),
                "steady": stable, "tvlUsd": num(m.tvl_usd.round()), "listed": m.listed, "howToDeposit": how,
                "source": m.source,
            })));
        }
    }
    // Liquidity pools holding the token, from the warm snapshot.
    if want_kind("lp") && !by_address {
        for p in &ctx.snap.pools {
            if p.tvl() < min_tvl || chain.as_ref().is_some_and(|c| &chain_key(&p.chain) != c) {
                continue;
            }
            if !p.pair.split('-').any(|s| same_token(s, &token)) {
                continue;
            }
            // A pool with a volatile partner is a bet on that token, not yield on this one: only stable pairs,
            // unless LPs were asked for by name.
            let lp_asked = kinds.as_ref().is_some_and(|ks| ks.iter().any(|k| k == "lp"));
            if !p.stable() && !lp_asked {
                continue;
            }
            let ry = p.range_yield.as_ref();
            let stable = ry.and_then(|r| r.days).map(|d| d >= 14.0);
            if stable_only && stable != Some(true) {
                continue;
            }
            let risk = pool_risk(p);
            let protocol = format!("{} {}", p.dex.clone().unwrap_or_else(|| p.project.clone()), p.version.clone().unwrap_or_default()).trim().to_string();
            rows.push((headline_apr(p), json!({
                "kind": "lp", "protocol": protocol, "name": p.pair, "chain": p.chain,
                "pool": pool_key(p), "baseApyPct": num(round2(headline_apr(p))), "rewardApyPct": num(round2(p.apy_reward.unwrap_or(0.0))),
                "vsHoldPct": ry.and_then(|r| r.net_pct).map(|x| num(round2(x))), "measuredDays": ry.and_then(|r| r.days).map(num),
                "steady": stable, "tvlUsd": num(p.tvl().round()), "risk": risk.grade.to_string(),
                "howToDeposit": format!("build_zap_liquidity with pool {} (from one token) or build_add_liquidity", pool_key(p)),
                "note": "LP APR: fees for a ±5% range, which can lose to holding when the price moves (see vsHoldPct).",
            })));
        }
    }
    rows.sort_by(|x, y| y.0.partial_cmp(&x.0).unwrap_or(std::cmp::Ordering::Equal));
    let total = rows.len();
    let markets: Vec<Value> = rows.into_iter().take(n).map(|(_, v)| v).collect();
    let indexed = ctx.index.markets.read().await.len();
    Ok(json!({
        "token": token, "matches": total, "markets": markets,
        "notes": [
            "Ranked by base APY: paid in the token itself. rewardApyPct is paid in other tokens and can stop.",
            "steady: the rate held over the last days (false means it jumped; check apy1dPct, apy7dPct, apy30dPct).",
            "LPs: only stable pairs unless kinds includes \"lp\" (a volatile partner adds price risk, often losing to holding).",
            "Lending and vaults carry smart-contract risk; LPs add price risk. Not financial advice.",
        ],
        "index": { "markets": indexed },
    }))
}
