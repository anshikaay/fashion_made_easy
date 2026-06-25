require('dotenv').config();
const pool = require('./pool');

const SQL = `
-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  password    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Clothes ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clothes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('tops','bottoms','outerwear','shoes','accessories','dresses')),
  image_data  TEXT NOT NULL,   -- base64 data URL
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clothes_user_id ON clothes(user_id);
CREATE INDEX IF NOT EXISTS idx_clothes_category ON clothes(user_id, category);

-- ── Saved Outfits ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outfits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weather_tag  TEXT,            -- e.g. "☀️ 38°C · Clear sky"
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outfits_user_id ON outfits(user_id);

-- ── Outfit ↔ Clothes join ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outfit_items (
  outfit_id   UUID NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  clothing_id UUID NOT NULL REFERENCES clothes(id) ON DELETE CASCADE,
  PRIMARY KEY (outfit_id, clothing_id)
);

-- ── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
`;

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(SQL);
    console.log('✅  Migration complete — all tables ready');
  } catch (err) {
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
