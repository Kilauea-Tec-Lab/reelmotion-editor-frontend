#!/bin/bash
set -e

DOMAIN="editor.reelmotion.ai"
EMAIL="vertex-ai-laravel-sa@deft-processor-465219-e0.iam.gserviceaccount.com" # Using the one from env

echo "🔧 Installing Nginx and Certbot..."
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx

echo "⚙️  Configuring Nginx for $DOMAIN..."
sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null <<EOF
server {
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # Opciones para uploads grandes (videos)
        client_max_body_size 500M; 
    }
}
EOF

# Enable site
if [ ! -f /etc/nginx/sites-enabled/$DOMAIN ]; then
    sudo ln -s /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
fi

echo "🔄 Reloading Nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo "🔒 Obtaining SSL Certificate..."
# Request certificate (non-interactive)
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL --redirect

echo "✅ HTTPS Setup Complete!"
