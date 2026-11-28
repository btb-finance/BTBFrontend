//! BTB Finance API for agents, in Rust, built to run long-lived on Flux with its data warm in memory.
//!
//! Moved here so far (src/tools.rs): the pool tools (top_pools, search_pools, chain_summary, pool_details, compare_pools,
//! best_pools_for, estimate_lp_earnings, lp_plan, add_liquidity_link) and token_safety. Every other tool and REST path is
//! forwarded to the TypeScript connector (UPSTREAM_URL, default https://btb.finance), so this server always offers
//! the whole API while parts move over one at a time. It holds no secrets.
//!
//!   POST /api/mcp (or /mcp)  MCP (Streamable HTTP, JSON responses)
//!   GET  /api/v1/...         REST, same paths and answers as https://btb.finance/api/v1
//!   GET  /health

mod builders;
mod indexers;
mod overview;
mod solana;
mod portfolio;
mod pumpmeta;
mod lite;
mod pools;
mod rates;
mod registry;
mod snapshot;
mod store;
mod signlink;
mod swap;
mod tools;
mod txstatus;
mod yields;

use axum::{
    body::Bytes,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use serde_json::{json, Map, Value};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::sync::RwLock;

const INSTRUCTIONS: &str = "BTB Finance: live liquidity pools across Base, Ethereum, BNB Chain, Robinhood Chain and more, with a risk grade (A best .. E worst) per pool, token tools, wallet reads, a registry of DeFi protocols and unsigned transaction builders. This server never signs. Not financial advice.";

#[derive(Clone)]
struct App {
    snap: snapshot::Shared,
    http: reqwest::Client,
    upstream: String,
    convex: String,
    index: store::Index,
    rates: rates::Feed,
    catalog: txstatus::Catalog,
    /// Steps people signed from btb.finance/sign links: link id → (step, hash, unix time). Kept one day.
    signed: Arc<signlink::Signed>,
    tokens: swap::Catalog,
    /// Anonymous REST calls per IP per minute, counted here instead of in Convex.
    limits: Arc<std::sync::Mutex<HashMap<String, (u64, u32)>>>,
    /// The upstream connector's tools/list, kept for 10 minutes.
    upstream_tools: Arc<RwLock<Option<(std::time::Instant, Vec<Value>)>>>,
}

/// Flux allows 20 environment variables per app and 400 characters per value, so the rest arrive bundled: BTB_ENV_1,
/// BTB_ENV_2, ... joined in order are base64 of gzip-compressed JSON (name → value). Each entry is set unless that
/// name is already set on its own (a direct variable wins).
fn unpack_env_bundle() {
    use base64::Engine;
    use std::io::Read;
    let mut joined = String::new();
    for i in 1..=19 {
        match std::env::var(format!("BTB_ENV_{i}")) {
            Ok(part) => joined.push_str(part.trim()),
            Err(_) => break,
        }
    }
    if joined.is_empty() {
        return;
    }
    let vars = base64::engine::general_purpose::STANDARD.decode(&joined).ok().and_then(|bytes| {
        let mut text = String::new();
        flate2::read::GzDecoder::new(&bytes[..]).read_to_string(&mut text).ok()?;
        serde_json::from_str::<Map<String, Value>>(&text).ok()
    });
    let Some(vars) = vars else {
        eprintln!("BTB_ENV_1..n are set but do not decode (base64 of gzip JSON); ignored");
        return;
    };
    let mut n = 0;
    for (k, v) in vars {
        if std::env::var_os(&k).is_none() {
            if let Some(s) = v.as_str() {
                std::env::set_var(&k, s);
                n += 1;
            }
        }
    }
    eprintln!("BTB_ENV bundle: {n} variables loaded");
}

fn main() {
    // Before the async runtime starts any threads, so setting variables is safe.
    unpack_env_bundle();
    tokio::runtime::Builder::new_multi_thread().enable_all().build().expect("runtime").block_on(run());
}

async fn run() {
    tracing_subscriber::fmt().with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into())).init();
    let convex = std::env::var("CONVEX_URL").unwrap_or_else(|_| "https://grateful-oyster-780.convex.cloud".into());
    let upstream = std::env::var("UPSTREAM_URL").unwrap_or_else(|_| "https://btb.finance".into());
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);
    let http = reqwest::Client::builder().user_agent("btb-api/0.1").build().expect("http client");
    let app = App { snap: Arc::new(RwLock::new(None)), http: http.clone(), upstream, convex: convex.clone(), index: store::Index::open().await, rates: rates::Feed::default(), catalog: txstatus::Catalog::default(), tokens: swap::Catalog::default(), signed: Arc::new(std::sync::Mutex::new(HashMap::new())), limits: Arc::new(std::sync::Mutex::new(HashMap::new())), upstream_tools: Arc::new(RwLock::new(None)) };
    // Old minute windows are dropped every few minutes so the table stays small.
    {
        let limits = app.limits.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(300)).await;
                let now = minute_now();
                limits.lock().map(|mut m| m.retain(|_, (w, _)| *w + 1 >= now)).ok();
            }
        });
    }
    snapshot::keep_fresh(app.snap.clone(), http.clone(), convex, Duration::from_secs(300));
    // BTB's own yield index: every lending market, vault and staking token, refreshed in the background.
    {
        let (i, h) = (app.index.clone(), http.clone());
        indexers::every("aave", Duration::from_secs(1800), move || { let (i, h) = (i.clone(), h.clone()); async move { indexers::aave(&i, &h).await } });
        let (i, h) = (app.index.clone(), http.clone());
        indexers::every("morpho", Duration::from_secs(1800), move || { let (i, h) = (i.clone(), h.clone()); async move { indexers::morpho(&i, &h).await } });
        let (i, h) = (app.index.clone(), http);
        indexers::every("llama", Duration::from_secs(3600), move || { let (i, h) = (i.clone(), h.clone()); async move { indexers::llama(&i, &h).await } });
    }

    let router = rest_routes(Router::new())
        .route("/health", get(health))
        .route("/api/mcp", post(mcp).get(mcp_get))
        // The old btb-mcp image answered at /mcp too; existing client URLs keep working.
        .route("/mcp", post(mcp).get(mcp_get))
        .route("/api/v1/sign-status", post(sign_report))
        .route("/api/v1/sign-status/:id", get(sign_read))
        .route("/api/v1/solana/pump/meta/:id", get(pump_meta))
        .route("/api/v1/solana/pump/img/:id", get(pump_img))
        .fallback(forward_rest)
        .layer(tower_http::cors::CorsLayer::permissive())
        .with_state(app);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await.expect("bind");
    tracing::info!(port, "btb-api listening");
    axum::serve(listener, router).await.expect("serve");
}

