# Logging Setup

ado-pulse uses [Axiom](https://axiom.co) for centralized logging. This document covers infrastructure setup on the Hetzner production server.

## Application-Level Logging (automatic)

The app ships structured JSON logs to Axiom via the `@axiomhq/js` SDK when `AXIOM_API_TOKEN` is set. No server-side changes needed for this — just configure the env vars in `.env` on the server:

```bash
AXIOM_API_TOKEN=xaat-xxxxxxxx
AXIOM_DATASET=ado-pulse
```

These are passed to the app container via `docker-compose.prod.yml`.

## Docker Container Log Collection with Vector (optional)

[Vector](https://vector.dev) can collect Docker container stdout/stderr and forward to Axiom. This captures logs from both the app and Caddy containers.

### Install Vector

```bash
curl --proto '=https' --tlsv1.2 -sSfL https://sh.vector.dev | bash
```

### Configure Vector

Create `/etc/vector/vector.toml`:

```toml
[sources.docker_logs]
type = "docker_logs"
include_containers = ["ado-pulse-app-1", "ado-pulse-caddy-1"]

[sinks.axiom]
type = "axiom"
inputs = ["docker_logs"]
dataset = "ado-pulse-infra"
token = "${AXIOM_API_TOKEN}"
```

### Run Vector as a service

```bash
sudo systemctl enable vector
sudo systemctl start vector
```

### Verify

```bash
sudo systemctl status vector
# Check Axiom dashboard for events in ado-pulse-infra dataset
```

## Axiom Setup

1. Create an Axiom account at https://axiom.co
2. Create two datasets: `ado-pulse` (app logs) and `ado-pulse-infra` (container logs)
3. Create an API token with ingest permissions for both datasets
4. Add the token as `AXIOM_API_TOKEN` in:
   - Server `.env` file (for Docker Compose)
   - GitHub repository secrets (for deployment logging)
