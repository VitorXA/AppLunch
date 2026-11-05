export class ApiError extends Error {
  constructor(status, code, data) {
    super(code);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'unknown', data);
  return data;
}

export const api = {
  config: () => request('GET', '/config'),
  me: () => request('GET', '/me'),
  login: (identifier, password) => request('POST', '/auth/login', { identifier, password }),
  register: (fields) => request('POST', '/auth/register', fields),
  logout: () => request('POST', '/auth/logout', {}),
  enrollFace: (image) => request('POST', '/face/enroll', { image, consent: true }),
  deleteFace: (password) => request('DELETE', '/face', { password }),
  checkin: (image) => request('POST', '/meals/checkin', { image }),
  adminMeals: (date) => request('GET', `/admin/meals${date ? `?date=${encodeURIComponent(date)}` : ''}`),
};
