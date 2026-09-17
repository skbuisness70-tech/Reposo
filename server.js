// server.js — the whole REST API for MelaMart.
// Run with: node server.js   (after `npm install` in this folder)

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-in-production';

app.use(cors());
app.use(express.json());

// ---------------- Helpers ----------------
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
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

// ================== AUTH ==================
app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name, email.toLowerCase(), hash);

  const user = { id: info.lastInsertRowid, name, email: email.toLowerCase() };
  res.status(201).json({ token: signToken(user), user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase());
  if (!row || !bcrypt.compareSync(password || '', row.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  const user = { id: row.id, name: row.name, email: row.email };
  res.json({ token: signToken(user), user });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// ================== PRODUCTS ==================
app.get('/api/products', (req, res) => {
  const { category, search } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (category && category !== 'All') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    sql += ' AND (LOWER(title) LIKE ? OR LOWER(category) LIKE ?)';
    const term = `%${search.toLowerCase()}%`;
    params.push(term, term);
  }
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

app.get('/api/products/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found' });
  res.json(row);
});

// ================== CART (requires login) ==================
app.get('/api/cart', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.product_id AS productId, c.qty, p.*
    FROM cart_items c JOIN products p ON p.id = c.product_id
    WHERE c.user_id = ?
  `).all(req.user.id);
  res.json(rows);
});

app.post('/api/cart', auth, (req, res) => {
  const { productId, qty = 1 } = req.body;
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  db.prepare(`
    INSERT INTO cart_items (user_id, product_id, qty) VALUES (?, ?, ?)
    ON CONFLICT(user_id, product_id) DO UPDATE SET qty = qty + excluded.qty
  `).run(req.user.id, productId, qty);

  res.status(201).json({ ok: true });
});

app.put('/api/cart/:productId', auth, (req, res) => {
  const { qty } = req.body;
  if (qty <= 0) {
    db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  } else {
    db.prepare('UPDATE cart_items SET qty = ? WHERE user_id = ? AND product_id = ?').run(qty, req.user.id, req.params.productId);
  }
  res.json({ ok: true });
});

app.delete('/api/cart/:productId', auth, (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  res.json({ ok: true });
});

// ================== ORDERS (requires login) ==================
app.post('/api/orders', auth, (req, res) => {
  const items = db.prepare(`
    SELECT c.product_id AS productId, c.qty, p.price
    FROM cart_items c JOIN products p ON p.id = c.product_id
    WHERE c.user_id = ?
  `).all(req.user.id);

  if (items.length === 0) return res.status(400).json({ error: 'Cart is empty' });

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  const placeOrder = db.transaction(() => {
    const orderInfo = db.prepare('INSERT INTO orders (user_id, total) VALUES (?, ?)').run(req.user.id, total);
    const orderId = orderInfo.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, qty, price_at_purchase) VALUES (?, ?, ?, ?)');
    for (const item of items) insertItem.run(orderId, item.productId, item.qty, item.price);
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
    return orderId;
  });

  const orderId = placeOrder();
  res.status(201).json({ orderId, total, status: 'placed' });
});

app.get('/api/orders', auth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const itemsStmt = db.prepare(`
    SELECT oi.*, p.title, p.emoji FROM order_items oi
    JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?
  `);
  const withItems = orders.map(o => ({ ...o, items: itemsStmt.all(o.id) }));
  res.json(withItems);
});

// ---------------- Health check ----------------
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`MelaMart API running at http://localhost:${PORT}`);
});
