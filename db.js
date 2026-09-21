// db.js — PostgreSQL connection + schema + seed data.
// Free tier database: neon.tech (recommended) or supabase.com both work,
// as long as you set the DATABASE_URL environment variable to the connection string they give you.

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required by most free Postgres hosts (Neon, Supabase, Render)
});

async function initDb() {
  // ---------- Schema ----------
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'buyer',   -- 'buyer' or 'seller' — used from Phase 2 onward
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER REFERENCES users(id),  -- NULL for now, filled in once sellers exist (Phase 2)
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      mrp INTEGER NOT NULL,
      emoji TEXT,
      rating REAL,
      reviews INTEGER,
      badge TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      qty INTEGER NOT NULL DEFAULT 1,
      UNIQUE(user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      total INTEGER NOT NULL,
      status TEXT DEFAULT 'placed',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      qty INTEGER NOT NULL,
      price_at_purchase INTEGER NOT NULL
    );
  `);

  // ---------- Seed products (only if table is empty) ----------
  const { rows } = await pool.query('SELECT COUNT(*) AS c FROM products');
  if (parseInt(rows[0].c, 10) === 0) {
    const products = [
      { title: "Wireless Over-Ear Headphones", category: "Electronics", price: 1799, mrp: 3499, emoji: "🎧", rating: 4.3, reviews: 2140, badge: "48% OFF", description: "40-hour battery life, active noise cancellation, and a foldable design that fits any bag." },
      { title: "Smart Fitness Band", category: "Electronics", price: 1299, mrp: 2199, emoji: "⌚", rating: 4.1, reviews: 980, badge: null, description: "Tracks heart rate, sleep and steps. 10-day battery, water resistant up to 50m." },
      { title: "Cotton Oversized Tee", category: "Fashion", price: 499, mrp: 999, emoji: "👕", rating: 4.4, reviews: 610, badge: "50% OFF", description: "100% breathable cotton, relaxed fit, pre-shrunk fabric. Available in 6 colours." },
      { title: "Running Shoes", category: "Sports", price: 2199, mrp: 3999, emoji: "👟", rating: 4.5, reviews: 3200, badge: null, description: "Lightweight mesh upper with responsive cushioning for daily runs and everyday wear." },
      { title: "Ceramic Coffee Mug Set", category: "Home", price: 599, mrp: 899, emoji: "☕", rating: 4.6, reviews: 410, badge: null, description: "Set of 2 hand-glazed mugs, microwave and dishwasher safe, 300ml capacity." },
      { title: "Matte Lipstick Trio", category: "Beauty", price: 749, mrp: 1299, emoji: "💄", rating: 4.2, reviews: 890, badge: "42% OFF", description: "Long-wearing, transfer-proof formula in three everyday shades." },
      { title: "Bestselling Fiction Novel", category: "Books", price: 299, mrp: 499, emoji: "📖", rating: 4.7, reviews: 5600, badge: null, description: "A gripping page-turner that topped charts for 12 straight weeks." },
      { title: "Mechanical Keyboard", category: "Electronics", price: 2999, mrp: 4499, emoji: "⌨️", rating: 4.4, reviews: 1250, badge: null, description: "Hot-swappable switches, per-key RGB, and a compact 75% layout." },
      { title: "Denim Jacket", category: "Fashion", price: 1599, mrp: 2799, emoji: "🧥", rating: 4.0, reviews: 340, badge: "43% OFF", description: "Classic washed denim with a relaxed cut, built to soften with every wear." },
      { title: "Yoga Mat Pro", category: "Sports", price: 899, mrp: 1499, emoji: "🧘", rating: 4.5, reviews: 770, badge: null, description: "6mm non-slip cushioning with alignment lines and a carry strap." },
      { title: "Table Lamp — Warm Oak", category: "Home", price: 1099, mrp: 1799, emoji: "💡", rating: 4.3, reviews: 290, badge: null, description: "Dimmable LED, oak-finish base, soft warm-white light for reading corners." },
      { title: "Sunscreen SPF 50", category: "Beauty", price: 399, mrp: 599, emoji: "🧴", rating: 4.6, reviews: 1890, badge: "34% OFF", description: "Non-greasy, broad-spectrum protection that layers well under makeup." },
      { title: "Bluetooth Speaker", category: "Electronics", price: 1499, mrp: 2499, emoji: "🔊", rating: 4.2, reviews: 670, badge: null, description: "360° sound, IPX7 waterproof, 12-hour playtime with a rugged rubber shell." },
      { title: "Kids Storybook Set", category: "Books", price: 449, mrp: 699, emoji: "📚", rating: 4.8, reviews: 230, badge: null, description: "A 5-book bedtime set with bright illustrations for early readers." },
      { title: "Canvas Backpack", category: "Fashion", price: 1299, mrp: 1999, emoji: "🎒", rating: 4.4, reviews: 1020, badge: null, description: "Water-resistant canvas with a padded 15-inch laptop sleeve and 4 pockets." },
      { title: "Resistance Bands Set", category: "Sports", price: 349, mrp: 599, emoji: "🏋️", rating: 4.1, reviews: 410, badge: "42% OFF", description: "5-band set covering light to extra-heavy resistance, with a carry pouch." },
    ];

    for (const p of products) {
      await pool.query(
        `INSERT INTO products (title, category, price, mrp, emoji, rating, reviews, badge, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [p.title, p.category, p.price, p.mrp, p.emoji, p.rating, p.reviews, p.badge, p.description]
      );
    }
    console.log(`Seeded ${products.length} products into Postgres`);
  }
}

module.exports = { pool, initDb };
