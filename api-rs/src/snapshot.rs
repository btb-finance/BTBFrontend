//! The Discover pool snapshot, read the way btb.finance reads it (Convex `discover:index` plus one gzip JSON file
//! per chain) and kept in memory. A background task refreshes it every few minutes, so requests never wait on it.

use crate::pools::{pool_key, Pool};
use base64::Engine;
use flate2::read::GzDecoder;
use indexmap::IndexMap;
use serde::Deserialize;
use std::io::Read;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

pub struct Snapshot {
    pub pools: Vec<Pool>,
    /// Unix milliseconds of the snapshot's last refresh.
    pub updated_at: Option<f64>,
    pub chains: Vec<String>,
}

pub type Shared = Arc<RwLock<Option<Arc<Snapshot>>>>;

#[derive(Deserialize)]
struct IndexChain {
    url: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Index {
    top: String,
    updated_at: Option<f64>,
    chains: Vec<IndexChain>,
}
#[derive(Deserialize)]
struct PoolList {
    pools: Vec<Pool>,
}

fn gunzip(bytes: &[u8]) -> anyhow::Result<String> {
    let mut s = String::new();
    GzDecoder::new(bytes).read_to_string(&mut s)?;
    Ok(s)
}

/// "gz:" + base64(gzip(json)), or plain JSON for older rows (src/lib/snapshotCodec.ts).
fn unpack(s: &str) -> anyhow::Result<PoolList> {
    match s.strip_prefix("gz:") {
        Some(b64) => {
            let bytes = base64::engine::general_purpose::STANDARD.decode(b64)?;
            Ok(serde_json::from_str(&gunzip(&bytes)?)?)
        }
        None => Ok(serde_json::from_str(s)?),
    }
}

async fn chain_file(http: &reqwest::Client, url: &str) -> anyhow::Result<Vec<Pool>> {
    let bytes = http.get(url).timeout(Duration::from_secs(15)).send().await?.error_for_status()?.bytes().await?;
    // Convex storage serves the file as stored (gzip); a proxy may already have decoded it.
    let text = if bytes.starts_with(&[0x1f, 0x8b]) { gunzip(&bytes)? } else { String::from_utf8(bytes.to_vec())? };
    Ok(serde_json::from_str::<PoolList>(&text)?.pools)
}

pub async fn load(http: &reqwest::Client, convex_url: &str) -> anyhow::Result<Snapshot> {
    #[derive(Deserialize)]
    struct Reply {
        status: String,
        value: Option<Index>,
        #[serde(rename = "errorMessage")]
        error_message: Option<String>,
    }
    let reply: Reply = http
        .post(format!("{convex_url}/api/query"))
        .json(&serde_json::json!({ "path": "discover:index", "args": {}, "format": "json" }))
        .timeout(Duration::from_secs(15))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    if reply.status != "success" {
        return Err(anyhow::anyhow!(reply.error_message.unwrap_or_else(|| "query failed".into())));
    }
    let index = reply.value.ok_or_else(|| anyhow::anyhow!("The pool snapshot is not available yet."))?;
    let top = unpack(&index.top)?;
    let files = futures::future::join_all(index.chains.iter().map(|c| chain_file(http, &c.url))).await;
    // Chain files are the full lists; the top list fills in for a chain whose file could not be read.
    let mut by_key: IndexMap<String, Pool> = IndexMap::new();
    for p in files.into_iter().flat_map(|f| f.unwrap_or_default()).chain(top.pools) {
        let k = pool_key(&p);
        // A few pools are listed twice under two DEX labels: keep the row with more TVL.
        match by_key.get(&k) {
            Some(had) if had.tvl() >= p.tvl() => {}
            _ => {
                by_key.insert(k, p);
            }
        }
    }
    let pools: Vec<Pool> = by_key.into_values().filter(|p| p.tvl_usd.is_some_and(f64::is_finite)).collect();
    let mut chains: Vec<String> = pools.iter().map(|p| p.chain.clone()).collect();
    chains.sort();
    chains.dedup();
    Ok(Snapshot { pools, updated_at: index.updated_at, chains })
}

/// Loads now, then every `every`; a failed refresh keeps the last good snapshot.
pub fn keep_fresh(state: Shared, http: reqwest::Client, convex_url: String, every: Duration) {
    tokio::spawn(async move {
        loop {
            let started = std::time::Instant::now();
            match load(&http, &convex_url).await {
                Ok(s) => {
                    tracing::info!(pools = s.pools.len(), ms = started.elapsed().as_millis() as u64, "snapshot loaded");
                    *state.write().await = Some(Arc::new(s));
                }
                Err(e) => tracing::warn!(error = %e, "snapshot refresh failed; keeping the last one"),
            }
            tokio::time::sleep(every).await;
        }
    });
}
