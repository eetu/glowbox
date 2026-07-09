#[tokio::main]
async fn main() -> anyhow::Result<()> {
    voxl_backend::run_server().await
}
