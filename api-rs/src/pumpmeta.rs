//! Coin metadata for Pump launches, hosted by BTB: the metadata JSON (name, symbol, description, image, links)
//! and, when the caller sends the picture itself, the image. Kept in Postgres so the links stay valid forever.

use serde_json::{json, Value};
use sha2::{Digest, Sha256};

const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS pump_meta (id text PRIMARY KEY, body jsonb NOT NULL, created bigint NOT NULL);
CREATE TABLE IF NOT EXISTS pump_img (id text PRIMARY KEY, content_type text NOT NULL, bytes bytea NOT NULL, created bigint NOT NULL)";
const MAX_IMAGE: usize = 1_000_000;

fn base() -> String {
    std::env::var("PUBLIC_API_URL").ok().map(|s| s.trim().trim_end_matches('/').to_string()).filter(|s| !s.is_empty()).unwrap_or_else(|| "https://btbmcp.app.runonflux.io".into())
}
fn id_of(bytes: &[u8]) -> String {
    let h: [u8; 32] = Sha256::digest(bytes).into();
    h[..12].iter().map(|b| format!("{b:02x}")).collect()
}
fn now() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}
async fn ready(db: &sqlx::PgPool) {
    static READY: tokio::sync::OnceCell<()> = tokio::sync::OnceCell::const_new();
    READY
        .get_or_init(|| async {
            for stmt in SCHEMA.split(';') {
                let _ = sqlx::query(stmt).execute(db).await;
            }
        })
        .await;
}

/// PNG, JPEG, GIF or WebP, by their first bytes.
fn image_type(b: &[u8]) -> Option<&'static str> {
    if b.starts_with(&[0x89, b'P', b'N', b'G']) {
        Some("image/png")
    } else if b.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if b.starts_with(b"GIF8") {
        Some("image/gif")
    } else if b.len() > 12 && &b[..4] == b"RIFF" && &b[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

pub struct Meta {
    pub name: String,
    pub symbol: String,
    pub description: String,
    pub image_url: Option<String>,
    pub image_base64: Option<String>,
    pub twitter: Option<String>,
    pub telegram: Option<String>,
    pub website: Option<String>,
}

/// Stores the image (if sent as bytes) and the metadata JSON; returns (metadata link, image link).
pub async fn save(db: Option<&sqlx::PgPool>, m: Meta) -> Result<(String, String), String> {
    let db = db.ok_or("BTB cannot host coin metadata right now (no database on this server). Pass metadataUri: a link to your own metadata JSON.")?;
    ready(db).await;
    let image = match (m.image_base64.as_deref().map(str::trim).filter(|s| !s.is_empty()), m.image_url.as_deref().map(str::trim).filter(|s| !s.is_empty())) {
        (Some(b64), _) => {
            let raw = b64.split_once("base64,").map(|(_, r)| r).unwrap_or(b64);
            let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, raw.trim()).map_err(|_| "imageBase64 is not valid base64.".to_string())?;
            if bytes.len() > MAX_IMAGE {
                return Err(format!("The image is {} KB; the limit is 1000 KB.", bytes.len() / 1000));
            }
            let ct = image_type(&bytes).ok_or("The image must be PNG, JPEG, GIF or WebP.")?;
            let id = id_of(&bytes);
            sqlx::query("INSERT INTO pump_img (id, content_type, bytes, created) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING")
                .bind(&id).bind(ct).bind(&bytes).bind(now())
                .execute(db).await.map_err(|e| format!("Could not store the image: {e}"))?;
            format!("{}/api/v1/solana/pump/img/{id}", base())
        }
        (None, Some(url)) if url.starts_with("https://") || url.starts_with("ipfs://") => url.to_string(),
        (None, Some(_)) => return Err("imageUrl must start with https:// or ipfs://.".into()),
        (None, None) => return Err("Send the coin's picture: imageUrl (https) or imageBase64 (PNG, JPEG, GIF or WebP, up to 1000 KB).".into()),
    };
    let mut body = json!({ "name": m.name, "symbol": m.symbol, "description": m.description, "image": image, "showName": true, "createdOn": "https://btb.finance" });
    for (k, v) in [("twitter", &m.twitter), ("telegram", &m.telegram), ("website", &m.website)] {
        if let Some(v) = v.as_deref().map(str::trim).filter(|v| v.starts_with("https://")) {
            body[k] = json!(v);
        }
    }
    let text = serde_json::to_vec(&body).unwrap_or_default();
    let id = id_of(&text);
    sqlx::query("INSERT INTO pump_meta (id, body, created) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING")
        .bind(&id).bind(&body).bind(now())
        .execute(db).await.map_err(|e| format!("Could not store the metadata: {e}"))?;
    Ok((format!("{}/api/v1/solana/pump/meta/{id}", base()), image))
}

pub async fn meta(db: Option<&sqlx::PgPool>, id: &str) -> Option<Value> {
    let db = db?;
    ready(db).await;
    sqlx::query_scalar::<_, Value>("SELECT body FROM pump_meta WHERE id = $1").bind(id).fetch_optional(db).await.ok().flatten()
}
pub async fn image(db: Option<&sqlx::PgPool>, id: &str) -> Option<(String, Vec<u8>)> {
    let db = db?;
    ready(db).await;
    sqlx::query_as::<_, (String, Vec<u8>)>("SELECT content_type, bytes FROM pump_img WHERE id = $1").bind(id).fetch_optional(db).await.ok().flatten()
}
