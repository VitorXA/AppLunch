# Deploy

Antes de tudo, leia o checklist em [SECURITY.md](../SECURITY.md) e [PRIVACY.md](PRIVACY.md). **A câmera do navegador só funciona em HTTPS** (ou `localhost`), então HTTPS não é opcional.

## Opção 1: direto no servidor (Node 22.13+)

```bash
git clone https://github.com/SEU-USUARIO/applunch.git && cd applunch
npm install
npm run build                 # gera dist/
cp .env.example .env          # edite: NODE_ENV=production, FACE_PROVIDER, ADMIN_*, etc.
npm start                     # API + frontend em :3000
```

Use um gerenciador de processos (systemd, pm2) para manter o app rodando. Em produção o servidor **não inicia com `FACE_PROVIDER=mock`**.

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

## Opção 2: Docker

```bash
cp .env.example .env          # configure como acima
docker compose up -d --build
```

O banco fica no volume `applunch-data` (`/data` no container). Faça backup desse volume (ele contém os templates faciais). A imagem final só tem Node + o servidor + o build do frontend.

> O `Dockerfile` e o `docker-compose.yml` seguem o padrão do projeto, mas não foram executados na criação deste template. Se algo falhar, abra uma issue.

## HTTPS com proxy reverso

Exemplo com [Caddy](https://caddyserver.com/) (HTTPS automático):

```
lunch.suaescola.edu.br {
    reverse_proxy localhost:3000
}
```

Com proxy na frente, defina `TRUST_PROXY=true` **apenas** se o proxy sobrescrever o cabeçalho `X-Forwarded-For` (Caddy e Nginx bem configurados fazem isso). Caso contrário, o limite de tentativas poderia ser burlado.

## Backup

Copie a pasta de dados (`DATABASE_PATH`, padrão `./data/`). Como o SQLite roda em modo WAL, prefira `sqlite3 data/applunch.db ".backup backup.db"` com o app rodando, ou pare o app antes de copiar. **Criptografe os backups.**

## Atualizando

```bash
git pull && npm install && npm run build && sudo systemctl restart applunch
```

As migrações do banco rodam automaticamente na inicialização.