// ---- JSON as the TypeScript server writes it (JSON.stringify(value, null, 1)) ----

fn pretty(v: &Value) -> String {
    let mut out = Vec::new();
    let fmt = serde_json::ser::PrettyFormatter::with_indent(b" ");
    let mut ser = serde_json::Serializer::with_formatter(&mut out, fmt);
    serde::Serialize::serialize(v, &mut ser).expect("json");
    String::from_utf8(out).expect("utf8")
}

fn json_response(status: StatusCode, v: &Value) -> Response {
    (status, [("content-type", "application/json; charset=utf-8"), ("cache-control", "no-store")], pretty(v)).into_response()
}

fn rest_error(status: StatusCode, code: &str, message: &str) -> Response {
    json_response(status, &json!({ "error": { "code": code, "message": message } }))
}

async fn snapshot_now(app: &App) -> Option<Arc<snapshot::Snapshot>> {
    app.snap.read().await.clone()
}

async fn health(State(app): State<App>) -> Response {
    match snapshot_now(&app).await {
        Some(s) => json_response(StatusCode::OK, &json!({ "ok": true, "pools": s.pools.len(), "updatedAt": s.updated_at, "database": app.index.db.is_some() })),
        None => json_response(StatusCode::SERVICE_UNAVAILABLE, &json!({ "ok": false, "note": "pool snapshot still loading" })),
    }
}

