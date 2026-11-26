//! BTB Finance API for agents, in Rust, built to run long-lived on Flux with its data warm in memory.
//!
//! Moved here so far (src/tools.rs): the pool tools (top_pools, search_pools, chain_summary, pool_details, compare_pools,
//! best_pools_for, estimate_lp_earnings, lp_plan, add_liquidity_link) and token_safety. Every other tool and REST path is
//! forwarded to the TypeScript connector (UPSTREAM_URL, default https://btb.finance), so this server always offers
//! the whole API while parts move over one at a time. It holds no secrets.
//!
//!   POST /api/mcp            MCP (Streamable HTTP, JSON responses)
//!   GET  /api/v1/...         REST, same paths and answers as https://btb.finance/api/v1
//!   GET  /health

mod pools;
mod snapshot;
mod tools;

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
    /// The upstream connector's tools/list, kept for 10 minutes.
    upstream_tools: Arc<RwLock<Option<(std::time::Instant, Vec<Value>)>>>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into())).init();
    let convex = std::env::var("CONVEX_URL").unwrap_or_else(|_| "https://grateful-oyster-780.convex.cloud".into());
    let upstream = std::env::var("UPSTREAM_URL").unwrap_or_else(|_| "https://btb.finance".into());
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);
    let http = reqwest::Client::builder().user_agent("btb-api/0.1").build().expect("http client");
    let app = App { snap: Arc::new(RwLock::new(None)), http: http.clone(), upstream, convex: convex.clone(), upstream_tools: Arc::new(RwLock::new(None)) };
    snapshot::keep_fresh(app.snap.clone(), http, convex, Duration::from_secs(300));

    let router = rest_routes(Router::new())
        .route("/health", get(health))
        .route("/api/mcp", post(mcp).get(mcp_get))
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
        Some(s) => json_response(StatusCode::OK, &json!({ "ok": true, "pools": s.pools.len(), "updatedAt": s.updated_at })),
        None => json_response(StatusCode::SERVICE_UNAVAILABLE, &json!({ "ok": false, "note": "pool snapshot still loading" })),
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
    let ctx = tools::Ctx { snap: &snap, http: &app.http, convex: &app.convex };
    match tools::call(tool, &args, &ctx).await {
        Ok(v) => json_response(StatusCode::OK, &v),
        Err(tools::ToolError(msg)) => {
            // The same codes the TypeScript API gives (src/lib/api/v1.ts callTool).
            let not_found = msg.contains("not found") || msg.contains("Not found");
            let code = if not_found { "not_found" } else if msg.starts_with("Input validation error") { "invalid_arguments" } else { "tool_error" };
            rest_error(if not_found { StatusCode::NOT_FOUND } else { StatusCode::BAD_REQUEST }, code, &msg)
        }
    }
}

fn body_args(body: &Bytes) -> Map<String, Value> {
    serde_json::from_slice::<Value>(body).ok().and_then(|v| v.as_object().cloned()).unwrap_or_default()
}

/// One REST route: path parameters, then the query string, then (POST) the JSON body, as the TypeScript API merges them.
async fn rest(app: App, tool: &'static str, rename: &'static [(&'static str, &'static str)], path: HashMap<String, String>, q: HashMap<String, String>, body: Option<Bytes>) -> Response {
    let mut a = rest_args(tool, &q, rename);
    for (k, v) in path {
        a.insert(k, json!(v));
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
            get(|State(app): State<App>, Path(p): Path<HashMap<String, String>>, Query(q): Query<HashMap<String, String>>| async move {
                rest(app, $tool, $rename, p, q, None).await
            })
            .post(|State(app): State<App>, Path(p): Path<HashMap<String, String>>, Query(q): Query<HashMap<String, String>>, body: Bytes| async move {
                rest(app, $tool, $rename, p, q, Some(body)).await
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
                    Some(snap) => match tools::call(&name, &args, &tools::Ctx { snap: &snap, http: &app.http, convex: &app.convex }).await {
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
