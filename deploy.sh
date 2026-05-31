#!/bin/bash

echo "🚀 Deploying Noxis for noxis.tech..."

# 1. Install Dependencies
echo "📦 Installing dependencies..."
npm install

# 2. Build Frontend
echo "🏗️ Building frontend..."
npm run build

# 3. Manage PM2 Processes
echo "🔄 Managing services..."

# Backend (Port 3000)
if pm2 list | grep -q "noxis-backend"; then
    echo "Restarting Backend..."
    pm2 restart noxis-backend
else
    echo "Starting Backend..."
    pm2 start server.js --name "noxis-backend"
fi

# Frontend (Port 5001 - Vite Preview)
if pm2 list | grep -q "noxis-frontend"; then
    echo "Restarting Frontend..."
    pm2 restart noxis-frontend
else
    echo "Starting Frontend..."
    pm2 start "npm run preview" --name "noxis-frontend"
fi

echo "✅ Deployment complete!"
echo "🌍 Check https://noxis.tech"
echo "   - Frontend running on :5001 (Proxied by Nginx)"
echo "   - Backend running on  :3000 (Proxied by Nginx)"
