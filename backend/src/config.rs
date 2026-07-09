use std::env;
use std::path::PathBuf;

/// blowbox is a pure client-side SPA (a 3D LED-grid playground) — the backend only
/// serves the built assets + an unauth `/status` probe. No database, no auth of
/// its own (LAN-only behind the Pi edge). Hence a tiny config.
#[derive(Debug, Clone)]
pub struct Config {
    pub bind: String,
    /// Directory of the built SPA to serve (Vite/adapter-static `dist/`).
    pub static_dir: PathBuf,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            bind: env::var("BLOWBOX_BIND").unwrap_or_else(|_| "0.0.0.0:3016".into()),
            static_dir: PathBuf::from(env::var("STATIC_DIR").unwrap_or_else(|_| "./dist".into())),
        }
    }
}
