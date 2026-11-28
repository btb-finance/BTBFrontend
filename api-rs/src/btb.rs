//! BTB's own products on Ethereum, ready to sign: Bear NFT mint, stake, unstake and claim; BTB to BTBB and back;
//! BTB to the trading wrapper and back; FLIP up and down. Nothing signs or sends; each build has a dry run and a
//! sign link.

use crate::launchpads::{call, calldata, eth, selector, simulate, tx, word, T};
use crate::signlink::with_sign_link;
use serde_json::{json, Value};

const CHAIN: i64 = 1;
pub const BTB: &str = "0x88888888c90CD71B35830daBFD24743DbC135B51";
pub const BTBB: &str = "0x88888880d5Ca13018D2dC11e2e4744BD91a5656f";
pub const BEAR: &str = "0x88888888aBa934ceA0b4f0000FeA62F1397D02A0";
pub const STAKING: &str = "0x8888888Faf81E6a98deb2B90A05B46b6E903e927";
pub const WRAPPER: &str = "0x88888805E7e3d5c7FB002AD98f08250E79c298dC";
pub const FLIP: &str = "0x8888889C878a0aE26033799517461af33a8E50a0";
const USDC: &str = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const MAX_IDS: usize = 200;

fn q(sig: &str, args: &[T]) -> String {
    calldata(sig, args)
}
async fn u(http: &reqwest::Client, to: &str, sig: &str, args: Vec<T>) -> u128 {
    call(http, CHAIN, to, &q(sig, &args)).await.map(|b| word(&b, 0)).unwrap_or(0)
}
fn units(raw: u128, dec: usize) -> String {
    crate::lite::format_units(&raw.to_string(), dec)
}
fn parse(amount: &str, dec: u32) -> Result<u128, String> {
    crate::swap::to_base_units(amount, dec).parse::<u128>().map_err(|_| "amount is not a number".to_string())
}

/// The wallet's Bear position: NFTs held and staked, rewards waiting (after the 1% BTBB fee), the pool's estimate.
pub async fn bear_status(http: &reqwest::Client, wallet: &str) -> Value {
    let wa = [T::Addr(wallet.into())];
    let stats_q = format!("0x{}", selector("getStats()"));
    let (held, staked, pending, price, left, stats) = futures::join!(
        u(http, BEAR, "balanceOf(address)", wa.to_vec()),
        u(http, STAKING, "stakedCountOf(address)", wa.to_vec()),
        u(http, STAKING, "pendingRewardsNet(address)", wa.to_vec()),
        u(http, BEAR, "pricePerNFT()", vec![]),
        u(http, BEAR, "remainingSupply()", vec![]),
        call(http, CHAIN, STAKING, &stats_q),
    );
    let stats = stats.unwrap_or_default();
    let per_nft_year = word(&stats, 4) as f64 / 1e22;
    json!({
        "wallet": wallet, "bearsInWallet": held, "bearsStaked": staked, "claimableBtbb": units(pending, 18),
        "pool": { "totalStaked": word(&stats, 0), "btbbPerBearPerYear": (per_nft_year * 100.0).round() / 100.0, "btbbLast24h": units(word(&stats, 3), 18) },
        "mint": { "priceEth": eth(price), "remaining": left },
        "how": "Every BTBB transfer pays 1%, and all of it goes to staked Bears. Claims pay BTBB less its 1% fee; redeem BTBB 1:1 for BTB.",
    })
}

