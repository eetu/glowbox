use std::sync::Arc;

use axum::extract::State;
use axum::http::{header, StatusCode};
use axum::response::{Html, IntoResponse};
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};

use crate::config::Config;

pub fn router(cfg: Arc<Config>) -> Router {
    Router::new()
        // Unauthenticated liveness — gatus probes this; keep it auth-free and on
        // a Traefik monitor router that bypasses oauth2-proxy.
        .route("/status", get(status))
        // SPA: serve a real built asset if the path maps to one under static_dir,
        // else return index.html (200) so the client router owns the route (a
        // hard refresh on a sub-route works). A handler, not tower-http ServeDir,
        // whose not_found_service would leak a 404 onto every client route.
        .fallback(get(serve_spa))
        .with_state(cfg)
}

async fn status() -> Json<Value> {
    Json(json!({
        "service": "voxl",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

async fn serve_spa(State(cfg): State<Arc<Config>>, uri: axum::http::Uri) -> axum::response::Response {
    let base = &cfg.static_dir;
    let rel = uri.path().trim_start_matches('/');

    // Only read a file for a path that stays inside static_dir after
    // normalisation — rejects `..` traversal and absolute escapes.
    if !rel.is_empty() {
        let candidate = base.join(rel);
        if let (Ok(canon), Ok(canon_base)) = (candidate.canonicalize(), base.canonicalize()) {
            if canon.starts_with(&canon_base) && canon.is_file() {
                if let Ok(bytes) = tokio::fs::read(&canon).await {
                    let mime = mime_guess::from_path(&canon).first_or_octet_stream();
                    return ([(header::CONTENT_TYPE, mime.as_ref())], bytes).into_response();
                }
            }
        }
    }

    match tokio::fs::read_to_string(base.join("index.html")).await {
        Ok(html) => Html(html).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "not found").into_response(),
    }
}