/// Hosted coin metadata and images for Pump launches (pumpmeta.rs). Content-addressed, so cached for good.
async fn pump_meta(State(app): State<App>, Path(id): Path<String>) -> Response {
    match pumpmeta::meta(app.index.db.as_ref(), id.trim_end_matches(".json")).await {
        Some(v) => {
            let mut r = json_response(StatusCode::OK, &v);
            r.headers_mut().insert(axum::http::header::CACHE_CONTROL, axum::http::HeaderValue::from_static("public, max-age=31536000, immutable"));
            r
        }
        None => rest_error(StatusCode::NOT_FOUND, "not_found", "No coin metadata with that id."),
    }
}
async fn pump_img(State(app): State<App>, Path(id): Path<String>) -> Response {
    match pumpmeta::image(app.index.db.as_ref(), &id).await {
        Some((ct, bytes)) => Response::builder()
            .header(axum::http::header::CONTENT_TYPE, ct)
            .header(axum::http::header::CACHE_CONTROL, "public, max-age=31536000, immutable")
            .body(axum::body::Body::from(bytes))
            .unwrap(),
        None => rest_error(StatusCode::NOT_FOUND, "not_found", "No coin image with that id."),
    }
}

// ---- REST ----

/// Query strings → typed arguments, as src/lib/api/v1.ts coerces them from each tool's schema.
fn rest_args(tool: &str, q: &HashMap<String, String>, rename: &[(&str, &str)]) -> Map<String, Value> {
    let mut m = Map::new();
    for (k, v) in q {
        if k == "api_key" {
            continue;
        }
        let name = rename.iter().find(|(from, _)| from == k).map(|(_, to)| *to).unwrap_or(k.as_str());
        let number = |v: &str| v.parse::<f64>().ok().filter(|n| n.is_finite()).map(pools::num).unwrap_or_else(|| json!(v));
        let val = match (tool, name) {
            ("compare_pools", "pools") => {
                if v.trim_start().starts_with('[') {
                    serde_json::from_str(v).unwrap_or_else(|_| json!(v))
                } else {
                    json!(v.split(',').map(str::trim).filter(|x| !x.is_empty()).collect::<Vec<_>>())
                }
            }
            ("compare_yield", "kinds") => json!(v.split(',').map(str::trim).filter(|x| !x.is_empty()).collect::<Vec<_>>()),
            (_, "limit" | "minTvlUsd" | "amountUsd" | "days" | "pools") => number(v),
            (_, "stableOnly") => json!(v == "true" || v == "1"),
            _ => json!(v),
        };
        m.insert(name.to_string(), val);
    }
    m
}

async fn run_rest(app: &App, tool: &str, args: Map<String, Value>) -> Response {
    let Some(snap) = snapshot_now(app).await else {
        return rest_error(StatusCode::SERVICE_UNAVAILABLE, "warming_up", "The pool snapshot is still loading. Retry in a few seconds.");
    };
    let ctx = tools::Ctx { snap: &snap, http: &app.http, convex: &app.convex, index: &app.index, rates: &app.rates, catalog: &app.catalog, tokens: &app.tokens, signed: &app.signed };
    match tools::call(tool, &args, &ctx).await {
        Ok(v) => json_response(StatusCode::OK, &v),
        Err(tools::ToolError(msg)) => {
            // The same codes the TypeScript API gives (src/lib/api/v1.ts callTool).
            // src/lib/api/v1.ts callTool: /not found|not in the BTB registry|No function/i is a 404.
            let lower = msg.to_lowercase();
            let not_found = lower.contains("not found") || lower.contains("not in the btb registry") || lower.contains("no function");
            let code = if not_found { "not_found" } else if msg.starts_with("Input validation error") { "invalid_arguments" } else { "tool_error" };
            rest_error(if not_found { StatusCode::NOT_FOUND } else { StatusCode::BAD_REQUEST }, code, &msg)
        }
    }
}

fn body_args(body: &Bytes) -> Map<String, Value> {
    serde_json::from_slice::<Value>(body).ok().and_then(|v| v.as_object().cloned()).unwrap_or_default()
}

/// Calls a minute per IP without an API key, the same as btb.finance/api/v1.
const ANON_PER_MINUTE: u32 = 20;

fn minute_now() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() / 60).unwrap_or(0)
}