async fn finish(http: &reqwest::Client, wallet: &str, title: &str, steps: Vec<(String, String, u128, String)>, extra: Value) -> Value {
    // Dry run only the first step when later steps wait on an approval.
    let (to, data, value, _) = &steps[0];
    let sim = simulate(http, CHAIN, wallet, to, data, *value).await;
    let sim = if steps.len() > 1 { json!({ "status": "skipped", "reason": "Runs once the approval in step 1 is confirmed.", "step1": sim["status"] }) } else { json!({ "status": sim["status"], "reason": sim.get("reason") }) };
    let txs: Vec<Value> = steps.iter().enumerate().map(|(i, (to, data, value, label))| { let mut t = tx(CHAIN, wallet, to, data, *value, label); t["step"] = json!(i + 1); t }).collect();
    let mut r = json!({ "chainId": CHAIN, "simulation": sim, "transactions": txs });
    if let (Some(m), Some(e)) = (r.as_object_mut(), extra.as_object()) {
        for (k, v) in e {
            m.insert(k.clone(), v.clone());
        }
    }
    let sims: Vec<Option<Value>> = (0..steps.len()).map(|i| (i + 1 == steps.len()).then(|| r["simulation"].clone())).collect();
    with_sign_link(r, title, wallet, &sims, None)
}

async fn approve_if(http: &reqwest::Client, token: &str, wallet: &str, spender: &str, amount: u128, label: &str) -> Option<(String, String, u128, String)> {
    let have = u(http, token, "allowance(address,address)", vec![T::Addr(wallet.into()), T::Addr(spender.into())]).await;
    (have < amount).then(|| (token.to_string(), q("approve(address,uint256)", &[T::Addr(spender.into()), T::U(amount)]), 0, label.to_string()))
}

