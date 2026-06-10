#!/bin/sh
echo "Starting Tor..."
tor --RunAsDaemon 1 --User debian-tor --DataDirectory /var/lib/tor

echo "Waiting for Tor to bootstrap..."
sleep 10

# Test Tor proxy connection
echo "Verifying Tor connection..."
curl --socks5-hostname 127.0.0.1:9050 https://check.torproject.org/api/ip || echo "Tor verification check failed, but proceeding..."

echo "Starting Node.js server..."
node server.js
