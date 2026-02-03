$ErrorActionPreference = "Stop"

# Configuration
$GCE_INSTANCE = "reelmotion-pro-server"
$ZONE = "us-central1-a"
$REPO_URL = "git@github.com:DarkusGamer/reelmotion-editor-frontend.git"

# 1. Local Git Operations
Write-Host " Preparing deployment..."
$commitMsg = Read-Host "Enter commit message (default: 'chore: deploy to production')"
if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    $commitMsg = "chore: deploy to production"
}

Write-Host "Commiting changes..."
git add .
try {
    git commit -m "$commitMsg"
} catch {
    Write-Host "Nothing to commit, proceeding..."
}

Write-Host "Pushing to GitHub..."
git push origin main

# 2. Copy Configuration Files
Write-Host " Syncing secrets and config..."
if (Test-Path "gcp-credentials.json") {
    # Copy to home directory
    gcloud compute scp gcp-credentials.json ${GCE_INSTANCE}: --zone=$ZONE
}

# Copy local .env file
if (Test-Path ".env") {
    Write-Host " Copying local .env file..."
    # Copy as a temp file in home dir
    gcloud compute scp .env ${GCE_INSTANCE}:env_temp --zone=$ZONE
}

# 3. Remote Execution
Write-Host " Preparing remote build on $GCE_INSTANCE..."

$remoteScript = @"
#!/bin/bash
set -e
# Ensure SSH config is OK for GitHub
if ! grep -q "github.com" ~/.ssh/known_hosts 2>/dev/null; then
    ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null
fi

# Clone or Pull
if [ ! -d 'reelmotion-editor-frontend' ]; then
    echo 'First clone...'
    git clone $REPO_URL
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
"@

# Write script to temp file locally
$tempScriptPath = "deploy-remote.sh"
Set-Content -Path $tempScriptPath -Value $remoteScript -Encoding UTF8

try {
    Write-Host " Uploading deployment script..."
    gcloud compute scp $tempScriptPath ${GCE_INSTANCE}: --zone=$ZONE

    Write-Host " Executing remote build..."
    # Make executable and run, then remove
    gcloud compute ssh $GCE_INSTANCE --zone=$ZONE --command="chmod +x deploy-remote.sh && ./deploy-remote.sh && rm deploy-remote.sh"
}
finally {
    # Cleanup local temp file
    if (Test-Path $tempScriptPath) {
        Remove-Item $tempScriptPath
    }
}

Write-Host " Deployment successful!"
Write-Host " App available at: http://104.197.115.149:3000"
