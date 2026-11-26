//! BTB's own DeFi index: every yield market (lending, vaults, staking) in one shape, kept in memory for answers and
//! in Postgres for history and a warm start. Postgres is optional: without DATABASE_URL the index runs from memory.

use serde::Serialize;
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// One place to earn on a token: an Aave reserve, a Morpho vault, a Fluid market, a staking token...
#[derive(Clone, Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Market {
    /// "{kind}:{chainId}:{address or source id}", stable across refreshes.
    pub id: String,
    /// "lend" | "vault" | "stake" | "savings"
    pub kind: String,
    pub chain_id: i64,
    pub chain: String,
    pub protocol: String,
    pub name: String,
    /// The contract to deposit into (Aave Pool, vault...), when known.
    pub address: Option<String>,
    pub asset_symbol: String,
    pub asset_address: Option<String>,
    pub curator: Option<String>,
    pub tvl_usd: f64,
    /// Yearly yield in %, paid in the asset itself.
    pub apy_base: f64,
    /// Extra yearly % paid in other tokens, which can stop.
    pub apy_reward: f64,
    pub apy_1d: Option<f64>,
    pub apy_7d: Option<f64>,
    pub apy_30d: Option<f64>,
    /// Listed or verified by the protocol (Morpho's listing, Aave's own reserves).
    pub listed: bool,
    pub source: String,
    pub updated_at: i64,
}

#[derive(Clone, Default)]
pub struct Index {
    pub markets: Arc<RwLock<HashMap<String, Market>>>,
    pub db: Option<PgPool>,
}

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS markets (
  id text PRIMARY KEY, kind text NOT NULL, chain_id bigint NOT NULL, chain text NOT NULL, protocol text NOT NULL,
  name text NOT NULL, address text, asset_symbol text NOT NULL, asset_address text, curator text,
  tvl_usd double precision NOT NULL, apy_base double precision NOT NULL, apy_reward double precision NOT NULL,
  apy_1d double precision, apy_7d double precision, apy_30d double precision, listed boolean NOT NULL,
  source text NOT NULL, updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS markets_asset ON markets (lower(asset_symbol));
CREATE TABLE IF NOT EXISTS market_history (
  market_id text NOT NULL, hour bigint NOT NULL, apy_base double precision NOT NULL, apy_reward double precision NOT NULL,
  tvl_usd double precision NOT NULL, PRIMARY KEY (market_id, hour)
);
"#;

impl Index {
    /// Connects when DATABASE_URL is set, creates the tables, and loads the last saved markets for a warm start.
    pub async fn open() -> Index {
        let Ok(url) = std::env::var("DATABASE_URL") else {
            tracing::info!("no DATABASE_URL: yield index runs from memory only");
            return Index::default();
        };
        let db = match PgPoolOptions::new().max_connections(5).acquire_timeout(std::time::Duration::from_secs(10)).connect(&url).await {
            Ok(db) => db,
            Err(e) => {
                tracing::warn!(error = %e, "database unavailable: yield index runs from memory only");
                return Index::default();
            }
        };
        for stmt in SCHEMA.split(';').map(str::trim).filter(|s| !s.is_empty()) {
            if let Err(e) = sqlx::query(stmt).execute(&db).await {
                tracing::warn!(error = %e, "schema");
            }
        }
        let index = Index { markets: Arc::new(RwLock::new(HashMap::new())), db: Some(db) };
        index.load().await;
        index
    }

    async fn load(&self) {
        let Some(db) = &self.db else { return };
        let rows = sqlx::query_as::<_, Market>(
            "SELECT id, kind, chain_id, chain, protocol, name, address, asset_symbol, asset_address, curator, tvl_usd, apy_base, apy_reward, apy_1d, apy_7d, apy_30d, listed, source, updated_at FROM markets",
        )
        .fetch_all(db)
        .await
        .unwrap_or_default();
        let mut m = self.markets.write().await;
        for r in rows {
            m.insert(r.id.clone(), r);
        }
        tracing::info!(markets = m.len(), "yield index loaded from the database");
    }

    /// Replaces every market from one source with a fresh set, and records this hour's rates.
    pub async fn replace_source(&self, source: &str, fresh: Vec<Market>) {
        {
            let mut m = self.markets.write().await;
            m.retain(|_, x| x.source != source);
            for x in &fresh {
                m.insert(x.id.clone(), x.clone());
            }
        }
        let Some(db) = &self.db else { return };
        let hour = chrono::Utc::now().timestamp() / 3600;
        let mut tx = match db.begin().await {
            Ok(t) => t,
            Err(e) => return tracing::warn!(error = %e, "db begin"),
        };
        let _ = sqlx::query("DELETE FROM markets WHERE source = $1").bind(source).execute(&mut *tx).await;
        for x in &fresh {
            let _ = sqlx::query(
                "INSERT INTO markets (id, kind, chain_id, chain, protocol, name, address, asset_symbol, asset_address, curator, tvl_usd, apy_base, apy_reward, apy_1d, apy_7d, apy_30d, listed, source, updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
                 ON CONFLICT (id) DO UPDATE SET kind=EXCLUDED.kind, chain_id=EXCLUDED.chain_id, chain=EXCLUDED.chain, protocol=EXCLUDED.protocol, name=EXCLUDED.name,
                 address=EXCLUDED.address, asset_symbol=EXCLUDED.asset_symbol, asset_address=EXCLUDED.asset_address, curator=EXCLUDED.curator, tvl_usd=EXCLUDED.tvl_usd,
                 apy_base=EXCLUDED.apy_base, apy_reward=EXCLUDED.apy_reward, apy_1d=EXCLUDED.apy_1d, apy_7d=EXCLUDED.apy_7d, apy_30d=EXCLUDED.apy_30d,
                 listed=EXCLUDED.listed, source=EXCLUDED.source, updated_at=EXCLUDED.updated_at",
            )
            .bind(&x.id).bind(&x.kind).bind(x.chain_id).bind(&x.chain).bind(&x.protocol).bind(&x.name).bind(&x.address).bind(&x.asset_symbol)
            .bind(&x.asset_address).bind(&x.curator).bind(x.tvl_usd).bind(x.apy_base).bind(x.apy_reward).bind(x.apy_1d).bind(x.apy_7d).bind(x.apy_30d)
            .bind(x.listed).bind(&x.source).bind(x.updated_at)
            .execute(&mut *tx)
            .await;
            let _ = sqlx::query("INSERT INTO market_history (market_id, hour, apy_base, apy_reward, tvl_usd) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING")
                .bind(&x.id).bind(hour).bind(x.apy_base).bind(x.apy_reward).bind(x.tvl_usd)
                .execute(&mut *tx)
                .await;
        }
        if let Err(e) = tx.commit().await {
            tracing::warn!(error = %e, "db commit");
        }
    }

    /// Average base APY over the last `hours` from our own history, when we have it.
    pub async fn history_avg(&self, ids: &[String], hours: i64) -> HashMap<String, f64> {
        let Some(db) = &self.db else { return HashMap::new() };
        let since = chrono::Utc::now().timestamp() / 3600 - hours;
        sqlx::query_as::<_, (String, f64)>("SELECT market_id, avg(apy_base) FROM market_history WHERE market_id = ANY($1) AND hour >= $2 GROUP BY market_id")
            .bind(ids)
            .bind(since)
            .fetch_all(db)
            .await
            .unwrap_or_default()
            .into_iter()
            .collect()
    }
}
