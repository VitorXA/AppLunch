import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { loadConfig, parseMeals } from '../config.js';
import { localTime } from '../meals.js';
import { createRecognizer } from '../recognition/index.js';
import { createHttpProvider } from '../recognition/http.js';
import { IMAGE, startTestServer } from './helpers.js';

describe('config', () => {
  test('MEAL_TYPES inválido é rejeitado com mensagem clara', () => {
    assert.throws(() => parseMeals('{'), /JSON/);
    assert.throws(() => parseMeals('[]'), /ao menos uma/);
    assert.throws(() => parseMeals('[{"id":"A b","label":"x","start":"11:00","end":"12:00"}]'), /id/);
    assert.throws(() => parseMeals('[{"id":"a","label":"x","start":"12:00","end":"11:00"}]'), /antes de/);
    assert.throws(() => parseMeals('[{"id":"a","label":"x","start":"1100","end":"1200"}]'), /HH:MM/);
  });

  test('fuso horário inválido é rejeitado', () => {
    assert.throws(() => loadConfig({ APP_TIMEZONE: 'Marte/Olympus' }), /APP_TIMEZONE/);
  });

  test('localTime respeita o fuso (meia-noite UTC ainda é "ontem" em Fortaleza)', () => {
    const t = localTime(new Date('2026-11-05T01:30:00Z'), 'America/Fortaleza');
    assert.equal(t.date, '2026-11-04');
    assert.equal(t.minutes, 22 * 60 + 30);
  });
});

describe('provedor de reconhecimento', () => {
  test('mock é recusado em produção, salvo autorização explícita', () => {
    const base = { FACE_PROVIDER: 'mock', NODE_ENV: 'production' };
    assert.throws(() => createRecognizer(loadConfig(base)), /não é permitido em produção/);
    assert.equal(createRecognizer(loadConfig({ ...base, ALLOW_MOCK_FACE_IN_PRODUCTION: 'true' })).name, 'mock');
    assert.equal(createRecognizer(loadConfig({ FACE_PROVIDER: 'mock' })).name, 'mock');
  });

  test('provedor desconhecido dá erro útil', () => {
    assert.throws(() => createRecognizer(loadConfig({ FACE_PROVIDER: 'xyz' })), /desconhecido/);
  });

  test('provedor http segue o contrato (enroll, verify, sem rosto, serviço fora do ar)', async () => {
    const seen = [];
    const service = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const body = JSON.parse(raw);
        seen.push({ url: req.url, auth: req.headers.authorization, body });
        res.setHeader('Content-Type', 'application/json');
        if (body.image === Buffer.from('noface').toString('base64')) {
          res.statusCode = 422;
          return res.end('{"error":"no_face"}');
        }
        if (req.url === '/enroll') return res.end('{"template":"embedding-abc"}');
        if (req.url === '/verify') return res.end(JSON.stringify({ match: body.template === 'embedding-abc', score: 0.88 }));
        res.statusCode = 404;
        res.end('{}');
      });
    });
    await new Promise((r) => service.listen(0, '127.0.0.1', r));
    const serviceUrl = `http://127.0.0.1:${service.address().port}/`;
    try {
      const provider = createHttpProvider({ serviceUrl, serviceToken: 's3cr3t' });
      const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

      assert.deepEqual(await provider.enroll({ image, mime: 'image/jpeg' }), { template: 'embedding-abc' });
      assert.deepEqual(await provider.verify({ image, mime: 'image/jpeg', template: 'embedding-abc' }), { match: true, score: 0.88 });
      assert.equal((await provider.verify({ image, mime: 'image/jpeg', template: 'outro' })).match, false);
      assert.equal(seen[0].auth, 'Bearer s3cr3t');
      assert.equal(seen[0].body.mime, 'image/jpeg');

      await assert.rejects(provider.enroll({ image: Buffer.from('noface'), mime: 'image/jpeg' }), { code: 'no_face_detected', status: 422 });
    } finally {
      await new Promise((r) => service.close(r));
    }
    await assert.rejects(
      createHttpProvider({ serviceUrl, timeoutMs: 500 }).enroll({ image: Buffer.from([1]), mime: 'image/jpeg' }),
      { code: 'recognition_unavailable', status: 503 },
    );
  });

  test('erro do provedor vira resposta HTTP, não 500', async () => {
    const recognizer = {
      name: 'quebrado',
      enroll: async () => {
        const { RecognitionError } = await import('../errors.js');
        throw new RecognitionError('no_face_detected', 422);
      },
    };
    const t = await startTestServer({ recognizer });
    try {
      const api = t.client();
      await api('POST', '/api/auth/register', { identifier: 'aluno1', password: 'senha-segura-123', name: 'Aluno' });
      const res = await api('POST', '/api/face/enroll', { image: IMAGE, consent: true });
      assert.equal(res.status, 422);
      assert.equal(res.data.error, 'no_face_detected');
    } finally {
      await t.close();
    }
  });
});

describe('arquivos estáticos', () => {
  test('serve o build, faz fallback de SPA e bloqueia path traversal', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'applunch-static-'));
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>x</title>');
    writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log(1)');
    writeFileSync(path.join(path.dirname(dir), 'segredo.txt'), 'nao vaze');
    const t = await startTestServer({ config: { staticDir: dir } });
    try {
      const get = async (p) => fetch(t.baseUrl + p);
      const index = await get('/');
      assert.equal(index.status, 200);
      assert.match(index.headers.get('content-type'), /text\/html/);
      assert.equal(index.headers.get('x-content-type-options'), 'nosniff');

      const js = await get('/assets/app.js');
      assert.match(js.headers.get('content-type'), /javascript/);
      assert.match(js.headers.get('cache-control'), /immutable/);

      assert.equal((await get('/alguma/rota/do/front')).status, 200); // fallback SPA
      assert.equal((await get('/assets/nao-existe.js')).status, 404);

      // fetch normaliza "../", então usamos uma requisição crua.
      const raw = await new Promise((resolve) => {
        const req = http.request({ host: '127.0.0.1', port: new URL(t.baseUrl).port, path: '/..%2fsegredo.txt', method: 'GET' }, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.end();
      });
      assert.ok(!raw.body.includes('nao vaze'));
    } finally {
      await t.close();
    }
  });

  test('payload gigante é recusado', async () => {
    const t = await startTestServer();
    try {
      const res = await t.client()('POST', '/api/auth/login', { identifier: 'x'.repeat(5_000_000), password: 'y' });
      assert.equal(res.status, 413);
    } finally {
      await t.close();
    }
  });
});
