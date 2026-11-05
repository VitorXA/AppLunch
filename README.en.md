# AppLunch 🍽️ (English summary)

Open source template for **school / university meal control**: students sign in with their ID number, confirm their identity with **face recognition**, and check in for a meal once per day within a configurable time window. Includes an admin dashboard.

The main documentation is in Portuguese ([README.md](README.md)); this is a short guide.

## Features

- Sign-up / login with ID number + password (`scrypt` hashing, `HttpOnly` session cookie, login rate limiting)
- Browser camera capture, face enrollment with explicit consent, right to delete your own face data
- **Pluggable face recognition**: `mock` (development only) and `http` (connect your own service: DeepFace, InsightFace, Rekognition…) — see [docs/FACE-RECOGNITION.md](docs/FACE-RECOGNITION.md)
- Configurable meal windows and timezone; one check-in per meal per day enforced by the database
- Admin dashboard (daily entries, totals, date filter)
- Dependency-free backend: only Node ≥ 22.13 built-ins (`node:http`, `node:sqlite`, `node:crypto`)
- Automated backend tests, GitHub Actions CI, Dockerfile

## Quick start

```bash
npm install
cp .env.example .env
npm run dev          # API on :3000, UI on http://localhost:5173
```

Set `ADMIN_ID` / `ADMIN_PASSWORD` in `.env` to create an admin account on first start. Configuration reference: [`.env.example`](.env.example). UI text lives in [`src/strings.js`](src/strings.js) (Portuguese by default, easy to translate).

## Read before using with real students

This handles **biometric data** (sensitive personal data under Brazil's LGPD and similar laws such as GDPR) of what are likely minors. The `mock` provider verifies nothing, there is **no liveness detection**, and there is no password recovery yet. See [docs/PRIVACY.md](docs/PRIVACY.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
