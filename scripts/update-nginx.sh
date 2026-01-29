#!/bin/bash
set -e

DOMAIN="editor.reelmotion.ai"

echo "🔧 Updating Nginx configuration for asset serving..."

# Define the cache directory path
CACHE_DIR="/home/Victor/reelmotion-editor-frontend/.cache/render-assets/"

# Create the directory if it doesn't exist yet (to avoid Nginx errors)
mkdir -p $CACHE_DIR

sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null <<EOF
server {
    server_name $DOMAIN;

    # Serve preloaded render assets directly
    location /_render_assets/ {
        alias $CACHE_DIR;
        autoindex off;
        expires 1h;
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "public, no-transform";
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # Options for large uploads
        client_max_body_size 500M; 
    }
    
    # SSL configuration will be maintained by Certbot in separate includes,
    # but since we are overwriting the file, we might lose the 'managed by Certbot' block.
    # We should re-run certbot install to be safe, or manually include paths.
    
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/editor.reelmotion.ai/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/editor.reelmotion.ai/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if (\$host = $DOMAIN) {
        return 301 https://\$host\$request_uri;
    } # managed by Certbot

    server_name $DOMAIN;
    listen 80;
    return 404; # managed by Certbot
}
EOF

echo "🔄 Reloading Nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo "✅ Nginx Configuration Updated!"
