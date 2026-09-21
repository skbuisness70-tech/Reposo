# Phase 2: Seller accounts + admin approval (Amazon/Flipkart-style)

## What's new
- Signup now asks: "Buy products" or "Sell products"
- A seller's account starts as **pending** — their products exist but aren't
  shown to buyers until an admin approves the account
- One admin account, set via an environment variable (nobody can self-promote to admin)
- Seller dashboard: add/remove your own products, see your approval status
- Admin dashboard: see pending sellers, approve or reject them

## Step 1 — Push the updated files to GitHub
Upload these 3 files to your `reposo` repo, overwriting the old ones:
- `db.js`
- `server.js`
- `index.html`

(`package.json` is unchanged from Phase 1 — no need to re-upload it.)

## Step 2 — Make yourself the admin
On Render → your `reposo` service → **Environment** tab → add one more variable:

- **Key:** `ADMIN_EMAIL`
- **Value:** the email address *you* will sign up with (e.g. `you@example.com`)

Save — Render redeploys automatically.

## Step 3 — Create your admin account
1. Open the site, tap **Account → Create an account**
2. Sign up using **exactly** the email you set as `ADMIN_EMAIL`
   (role selector doesn't matter here — the server auto-detects the admin email
   and makes you an admin regardless of what you pick)
3. Log in — the bottom-right nav tab now says **"Approvals"** instead of "Account"

## Step 4 — Try the seller flow
1. Log out, sign up again with a **different** email, this time choosing **"Sell products"**
2. You'll see: *"Your account is pending admin approval"* — you can still add products,
   they just won't show on the buyer-facing storefront yet
3. Add a test product from the seller dashboard

## Step 5 — Approve the seller
1. Log out, log back in as your **admin** account
2. Tap the **"Approvals"** nav tab
3. You'll see the pending seller — tap **Approve**
4. Log out, log back in as a buyer (or just browse without logging in) — the
   seller's product now appears in the main product grid

## How the approval logic works, in plain terms
- Every product row optionally has a `seller_id`
- The 16 original demo products have no seller — they always show (that's the platform's own catalogue)
- A product with a seller only shows to buyers once that seller's account status is `approved`
- This means a rejected or still-pending seller's products stay invisible without needing to touch the products themselves — only the seller's status

## What Phase 3 will add
Real payments with per-seller payouts and a platform commission — so far, checkout still just creates an order record without actually charging a card.
