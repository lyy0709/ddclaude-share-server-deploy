#!/bin/sh
set -eu
cd /opt/claude-frame-proxy
docker run --rm \
  -v "$PWD/acme/config:/etc/letsencrypt" \
  -v "$PWD/acme/work:/var/lib/letsencrypt" \
  -v "$PWD/acme/logs:/var/log/letsencrypt" \
  -v /root/.secrets/chatgpt-ng-cloudflare.ini:/secrets/cloudflare.ini:ro \
  certbot/dns-cloudflare@sha256:c45edb002b883da1a1235abb205dff474a7a1a459d878e8d5fdc7f9d83073aea \
  renew --cert-name frame.chatgpt.ng --quiet

source_dir=acme/config/live/frame.chatgpt.ng
if cmp -s "$source_dir/fullchain.pem" tls/fullchain.pem && cmp -s "$source_dir/privkey.pem" tls/privkey.pem; then
  exit 0
fi
install -d -m 750 -o 1000 -g 1000 tls
install -m 644 -o 1000 -g 1000 "$source_dir/fullchain.pem" tls/fullchain.pem.new
install -m 600 -o 1000 -g 1000 "$source_dir/privkey.pem" tls/privkey.pem.new
mv tls/fullchain.pem.new tls/fullchain.pem
mv tls/privkey.pem.new tls/privkey.pem
if [ "$(docker inspect -f '{{.State.Running}}' claude-frame-proxy 2>/dev/null || true)" = true ]; then
  docker kill --signal HUP claude-frame-proxy >/dev/null
fi
