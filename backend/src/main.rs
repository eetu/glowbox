#[tokio::main]
async fn main() -> anyhow::Result<()> {
    blowbox_backend::run_server().await
}
