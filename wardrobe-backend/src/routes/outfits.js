const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');

router.use(auth);

// ── GET /outfits ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         o.id,
         o.weather_tag,
         o.created_at,
         json_agg(
           json_build_object(
             'id',         c.id,
             'name',       c.name,
             'category',   c.category,
             'image_data', c.image_data
           ) ORDER BY c.category
         ) FILTER (WHERE c.id IS NOT NULL) AS items
       FROM outfits o
       LEFT JOIN outfit_items oi ON oi.outfit_id = o.id
       LEFT JOIN clothes      c  ON c.id = oi.clothing_id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.userId]
    );
    res.json({ outfits: rows, total: rows.length });
  } catch (err) {
    console.error('Get outfits error:', err);
    res.status(500).json({ error: 'Failed to fetch outfits' });
  }
});

// ── POST /outfits ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { clothing_ids, weather_tag } = req.body;

  if (!Array.isArray(clothing_ids) || clothing_ids.length === 0) {
    return res.status(400).json({ error: 'clothing_ids must be a non-empty array of UUIDs' });
  }
  if (clothing_ids.length > 10) {
    return res.status(400).json({ error: 'An outfit can have at most 10 items' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: owned } = await client.query(
      `SELECT id FROM clothes WHERE id = ANY($1::uuid[]) AND user_id = $2`,
      [clothing_ids, req.userId]
    );
    if (owned.length !== clothing_ids.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'One or more clothing IDs are invalid or do not belong to you' });
    }

    const { rows: outfitRows } = await client.query(
      `INSERT INTO outfits (user_id, weather_tag) VALUES ($1, $2) RETURNING id, weather_tag, created_at`,
      [req.userId, weather_tag || null]
    );
    const outfit = outfitRows[0];

    const itemValues = clothing_ids.map((_, i) => `($1, $${i + 2})`).join(', ');
    await client.query(
      `INSERT INTO outfit_items (outfit_id, clothing_id) VALUES ${itemValues}`,
      [outfit.id, ...clothing_ids]
    );

    await client.query('COMMIT');

    const { rows: full } = await pool.query(
      `SELECT
         o.id, o.weather_tag, o.created_at,
         json_agg(
           json_build_object(
             'id',         c.id,
             'name',       c.name,
             'category',   c.category,
             'image_data', c.image_data
           ) ORDER BY c.category
         ) AS items
       FROM outfits o
       JOIN outfit_items oi ON oi.outfit_id = o.id
       JOIN clothes      c  ON c.id = oi.clothing_id
       WHERE o.id = $1
       GROUP BY o.id`,
      [outfit.id]
    );

    res.status(201).json({ outfit: full[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Save outfit error:', err);
    res.status(500).json({ error: 'Failed to save outfit' });
  } finally {
    client.release();
  }
});

// ── GET /outfits/:id ──────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         o.id, o.weather_tag, o.created_at,
         json_agg(
           json_build_object(
             'id',         c.id,
             'name',       c.name,
             'category',   c.category,
             'image_data', c.image_data
           ) ORDER BY c.category
         ) FILTER (WHERE c.id IS NOT NULL) AS items
       FROM outfits o
       LEFT JOIN outfit_items oi ON oi.outfit_id = o.id
       LEFT JOIN clothes      c  ON c.id = oi.clothing_id
       WHERE o.id = $1 AND o.user_id = $2
       GROUP BY o.id`,
      [req.params.id, req.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Outfit not found' });
    res.json({ outfit: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch outfit' });
  }
});

// ── DELETE /outfits/:id ───────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM outfits WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Outfit not found' });
    res.json({ message: 'Outfit deleted' });
  } catch (err) {
    console.error('Delete outfit error:', err);
    res.status(500).json({ error: 'Failed to delete outfit' });
  }
});

module.exports = router;
