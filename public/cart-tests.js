/**
 * Neurotonics — Browser Console Test Runner
 * ==========================================
 * Paste this entire file into the browser DevTools console, or load it via:
 *   <script src="/neurotonics/cart-tests.js"></script>
 *
 * The runner does NOT require a framework — it uses plain assertions and
 * reports results directly to the console.
 *
 * Run:  runCartTests()
 */

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // Micro test framework
  // -------------------------------------------------------------------------

  const STORAGE_KEY = 'neurotonics-cart';
  const results = [];

  function assert(description, condition, detail) {
    const status = condition ? 'PASS' : 'FAIL';
    results.push({ status, description, detail });
    if (condition) {
      console.log('%c✓ ' + description, 'color: green; font-weight: bold;', detail !== undefined ? '→ ' + JSON.stringify(detail) : '');
    } else {
      console.error('%c✗ ' + description, 'color: red; font-weight: bold;', detail !== undefined ? '→ ' + JSON.stringify(detail) : '');
    }
  }

  function assertEqual(description, actual, expected) {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    assert(description, pass, { actual, expected });
  }

  function assertClose(description, actual, expected, tolerance) {
    tolerance = tolerance || 0.01;
    const pass = Math.abs(actual - expected) <= tolerance;
    assert(description, pass, { actual, expected, tolerance });
  }

  function assertGreaterThan(description, actual, min) {
    const pass = actual > min;
    assert(description, pass, { actual, min });
  }

  function section(title) {
    console.groupCollapsed('%c▸ ' + title, 'color: #1d4ed8; font-size: 13px; font-weight: bold;');
  }

  function sectionEnd() {
    console.groupEnd();
  }

  // -------------------------------------------------------------------------
  // Pure cart logic (mirrors src/lib/cart.tsx) — no React needed
  // -------------------------------------------------------------------------

  function _addItem(cart, item, qty) {
    qty = qty || 1;
    var existing = cart.find(function (i) { return i.id === item.id; });
    if (existing) {
      return cart.map(function (i) {
        return i.id === item.id ? Object.assign({}, i, { quantity: i.quantity + qty }) : i;
      });
    }
    return cart.concat([Object.assign({}, item, { quantity: qty })]);
  }

  function _removeItem(cart, id) {
    return cart.filter(function (i) { return i.id !== id; });
  }

  function _updateQuantity(cart, id, quantity) {
    if (quantity <= 0) {
      return cart.filter(function (i) { return i.id !== id; });
    }
    return cart.map(function (i) {
      return i.id === id ? Object.assign({}, i, { quantity: quantity }) : i;
    });
  }

  function _subtotal(cart) {
    return cart.reduce(function (sum, i) { return sum + i.price * i.quantity; }, 0);
  }

  function _totalItems(cart) {
    return cart.reduce(function (sum, i) { return sum + i.quantity; }, 0);
  }

  function _saveCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function _getStoredCart() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Fixtures
  // -------------------------------------------------------------------------

  // Fixtures mirror actual product prices from src/content/product.json
  var PRODUCT_A = { id: 'brain-boost-1000', name: 'Brain Boost 1000', price: 79.90, image: '/images/product-main.png' };
  var PRODUCT_B = { id: 'brain-boost-500', name: 'Brain Boost 500', price: 49.90, image: '/images/product-500.png' };

  // -------------------------------------------------------------------------
  // Test suites
  // -------------------------------------------------------------------------

  function testAddToCart() {
    section('Add to Cart');
    var cart;

    cart = _addItem([], PRODUCT_A);
    assertEqual('Add new item → cart has 1 entry', cart.length, 1);
    assertEqual('New item has quantity 1', cart[0].quantity, 1);

    cart = _addItem(cart, PRODUCT_A);
    assertEqual('Same item added again → still 1 entry (quantity merged)', cart.length, 1);
    assertEqual('Merged quantity is 2', cart[0].quantity, 2);

    cart = _addItem([], PRODUCT_A, 3);
    assertEqual('Add with custom qty=3', cart[0].quantity, 3);

    cart = _addItem([], PRODUCT_A);
    cart = _addItem(cart, PRODUCT_B);
    assertEqual('Two distinct items → 2 entries', cart.length, 2);

    sectionEnd();
  }

  function testPriceCalculations() {
    section('Price Calculations');
    var cart;

    cart = _addItem([], PRODUCT_A, 2);
    assertClose('2 × $79.90 = $159.80', _subtotal(cart), 159.80);

    cart = _addItem([], PRODUCT_A, 1);
    cart = _addItem(cart, PRODUCT_B, 2);
    assertClose('$79.90 + 2×$49.90 = $179.70', _subtotal(cart), 179.70);

    assertEqual('Empty cart subtotal = 0', _subtotal([]), 0);

    cart = _addItem([], PRODUCT_A, 3);
    cart = _addItem(cart, PRODUCT_B, 2);
    assertEqual('Total items count', _totalItems(cart), 5);

    var shippingFee = 8.95;
    cart = _addItem([], PRODUCT_A, 1);
    assertClose('Subtotal ($79.90) + shipping ($8.95) = $88.85', _subtotal(cart) + shippingFee, 88.85);

    sectionEnd();
  }

  function testUpdateQuantity() {
    section('Update Quantity');
    var cart;

    cart = _addItem([], PRODUCT_A, 1);
    cart = _updateQuantity(cart, PRODUCT_A.id, 5);
    assertEqual('Update to qty=5', cart[0].quantity, 5);

    cart = _addItem([], PRODUCT_A, 2);
    cart = _updateQuantity(cart, PRODUCT_A.id, 0);
    assertEqual('qty=0 removes item', cart.length, 0);

    cart = _addItem([], PRODUCT_A, 2);
    cart = _updateQuantity(cart, PRODUCT_A.id, -1);
    assertEqual('qty=-1 removes item', cart.length, 0);

    cart = _addItem([], PRODUCT_A, 1);
    cart = _addItem(cart, PRODUCT_B, 3);
    cart = _updateQuantity(cart, PRODUCT_A.id, 4);
    var b = cart.find(function (i) { return i.id === PRODUCT_B.id; });
    assertEqual('Other item unaffected during update', b && b.quantity, 3);

    sectionEnd();
  }

  function testRemoveItem() {
    section('Remove Item');
    var cart;

    cart = _addItem([], PRODUCT_A);
    cart = _addItem(cart, PRODUCT_B);
    cart = _removeItem(cart, PRODUCT_A.id);
    assertEqual('Correct item removed (B remains)', cart.length, 1);
    assertEqual('Remaining item is PRODUCT_B', cart[0].id, PRODUCT_B.id);

    cart = _addItem([], PRODUCT_A);
    var result = _removeItem(cart, 'nonexistent');
    assertEqual('Removing non-existent id is a no-op', result.length, 1);

    cart = _addItem([], PRODUCT_A);
    cart = _removeItem(cart, PRODUCT_A.id);
    assertEqual('Cart is empty after removing only item', cart.length, 0);

    sectionEnd();
  }

  function testLocalStoragePersistence() {
    section('localStorage Persistence');
    localStorage.removeItem(STORAGE_KEY);

    var items = [Object.assign({}, PRODUCT_A, { quantity: 2 })];
    _saveCart(items);
    var stored = localStorage.getItem(STORAGE_KEY);
    assert('Cart saved to localStorage', stored !== null);
    var parsed = JSON.parse(stored);
    assertEqual('Saved quantity = 2', parsed[0].quantity, 2);

    var restored = _getStoredCart();
    assertEqual('Restored cart length = 1', restored.length, 1);
    assertEqual('Restored quantity = 2', restored[0].quantity, 2);

    localStorage.removeItem(STORAGE_KEY);
    assertEqual('Empty localStorage returns []', _getStoredCart(), []);

    localStorage.setItem(STORAGE_KEY, 'INVALID_JSON{{');
    assertEqual('Corrupt localStorage returns []', _getStoredCart(), []);
    localStorage.removeItem(STORAGE_KEY);

    sectionEnd();
  }

  function testEdgeCases() {
    section('Edge Cases');
    var cart;

    assertEqual('Empty cart checkout — subtotal is 0', _subtotal([]), 0);

    cart = _addItem([], PRODUCT_A, 2);
    cart = _updateQuantity(cart, PRODUCT_A.id, 0);
    assertEqual('Zero quantity removes item', cart.length, 0);

    cart = _addItem([], PRODUCT_A, 2);
    cart = _updateQuantity(cart, PRODUCT_A.id, -5);
    assertEqual('Negative quantity removes item', cart.length, 0);

    cart = _addItem([], PRODUCT_A, 1);
    cart = _addItem(cart, PRODUCT_A, 1);
    cart = _addItem(cart, PRODUCT_A, 1);
    assertEqual('Triple duplicate additions merge to qty=3', cart[0].quantity, 3);
    assertEqual('Duplicate additions do not create extra entries', cart.length, 1);

    cart = _addItem([], PRODUCT_A, 3);
    assertClose('3 × $79.90 floating-point accuracy', _subtotal(cart), 239.70);

    sectionEnd();
  }

  function testLiveCartState() {
    section('Live Cart State (from page localStorage)');
    var live = _getStoredCart();
    console.log('Current cart contents:', live);
    assert('Cart is an array', Array.isArray(live));
    live.forEach(function (item) {
      assertGreaterThan('Item "' + item.id + '" has positive price', item.price, 0);
      assertGreaterThan('Item "' + item.id + '" has positive quantity', item.quantity, 0);
    });
    if (live.length > 0) {
      var sub = _subtotal(live);
      assertGreaterThan('Subtotal > 0 when cart has items', sub, 0);
      console.log('Calculated subtotal: $' + sub.toFixed(2));
    } else {
      console.log('Cart is currently empty — add items and re-run to test live state.');
    }
    sectionEnd();
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  function printSummary() {
    var passed = results.filter(function (r) { return r.status === 'PASS'; }).length;
    var failed = results.filter(function (r) { return r.status === 'FAIL'; }).length;
    var total = results.length;

    console.log('');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #1d4ed8');
    console.log('%c  NEUROTONICS CART TEST RESULTS', 'color: #1d4ed8; font-size: 14px; font-weight: bold;');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #1d4ed8');
    console.log('%c  ✓ Passed: ' + passed + '/' + total, 'color: green; font-weight: bold;');
    if (failed > 0) {
      console.log('%c  ✗ Failed: ' + failed + '/' + total, 'color: red; font-weight: bold;');
      console.log('');
      console.log('%cFailed tests:', 'color: red; font-weight: bold;');
      results.filter(function (r) { return r.status === 'FAIL'; }).forEach(function (r) {
        console.error('  ✗ ' + r.description, r.detail);
      });
    } else {
      console.log('%c  All tests passed! 🎉', 'color: green; font-weight: bold;');
    }
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #1d4ed8');

    return { passed: passed, failed: failed, total: total };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Run all cart tests and print a summary.
   * @returns {object} { passed, failed, total }
   */
  function runCartTests() {
    results.length = 0;
    console.clear();
    console.log('%c🧠 Neurotonics Cart Test Runner', 'color: #1d4ed8; font-size: 16px; font-weight: bold;');
    console.log('Running tests against isolated cart logic + live localStorage…');
    console.log('');

    testAddToCart();
    testPriceCalculations();
    testUpdateQuantity();
    testRemoveItem();
    testLocalStoragePersistence();
    testEdgeCases();
    testLiveCartState();

    return printSummary();
  }

  // Expose globally
  window.runCartTests = runCartTests;
  console.log('%c✅ Cart test runner loaded. Call runCartTests() to run all tests.', 'color: #1d4ed8; font-weight: bold;');
})();
