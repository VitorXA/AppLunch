import { HttpError } from './errors.js';

// Aceita data URL ("data:image/jpeg;base64,...") ou base64 puro, valida o tipo
// pelos "magic bytes" (não confia no que o cliente declara) e limita o tamanho.
export function decodeImage(input, maxBytes) {
  if (typeof input !== 'string' || input.length === 0) throw new HttpError(422, 'invalid_image');
  const base64 = input.replace(/^data:image\/[a-z+.-]+;base64,/i, '');
  if (base64.length > Math.ceil((maxBytes * 4) / 3) + 8) throw new HttpError(413, 'image_too_large');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new HttpError(422, 'invalid_image');

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > maxBytes) throw new HttpError(413, 'image_too_large');

  let mime = null;
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) mime = 'image/jpeg';
  else if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) mime = 'image/png';
  if (!mime) throw new HttpError(422, 'invalid_image');

  return { buffer, mime };
}
