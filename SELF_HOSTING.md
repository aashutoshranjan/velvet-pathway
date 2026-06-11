# Self-Hosting on Ubuntu 24.04 (Node.js + Nginx)

This project is a TanStack Start app. For self-hosting we build with Nitro's
`node-server` preset so `npm run build` produces a standalone Node.js HTTP
server (with a real listener) at `.output/server/index.mjs`.

## 1. Server prerequisites

```bash
# Node.js 20+ (use nvm or NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm i -g pm2
```

## 2. Environment variables

Create a `.env` (or systemd/pm2 env) with at least:

```
PORT=3001
NODE_ENV=production

# Lovable Cloud / Supabase — required at runtime
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server-only, never commit
```

`VITE_*` values are inlined at build time, so you must export them
**before** `npm run build`. `SUPABASE_SERVICE_ROLE_KEY` is read at runtime.

## 3. Build & run

```bash
npm ci
npm run build          # outputs .output/server/index.mjs + .output/public
npm run start          # listens on $PORT (default 3001)
```

The exact production start command:

```bash
PORT=3001 NODE_ENV=production node .output/server/index.mjs
```

### Run under pm2

```bash
pm2 start "node .output/server/index.mjs" --name lms --env production
pm2 save && pm2 startup
```

### Or under systemd (`/etc/systemd/system/lms.service`)

```ini
[Unit]
Description=LMS Trainee Program
After=network.target

[Service]
WorkingDirectory=/var/www/lms
EnvironmentFile=/var/www/lms/.env
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lms
```

## 4. Nginx reverse proxy

`/etc/nginx/sites-available/lms`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lms /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com   # optional TLS
```

## 5. Files committed for self-hosting

- `vite.config.ts` — forces Nitro `node-server` preset outside the Lovable sandbox.
- `package.json` — adds the `start` script.
- `SELF_HOSTING.md` — this guide.

No UI or application behavior was changed.
