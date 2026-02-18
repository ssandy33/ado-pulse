#!/bin/bash
set -euo pipefail

echo "=== 1. Install sslh ==="
apt update && apt install -y sslh

echo ""
echo "=== 2. Configure sslh ==="
cat > /etc/default/sslh <<'EOF'
RUN=yes
DAEMON_OPTS="--user sslh --listen 0.0.0.0:443 --ssh 127.0.0.1:22 --tls 127.0.0.1:8443 --pidfile /var/run/sslh/sslh.pid"
EOF

echo ""
echo "=== 3. Update docker-compose — move Caddy from 443 to 8443 ==="
cd /opt/ado-pulse
sed -i 's/"443:443"/"8443:443"/' docker-compose.prod.yml
echo "Updated port mapping:"
grep -n "443" docker-compose.prod.yml

echo ""
echo "=== 4. Restart containers with new port ==="
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "=== 5. Start sslh ==="
systemctl enable sslh
systemctl restart sslh

echo ""
echo "=== 6. Add swap if missing ==="
if [ -f /swapfile ]; then
  echo "Swap already exists:"
  swapon --show
else
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Swap created and enabled"
fi

echo ""
echo "=== 7. Verify ==="
sleep 5
free -h
echo ""
ss -tlnp | grep -E ':443|:8443|:22|:80'
echo ""
systemctl status sslh --no-pager
echo ""
docker ps
echo ""
echo "=== DONE ==="
echo "Test with: ssh -p 443 root@<your-server-ip>"
echo "Site at: https://<your-domain>"
