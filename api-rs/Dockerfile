# BTB API (Rust): the public agent API, long-lived with its data warm in memory. Built for Flux.
# Build from api-rs/:  docker build -t btb-api api-rs
# Run:                 docker run -p 8080:8080 btb-api
# No secrets needed. Optional env: PORT, CONVEX_URL, UPSTREAM_URL (where tools not yet in Rust are forwarded).

FROM rust:1.89-slim-bookworm AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock* ./
COPY src ./src
# The protocol registry, compiled into the binary (written by scripts/registry.mjs index).
COPY data ./data
RUN cargo build --release --locked || cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 btb
COPY --from=build /src/target/release/btb-api /usr/local/bin/btb-api
USER btb
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD curl -fsS http://localhost:${PORT}/health || exit 1
CMD ["btb-api"]
