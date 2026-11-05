import { createHttpProvider } from './http.js';
import { createMockProvider } from './mock.js';

// Contrato de um provedor (veja docs/FACE-RECOGNITION.md):
//   name: string
//   enroll({ image: Buffer, mime }) -> { template: string }
//   verify({ image: Buffer, mime, template }) -> { match: boolean, score: number | null }
// Para sinalizar falhas, lance RecognitionError(code, status) de ../errors.js.
//
// Para adicionar um provedor próprio, crie um arquivo nesta pasta e registre-o abaixo.
const PROVIDERS = {
  mock: () => createMockProvider(),
  http: (face) => createHttpProvider(face),
};

export function createRecognizer(config) {
  const { face, isProduction } = config;
  const factory = PROVIDERS[face.provider];
  if (!factory) {
    throw new Error(`FACE_PROVIDER desconhecido: "${face.provider}". Opções: ${Object.keys(PROVIDERS).join(', ')}.`);
  }
  if (face.provider === 'mock' && isProduction && !face.allowMockInProduction) {
    throw new Error(
      'FACE_PROVIDER=mock não é permitido em produção: ele aceita qualquer pessoa. ' +
        'Configure um provedor real (FACE_PROVIDER=http) ou defina ALLOW_MOCK_FACE_IN_PRODUCTION=true se souber o que está fazendo.',
    );
  }
  return factory(face);
}
