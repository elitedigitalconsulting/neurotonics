# Neurotonics — Testing & Validation Guide

> **Status**: All automated tests passing (110/110)

---

## Table of Contents

1. [Running Automated Tests](#1-running-automated-tests)
2. [Manual Test Cases](#2-manual-test-cases)
   - A. Add to Cart
   - B. Cart Functionality
   - C. Checkout Form
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
| `npx jest --testPathPattern=checkout` | Run only checkout form tests |
| `npx jest --testPathPattern=api` | Run only API endpoint tests |

### Test files

| File | Coverage |
|------|----------|
| `src/__tests__/cart.test.ts` | Cart state logic, price calculations, localStorage persistence, edge cases |
| `src/__tests__/shipping.test.ts` | `calculateShipping()` — all zones, specificity, edge cases |
| `src/__tests__/checkout.test.ts` | `validateCheckoutForm()`, `calculateShipping()`, `updateTotal()` — all validation rules, edge cases |
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

### C. Checkout Form

#### TC-C1: Proceed to checkout

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add item to cart |  |
| 2 | Navigate to `/neurotonics/cart` |  |
| 3 | Click **"Proceed to Checkout"** | Redirected to `/neurotonics/checkout` |
| 4 | Checkout page loads | Three sections visible: Contact Information, Shipping Address, Delivery Options |
| 5 | Order summary visible | Right column (desktop) or top (mobile) shows product, subtotal, total |

✅ **Expected**: Checkout page loads with all form sections.

---

#### TC-C2: Empty cart checkout attempt

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure cart is empty (clear or navigate fresh) |  |
| 2 | Navigate directly to `/neurotonics/checkout` |  |
| 3 | Observe result | "Your cart is empty" screen shown with link to product |

✅ **Expected**: Cannot proceed to checkout with empty cart.

---

#### TC-C3: Form validation — submit with empty form

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add item to cart and navigate to checkout |  |
| 2 | Leave all fields empty |  |
| 3 | Click **"Pay $XX.XX AUD"** button | Form does NOT submit |
| 4 | Observe | Inline error messages appear on all required fields |
| 5 | Error examples | "Email address is required", "Phone number is required", "Full name is required", "Please select a delivery option" |

✅ **Expected**: Submission blocked with clear per-field error messages.

---

#### TC-C4: Form validation — invalid email

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type `notanemail` in the Email field |  |
| 2 | Click outside the field (blur) | "Please enter a valid email address" shown below the field |
| 3 | Type `user@domain.com` | Error clears immediately |

✅ **Expected**: Email validated on blur and corrected on re-type.

---

#### TC-C5: Form validation — invalid phone

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type `123` in the Phone field (too short) |  |
| 2 | Click outside the field (blur) | "Please enter a valid phone number" shown |
| 3 | Type `0412 345 678` | Error clears |

✅ **Expected**: Phone validated, accepts 10+ digit numbers.

---

#### TC-C6: Form validation — AU postcode

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure country is Australia |  |
| 2 | Enter `200` in Postcode (3 digits) and blur | "Please enter a valid 4-digit Australian postcode" shown |
| 3 | No delivery options shown yet |  |
| 4 | Enter `2000` (4 digits) | Error clears; delivery options appear automatically |

✅ **Expected**: 4-digit postcode triggers delivery options; 3-digit shows error.

---

#### TC-C7: Delivery options — dynamic calculation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fill contact info and enter postcode **2000**, country **Australia** | Standard, Express options appear |
| 2 | Note Standard fee | Sydney Metro: $8.95 |
| 3 | Change postcode to **6000** | Options update: Western Australia $14.95 |
| 4 | Change postcode to **0800** | Northern Territory $15.95 |
| 5 | Change country to **United States** | Single "International Standard" option appears |

✅ **Expected**: Delivery options update in real-time as address changes.

---

#### TC-C8: Free shipping eligibility on checkout

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add 1× Brain Boost 1000 ($79.90) to cart |  |
| 2 | Go to checkout | Amber banner: "You're $20.10 away from Free Shipping!" |
| 3 | Go back to product, add 2 more (total 3×, subtotal $239.70) |  |
| 4 | Go to checkout | Green banner: "You qualify for Free Shipping!" |
| 5 | Enter AU postcode | Free Shipping option appears as first/recommended option |

✅ **Expected**: Free shipping banner and option update based on subtotal.

---

#### TC-C9: Order summary updates with delivery selection

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter postcode **2000** on checkout | Standard ($8.95) auto-selected |
| 2 | Observe Order Summary | Shows Subtotal + $8.95 shipping + Total |
| 3 | Click Express Shipping | Total in Order Summary updates instantly |
| 4 | Click Standard Shipping | Total reverts |

✅ **Expected**: Total updates in real-time when delivery option changes.

---

#### TC-C10: Form data persists across page navigation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fill in email and full name on checkout |  |
| 2 | Navigate to cart, then back to checkout | Previously entered email and name are still filled |
| 3 | Check browser DevTools → Application → Local Storage → `neurotonics-checkout` | JSON with contact and address data |

✅ **Expected**: Form data auto-saved to localStorage and restored on return.

---

#### TC-C11: International address

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Change Country to **United States** |  |
| 2 | Observe State field | Changes from dropdown to free-text input |
| 3 | Observe Postcode field | Accepts alphanumeric (no 4-digit restriction) |
| 4 | Delivery options show | Single "International Standard" ($29.95) option |
| 5 | Fill all fields and attempt checkout | Redirects to Stripe with customer email pre-filled |

✅ **Expected**: International checkout flow works end-to-end.

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

These are covered in automated tests (`src/__tests__/cart.test.ts`, `src/__tests__/checkout.test.ts`) but also testable manually:

| Edge Case | How to test | Expected |
|-----------|-------------|----------|
| Empty cart checkout | Clear cart, go to `/checkout` | "Your cart is empty" view |
| Zero quantity | In cart, click `−` until quantity would go to 0 | Item removed automatically |
| Negative quantity | Not possible via UI (clamped); tested via automated tests | Item removed |
| Duplicate items | Add same product twice | Quantity merges, no duplicate entries |
| Network failure during checkout | Open DevTools → Network → set to "Offline", click "Pay" | "Failed to start checkout" error shown |
| Stripe API failure | Remove `STRIPE_SECRET_KEY` from server `.env`, restart server, attempt checkout | 500 error handled gracefully with user-facing message |
| Corrupt localStorage | In DevTools console: `localStorage.setItem('neurotonics-cart', 'BAD{JSON')` then refresh | Cart gracefully resets to empty |
| Invalid AU postcode (3 digits) | Enter `200` in postcode field | Error shown; no delivery options appear |
| Postcode with no zone match | Enter `9999` | Falls back to Standard rate ($14.95) |
| Missing NEXT_PUBLIC_API_URL | Remove env var, attempt checkout | "Checkout is not configured" error shown |
| No delivery option selected | Fill form but no shipping option available (e.g. AU + blank postcode) | "Please select a delivery option" error on submit |
| Corrupt checkout localStorage | `localStorage.setItem('neurotonics-checkout', 'bad')` then navigate to checkout | Form loads empty (graceful fallback) |

---

## 5. Debugging Output Guide

The following console output points are built in:

### API route (`/api/create-payment-intent`)

- On error: `console.error('Payment intent creation failed:', error)` — visible in server logs (`npm run dev` terminal) and in browser Network tab response.

### Shipping calculation

- Delivery options on the checkout page update automatically when postcode/country changes. No errors are thrown — if the postcode is invalid for AU, no options are shown and a prompt guides the user.

### Checkout initialization

- On server failure: error state displayed in UI + response JSON visible in DevTools Network tab.

### Cart store

- All state mutations go through `setCartItems()` which calls `saveCart()` — the current cart state is always inspectable via:

```javascript
// In browser console:
JSON.parse(localStorage.getItem('neurotonics-cart') || '[]')
```

### Checkout form data

```javascript
// In browser console:
JSON.parse(localStorage.getItem('neurotonics-checkout') || 'null')
```

### Debugging checklist for a broken checkout

1. Open DevTools → Network tab
2. Navigate to checkout and click "Pay $XX.XX AUD"
3. Look for `POST /create-checkout-session` request to `NEXT_PUBLIC_API_URL`
4. Check response body for `error` field
5. Check the terminal running `node server/index.js` for server-side error logs
6. Verify server `.env` contains a valid `STRIPE_SECRET_KEY`
7. Verify `NEXT_PUBLIC_API_URL` in `.env.local` points to the running Express server

---

## 6. Final Validation Checklist

Use this checklist before each production deployment:

### Automated tests

- [ ] `npm test` — all 110 tests pass with no failures
- [ ] No TypeScript errors (`npm run build` completes without errors)
- [ ] No lint errors (`npm run lint`)

### Cart

- [ ] **Add to Cart works** — product can be added, button feedback shown ✅
- [ ] **Multiple quantities** — correct quantity and price shown ✅
- [ ] **Duplicate items merge** — no duplicate line items ✅
- [ ] **Cart persists** — items survive page refresh (localStorage) ✅
- [ ] **Quantity update** — `+`/`−` buttons update total instantly ✅
- [ ] **Remove item** — correct item removed, empty state shown ✅

### Shipping calculator (cart page)

- [ ] Sydney Metro (2000) → $8.95 ✅
- [ ] Melbourne Metro (3000) → $8.95 ✅
- [ ] Unknown postcode (9999) → Standard $14.95 ✅
- [ ] Invalid (3-digit) postcode — button stays disabled ✅

### Checkout form

- [ ] **Empty cart** — blocked with friendly message ✅
- [ ] **Contact section** — Email and Phone fields shown with correct validation ✅
- [ ] **Address section** — All required fields shown; AU uses state dropdown ✅
- [ ] **AU postcode triggers delivery options** — entering 4 digits shows options ✅
- [ ] **International country** — shows single International Standard option ✅
- [ ] **Delivery selection** — highlighted when selected; total updates instantly ✅
- [ ] **Free shipping banner** — shows when subtotal < $100 (AU only) ✅
- [ ] **Form validation on submit** — all required fields show errors when empty ✅
- [ ] **Inline errors on blur** — error shown when leaving a field with invalid input ✅
- [ ] **Form data persists** — saved to localStorage; restored on back-navigation ✅
- [ ] **Order summary** — correct items, shipping, and total shown ✅

### Payments

- [ ] **Payments succeed in test mode** — card `4242 4242 4242 4242` shows "Order Confirmed!" ✅
- [ ] **Declined payment** — Stripe shows error, cart preserved ✅
- [ ] **Cart cleared** after successful payment ✅
- [ ] **Checkout data cleared** after successful payment ✅
- [ ] **Customer email pre-filled** on Stripe checkout page ✅

### Wallet payments

- [ ] **Apple Pay** — appears in Safari with a saved Apple Pay card ✅
- [ ] **Google Pay** — appears in Chrome with a saved Google Pay method ✅

### Browser console test runner

- [ ] `runCartTests()` runs without errors
- [ ] All sections show green ✓ ticks
- [ ] Summary shows 0 failures
