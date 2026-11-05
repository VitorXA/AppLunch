import { RecognitionError } from '../errors.js';

// Provedor genérico: delega o reconhecimento a um serviço HTTP seu (ex.: um
// microserviço Python com DeepFace/InsightFace, ou um wrapper de AWS Rekognition).
// O contrato está documentado em docs/FACE-RECOGNITION.md.
export function createHttpProvider({ serviceUrl, serviceToken, timeoutMs = 10_000 }) {
  if (!serviceUrl) throw new Error('FACE_SERVICE_URL é obrigatório quando FACE_PROVIDER=http.');
  const base = serviceUrl.replace(/\/+$/, '');

  async function call(endpoint, payload) {
    let res;
    try {
      res = await fetch(`${base}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(serviceToken ? { Authorization: `Bearer ${serviceToken}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new RecognitionError('recognition_unavailable', 503);
    }
    if (res.status === 422) throw new RecognitionError('no_face_detected', 422);
    if (!res.ok) throw new RecognitionError('recognition_unavailable', 503);
    try {
      return await res.json();
    } catch {
      throw new RecognitionError('recognition_unavailable', 503);
    }
  }

  const toPayload = ({ image, mime }) => ({ image: image.toString('base64'), mime });

  return {
    name: 'http',
    async enroll({ image, mime }) {
      const data = await call('enroll', toPayload({ image, mime }));
      if (typeof data?.template !== 'string' || !data.template) {
        throw new RecognitionError('recognition_unavailable', 503);
      }
      return { template: data.template };
    },
    async verify({ image, mime, template }) {
      const data = await call('verify', { ...toPayload({ image, mime }), template });
      if (typeof data?.match !== 'boolean') throw new RecognitionError('recognition_unavailable', 503);
      return { match: data.match, score: typeof data.score === 'number' ? data.score : null };
    },
  };
}
