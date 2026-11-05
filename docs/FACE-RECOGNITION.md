# Reconhecimento facial

O AppLunch **não embute um modelo de reconhecimento facial**: ele define um contrato simples e deixa você escolher o motor. Isso mantém o template leve e permite trocar de tecnologia (ou rodar tudo dentro da sua infraestrutura, o que ajuda na conformidade com a LGPD).

## Como o servidor usa o provedor

| Momento | Chamada | O que acontece |
| --- | --- | --- |
| Cadastro do rosto | `enroll({ image, mime })` → `{ template }` | O `template` (texto opaco: um embedding, um ID…) é salvo em `face_templates`. |
| Registro da refeição | `verify({ image, mime, template })` → `{ match, score }` | Se `match` for `true`, a refeição é gravada (com o `score`). |

`image` é um `Buffer` já validado (JPEG ou PNG, até `MAX_IMAGE_BYTES`). O **limiar de decisão** (quão parecido é "parecido o bastante") é responsabilidade do provedor, que devolve `match`.

## Provedores incluídos

### `mock` (padrão em desenvolvimento)

Aceita qualquer imagem. Serve só para testar o fluxo. Com `NODE_ENV=production` o servidor **se recusa a iniciar** com ele (a menos que você defina `ALLOW_MOCK_FACE_IN_PRODUCTION=true`, o que não é recomendado).

### `http`

Chama um serviço HTTP seu. Configure:

```bash
FACE_PROVIDER=http
FACE_SERVICE_URL=http://face-service:8000
FACE_SERVICE_TOKEN=um-segredo-forte     # opcional; enviado como "Authorization: Bearer ..."
```

Contrato que o seu serviço precisa implementar (JSON, timeout de 10 s):

**`POST {FACE_SERVICE_URL}/enroll`**

```json
{ "image": "<base64 do JPEG/PNG>", "mime": "image/jpeg" }
```

- `200` → `{ "template": "<string>" }` — qualquer texto que permita verificar depois (embedding serializado, ID de coleção…)
- `422` → nenhum rosto detectado (vira o erro `no_face_detected` para o aluno)
- qualquer outro status ou falha de rede → o aluno vê `recognition_unavailable`

**`POST {FACE_SERVICE_URL}/verify`**

```json
{ "image": "<base64>", "mime": "image/jpeg", "template": "<o template salvo no enroll>" }
```

- `200` → `{ "match": true, "score": 0.91 }` (`score` é opcional e só informativo)
- `422` → nenhum rosto detectado
- demais casos como acima

Para testar o seu serviço isoladamente:

```bash
curl -X POST http://localhost:8000/enroll \
  -H 'Content-Type: application/json' \
  -d "{\"image\":\"$(base64 -w0 rosto.jpg)\",\"mime\":\"image/jpeg\"}"
```

> O repositório inclui um teste (`server/test/misc.test.js`) que sobe um serviço falso e valida exatamente esse contrato. Use-o como referência de implementação.

#### Opções para implementar o serviço

- **Python + [DeepFace](https://github.com/serengil/deepface) ou [InsightFace](https://github.com/deepinsight/insightface)**: gere o embedding no `/enroll`, devolva-o serializado como `template`, e no `/verify` compare por distância (cosseno) com um limiar calibrado.
- **Serviço em nuvem** (AWS Rekognition, Azure Face…): o `template` pode ser o ID da face na coleção. Atenção a custos, contratos de tratamento de dados e transferência internacional.
- **Rodando no navegador** (face-api.js, MediaPipe) é possível, mas **não recomendado** para este caso: o cliente é controlado pelo aluno, então a verificação poderia ser burlada.

## Escrevendo um provedor nativo

Crie `server/recognition/meu-provedor.js` exportando uma função que devolve `{ name, enroll, verify }` e registre-a em `server/recognition/index.js`:

```js
const PROVIDERS = {
  mock: () => createMockProvider(),
  http: (face) => createHttpProvider(face),
  meu: (face) => createMeuProvedor(face),   // ← FACE_PROVIDER=meu
};
```

Para sinalizar falhas controladas, lance `new RecognitionError('no_face_detected', 422)` (de `server/errors.js`); o servidor converte em resposta HTTP com o código correspondente. Erros inesperados viram `500`.

## Limitações que você precisa conhecer

- **Prova de vida (liveness)**: o template de contrato não inclui detecção de vivacidade. Uma foto impressa ou na tela de celular pode enganar muitos modelos. Se isso importa para você, implemente liveness no seu serviço (ex.: desafio de piscar/virar o rosto, ou modelos anti-spoofing).
- **Qualidade e viés**: a acurácia varia com iluminação, câmera e características do rosto. Teste com o seu público e tenha um **procedimento alternativo** (ex.: validação manual pelo admin) para quem não for reconhecido.
- **Limite de tentativas**: o servidor limita check-ins a 10 por 5 minutos por usuário para dificultar tentativas repetidas.
