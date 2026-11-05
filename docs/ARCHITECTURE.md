# Arquitetura

## Visão geral

- **Frontend**: React 19 + Vite. Uma SPA pequena: `AuthPage` (login/cadastro), `ScanScreen` (câmera + cadastro do rosto + check-in), `AdminPanel` (registros do dia).
- **Backend**: Node 22 puro, **sem dependências npm**. `node:http` para o servidor, `node:sqlite` para o banco, `node:crypto` para senhas e tokens. Em produção, o mesmo processo também serve o build do frontend.
- **Banco**: um arquivo SQLite (`DATABASE_PATH`), com migrações versionadas por `PRAGMA user_version`.
- **Reconhecimento facial**: provedor plugável ([FACE-RECOGNITION.md](FACE-RECOGNITION.md)).

Por que sem frameworks? Para o template ser fácil de ler e auditar inteiro, sem módulos nativos para compilar (o original usava `sqlite3`, que costuma dar dor de cabeça em instalação). Se você preferir Express, Fastify etc., a lógica em `server/app.js` migra de forma direta: cada rota é uma função `({ user, body, ... }) → { status, body }`.

## Modelo de dados

```
users(id, identifier UNIQUE NOCASE, name, email, password_hash, role[student|admin], created_at)
sessions(token_hash PK, user_id → users, expires_at)
face_templates(user_id PK → users, provider, template, consent_at, created_at)
meals(id, user_id → users, meal_type, meal_date, score, created_at,
      UNIQUE(user_id, meal_type, meal_date))   -- garante 1 refeição por tipo por dia
```

Para mudar o schema, **adicione** um item ao final de `MIGRATIONS` em `server/db.js` (nunca edite os anteriores).

## Fluxo do check-in (`POST /api/meals/checkin`)

1. Sessão válida? (cookie → hash SHA-256 → tabela `sessions`)
2. Limite de tentativas (10 por 5 min por usuário)
3. Existe refeição aberta agora, no fuso `APP_TIMEZONE`? (`outside_meal_window`)
4. O aluno tem rosto cadastrado? (`face_not_enrolled`)
5. Já registrou esta refeição hoje? (`already_checked_in`)
6. Valida a imagem (magic bytes, tamanho) → provedor `verify` (`face_mismatch`)
7. Grava em `meals`. A restrição `UNIQUE` cobre condições de corrida (duas requisições simultâneas).

## Sessões e CSRF

Login cria um token aleatório; o cookie leva o token e o banco guarda só o hash. O cookie é `HttpOnly` + `SameSite=Strict`. Como o frontend e a API ficam na **mesma origem** (em dev, o Vite faz proxy de `/api`), não há CORS. Toda escrita exige `Content-Type: application/json`, o que um site de terceiros não consegue enviar sem preflight.

## Testes

`npm test` roda `node:test` contra um servidor real em memória (banco `:memory:`, relógio injetável). Cobrem autenticação, consentimento, janelas de refeição/fuso, duplicidade, admin, o contrato do provedor `http`, arquivos estáticos e limites.

O frontend ainda não tem testes automatizados (veja o roadmap no README).

## Onde mexer para…

| Quero… | Mexa em |
| --- | --- |
| Outro motor de reconhecimento facial | `server/recognition/` |
| Mudar regras de refeição (ex.: horários por dia da semana) | `server/meals.js` e `server/app.js` (`/api/meals/checkin`) |
| Importar alunos de um sistema acadêmico / login institucional (SSO) | `server/app.js` (rotas de `/api/auth`) |
| Mudar textos/idioma | `src/strings.js` |
| Mudar aparência | `src/index.css` (variáveis) e `src/components/*/*.css` |
| Novos campos de usuário | nova migração em `server/db.js` + `register` em `server/app.js` |
