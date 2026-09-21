// server.js — Reposo REST API, now backed by PostgreSQL.
// Run with: node server.js   (needs DATABASE_URL env var set — see README)

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-in-production';

app.use(cors());
app.use(express.json());

// ---------------- Helpers ----------------
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

// wraps async route handlers so thrown errors reach Express instead of crashing the process
function wrap(fn) {
  return (req, res) => fn(req, res).catch(err => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  });
}

// ================== AUTH ==================
app.post('/api/auth/signup', wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) return res.status(409).json({ error: 'An account with this email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const inserted = await pool.query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) RETURNING id, name, email, role',
    [name, email.toLowerCase(), hash]
  );
  const user = inserted.rows[0];
  res.status(201).json({ token: signToken(user), user });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [(email || '').toLowerCase()]);
  const row = result.rows[0];
  if (!row || !bcrypt.compareSync(password || '', row.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  res.json({ token: signToken(user), user });
}));

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// ================== PRODUCTS ==================
app.get('/api/products', wrap(async (req, res) => {
  const { category, search } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (category && category !== 'All') {
    params.push(category);
    sql += ` AND category = $${params.length}`;
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    sql += ` AND (LOWER(title) LIKE $${params.length} OR LOWER(category) LIKE $${params.length})`;
  }
  const result = await pool.query(sql, params);
  res.json(result.rows);
}));

app.get('/api/products/:id', wrap(async (req, res) => {
  const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.json(result.rows[0]);
}));

// ================== CART (requires login) ==================
app.get('/api/cart', auth, wrap(async (req, res) => {
  const result = await pool.query(`
    SELECT c.product_id AS "productId", c.qty, p.*
    FROM cart_items c JOIN products p ON p.id = c.product_id
    WHERE c.user_id = $1
  `, [req.user.id]);
  res.json(result.rows);
}));

app.post('/api/cart', auth, wrap(async (req, res) => {
  const { productId, qty = 1 } = req.body;
  const product = await pool.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (!product.rows[0]) return res.status(404).json({ error: 'Product not found' });

  await pool.query(`
    INSERT INTO cart_items (user_id, product_id, qty) VALUES ($1,$2,$3)
    ON CONFLICT (user_id, product_id) DO UPDATE SET qty = cart_items.qty + EXCLUDED.qty
  `, [req.user.id, productId, qty]);

  res.status(201).json({ ok: true });
}));

app.put('/api/cart/:productId', auth, wrap(async (req, res) => {
  const { qty } = req.body;
  if (qty <= 0) {
    await pool.query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2', [req.user.id, req.params.productId]);
  } else {
    await pool.query('UPDATE cart_items SET qty = $1 WHERE user_id = $2 AND product_id = $3', [qty, req.user.id, req.params.productId]);
  }
  res.json({ ok: true });
}));

app.delete('/api/cart/:productId', auth, wrap(async (req, res) => {
  await pool.query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2', [req.user.id, req.params.productId]);
  res.json({ ok: true });
}));

// ================== ORDERS (requires login) ==================
app.post('/api/orders', auth, wrap(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const itemsResult = await client.query(`
      SELECT c.product_id AS "productId", c.qty, p.price
      FROM cart_items c JOIN products p ON p.id = c.product_id
      WHERE c.user_id = $1
    `, [req.user.id]);
    const items = itemsResult.rows;

    if (items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    const orderResult = await client.query(
      'INSERT INTO orders (user_id, total) VALUES ($1,$2) RETURNING id',
      [req.user.id, total]
    );
    const orderId = orderResult.rows[0].id;

    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, qty, price_at_purchase) VALUES ($1,$2,$3,$4)',
        [orderId, item.productId, item.qty, item.price]
      );
    }
    await client.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);

    await client.query('COMMIT');
    res.status(201).json({ orderId, total, status: 'placed' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

app.get('/api/orders', auth, wrap(async (req, res) => {
  const ordersResult = await pool.query(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  const orders = ordersResult.rows;

  const withItems = [];
  for (const o of orders) {
    const itemsResult = await pool.query(`
      SELECT oi.*, p.title, p.emoji FROM order_items oi
      JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1
    `, [o.id]);
    withItems.push({ ...o, items: itemsResult.rows });
  }
  res.json(withItems);
}));

// ---------------- Health check ----------------
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ---------------- Start ----------------
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Reposo API running at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to set up database:', err);
    process.exit(1);
  });
