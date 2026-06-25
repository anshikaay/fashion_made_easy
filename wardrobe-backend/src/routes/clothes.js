const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');

const VALID_CATEGORIES = ['tops', 'bottoms', 'outerwear', 'shoes', 'accessories', 'dresses'];

// All routes require auth
router.use(auth);

// ── GET /clothes ──────────────────────────────────────────────────────────────
// Query params: ?category=tops
router.get('/', async (req, res) => {
  const { category } = req.query;

  try {
    let query  = 'SELECT id, name, category, image_data, created_at FROM clothes WHERE user_id = $1';
    const vals = [req.userId];

    if (category) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
      }
      query += ' AND category = $2';
      vals.push(category);
    }

    query += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(query, vals);
    res.json({ clothes: rows, total: rows.length });
  } catch (err) {
    console.error('Get clothes error:', err);
    res.status(500).json({ error: 'Failed to fetch clothes' });
  }
});

// ── POST /clothes ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, category, image_data } = req.body;

  if (!name || !category || !image_data) {
    return res.status(400).json({ error: 'name, category, and image_data are required' });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }
  if (!image_data.startsWith('data:image/')) {
    return res.status(400).json({ error: 'image_data must be a base64 data URL (data:image/...)' });
  }

  // Rough size check — base64 image shouldn't exceed ~8MB
  if (image_data.length > 10_000_000) {
    return res.status(413).json({ error: 'Image too large. Please resize to under 6MB.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO clothes (user_id, name, category, image_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, category, image_data, created_at`,
      [req.userId, name.trim(), category, image_data]
    );
    res.status(201).json({ clothing: rows[0] });
  } catch (err) {
    console.error('Add clothing error:', err);
    res.status(500).json({ error: 'Failed to add clothing item' });
  }
});

// ── GET /clothes/:id ──────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, category, image_data, created_at FROM clothes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json({ clothing: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// ── PATCH /clothes/:id ────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const { name, category } = req.body;
  const updates = [];
  const values  = [];
  let   idx     = 1;

  if (name) { updates.push(`name = $${idx++}`); values.push(name.trim()); }
  if (category) {
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    updates.push(`category = $${idx++}`);
    values.push(category);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  values.push(req.params.id, req.userId);
  try {
    const { rows } = await pool.query(
      `UPDATE clothes SET ${updates.join(', ')}
       WHERE id = $${idx} AND user_id = $${idx + 1}
       RETURNING id, name, category, image_data, created_at`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json({ clothing: rows[0] });
  } catch (err) {
    console.error('Patch clothing error:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// ── DELETE /clothes/:id ───────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM clothes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error('Delete clothing error:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = router;