fn client_ip(h: &HeaderMap) -> String {
    let get = |k: &str| h.get(k).and_then(|v| v.to_str().ok()).map(|s| s.split(',').next().unwrap_or("").trim().to_string());
    get("cf-connecting-ip").or_else(|| get("x-forwarded-for")).or_else(|| get("x-real-ip")).filter(|s| !s.is_empty()).unwrap_or_else(|| "unknown".into())
}

fn has_api_key(h: &HeaderMap, q: &HashMap<String, String>) -> bool {
    h.contains_key("authorization") || h.contains_key("x-api-key") || q.contains_key("api_key")
}

/// Counts one anonymous call; Err(seconds to wait) once the IP is over its minute's limit.
fn take_anon(app: &App, ip: &str) -> Result<(u32, u64), u64> {
    let now = minute_now();
    let mut m = app.limits.lock().map_err(|_| 1u64)?;
    let e = m.entry(ip.to_string()).or_insert((now, 0));
    if e.0 != now {
        *e = (now, 0);
    }
    if e.1 >= ANON_PER_MINUTE {
        let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        return Err(60 - secs % 60);
    }
    e.1 += 1;
    Ok((ANON_PER_MINUTE - e.1, (now + 1) * 60))
}

/// One REST route: path parameters, then the query string, then (POST) the JSON body, as the TypeScript API merges them.
/// Calls with an API key go to btb.finance, where keys live (Convex), so this server holds no secrets.
async fn rest(app: App, tool: &'static str, rename: &'static [(&'static str, &'static str)], path: HashMap<String, String>, q: HashMap<String, String>, body: Option<Bytes>, headers: HeaderMap, method: axum::http::Method, uri: axum::http::Uri) -> Response {
    if has_api_key(&headers, &q) {
        return forward_rest(State(app), method, uri, headers, body.unwrap_or_default()).await;
    }
    let (remaining, reset) = match take_anon(&app, &client_ip(&headers)) {
        Ok(x) => x,
        Err(wait) => {
            let mut r = rest_error(StatusCode::TOO_MANY_REQUESTS, "rate_limited", &format!("Limit of {ANON_PER_MINUTE} calls a minute reached. Retry in {wait}s, or get a free key (POST /api/v1/keys) for 120 a minute."));
            r.headers_mut().insert("retry-after", wait.into());
            r.headers_mut().insert("x-ratelimit-limit", ANON_PER_MINUTE.into());
            r.headers_mut().insert("x-ratelimit-remaining", 0u32.into());
            return r;
        }
    };
    let mut r = rest_inner(app, tool, rename, path, q, body).await;
    r.headers_mut().insert("x-ratelimit-limit", ANON_PER_MINUTE.into());
    r.headers_mut().insert("x-ratelimit-remaining", remaining.into());
    r.headers_mut().insert("x-ratelimit-reset", reset.into());
    r
}

async fn rest_inner(app: App, tool: &'static str, rename: &'static [(&'static str, &'static str)], path: HashMap<String, String>, q: HashMap<String, String>, body: Option<Bytes>) -> Response {
    let mut a = rest_args(tool, &q, rename);
    for (k, v) in path {
        let name = rename.iter().find(|(from, _)| *from == k).map(|(_, to)| to.to_string()).unwrap_or(k);
        a.insert(name, json!(v));
    }
    if let Some(b) = body {
        for (k, v) in body_args(&b) {
            let name = rename.iter().find(|(from, _)| *from == k).map(|(_, to)| to.to_string()).unwrap_or(k);
            a.insert(name, v);
        }
    }
    run_rest(&app, tool, a).await
}

macro_rules! route_tool {
    ($router:expr, $path:literal, $tool:literal, $rename:expr) => {
        $router.route(
            $path,
            get(|State(app): State<App>, Path(p): Path<HashMap<String, String>>, Query(q): Query<HashMap<String, String>>, h: HeaderMap, m: axum::http::Method, u: axum::http::Uri| async move {
                rest(app, $tool, $rename, p, q, None, h, m, u).await
            })
            .post(|State(app): State<App>, Path(p): Path<HashMap<String, String>>, Query(q): Query<HashMap<String, String>>, h: HeaderMap, m: axum::http::Method, u: axum::http::Uri, body: Bytes| async move {
                rest(app, $tool, $rename, p, q, Some(body), h, m, u).await
            }),
        )
    };
}

