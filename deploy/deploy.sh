#!/bin/bash
set -euo pipefail

# ============================================================
# ado-pulse — Fresh VPS Deploy Script
# ============================================================

echo "=== ado-pulse — Production Setup ==="
echo ""

# --------------------------------------------------
# 1. Check running as root
# --------------------------------------------------
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: This script must be run as root (or with sudo)."
    echo "Usage: sudo bash deploy.sh"
    exit 1
fi

# --------------------------------------------------
# 2. Update system packages
# --------------------------------------------------
echo ">>> Updating system packages..."
apt update && apt upgrade -y
echo ""

# --------------------------------------------------
# 3. Install Docker and Docker Compose
# --------------------------------------------------
if command -v docker &> /dev/null; then
    echo ">>> Docker already installed: $(docker --version)"
else
    echo ">>> Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo ">>> Docker installed: $(docker --version)"
fi

# Verify docker compose plugin is available
if docker compose version &> /dev/null; then
    echo ">>> Docker Compose available: $(docker compose version)"
else
    echo "ERROR: Docker Compose plugin not found. Please install it manually."
    exit 1
fi
echo ""

# --------------------------------------------------
# 4. Configure UFW firewall
# --------------------------------------------------
echo ">>> Configuring firewall (UFW)..."
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
echo "y" | ufw enable
ufw status
echo ""

# --------------------------------------------------
# 5. Create app user
# --------------------------------------------------
APP_USER="adoapp"
APP_DIR="/opt/ado-pulse"

if id "$APP_USER" &> /dev/null; then
    echo ">>> App user '$APP_USER' already exists."
else
    echo ">>> Creating app user '$APP_USER'..."
    useradd -r -m -s /bin/bash "$APP_USER"
    usermod -aG docker "$APP_USER"
fi
echo ""

# --------------------------------------------------
# 6. Clone repo or use existing files
# --------------------------------------------------
if [ -d "$APP_DIR" ] && [ -f "$APP_DIR/docker-compose.prod.yml" ]; then
    echo ">>> App directory already exists at $APP_DIR"
    read -p "Pull latest changes? (y/n): " PULL_LATEST
    if [ "$PULL_LATEST" = "y" ]; then
        cd "$APP_DIR"
        git pull
    fi
else
    echo ">>> Setting up application directory..."
    read -p "Enter the git repo URL: " REPO_URL
    git clone "$REPO_URL" "$APP_DIR"
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

cd "$APP_DIR"
echo ""

# --------------------------------------------------
# 7. Prompt for configuration
# --------------------------------------------------
echo ">>> Configuration"
echo ""

read -p "Enter your domain name [pulse.shawnjsandy.com]: " DOMAIN
DOMAIN="${DOMAIN:-pulse.shawnjsandy.com}"

echo ""
read -p "Enable basic auth? (y/n): " ENABLE_AUTH
BASIC_AUTH_USER=""
BASIC_AUTH_PASS=""
if [ "$ENABLE_AUTH" = "y" ]; then
    read -p "  Username: " BASIC_AUTH_USER
    read -sp "  Password: " BASIC_AUTH_PASS
    echo ""
fi

echo ""
echo ">>> ADO Configuration"
read -p "  ADO Organization: " ADO_ORG
read -p "  ADO Project: " ADO_PROJECT
read -sp "  ADO PAT: " ADO_PAT
echo ""
read -p "  Default Team [Platform Engineering]: " ADO_DEFAULT_TEAM
ADO_DEFAULT_TEAM="${ADO_DEFAULT_TEAM:-Platform Engineering}"

# --------------------------------------------------
# 8. Create .env file
# --------------------------------------------------
echo ">>> Creating .env file..."
cat > "$APP_DIR/.env" <<EOF
DOMAIN=${DOMAIN}
BASIC_AUTH_USER=${BASIC_AUTH_USER}
BASIC_AUTH_PASS=${BASIC_AUTH_PASS}
ADO_ORG=${ADO_ORG}
ADO_PROJECT=${ADO_PROJECT}
ADO_PAT=${ADO_PAT}
ADO_DEFAULT_TEAM=${ADO_DEFAULT_TEAM}
EOF

chmod 600 "$APP_DIR/.env"
chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
echo ""

# --------------------------------------------------
# 9. Build and start containers
# --------------------------------------------------
echo ">>> Building and starting containers..."
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml up -d --build
echo ""

# --------------------------------------------------
# 10. Wait for containers to become healthy
# --------------------------------------------------
echo ">>> Waiting for services to become healthy..."
sleep 10

MAX_RETRIES=12
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker compose -f docker-compose.prod.yml ps | grep -q "unhealthy\|starting"; then
        echo "  Waiting for services... ($(( RETRY_COUNT + 1 ))/${MAX_RETRIES})"
        sleep 10
        RETRY_COUNT=$(( RETRY_COUNT + 1 ))
    else
        break
    fi
done

echo ""
echo ">>> Container status:"
docker compose -f docker-compose.prod.yml ps
echo ""

# --------------------------------------------------
# 11. Final output
# --------------------------------------------------
echo "=========================================="
echo ""
echo "  ado-pulse is live at https://${DOMAIN}"
echo ""
echo "=========================================="
echo ""
echo "REMINDER: Make sure your DNS A record points"
echo "  ${DOMAIN} -> $(curl -s ifconfig.me || echo '<this server IP>')"
echo ""
echo "Useful commands:"
echo "  Status:  bash deploy/status.sh"
echo "  Update:  bash deploy/update.sh"
echo "  Logs:    docker compose -f docker-compose.prod.yml logs -f"
echo ""
