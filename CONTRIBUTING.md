# Contribuindo

Obrigado por querer ajudar! Qualquer contribuição é bem-vinda: correções, testes, documentação, traduções, provedores de reconhecimento facial de exemplo.

## Rodando localmente

```bash
npm install
cp .env.example .env
npm run dev        # http://localhost:5173
```

Requer Node.js 22.13+.

## Antes de abrir um Pull Request

```bash
npm run lint
npm test
npm run build
```

O CI roda os mesmos três comandos.

## Diretrizes

- **Mudanças de comportamento do backend vêm com teste** em `server/test/` (usam `node:test`; veja `helpers.js`).
- **Mantenha o backend sem dependências npm**, salvo forte justificativa. É uma das características do template.
- **Textos da interface** vão em `src/strings.js`, nunca fixos nos componentes.
- **Migrações de banco**: só adicione itens ao final de `MIGRATIONS` em `server/db.js`.
- **Nunca commite dados reais**: `.env`, bancos `.db`, fotos, matrículas ou senhas de pessoas reais. O `.gitignore` já cobre os casos comuns.
- Commits e PRs pequenos e com descrição clara são mais fáceis de revisar.

## Ideias para começar

Veja a seção *Roadmap* do [README](README.md). Itens marcados como bons para quem está começando: traduções da interface, exportação CSV, documentação.

## Segurança

Para vulnerabilidades, siga o [SECURITY.md](SECURITY.md) (não abra issue pública).
