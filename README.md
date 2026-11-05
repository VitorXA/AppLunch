# AppLunch

Template open source para **controle de refeições em escolas, institutos e universidades**: o aluno faz login com a matrícula, confirma a identidade por **reconhecimento facial** e registra o almoço (ou café, jantar…) uma única vez por dia, dentro do horário.

[![CI](https://github.com/VitorXA/applunch/actions/workflows/ci.yml/badge.svg)](https://github.com/VitorXA/applunch/actions/workflows/ci.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-green.svg)](LICENSE)
![Node >= 22.13](https://img.shields.io/badge/node-%3E%3D22.13-339933)

[English summary](README.en.md)

## Por que existe

Controlar quem já almoçou (e evitar que um aluno registre pelo outro) normalmente é feito em papel, planilha ou com leitores caros. O AppLunch é um ponto de partida **simples, auditável e sem dependências pesadas** para instituições que querem montar o próprio sistema, e foi pensado para ser adaptado: outro nome para a matrícula (SUAP, RA…), outras refeições, outro serviço de reconhecimento facial.

## O que já vem pronto

- **Cadastro e login** por matrícula + senha (hash `scrypt`, sessão em cookie `HttpOnly`, limite de tentativas)
- **Leitura facial pela câmera do navegador**, com cadastro do rosto e **consentimento explícito**
- **Reconhecimento facial plugável**: provedor `mock` (desenvolvimento) e provedor `http` (conecte ao seu serviço: DeepFace, InsightFace, Rekognition…)
- **Janelas de refeição configuráveis** (café, almoço, jantar), fuso horário e **uma refeição por tipo por dia** garantida pelo banco
- **Painel administrativo** com os registros do dia, totais por refeição e filtro por data
- **Direito de apagar o próprio rosto** (pelo aluno ou pelo admin)
- **Backend sem dependências npm**: só Node 22 (`node:http`, `node:sqlite`, `node:crypto`), sem compilar módulos nativos
- Testes automatizados do backend, CI no GitHub Actions, Dockerfile

## Início rápido

Requisitos: **Node.js 22.13 ou superior**.

```bash
git clone https://github.com/VitorXA/applunch.git
cd applunch
npm install
cp .env.example .env     # ajuste se quiser; os padrões funcionam para testar
npm run dev
```

Abra **http://localhost:5173**, crie uma conta e teste o fluxo (o navegador vai pedir permissão da câmera; `localhost` funciona sem HTTPS).

> O registro de refeição só funciona dentro da janela configurada (padrão: almoço 11:00–14:00, fuso `America/Fortaleza`). Para testar fora desse horário, defina no `.env` uma janela que inclua o momento atual, por exemplo `MEAL_TYPES=[{"id":"lunch","label":"Almoço","start":"00:00","end":"23:59"}]`.

> Em desenvolvimento o reconhecimento facial roda em modo **`mock`**: qualquer imagem é aceita como "o mesmo rosto". É para testar o fluxo, **não oferece segurança alguma**. Para uso real, veja [reconhecimento facial](docs/FACE-RECOGNITION.md).

### Criar um administrador

No `.env`, defina `ADMIN_ID` e `ADMIN_PASSWORD` e reinicie: a conta é criada na primeira inicialização. Depois remova a senha do `.env`. Entre com ela e use a aba **Painel**.

### Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor (`:3000`, com reload) + Vite (`:5173`) juntos |
| `npm run build` | Gera o frontend em `dist/` |
| `npm start` | Servidor de produção: API **e** frontend em `:3000` |
| `npm test` | Testes do backend |
| `npm run lint` | ESLint |

## Como funciona

```
 Navegador (React + Vite)                 Servidor Node (sem frameworks)            Seu serviço facial
 ┌─────────────────────────┐   /api/*      ┌──────────────────────────────┐  HTTP   ┌──────────────────┐
 │ Login / Cadastro        │ ────────────▶ │ auth · sessões · rate limit   │ ──────▶ │ enroll / verify  │
 │ Câmera (getUserMedia)   │ ◀──────────── │ janelas de refeição           │ ◀────── │ (opcional)       │
 │ Painel admin            │   cookie      │ SQLite (node:sqlite)          │         └──────────────────┘
 └─────────────────────────┘               └──────────────────────────────┘
```

1. O aluno se cadastra e, no primeiro acesso, **cadastra o rosto** (com consentimento). O provedor devolve um *template* opaco que fica guardado no banco.
2. No refeitório, ele abre o app, liga a câmera e toca no botão: o servidor confere se há refeição aberta agora, se ele ainda não registrou hoje e se o rosto **confere** com o template.
3. Se tudo certo, a refeição é gravada. O admin acompanha pelo painel.

Detalhes em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Adaptando para a sua instituição

Quase tudo se resolve por configuração (`.env`, veja [`.env.example`](.env.example)):

| Variável | Para quê | Padrão |
| --- | --- | --- |
| `MEAL_TYPES` | Refeições e horários (JSON) | Almoço 11:00–14:00 |
| `APP_TIMEZONE` | Fuso para "hoje" e janelas | `America/Fortaleza` |
| `ID_PATTERN` | Regex da matrícula (ex.: SUAP: `^\d{14}$`) | `^[A-Za-z0-9._-]{3,32}$` |
| `REGISTRATION_CODE` | Exige código de convite para cadastrar | desligado |
| `REGISTRATION_OPEN` | Fecha o cadastro público | `true` |
| `FACE_PROVIDER` | `mock` ou `http` | `mock` |
| `VITE_APP_NAME`, `VITE_ID_LABEL` | Nome do app e da matrícula (SUAP, RA…) na interface | AppLunch / Matrícula |

Textos da interface ficam em [`src/strings.js`](src/strings.js); as cores, em variáveis CSS no topo de [`src/index.css`](src/index.css).

Exemplo com café e almoço:

```bash
MEAL_TYPES='[{"id":"breakfast","label":"Café da manhã","start":"07:00","end":"08:30"},{"id":"lunch","label":"Almoço","start":"11:00","end":"14:00"}]'
```

## Estrutura do projeto

```
applunch/
├── server/                 # Backend (Node puro, sem dependências npm)
│   ├── index.js            #   entrada: carrega .env, abre o banco, sobe o HTTP
│   ├── app.js              #   rotas da API + servidor do frontend
│   ├── config.js           #   leitura/validação das variáveis de ambiente
│   ├── db.js               #   SQLite + migrações
│   ├── auth.js             #   hash de senha (scrypt) e tokens
│   ├── meals.js            #   janelas de refeição e fuso horário
│   ├── recognition/        #   provedores de reconhecimento facial (mock, http)
│   └── test/               #   testes (node:test)
├── src/                    # Frontend React
│   ├── App/                #   estado da sessão e navegação
│   ├── components/         #   AuthPage, ScanScreen, ScanButton, AdminPanel, Header
│   ├── hooks/useCamera.js  #   câmera do navegador
│   ├── api/client.js       #   cliente da API
│   └── strings.js          #   textos da interface (traduza/adapte aqui)
├── docs/                   # Arquitetura, reconhecimento facial, privacidade, deploy
├── scripts/dev.js          # roda servidor + Vite juntos
├── Dockerfile · docker-compose.yml
└── .github/workflows/ci.yml
```

## API

Todas as rotas aceitam/retornam JSON; escritas exigem `Content-Type: application/json`. Erros vêm como `{ "error": "codigo" }`.

| Método e rota | Acesso | Descrição |
| --- | --- | --- |
| `GET /api/health` | público | Verificação de saúde |
| `GET /api/config` | público | Se o cadastro está aberto / exige convite |
| `POST /api/auth/register` | público | Cria conta e inicia sessão |
| `POST /api/auth/login` · `POST /api/auth/logout` | público / sessão | Entrar / sair |
| `GET /api/me` | aluno | Usuário, rosto cadastrado?, refeições de hoje |
| `POST /api/face/enroll` | aluno | Cadastra o rosto (`image`, `consent: true`) |
| `DELETE /api/face` | aluno | Apaga o próprio rosto (exige `password`) |
| `POST /api/meals/checkin` | aluno | Registra a refeição atual (`image`) |
| `GET /api/admin/meals?date=YYYY-MM-DD` | admin | Registros e totais do dia |
| `DELETE /api/admin/users/:id/face` | admin | Remove o rosto de um aluno |

## Antes de usar com alunos reais

Este projeto trata **dados biométricos**, que a LGPD classifica como dado pessoal **sensível**, e provavelmente de **menores de idade**. Leia [docs/PRIVACY.md](docs/PRIVACY.md) e [SECURITY.md](SECURITY.md). Em resumo:

- O provedor `mock` **não verifica nada** (o servidor se recusa a iniciar com ele em produção).
- **Não há detecção de "prova de vida"** (liveness): uma foto impressa ou na tela pode enganar a maioria dos modelos. Avalie esse risco ou adicione liveness no seu provedor.
- Ainda **não há recuperação de senha** (o e-mail é coletado, mas não usado), nem autenticação em dois fatores.
- O limite de tentativas é em memória (uma instância). O banco usa `node:sqlite`, ainda marcado como experimental no Node 22.
- Faça seu próprio levantamento jurídico (base legal, consentimento dos responsáveis, retenção, ROPA/RIPD) antes de colocar em produção.

## Roadmap / ideias de contribuição

- [ ] Recuperação de senha por e-mail
- [ ] Provedor de reconhecimento facial de referência (ex.: serviço Python + DeepFace) em `examples/`
- [ ] Detecção de prova de vida
- [ ] Exportação CSV dos registros e relatórios por período
- [ ] Importação em lote de alunos (CSV) / integração com sistema acadêmico
- [ ] Outros idiomas na interface
- [ ] Testes de componentes do frontend

Veja [CONTRIBUTING.md](CONTRIBUTING.md). Contribuições são bem-vindas!

## Licença

[MIT](LICENSE).
