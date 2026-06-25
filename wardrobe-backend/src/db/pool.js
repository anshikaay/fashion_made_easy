const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB client error:', err);
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌  DB connection failed:', err.message);
  } else {
    console.log('✅  PostgreSQL connected');
    release();
  }
});

module.exports = pool;