pub async fn build(http: &reqwest::Client, wallet: &str, action: &str, count: Option<u64>, amount: Option<String>) -> Result<Value, String> {
    let w = || T::Addr(wallet.into());
    match action {
        "bear_status" => Ok(bear_status(http, wallet).await),
        "bear_mint" => {
            let n = count.unwrap_or(1).clamp(1, MAX_IDS as u64) as u128;
            let price = u(http, BEAR, "getPrice(uint256)", vec![T::U(n)]).await;
            let price = if price == 0 { u(http, BEAR, "pricePerNFT()", vec![]).await * n } else { price };
            let data = q("buyNFT(uint256)", &[T::U(n)]);
            let label = format!("Mint {n} BTB Bear{} for {} ETH", if n > 1 { "s" } else { "" }, eth(price));
            Ok(finish(http, wallet, &label, vec![(BEAR.into(), data, price, label.clone())], json!({ "action": "bear_mint", "bears": n as u64, "costEth": eth(price), "xp": "1,000 XP per Bear on btb.finance", "next": "Stake them with action bear_stake to earn BTBB." })).await)
        }
        "bear_stake" => {
            let held = u(http, BEAR, "balanceOf(address)", vec![w()]).await as usize;
            if held == 0 {
                return Err("This wallet holds no BTB Bears on Ethereum. Mint with action bear_mint.".into());
            }
            let n = count.map(|c| c as usize).unwrap_or(held).min(held).min(MAX_IDS);
            let ids = futures::future::join_all((0..n).map(|i| u(http, BEAR, "tokenOfOwnerByIndex(address,uint256)", vec![w(), T::U(i as u128)]))).await;
            let approved = u(http, BEAR, "isApprovedForAll(address,address)", vec![w(), T::Addr(STAKING.into())]).await == 1;
            let mut steps = Vec::new();
            if !approved {
                steps.push((BEAR.to_string(), q("setApprovalForAll(address,bool)", &[T::Addr(STAKING.into()), T::Bool(true)]), 0, "Let Bear staking hold your Bears (once)".to_string()));
            }
            let label = format!("Stake {n} BTB Bear{}", if n > 1 { "s" } else { "" });
            steps.push((STAKING.into(), q("stake(uint256[])", &[T::Arr(ids.iter().map(|i| T::U(*i)).collect())]), 0, label.clone()));
            Ok(finish(http, wallet, &label, steps, json!({ "action": "bear_stake", "tokenIds": ids.iter().map(|i| i.to_string()).collect::<Vec<_>>() })).await)
        }
        "bear_unstake" => {
            let staked = u(http, STAKING, "stakedCountOf(address)", vec![w()]).await as u64;
            if staked == 0 {
                return Err("This wallet has no Bears staked.".into());
            }
            let n = count.unwrap_or(staked).min(staked);
            let label = format!("Unstake {n} Bear{} and claim rewards", if n > 1 { "s" } else { "" });
            Ok(finish(http, wallet, &label, vec![(STAKING.into(), q("unstake(uint256)", &[T::U(n as u128)]), 0, label.clone())], json!({ "action": "bear_unstake", "note": "You get back that many Bears from the staking pool (not necessarily the same ids), plus your rewards." })).await)
        }
        "bear_claim" => {
            let pending = u(http, STAKING, "pendingRewardsNet(address)", vec![w()]).await;
            if pending == 0 {
                return Err("No Bear rewards to claim right now.".into());
            }
            let label = format!("Claim {} BTBB from Bear staking", units(pending, 18));
            Ok(finish(http, wallet, &label, vec![(STAKING.into(), q("claim()", &[]), 0, label.clone())], json!({ "action": "bear_claim", "claimableBtbb": units(pending, 18), "next": "Redeem BTBB for BTB 1:1 with action btbb_unwrap, or hold it." })).await)
        }
        "btbb_wrap" | "btbb_unwrap" | "wrap" | "unwrap" => {
            let amt = parse(&amount.ok_or("amount is required (whole BTB, e.g. \"100\")")?, 18)?;
            let (token_in, contract, sig, label) = match action {
                "btbb_wrap" => (BTB, BTBB, "mint(uint256)", format!("Turn {} BTB into BTBB", units(amt, 18))),
                "btbb_unwrap" => (BTBB, BTBB, "redeem(uint256)", format!("Redeem {} BTBB for BTB", units(amt, 18))),
                "wrap" => (BTB, WRAPPER, "mint(uint256)", format!("Wrap {} BTB for trading in BTB pools", units(amt, 18))),
                _ => (WRAPPER, WRAPPER, "burn(uint256)", format!("Unwrap {} pool tokens back to BTB", units(amt, 18))),
            };
            let bal = u(http, token_in, "balanceOf(address)", vec![w()]).await;
            if bal < amt {
                return Err(format!("Not enough: the wallet holds {}.", units(bal, 18)));
            }
            let mut steps = Vec::new();
            if token_in != contract {
                if let Some(a) = approve_if(http, token_in, wallet, contract, amt, &format!("Approve exactly {} BTB", units(amt, 18))).await {
                    steps.push(a);
                }
            }
            steps.push((contract.into(), q(sig, &[T::U(amt)]), 0, label.clone()));
            Ok(finish(http, wallet, &label, steps, json!({ "action": action, "amount": units(amt, 18) })).await)
        }
        "flip_up" | "flip_down" => {
            let up = action == "flip_up";
            let amt = parse(&amount.ok_or("amount is required (USDC for flip_up, FLIP for flip_down)")?, if up { 6 } else { 18 })?;
            let label = if up { format!("Flip up: {} USDC into FLIP", units(amt, 6)) } else { format!("Flip down: {} FLIP into USDC", units(amt, 18)) };
            let mut steps = Vec::new();
            if up {
                if let Some(a) = approve_if(http, USDC, wallet, FLIP, amt, &format!("Approve exactly {} USDC", units(amt, 6))).await {
                    steps.push(a);
                }
            }
            steps.push((FLIP.into(), q(if up { "flipUp(uint256)" } else { "flipDown(uint256)" }, &[T::U(amt)]), 0, label.clone()));
            Ok(finish(http, wallet, &label, steps, json!({ "action": action, "note": "FLIP is backed by USDC: flip up when FLIP trades above $1, flip down when below." })).await)
        }
        _ => Err("action must be bear_status, bear_mint, bear_stake, bear_unstake, bear_claim, btbb_wrap, btbb_unwrap, wrap, unwrap, flip_up or flip_down".into()),
    }
}
