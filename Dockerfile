FROM node:18-bullseye-slim

# Install Tor, ffmpeg, curl, procps
RUN apt-get update && apt-get install -y --no-install-recommends \
    tor \
    ffmpeg \
    curl \
    ca-certificates \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Disable automatic ffmpeg-static binary download from GitHub releases
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe
ENV FFMPEG_BINARY=disabled
ENV FFPROBE_BINARY=disabled

# Install npm dependencies cleanly ignoring postinstall binary downloads
RUN npm install --ignore-scripts --production=false

# Copy source files
COPY . .

# Build Vite frontend assets
RUN npm run build || true

EXPOSE 10000

ENV PORT=10000
ENV USE_TOR=true
ENV TOR_SOCKS_PROXY=socks5h://127.0.0.1:9050

# Start Tor daemon and launch node server.js
CMD tor --RunAsDaemon 1 && sleep 2 && node server.js
