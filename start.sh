#!/bin/sh
echo "Starting Tor..."
mkdir -p /app/tor-data
chmod 700 /app/tor-data

# If running as root, drop privileges to debian-tor. Otherwise, run as current user.
if [ "$(id -u)" = "0" ]; then
    echo "Running as root. Changing ownership of tor-data and starting Tor..."
    chown -R debian-tor:debian-tor /app/tor-data
    tor --RunAsDaemon 1 --User debian-tor --DataDirectory /app/tor-data
else
    echo "Running as non-root user ($(id -u)). Starting Tor..."
    tor --RunAsDaemon 1 --DataDirectory /app/tor-data
fi

echo "Waiting for Tor to bootstrap..."
sleep 15

# Test Tor proxy connection
echo "Verifying Tor connection..."
curl --socks5-hostname 127.0.0.1:9050 https://check.torproject.org/api/ip || echo "Tor verification check failed, but proceeding..."

echo "Starting Node.js server..."
node server.js
