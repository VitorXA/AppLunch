# Deploy

Antes de tudo, leia o checklist em [SECURITY.md](../SECURITY.md) e [PRIVACY.md](PRIVACY.md). **A cÃ¢mera do navegador sÃ³ funciona em HTTPS** (ou `localhost`), entÃ£o HTTPS nÃ£o Ã© opcional.

## OpÃ§Ã£o 1: direto no servidor (Node 22.13+)

```bash
git clone https://github.com/VitorXA/applunch.git && cd applunch
npm install
npm run build                 # gera dist/
cp .env.example .env          # edite: NODE_ENV=production, FACE_PROVIDER, ADMIN_*, etc.
npm start                     # API + frontend em :3000
```

Use um gerenciador de processos (systemd, pm2) para manter o app rodando. Em produÃ§Ã£o o servidor **nÃ£o inicia com `FACE_PROVIDER=mock`**.

Exemplo de unidade systemd:

```ini
[Unit]
Description=AppLunch
After=network.target

[Service]
WorkingDirectory=/opt/applunch
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
User=applunch
EnvironmentFile=/opt/applunch/.env

[Install]
WantedBy=multi-user.target
```

## OpÃ§Ã£o 2: Docker

```bash
cp .env.example .env          # configure como acima
docker compose up -d --build
```

O banco fica no volume `applunch-data` (`/data` no container). FaÃ§a backup desse volume (ele contÃ©m os templates faciais). A imagem final sÃ³ tem Node + o servidor + o build do frontend.

> O `Dockerfile` e o `docker-compose.yml` seguem o padrÃ£o do projeto, mas nÃ£o foram executados na criaÃ§Ã£o deste template. Se algo falhar, abra uma issue.

## HTTPS com proxy reverso

Exemplo com [Caddy](https://caddyserver.com/) (HTTPS automÃ¡tico):

```
lunch.suaescola.edu.br {
    reverse_proxy localhost:3000
}
```

Com proxy na frente, defina `TRUST_PROXY=true` **apenas** se o proxy sobrescrever o cabeÃ§alho `X-Forwarded-For` (Caddy e Nginx bem configurados fazem isso). Caso contrÃ¡rio, o limite de tentativas poderia ser burlado.

## Backup

Copie a pasta de dados (`DATABASE_PATH`, padrÃ£o `./data/`). Como o SQLite roda em modo WAL, prefira `sqlite3 data/applunch.db ".backup backup.db"` com o app rodando, ou pare o app antes de copiar. **Criptografe os backups.**

## Atualizando

```bash
git pull && npm install && npm run build && sudo systemctl restart applunch
```

As migraÃ§Ãµes do banco rodam automaticamente na inicializaÃ§Ã£o.
