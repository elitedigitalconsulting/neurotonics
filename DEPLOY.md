# Deploying the Neurotonics CMS Server

The CMS backend (`server/`) is deployed on [Render.com](https://render.com) — a free hosting
platform with automatic GitHub deploys. Follow these steps to get a public URL.

---

## 1 · Create a free Render account

Go to **https://render.com** and sign up (free, no credit card needed for the web-service tier).

---

## 2 · Deploy via Blueprint (one click)

1. Open your Render dashboard: **https://dashboard.render.com/**
2. Click **New → Blueprint**
3. Connect your GitHub account if you haven't already
4. Select the **`elitedigitalconsulting/neurotonics`** repository
5. Render will detect `render.yaml` and show a service called **`neurotonics-cms`**
6. Click **Apply**

Render will provision the service and start a first deployment. It will fail until you set the
required secret environment variables (next step).

---

## 3 · Set required environment variables

In the Render dashboard, go to the **neurotonics-cms** service → **Environment** tab, and fill in:

| Variable | Where to get it |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard → Developers → Webhooks (see step 4) |
| `ADMIN_INITIAL_PASSWORD` | Choose a strong password — this becomes your CMS login |
| `RESEND_API_KEY` | Resend API key for transactional email (preferred) |
| `EMAIL_USER` | SMTP fallback: your Gmail address or other SMTP username |
| `EMAIL_PASS` | SMTP fallback: Gmail App Password ([how to create one](https://support.google.com/accounts/answer/185833)) or SMTP password |
| `GITHUB_PAT` | GitHub → Settings → Developer settings → Personal access tokens (repo scope) |

Useful optional variables:

| Variable | Purpose |
|---|---|
| `EMAIL_FROM` or `RESEND_FROM_EMAIL` | Sender address for order emails |
| `SUPPORT_EMAIL` | Reply/contact address in customer emails |
| `ORDER_NOTIFICATION_EMAIL` | Fallback admin order alert recipient |
| `STORE_URL` or `PUBLIC_STORE_URL` | Store link used in order emails |
| `ORDER_STATUS_URL` | Optional order-status link template; supports `{{orderNumber}}` |

After saving, Render will automatically redeploy.

---

## 4 · Register the Stripe webhook (required for CMS orders)

So Stripe can notify your server of completed payments and create CMS orders:

1. Go to **https://dashboard.stripe.com/webhooks**
2. Click **Add endpoint**
3. URL: `https://<your-render-url>/stripe/webhook`
4. Select events:
   - `checkout.session.completed` (primary hosted Checkout path)
   - `checkout.session.async_payment_succeeded` (delayed Checkout payments)
   - `payment_intent.succeeded` (alternate PaymentIntent path)
   - `payment_intent.payment_failed` (failed PaymentIntent records)
5. Copy the **Signing secret** and paste it as `STRIPE_WEBHOOK_SECRET` in Render

In production, the backend rejects webhook requests when
`STRIPE_WEBHOOK_SECRET` is missing. The public `/success` page is not the order
source of truth; the webhook creates `ORD-...` rows, reduces server-side product
stock, and triggers customer/admin order emails.

---

## 5 · Update CORS for your frontend

In the Render **Environment** tab, update `CLIENT_ORIGINS` to include your GitHub Pages URL:

```
https://elitedigitalconsulting.github.io
```

Add multiple origins as a comma-separated list, e.g.:

```
https://elitedigitalconsulting.github.io,https://www.neurotonics.com.au
```

---

## 6 · Access the CMS

Once deployed, your CMS admin panel is at:

```
https://neurotonics-cms.onrender.com/admin
```

Log in with:
- **Email:** `admin@neurotonics.com.au` (or the value you set for `ADMIN_INITIAL_EMAIL`)
- **Password:** the value you set for `ADMIN_INITIAL_PASSWORD`

> **Note on the free tier:** Render free web services spin down after 15 minutes of inactivity and
> wake up on the next request (a ~30 second cold start). SQLite data persists across restarts but
> resets if the service is redeployed with a code push. For production use with persistent data,
> upgrade to a Render Starter plan ($7/month) and add a persistent disk mounted at `/data`,
> then set `DB_PATH=/data/neurotonics.db` in the environment.

---

## 7 · Update the frontend to use the new API URL

In the `neurotonics` repo settings, set the GitHub Actions secret:

```
NEXT_PUBLIC_API_URL = https://neurotonics-cms.onrender.com
```

Then push any change to `main` to trigger a GitHub Pages rebuild.

---

## Local development

```bash
cd server
cp .env.example .env     # fill in your keys
npm install
npm run build:admin      # build the React admin UI once
npm start                # or: npm run dev
```

Open **http://localhost:4000/admin** in your browser.

## Checkout and order troubleshooting

- **Payment succeeds but no CMS order appears:** check Stripe webhook delivery
  for `checkout.session.completed`, confirm the endpoint URL is
  `https://<your-render-url>/stripe/webhook`, and verify
  `STRIPE_WEBHOOK_SECRET` matches the endpoint signing secret.
- **Payment succeeds but emails are missing:** visit `/email-status`, then check
  Render logs for `[email]` messages. Configure `RESEND_API_KEY` or SMTP
  `EMAIL_USER` + `EMAIL_PASS`.
- **Success page works but cart/order data looks sparse:** the success page uses
  local browser state for display and clears it after notification fallback
  work. The durable order details live in SQLite through the webhook.
- **Static site still calls the wrong backend:** set `NEXT_PUBLIC_API_URL` in
  GitHub Actions secrets and rebuild GitHub Pages.
