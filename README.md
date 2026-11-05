# AppLunch ðŸ½ï¸

> Template open source para **controle de refeiÃ§Ãµes em escolas, institutos e universidades**: o aluno faz login com a matrÃ­cula, confirma a identidade por **reconhecimento facial** e registra o almoÃ§o (ou cafÃ©, jantarâ€¦) uma Ãºnica vez por dia, dentro do horÃ¡rio.

[![CI](https://github.com/VitorXA/applunch/actions/workflows/ci.yml/badge.svg)](https://github.com/VitorXA/applunch/actions/workflows/ci.yml)
[![LicenÃ§a: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-green.svg)](LICENSE)
![Node >= 22.13](https://img.shields.io/badge/node-%3E%3D22.13-339933)

ðŸ‡¬ðŸ‡§ [English summary](README.en.md)

## Por que existe

Controlar quem jÃ¡ almoÃ§ou (e evitar que um aluno registre pelo outro) normalmente Ã© feito em papel, planilha ou com leitores caros. O AppLunch Ã© um ponto de partida **simples, auditÃ¡vel e sem dependÃªncias pesadas** para instituiÃ§Ãµes que querem montar o prÃ³prio sistema, e foi pensado para ser adaptado: outro nome para a matrÃ­cula (SUAP, RAâ€¦), outras refeiÃ§Ãµes, outro serviÃ§o de reconhecimento facial.

## O que jÃ¡ vem pronto

- ðŸ” **Cadastro e login** por matrÃ­cula + senha (hash `scrypt`, sessÃ£o em cookie `HttpOnly`, limite de tentativas)
- ðŸ“· **Leitura facial pela cÃ¢mera do navegador**, com cadastro do rosto e **consentimento explÃ­cito**
- ðŸ”Œ **Reconhecimento facial plugÃ¡vel**: provedor `mock` (desenvolvimento) e provedor `http` (conecte ao seu serviÃ§o: DeepFace, InsightFace, Rekognitionâ€¦)
- ðŸ•’ **Janelas de refeiÃ§Ã£o configurÃ¡veis** (cafÃ©, almoÃ§o, jantar), fuso horÃ¡rio e **uma refeiÃ§Ã£o por tipo por dia** garantida pelo banco
- ðŸ§‘â€ðŸ³ **Painel administrativo** com os registros do dia, totais por refeiÃ§Ã£o e filtro por data
- ðŸ—‘ï¸ **Direito de apagar o prÃ³prio rosto** (pelo aluno ou pelo admin)
- ðŸ§± **Backend sem dependÃªncias npm**: sÃ³ Node 22 (`node:http`, `node:sqlite`, `node:crypto`), sem compilar mÃ³dulos nativos
- âœ… Testes automatizados do backend, CI no GitHub Actions, Dockerfile

## InÃ­cio rÃ¡pido

Requisitos: **Node.js 22.13 ou superior**.

```bash
git clone https://github.com/VitorXA/applunch.git
cd applunch
npm install
cp .env.example .env     # ajuste se quiser; os padrÃµes funcionam para testar
npm run dev
```

Abra **http://localhost:5173**, crie uma conta e teste o fluxo (o navegador vai pedir permissÃ£o da cÃ¢mera; `localhost` funciona sem HTTPS).

> ðŸ•’ O registro de refeiÃ§Ã£o sÃ³ funciona dentro da janela configurada (padrÃ£o: almoÃ§o 11:00â€“14:00, fuso `America/Fortaleza`). Para testar fora desse horÃ¡rio, defina no `.env` uma janela que inclua o momento atual, por exemplo `MEAL_TYPES=[{"id":"lunch","label":"AlmoÃ§o","start":"00:00","end":"23:59"}]`.

> âš ï¸ Em desenvolvimento o reconhecimento facial roda em modo **`mock`**: qualquer imagem Ã© aceita como "o mesmo rosto". Ã‰ para testar o fluxo, **nÃ£o oferece seguranÃ§a alguma**. Para uso real, veja [reconhecimento facial](docs/FACE-RECOGNITION.md).

### Criar um administrador

No `.env`, defina `ADMIN_ID` e `ADMIN_PASSWORD` e reinicie: a conta Ã© criada na primeira inicializaÃ§Ã£o. Depois remova a senha do `.env`. Entre com ela e use a aba **Painel**.


### Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor (`:3000`, com reload) + Vite (`:5173`) juntos |
| `npm run build` | Gera o frontend em `dist/` |
| `npm start` | Servidor de produÃ§Ã£o: API **e** frontend em `:3000` |
| `npm test` | Testes do backend |
| `npm run lint` | ESLint |

## Como funciona

```
 Navegador (React + Vite)                 Servidor Node (sem frameworks)            Seu serviÃ§o facial
 â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   /api/*      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  HTTP   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
 â”‚ Login / Cadastro       â”‚ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶ â”‚ auth Â· sessÃµes Â· rate limit   â”‚ â”€â”€â”€â”€â”€â”€â–¶ â”‚ enroll / verify  â”‚
 â”‚ CÃ¢mera (getUserMedia)  â”‚ â—€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ â”‚ janelas de refeiÃ§Ã£o           â”‚ â—€â”€â”€â”€â”€â”€â”€ â”‚ (opcional)       â”‚
 â”‚ Painel admin           â”‚   cookie      â”‚ SQLite (node:sqlite)          â”‚         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
 â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜               â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

1. O aluno se cadastra e, no primeiro acesso, **cadastra o rosto** (com consentimento). O provedor devolve um *template* opaco que fica guardado no banco.
2. No refeitÃ³rio, ele abre o app, liga a cÃ¢mera e toca no botÃ£o: o servidor confere se hÃ¡ refeiÃ§Ã£o aberta agora, se ele ainda nÃ£o registrou hoje e se o rosto **confere** com o template.
3. Se tudo certo, a refeiÃ§Ã£o Ã© gravada. O admin acompanha pelo painel.

Detalhes em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Adaptando para a sua instituiÃ§Ã£o

Quase tudo se resolve por configuraÃ§Ã£o (`.env`, veja [`.env.example`](.env.example)):

| VariÃ¡vel | Para quÃª | PadrÃ£o |
| --- | --- | --- |
| `MEAL_TYPES` | RefeiÃ§Ãµes e horÃ¡rios (JSON) | AlmoÃ§o 11:00â€“14:00 |
| `APP_TIMEZONE` | Fuso para "hoje" e janelas | `America/Fortaleza` |
| `ID_PATTERN` | Regex da matrÃ­cula (ex.: SUAP: `^\d{14}$`) | `^[A-Za-z0-9._-]{3,32}$` |
| `REGISTRATION_CODE` | Exige cÃ³digo de convite para cadastrar | desligado |
| `REGISTRATION_OPEN` | Fecha o cadastro pÃºblico | `true` |
| `FACE_PROVIDER` | `mock` ou `http` | `mock` |
| `VITE_APP_NAME`, `VITE_ID_LABEL` | Nome do app e da matrÃ­cula (SUAP, RAâ€¦) na interface | AppLunch / MatrÃ­cula |

Textos da interface ficam em [`src/strings.js`](src/strings.js); as cores, em variÃ¡veis CSS no topo de [`src/index.css`](src/index.css).

Exemplo com cafÃ© e almoÃ§o:

```bash
MEAL_TYPES='[{"id":"breakfast","label":"CafÃ© da manhÃ£","start":"07:00","end":"08:30"},{"id":"lunch","label":"AlmoÃ§o","start":"11:00","end":"14:00"}]'
```

## Estrutura do projeto

```
applunch/
â”œâ”€â”€ server/                 # Backend (Node puro, sem dependÃªncias npm)
â”‚   â”œâ”€â”€ index.js            #   entrada: carrega .env, abre o banco, sobe o HTTP
â”‚   â”œâ”€â”€ app.js              #   rotas da API + servidor do frontend
â”‚   â”œâ”€â”€ config.js           #   leitura/validaÃ§Ã£o das variÃ¡veis de ambiente
â”‚   â”œâ”€â”€ db.js               #   SQLite + migraÃ§Ãµes
â”‚   â”œâ”€â”€ auth.js             #   hash de senha (scrypt) e tokens
â”‚   â”œâ”€â”€ meals.js            #   janelas de refeiÃ§Ã£o e fuso horÃ¡rio
â”‚   â”œâ”€â”€ recognition/        #   provedores de reconhecimento facial (mock, http)
â”‚   â””â”€â”€ test/               #   testes (node:test)
â”œâ”€â”€ src/                    # Frontend React
â”‚   â”œâ”€â”€ App/                #   estado da sessÃ£o e navegaÃ§Ã£o
â”‚   â”œâ”€â”€ components/         #   AuthPage, ScanScreen, ScanButton, AdminPanel, Header
â”‚   â”œâ”€â”€ hooks/useCamera.js  #   cÃ¢mera do navegador
â”‚   â”œâ”€â”€ api/client.js       #   cliente da API
â”‚   â””â”€â”€ strings.js          #   textos da interface (traduza/adapte aqui)
â”œâ”€â”€ docs/                   # Arquitetura, reconhecimento facial, privacidade, deploy
â”œâ”€â”€ scripts/dev.js          # roda servidor + Vite juntos
â”œâ”€â”€ Dockerfile Â· docker-compose.yml
â””â”€â”€ .github/workflows/ci.yml
```

## API

Todas as rotas aceitam/retornam JSON; escritas exigem `Content-Type: application/json`. Erros vÃªm como `{ "error": "codigo" }`.

| MÃ©todo e rota | Acesso | DescriÃ§Ã£o |
| --- | --- | --- |
| `GET /api/health` | pÃºblico | VerificaÃ§Ã£o de saÃºde |
| `GET /api/config` | pÃºblico | Se o cadastro estÃ¡ aberto / exige convite |
| `POST /api/auth/register` | pÃºblico | Cria conta e inicia sessÃ£o |
| `POST /api/auth/login` Â· `POST /api/auth/logout` | pÃºblico / sessÃ£o | Entrar / sair |
| `GET /api/me` | aluno | UsuÃ¡rio, rosto cadastrado?, refeiÃ§Ãµes de hoje |
| `POST /api/face/enroll` | aluno | Cadastra o rosto (`image`, `consent: true`) |
| `DELETE /api/face` | aluno | Apaga o prÃ³prio rosto (exige `password`) |
| `POST /api/meals/checkin` | aluno | Registra a refeiÃ§Ã£o atual (`image`) |
| `GET /api/admin/meals?date=YYYY-MM-DD` | admin | Registros e totais do dia |
| `DELETE /api/admin/users/:id/face` | admin | Remove o rosto de um aluno |

## âš ï¸ Antes de usar com alunos reais

Este projeto trata **dados biomÃ©tricos**, que a LGPD classifica como dado pessoal **sensÃ­vel**, e provavelmente de **menores de idade**. Leia [docs/PRIVACY.md](docs/PRIVACY.md) e [SECURITY.md](SECURITY.md). Em resumo:

- O provedor `mock` **nÃ£o verifica nada** (o servidor se recusa a iniciar com ele em produÃ§Ã£o).
- **NÃ£o hÃ¡ detecÃ§Ã£o de "prova de vida"** (liveness): uma foto impressa ou na tela pode enganar a maioria dos modelos. Avalie esse risco ou adicione liveness no seu provedor.
- Ainda **nÃ£o hÃ¡ recuperaÃ§Ã£o de senha** (o e-mail Ã© coletado, mas nÃ£o usado), nem autenticaÃ§Ã£o em dois fatores.
- O limite de tentativas Ã© em memÃ³ria (uma instÃ¢ncia). O banco usa `node:sqlite`, ainda marcado como experimental no Node 22.
- FaÃ§a seu prÃ³prio levantamento jurÃ­dico (base legal, consentimento dos responsÃ¡veis, retenÃ§Ã£o, ROPA/RIPD) antes de colocar em produÃ§Ã£o.

## Roadmap / ideias de contribuiÃ§Ã£o

- [ ] RecuperaÃ§Ã£o de senha por e-mail
- [ ] Provedor de reconhecimento facial de referÃªncia (ex.: serviÃ§o Python + DeepFace) em `examples/`
- [ ] DetecÃ§Ã£o de prova de vida
- [ ] ExportaÃ§Ã£o CSV dos registros e relatÃ³rios por perÃ­odo
- [ ] ImportaÃ§Ã£o em lote de alunos (CSV) / integraÃ§Ã£o com sistema acadÃªmico
- [ ] Outros idiomas na interface
- [ ] Testes de componentes do frontend

Veja [CONTRIBUTING.md](CONTRIBUTING.md). ContribuiÃ§Ãµes sÃ£o bem-vindas!

## LicenÃ§a

[MIT](LICENSE).
