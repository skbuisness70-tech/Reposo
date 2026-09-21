# Phase 1: Reposo on real PostgreSQL (100% free)

This replaces the old SQLite file (`melamart.db` / `reposo.db`) with a real
Postgres database — needed before a marketplace can have multiple sellers
writing at the same time. Hosting stays free the whole way through.

## What changed
- `db.js` — now connects to Postgres with the `pg` library instead of `better-sqlite3`
- `server.js` — every database call is now `async/await` against that Postgres pool
- `package.json` — swapped `better-sqlite3` for `pg`
- A `role` column was added to `users` ('buyer' or 'seller') — not used yet, but it's there
  ready for Phase 2 so we won't need another migration soon
- A `seller_id` column was added to `products` — same reason

`index.html` is untouched — it still talks to `reposo.onrender.com`.

## Step 1 — Create a free Postgres database on Neon

1. Go to **[neon.tech](https://neon.tech)** and sign up (free, no card required)
2. Click **"Create a project"** — name it `reposo`
3. Once created, Neon shows a **connection string** that looks like:
   ```
   postgresql://username:password@ep-xxxx.neon.tech/reposo?sslmode=require
   ```
4. **Copy that whole string** — you'll need it in Step 3

## Step 2 — Push these updated files to GitHub

In your `reposo` GitHub repo, upload these 3 files, overwriting the old ones:
- `db.js`
- `server.js`
- `package.json`

(`index.html` and `README.md` don't need to change.)

## Step 3 — Tell Render about the database

1. Open your Render dashboard → your `reposo` web service
2. Go to **Environment** (left sidebar)
3. Click **"Add Environment Variable"**
4. Key: `DATABASE_URL`
   Value: *paste the Neon connection string from Step 1*
5. Save — Render will automatically redeploy

## Step 4 — Watch the deploy logs

In Render's **Logs** tab, you should see:
```
Seeded 16 products into Postgres
Reposo API running at http://localhost:4000
```

If instead you see a connection error, double check the `DATABASE_URL` was pasted
correctly (no extra spaces, no missing `?sslmode=require` at the end).

## Step 5 — Test it

Visit `https://reposo.onrender.com/api/products` in a browser — same JSON list
of products as before, but now it's coming from real Postgres, and unlike
SQLite it will happily handle many people reading and writing to it at once.

---

## What Phase 1 unlocks
Nothing changes for buyers yet — the app looks and works the same. But the
foundation is now solid enough for **Phase 2: seller accounts**, where the
`role` and `seller_id` columns we already added will start getting used —
sellers will sign up, get their own dashboard, and add their own products
instead of the 16 seeded demo ones.

Say the word when you want Phase 2.