fn rest_routes(r: Router<App>) -> Router<App> {
    let r = route_tool!(r, "/api/v1/pools", "top_pools", &[]);
    let r = route_tool!(r, "/api/v1/pools/search", "search_pools", &[("q", "query")]);
    let r = route_tool!(r, "/api/v1/pools/best", "best_pools_for", &[]);
    let r = route_tool!(r, "/api/v1/pools/compare", "compare_pools", &[]);
    let r = route_tool!(r, "/api/v1/pools/:chain/:pool", "pool_details", &[]);
    let r = route_tool!(r, "/api/v1/pools/:chain/:pool/earnings", "estimate_lp_earnings", &[]);
    let r = route_tool!(r, "/api/v1/pools/:chain/:pool/link", "add_liquidity_link", &[]);
    let r = route_tool!(r, "/api/v1/plan", "lp_plan", &[]);
    let r = route_tool!(r, "/api/v1/chains", "chain_summary", &[]);
    let r = route_tool!(r, "/api/v1/chains/:chain", "chain_summary", &[]);
    let r = route_tool!(r, "/api/v1/yield", "compare_yield", &[]);
    let r = route_tool!(r, "/api/v1/protocols", "list_protocols", &[]);
    let r = route_tool!(r, "/api/v1/protocols/:protocol", "get_protocol", &[]);
    let r = route_tool!(r, "/api/v1/tokens/:chain/:token/quick-check", "quick_token_check", &[]);
    let r = route_tool!(r, "/api/v1/bridge/status/:hash", "bridge_status", &[]);
    let r = route_tool!(r, "/api/v1/lending", "lending_rates", &[]);
    let r = route_tool!(r, "/api/v1/staking", "staking_rates", &[]);
    let r = route_tool!(r, "/api/v1/tx/:chain/:hash", "tx_status", &[]);
    let r = route_tool!(r, "/api/v1/tokens/find", "find_token", &[("q", "query")]);
    let r = route_tool!(r, "/api/v1/quote", "quote_swap", &[]);
    let r = route_tool!(r, "/api/v1/sign/status", "sign_status", &[]);
    let r = route_tool!(r, "/api/v1/wallets/:address/portfolio", "wallet_portfolio", &[("address", "wallet")]);
    let r = route_tool!(r, "/api/v1/wallets/:address/overview", "wallet_overview", &[("address", "wallet")]);
    let r = route_tool!(r, "/api/v1/solana/pump/claim", "build_pump_claim", &[]);
    let r = route_tool!(r, "/api/v1/solana/pump/launch", "build_pump_launch", &[]);
    let r = route_tool!(r, "/api/v1/build/swap", "build_swap", &[]);
    let r = route_tool!(r, "/api/v1/build/lend", "build_lend", &[]);
    let r = route_tool!(r, "/api/v1/build/withdraw", "build_withdraw", &[]);
    let r = route_tool!(r, "/api/v1/build/vault-deposit", "build_vault_deposit", &[]);
    let r = route_tool!(r, "/api/v1/build/vault-withdraw", "build_vault_withdraw", &[]);
    let r = route_tool!(r, "/api/v1/build/bridge", "build_bridge", &[]);
    route_tool!(r, "/api/v1/tokens/:chain/:token/safety", "token_safety", &[])
}

