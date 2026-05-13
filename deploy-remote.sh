#!/bin/bash
set -e
# Ensure SSH config is OK for GitHub
if ! grep -q "github.com" ~/.ssh/known_hosts 2>/dev/null; then
    ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null
fi

# Clone or Pull
if [ ! -d 'reelmotion-editor-frontend' ]; then
    echo 'First clone...'
    git clone git@github.com:DarkusGamer/reelmotion-editor-frontend.git
    cd reelmotion-editor-frontend
else
    cd reelmotion-editor-frontend
    echo 'Pulling latest changes...'
    git pull origin main
fi

# Restore secrets
if [ -f ~/gcp-credentials.json ]; then
    mv ~/gcp-credentials.json .
fi

# Restore .env
if [ -f ~/env_temp ]; then
    echo "Restoring .env..."
    mv ~/env_temp .env
fi

# Configuration
echo 'NEXT_PUBLIC_IS_LOCAL_RENDER=true' > .env.local

# Install & Build
echo 'Installing dependencies...'
npm install
echo 'Building Next.js app...'
npm run build

# Restart PM2
echo 'Restarting server...'
if pm2 list | grep -q 'editor'; then
    pm2 restart editor
else
    pm2 start npm --name 'editor' -- start
fi

# Save PM2 list so it restarts on reboot
pm2 save
