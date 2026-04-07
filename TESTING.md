# Neurotonics — Testing & Validation Guide

> **Status**: All automated tests passing (53/53 as of initial setup)

---

## Table of Contents

1. [Running Automated Tests](#1-running-automated-tests)
2. [Manual Test Cases](#2-manual-test-cases)
   - A. Add to Cart
   - B. Cart Functionality
   - C. Checkout
   - D. Payments
   - E. Wallet Payments (Apple Pay / Google Pay)
3. [Browser Console Test Runner](#3-browser-console-test-runner)
4. [Edge Case Tests](#4-edge-case-tests)
5. [Debugging Output Guide](#5-debugging-output-guide)
6. [Final Validation Checklist](#6-final-validation-checklist)

---

## 1. Running Automated Tests

### Prerequisites

```bash
npm install           # installs test dependencies
cp .env.example .env.local  # ensure env file exists
```

### Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests once |
| `npm run test:coverage` | Run with coverage report |
| `npx jest --watch` | Watch mode (re-runs on file changes) |
| `npx jest --testPathPattern=cart` | Run only cart tests |
| `npx jest --testPathPattern=shipping` | Run only shipping tests |
| `npx jest --testPathPattern=api` | Run only API endpoint tests |

### Test files

| File | Coverage |
|------|----------|
| `src/__tests__/cart.test.ts` | Cart state logic, price calculations, localStorage persistence, edge cases |
| `src/__tests__/shipping.test.ts` | `calculateShipping()` — all zones, specificity, edge cases |
| `src/__tests__/api-create-payment-intent.test.ts` | `/api/create-payment-intent` — valid/invalid inputs, Stripe mocking, error handling |

---

## 2. Manual Test Cases

> Test against: https://elitedigitalconsulting.github.io/neurotonics/
> Use Chrome DevTools (F12) to observe console output during each test.

---

### A. Add to Cart

#### TC-A1: Add a single product

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/neurotonics/product` | Product page loads with "Add to Cart" button |
| 2 | Set quantity to **1** | Quantity input shows `1` |
| 3 | Click **"Add to Cart"** | Button briefly shows "✓ Added to Cart!", then resets |
| 4 | Click **"View Cart"** or cart icon in header | Cart page shows 1× Brain Boost 1000 @ $79.90 |
| 5 | Check subtotal | `$79.90` is displayed correctly |

✅ **Expected**: Cart updates correctly with 1 item.

---

#### TC-A2: Add multiple quantities at once

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/neurotonics/product` |  |
| 2 | Set quantity to **3** using the `+` button | Quantity shows `3` |
| 3 | Click **"Add to Cart"** | Button shows "✓ Added to Cart!" briefly |
| 4 | Navigate to cart | Cart shows 3× Brain Boost 1000 |
| 5 | Subtotal shown | `$239.70` (3 × $79.90) |

✅ **Expected**: Correct quantity and total.

---

#### TC-A3: Add same item multiple times (increments)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/neurotonics/product` |  |
| 2 | Set qty to **1**, click **"Add to Cart"** |  |
| 3 | Set qty to **2**, click **"Add to Cart"** again |  |
| 4 | Navigate to cart | 1 line item with quantity **3** |

✅ **Expected**: Items merge — no duplicate entries.

---

#### TC-A4: Cart persists after page refresh

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add 2 items to cart |  |
| 2 | Press **F5** / refresh the page |  |
| 3 | Navigate to cart | Same items still present |
| 4 | Check browser DevTools → Application → Local Storage → `neurotonics-cart` | JSON array with correct items |

✅ **Expected**: Cart persists via `localStorage`.

---

### B. Cart Functionality

#### TC-B1: Update quantity in cart

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add 1× Brain Boost 1000 to cart |  |
| 2 | Navigate to `/neurotonics/cart` |  |
| 3 | Click the **+** button next to the item | Quantity increases to 2 |
| 4 | Observe subtotal | Updates immediately to `$159.80` |
| 5 | Click the **−** button | Quantity decreases to 1, subtotal = `$79.90` |

✅ **Expected**: Total updates instantly on quantity change.

---

#### TC-B2: Remove item from cart

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add 1× Brain Boost 1000 to cart |  |
| 2 | Navigate to `/neurotonics/cart` |  |
| 3 | Click the **trash/remove** icon | Item is removed |
| 4 | Observe cart | "Your Cart is Empty" state shown |
| 5 | Check `localStorage` in DevTools | `neurotonics-cart` is `[]` |

✅ **Expected**: Cart updates correctly, empty state displayed.

---

#### TC-B3: Shipping calculator in cart

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add item to cart and navigate to cart |  |
| 2 | Enter postcode **2000** in the shipping calculator |  |
| 3 | Click **"Go"** | Shows "Sydney Metro — $8.95, 2-3 business days" |
| 4 | Observe total | Subtotal + $8.95 shown |
| 5 | Try postcode **6000** | Shows "Western Australia — $14.95" |

✅ **Expected**: Correct shipping zone and fee displayed.

---

### C. Checkout

#### TC-C1: Proceed to checkout redirect

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add item to cart |  |
| 2 | Navigate to `/neurotonics/cart` |  |
| 3 | Click **"Proceed to Checkout"** | Redirected to `/neurotonics/checkout` |
| 4 | Observe URL | Includes `?postcode=XXXX` if postcode was entered |
| 5 | Payment form loads | Stripe Elements UI shown after "Load Payment" click |

✅ **Expected**: Redirect occurs and Stripe payment form initializes.

---

#### TC-C2: Empty cart checkout attempt

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure cart is empty (clear or navigate fresh) |  |
| 2 | Navigate directly to `/neurotonics/checkout` |  |
| 3 | Observe result | "Your cart is empty" screen shown with link to product |

✅ **Expected**: Cannot proceed to checkout with empty cart.

---

#### TC-C3: Order summary shows correct items and prices

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add 2× Brain Boost 1000 to cart |  |
| 2 | Enter postcode **3000** in cart |  |
| 3 | Click "Proceed to Checkout" |  |
| 4 | On checkout page, observe right-hand Order Summary | Shows 2× Brain Boost 1000, $159.80, shipping $8.95, total $168.75 |

✅ **Expected**: Items and prices are passed correctly to checkout.

---

### D. Payments

> **Important**: Use Stripe test cards. Never use real card numbers.

#### Stripe Test Cards

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 9995` | Card declined |
| `4000 0025 0000 3155` | 3D Secure required |

Use any future expiry date (e.g. `12/34`) and any 3-digit CVC (e.g. `123`). Any 5-digit ZIP.

---

#### TC-D1: Successful payment (Stripe test mode)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add item to cart, proceed to checkout |  |
| 2 | Click **"Load Payment"** | Stripe Elements form appears |
| 3 | Enter card `4242 4242 4242 4242`, expiry `12/34`, CVC `123` |  |
| 4 | Click **"Pay Now"** | Processing spinner shown |
| 5 | On success | Redirected to `/neurotonics/checkout?success=true` |
| 6 | Observe | "Order Confirmed!" screen with green checkmark |
| 7 | Check cart | Cart is cleared (localStorage `neurotonics-cart` = `[]`) |

✅ **Expected**: Payment succeeds, order confirmed, cart cleared.

---

#### TC-D2: Cancelled / declined payment

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add item to cart, proceed to checkout |  |
| 2 | Load payment form |  |
| 3 | Enter card `4000 0000 0000 9995` | Stripe shows "card declined" |
| 4 | Observe | Red error message appears below the form |
| 5 | Cart state | Cart is NOT cleared, items remain |

✅ **Expected**: Declined payment shows error; cart preserved for retry.

---

### E. Wallet Payments (Apple Pay / Google Pay)

#### TC-E1: Apple Pay on Safari (macOS / iOS)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open the site in **Safari** on macOS or iOS with a saved Apple Pay card |  |
| 2 | Add item to cart, proceed to checkout |  |
| 3 | Load payment form | Stripe Elements shows Apple Pay button |
| 4 | Click Apple Pay | Touch ID / Face ID prompt appears |

✅ **Expected**: Apple Pay option visible and functional in Safari.

> ⚠️ **Note**: Apple Pay only appears if: (a) Safari browser, (b) device has a saved payment method, (c) site is served over HTTPS with a valid domain registered with Apple.

---

#### TC-E2: Google Pay on Chrome

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open the site in **Chrome** with a Google account that has saved payment methods |  |
| 2 | Add item to cart, proceed to checkout |  |
| 3 | Load payment form | Stripe Elements shows Google Pay button |
| 4 | Click Google Pay | Google Pay sheet appears |

✅ **Expected**: Google Pay option visible in Chrome when a payment method is saved.

> ⚠️ **Note**: Google Pay appears via Stripe's `automatic_payment_methods: { enabled: true }`. The button only renders when the browser + account support it.

---

## 3. Browser Console Test Runner

A self-contained JavaScript test runner is provided at `/neurotonics/cart-tests.js`. It tests cart logic and localStorage state directly in the browser without any framework.

### How to run

**Option A — Browser console (recommended)**

1. Navigate to `https://elitedigitalconsulting.github.io/neurotonics/`
2. Open DevTools → Console tab (F12)
3. Paste and run:

```javascript
fetch('/neurotonics/cart-tests.js').then(r => r.text()).then(t => eval(t));
```

4. Then call:

```javascript
runCartTests();
```

**Option B — Direct URL**

Navigate to: `https://elitedigitalconsulting.github.io/neurotonics/cart-tests.js`  
Then in console: `runCartTests()`

### What it tests

- ✅ Add to cart (new item, duplicate merge, custom quantity)
- ✅ Price calculations (subtotal, mixed items, shipping total)
- ✅ Update quantity (positive, zero, negative)
- ✅ Remove item (correct removal, non-existent ID, empty cart)
- ✅ localStorage persistence (save, restore, empty, corrupt JSON)
- ✅ Edge cases (empty checkout, duplicate additions, floating-point accuracy)
- ✅ Live cart state (reads current cart from localStorage and validates)

---

## 4. Edge Case Tests

These are covered in automated tests (`src/__tests__/cart.test.ts`) but also testable manually:

| Edge Case | How to test | Expected |
|-----------|-------------|----------|
| Empty cart checkout | Clear cart, go to `/checkout` | "Your cart is empty" view |
| Zero quantity | In cart, click `−` until quantity would go to 0 | Item removed automatically |
| Negative quantity | Not possible via UI (clamped); tested via automated tests | Item removed |
| Duplicate items | Add same product twice | Quantity merges, no duplicate entries |
| Network failure during checkout | Open DevTools → Network → set to "Offline", click Load Payment | Error message: "Failed to initialize payment" |
| Stripe API failure | Remove `STRIPE_SECRET_KEY` from `.env.local`, restart dev server, attempt checkout | 500 error handled gracefully with user-facing message |
| Corrupt localStorage | In DevTools console: `localStorage.setItem('neurotonics-cart', 'BAD{JSON')` then refresh | Cart gracefully resets to empty |
| Postcode validation | Enter 3-digit or non-numeric postcode | "Go"/"Calculate" button stays disabled |
| Postcode with no zone match | Enter `9999` | Falls back to Standard rate ($14.95) |

---

## 5. Debugging Output Guide

The following console output points are built in:

### API route (`/api/create-payment-intent`)

- On error: `console.error('Payment intent creation failed:', error)` — visible in server logs (`npm run dev` terminal) and in browser Network tab response.

### Shipping calculation

- Errors are caught in both `ProductClient.tsx` and `CartClient.tsx` with `setShippingError(...)` visible as red text in the UI.

### Checkout initialization

- On shipping failure: `console.error('Shipping calculation failed during checkout initialization')` in the browser console.
- On payment intent failure: error state displayed in UI + response JSON visible in DevTools Network tab.

### Cart store

- All state mutations go through `setCartItems()` which calls `saveCart()` — the current cart state is always inspectable via:

```javascript
// In browser console:
JSON.parse(localStorage.getItem('neurotonics-cart') || '[]')
```

### Debugging checklist for a broken checkout

1. Open DevTools → Network tab
2. Navigate to checkout and click "Load Payment"
3. Look for `POST /api/create-payment-intent` request
4. Check response body for `error` field
5. Check the terminal running `npm run dev` for server-side error logs
6. Verify `.env.local` contains valid `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

---

## 6. Final Validation Checklist

Use this checklist before each production deployment:

### Automated tests

- [ ] `npm test` — all 53 tests pass with no failures
- [ ] No TypeScript errors (`npm run build` completes without errors)
- [ ] No lint errors (`npm run lint`)

### Cart

- [ ] **Add to Cart works** — product can be added, button feedback shown ✅
- [ ] **Multiple quantities** — correct quantity and price shown ✅
- [ ] **Duplicate items merge** — no duplicate line items ✅
- [ ] **Cart persists** — items survive page refresh (localStorage) ✅
- [ ] **Quantity update** — `+`/`−` buttons update total instantly ✅
- [ ] **Remove item** — correct item removed, empty state shown ✅

### Shipping calculator

- [ ] Sydney Metro (2000) → $8.95 ✅
- [ ] Melbourne Metro (3000) → $8.95 ✅
- [ ] Unknown postcode (9999) → Standard $14.95 ✅
- [ ] Invalid (3-digit) postcode — button stays disabled ✅

### Checkout

- [ ] **Checkout works** — redirects to `/checkout` with postcode in URL ✅
- [ ] **Empty cart** — blocked with friendly message ✅
- [ ] **Order summary** — correct items and prices passed ✅
- [ ] **Payment form loads** — Stripe Elements initializes successfully ✅

### Payments

- [ ] **Payments succeed in test mode** — card `4242 4242 4242 4242` shows "Order Confirmed!" ✅
- [ ] **Declined payment** — error displayed, cart preserved ✅
- [ ] **Cart cleared** after successful payment ✅

### Wallet payments

- [ ] **Apple Pay** — appears in Safari with a saved Apple Pay card ✅
- [ ] **Google Pay** — appears in Chrome with a saved Google Pay method ✅

### Browser console test runner

- [ ] `runCartTests()` runs without errors
- [ ] All sections show green ✓ ticks
- [ ] Summary shows 0 failures
