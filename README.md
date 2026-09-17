# MelaMart — real architecture

## How it's structured now

```
melamart/
├── backend/            ← Node.js + Express REST API
│   ├── server.js       ← all API routes (auth, products, cart, orders)
│   ├── db.js           ← SQLite database + product seed data
│   └── package.json    ← dependencies list
└── frontend/
    └── index.html      ← the site itself (calls the backend over fetch)
```

This is a standard **3-tier architecture**:

1. **Frontend** (browser) — `index.html`. Renders the UI, calls the backend with `fetch()`.
2. **Backend** (server) — `server.js`. Express app exposing a REST API. Checks passwords, issues login tokens (JWT), enforces "you can only see your own cart."
3. **Database** — `melamart.db`, a real SQLite file created automatically the first time you run the server. Stores users, products, cart items, and orders permanently — data survives restarts, unlike the old version where everything reset on page refresh.

## API endpoints

| Method | Path                  | Auth? | Does |
|--------|-----------------------|-------|------|
| POST   | /api/auth/signup      | no    | create account, returns token |
| POST   | /api/auth/login       | no    | log in, returns token |
| GET    | /api/products         | no    | list products (`?category=`, `?search=`) |
| GET    | /api/products/:id     | no    | one product |
| GET    | /api/cart             | yes   | your cart |
| POST   | /api/cart             | yes   | add item `{productId, qty}` |
| PUT    | /api/cart/:productId  | yes   | change quantity `{qty}` |
| DELETE | /api/cart/:productId  | yes   | remove item |
| POST   | /api/orders           | yes   | checkout (turns cart into an order) |
| GET    | /api/orders           | yes   | your order history |

Passwords are hashed with bcrypt (never stored in plain text). Login returns a JWT token the frontend stores in `localStorage` and sends back on every request.

## Running it

You'll need **Node.js** installed (free, from nodejs.org) — this one part does need a terminal, since a backend is a running program, not a static page.

**1. Start the backend:**
```
cd melamart/backend
npm install
npm start
```
This prints `MelaMart API running at http://localhost:4000` and creates `melamart.db` automatically with 16 seeded products.

**2. Open the frontend:**
Just double-click `frontend/index.html` — no terminal needed for this part. It's already configured to call `http://localhost:4000/api`.

**3. Try it:** browse products, tap "Add to cart" → it'll ask you to log in first (tap "Create an account"), then your cart and orders persist for real, backed by the database.

## Going live (no terminal needed for this part)

Once you're ready to put this on the internet instead of your own laptop:

- **Backend:** deploy the `backend/` folder to [Render](https://render.com) or [Railway](https://railway.app) — both let you connect a GitHub repo and deploy by clicking a button in their dashboard, no command line required. They'll give you a live URL like `https://melamart-api.onrender.com`.
- **Frontend:** change `API_BASE` at the top of `index.html`'s `<script>` to that live URL, then drag-drop the `frontend` folder onto [Netlify Drop](https://app.netlify.com/drop) for a live site in seconds.

## What's still simplified (good next steps)

- Checkout is a mock — no real payment gateway (Razorpay/Stripe) wired in yet.
- No product images — emoji placeholders stand in for photos.
- No admin panel to add/edit products (currently edited via `db.js` seed data).
- No order tracking / delivery status updates.

Tell me which of these you want next and I'll build it in.
