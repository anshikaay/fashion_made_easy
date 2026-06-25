# Wardrobe API

REST backend for the digital closet app. Node.js + Express + PostgreSQL.

## Quick Start

```bash
npm install
cp .env.example .env   # fill in your values
npm run db:migrate     # creates all tables
npm run dev            # http://localhost:3001
```

---

## Deploy to Railway

1. Push this folder to a GitHub repo
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add a **PostgreSQL** plugin — Railway auto-sets `DATABASE_URL`
4. Add env vars in the Railway dashboard:
   - `JWT_SECRET` — generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
   - `JWT_EXPIRES_IN=7d`
   - `NODE_ENV=production`
   - `ALLOWED_ORIGIN=https://your-frontend-url`
5. Railway runs `npm run db:migrate && npm start` on every deploy (see `railway.toml`)

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret for signing JWTs (min 32 chars) |
| `JWT_EXPIRES_IN` | — | Token expiry, default `7d` |
| `PORT` | — | Server port, default `3001` |
| `NODE_ENV` | — | `development` or `production` |
| `ALLOWED_ORIGIN` | — | CORS origin, default `*` |

---

## API Reference

Base URL: `https://your-app.railway.app`

All 🔒 routes require: `Authorization: Bearer <token>`

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account → returns `{ token, user }` |
| POST | `/auth/login` | Login → returns `{ token, user }` |
| GET | `/auth/me` 🔒 | Get current user |
| PATCH | `/auth/me` 🔒 | Update name or password |

**Register / Login body:**
```json
{ "email": "you@example.com", "name": "Ada", "password": "min8chars" }
```

### Clothes

| Method | Path | Description |
|---|---|---|
| GET | `/clothes` 🔒 | List all items (`?category=tops` to filter) |
| POST | `/clothes` 🔒 | Add item `{ name, category, image_data }` |
| GET | `/clothes/:id` 🔒 | Get single item |
| PATCH | `/clothes/:id` 🔒 | Update `{ name?, category? }` |
| DELETE | `/clothes/:id` 🔒 | Delete item |

Valid categories: `tops` `bottoms` `outerwear` `shoes` `accessories` `dresses`

### Outfits

| Method | Path | Description |
|---|---|---|
| GET | `/outfits` 🔒 | List saved outfits (includes full clothing data) |
| POST | `/outfits` 🔒 | Save outfit `{ clothing_ids: [uuid,...], weather_tag? }` |
| GET | `/outfits/:id` 🔒 | Get single outfit |
| DELETE | `/outfits/:id` 🔒 | Delete outfit |

### Health

`GET /health` — no auth, returns `{ status: "ok" }`

---

## Database Schema

```
users         id · email · name · password · created_at · updated_at
clothes       id · user_id · name · category · image_data · created_at
outfits       id · user_id · weather_tag · created_at
outfit_items  outfit_id · clothing_id   ← junction table
```

All `user_id` FKs cascade on delete — removing a user wipes all their data.

---

## Connecting the Frontend

```js
const API_BASE = 'https://your-app.railway.app';
const token    = localStorage.getItem('wdc_token');
const headers  = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

// Register
const { token, user } = await fetch(`${API_BASE}/auth/register`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, name, password })
}).then(r => r.json());
localStorage.setItem('wdc_token', token);

// Add clothing
await fetch(`${API_BASE}/clothes`, {
  method: 'POST', headers,
  body: JSON.stringify({ name, category, image_data })
});

// Save outfit
await fetch(`${API_BASE}/outfits`, {
  method: 'POST', headers,
  body: JSON.stringify({ clothing_ids: ['uuid1', 'uuid2'], weather_tag: '☀️ 38°C' })
});
```