/// Anything not moved yet: the same request to the TypeScript server, answer passed through.
async fn forward_rest(State(app): State<App>, method: axum::http::Method, uri: axum::http::Uri, headers: HeaderMap, body: Bytes) -> Response {
    let path = uri.path_and_query().map(|p| p.as_str()).unwrap_or("/");
    if !path.starts_with("/api/") && !path.starts_with("/llms.txt") {
        return rest_error(StatusCode::NOT_FOUND, "not_found", "This server answers /api/mcp, /api/v1 and /health.");
    }
    let mut req = app.http.request(method, format!("{}{}", app.upstream, path)).timeout(Duration::from_secs(30)).body(body);
    for h in ["content-type", "accept", "authorization", "x-api-key", "cf-connecting-ip", "x-forwarded-for"] {
        if let Some(v) = headers.get(h) {
            req = req.header(h, v);
        }
    }
    match req.send().await {
        Ok(r) => {
            let status = StatusCode::from_u16(r.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
            let ct = r.headers().get("content-type").and_then(|v| v.to_str().ok()).unwrap_or("application/json").to_string();
            let bytes = r.bytes().await.unwrap_or_default();
            (status, [("content-type", ct)], bytes).into_response()
        }
        Err(e) => rest_error(StatusCode::BAD_GATEWAY, "upstream_unavailable", &format!("Could not reach the BTB connector: {e}")),
    }
}

// ---- MCP (JSON-RPC over POST, JSON responses) ----

async fn mcp_get() -> Response {
    // No server-initiated stream: every answer comes back on the POST.
    (StatusCode::METHOD_NOT_ALLOWED, [("allow", "POST")], "").into_response()
}

fn rpc_result(id: &Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}
fn rpc_error(id: &Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}
fn text_content(v: &Value, is_error: bool) -> Value {
    let text = match v {
        Value::String(s) => s.clone(),
        other => pretty(other),
    };
    let mut r = json!({ "content": [{ "type": "text", "text": text }] });
    if is_error {
        r["isError"] = json!(true);
    }
    r
}

/// One JSON-RPC message from the upstream connector (it may answer as JSON or as one Server-Sent Event).
async fn upstream_rpc(app: &App, msg: &Value) -> Result<Value, String> {
    let r = app
        .http
        .post(format!("{}/api/mcp", app.upstream))
        .header("content-type", "application/json")
        .header("accept", "application/json, text/event-stream")
        .json(msg)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let text = r.text().await.map_err(|e| e.to_string())?;
    let body = if text.trim_start().starts_with('{') {
        text
    } else {
        text.lines().filter_map(|l| l.strip_prefix("data:")).map(str::trim).filter(|l| !l.is_empty()).last().unwrap_or("").to_string()
    };
    serde_json::from_str(&body).map_err(|e| format!("bad upstream answer: {e}"))
}

async fn upstream_tools(app: &App) -> Vec<Value> {
    if let Some((at, tools)) = app.upstream_tools.read().await.as_ref() {
        if at.elapsed() < Duration::from_secs(600) {
            return tools.clone();
        }
    }
    let msg = json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {} });
    match upstream_rpc(app, &msg).await {
        Ok(v) => {
            let tools = v["result"]["tools"].as_array().cloned().unwrap_or_default();
            *app.upstream_tools.write().await = Some((std::time::Instant::now(), tools.clone()));
            tools
        }
        Err(e) => {
            tracing::warn!(error = %e, "upstream tools/list failed");
            app.upstream_tools.read().await.as_ref().map(|(_, t)| t.clone()).unwrap_or_default()
        }
    }
}

async fn handle_rpc(app: &App, msg: Value) -> Option<Value> {
    let id = msg.get("id").cloned();
    let method = msg.get("method").and_then(Value::as_str).unwrap_or("");
    // Notifications (no id) get no answer.
    let id = id?;
    Some(match method {
        "initialize" => rpc_result(&id, json!({
            "protocolVersion": msg["params"]["protocolVersion"].as_str().unwrap_or("2025-06-18"),
            "capabilities": { "tools": { "listChanged": false } },
            "serverInfo": { "name": "btb-finance", "title": "BTB Finance", "version": "1.0.0", "websiteUrl": pools::SITE },
            "instructions": INSTRUCTIONS,
        })),
        "ping" => rpc_result(&id, json!({})),
        "tools/list" => {
            let mut list = tools::definitions();
            list.extend(upstream_tools(app).await.into_iter().filter(|t| !tools::has(t["name"].as_str().unwrap_or(""))));
            rpc_result(&id, json!({ "tools": list }))
        }
        "tools/call" => {
            let name = msg["params"]["name"].as_str().unwrap_or("").to_string();
            if tools::has(&name) {
                let args = msg["params"]["arguments"].as_object().cloned().unwrap_or_default();
                match snapshot_now(app).await {
                    None => rpc_result(&id, text_content(&json!("The pool snapshot is still loading. Retry in a few seconds."), true)),
                    Some(snap) => match tools::call(&name, &args, &tools::Ctx { snap: &snap, http: &app.http, convex: &app.convex, index: &app.index, rates: &app.rates, catalog: &app.catalog, tokens: &app.tokens, signed: &app.signed }).await {
                        Ok(v) => rpc_result(&id, text_content(&v, false)),
                        Err(tools::ToolError(m)) => rpc_result(&id, text_content(&json!(m), true)),
                    },
                }
            } else {
                match upstream_rpc(app, &msg).await {
                    Ok(v) => v,
                    Err(e) => rpc_error(&id, -32603, &format!("Could not reach the BTB connector: {e}")),
                }
            }
        }
        _ => rpc_error(&id, -32601, &format!("Method not found: {method}")),
    })
}

async fn mcp(State(app): State<App>, body: Bytes) -> Response {
    let Ok(parsed) = serde_json::from_slice::<Value>(&body) else {
        return json_response(StatusCode::BAD_REQUEST, &rpc_error(&Value::Null, -32700, "Parse error"));
    };
    match parsed {
        Value::Array(batch) => {
            let mut out = Vec::new();
            for m in batch {
                if let Some(r) = handle_rpc(&app, m).await {
                    out.push(r);
                }
            }
            if out.is_empty() { StatusCode::ACCEPTED.into_response() } else { json_response(StatusCode::OK, &Value::Array(out)) }
        }
        m => match handle_rpc(&app, m).await {
            Some(r) => json_response(StatusCode::OK, &r),
            None => StatusCode::ACCEPTED.into_response(),
        },
    }
}

// ---- sign status: the sign page reports each step it sent, agents read it back (sign_status tool) ----

/// POST {id, step, hash}: a step of a sign link was sent. Anyone can report; the sign_status tool checks every hash on
/// chain (sent from the link's wallet, to the step's contract) before believing it.
async fn sign_report(State(app): State<App>, body: Bytes) -> Response {
    let v: Value = serde_json::from_slice(&body).unwrap_or(Value::Null);
    let id = v["id"].as_str().unwrap_or("");
    let hash = v["hash"].as_str().unwrap_or("");
    let step = v["step"].as_u64().unwrap_or(0) as u32;
    let hex = |s: &str, n: usize| s.len() == n + 2 && s.starts_with("0x") && s[2..].chars().all(|c| c.is_ascii_hexdigit());
    // EVM hashes are 0x + 64 hex; Solana signatures are base58 of 64 bytes (kept as they are: base58 is case sensitive).
    let solana_sig = bs58::decode(hash).into_vec().map(|b| b.len() == 64).unwrap_or(false);
    if !(16..=64).contains(&id.len()) || !id.chars().all(|c| c.is_ascii_hexdigit()) || !(hex(hash, 64) || solana_sig) || !(1..=10).contains(&step) {
        return rest_error(StatusCode::BAD_REQUEST, "invalid_arguments", "Send {id, step (1-10), hash (0x + 64 hex, or a Solana signature)}.");
    }
    let hash = if solana_sig { hash.to_string() } else { hash.to_lowercase() };
    let now = chrono::Utc::now().timestamp();
    if let Ok(mut m) = app.signed.lock() {
        m.retain(|_, steps| steps.iter().any(|s| now - s.2 < 86_400));
        if m.len() > 50_000 {
            return rest_error(StatusCode::SERVICE_UNAVAILABLE, "busy", "Too many open sign links. Try again later.");
        }
        let steps = m.entry(id.to_lowercase()).or_default();
        steps.retain(|s| s.0 != step);
        steps.push((step, hash.clone(), now));
        steps.sort_by_key(|s| s.0);
    }
    json_response(StatusCode::ACCEPTED, &json!({ "ok": true }))
}

async fn sign_read(State(app): State<App>, Path(id): Path<String>) -> Response {
    let steps = app.signed.lock().ok().and_then(|m| m.get(&id.to_lowercase()).cloned()).unwrap_or_default();
    json_response(StatusCode::OK, &json!({
        "id": id.to_lowercase(),
        "steps": steps.iter().map(|(s, h, t)| json!({ "step": s, "hash": h, "reportedAt": t })).collect::<Vec<_>>(),
    }))
}
