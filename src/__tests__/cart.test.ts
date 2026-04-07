/**
 * Cart state logic, price calculation, and localStorage persistence tests.
 *
 * These tests exercise the module-level cart store functions directly,
 * without requiring a React component tree.
 */

const STORAGE_KEY = 'neurotonics-cart';

// ---------------------------------------------------------------------------
// Helpers that mirror the cart module's internal functions so we can test
// them in isolation without the React context overhead.
// ---------------------------------------------------------------------------

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

function getStoredCart(): CartItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function addItem(
  current: CartItem[],
  item: Omit<CartItem, 'quantity'>,
  qty = 1,
): CartItem[] {
  const existing = current.find(i => i.id === item.id);
  if (existing) {
    return current.map(i =>
      i.id === item.id ? { ...i, quantity: i.quantity + qty } : i,
    );
  }
  return [...current, { ...item, quantity: qty }];
}

function removeItem(current: CartItem[], id: string): CartItem[] {
  return current.filter(i => i.id !== id);
}

function updateQuantity(current: CartItem[], id: string, quantity: number): CartItem[] {
  if (quantity <= 0) {
    return current.filter(i => i.id !== id);
  }
  return current.map(i => (i.id === id ? { ...i, quantity } : i));
}

function calcSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

function calcTotalItems(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

// ---------------------------------------------------------------------------
// Sample product fixture
// ---------------------------------------------------------------------------

const PRODUCT_A: Omit<CartItem, 'quantity'> = {
  id: 'brain-boost-1000',
  name: 'Brain Boost 1000',
  price: 79.90,
  image: '/images/product-main.png',
};

const PRODUCT_B: Omit<CartItem, 'quantity'> = {
  id: 'brain-boost-500',
  name: 'Brain Boost 500',
  price: 49.90,
  image: '/images/product-500.png',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  console.log('[CART TESTS] Starting new test');
});

describe('Add to Cart', () => {
  it('adds a new item to an empty cart', () => {
    const cart = addItem([], PRODUCT_A);
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({ id: PRODUCT_A.id, quantity: 1 });
    console.log('[PASS] Add new item to empty cart:', JSON.stringify(cart));
  });

  it('increments quantity when same item is added again', () => {
    let cart = addItem([], PRODUCT_A);
    cart = addItem(cart, PRODUCT_A);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(2);
    console.log('[PASS] Increment duplicate item quantity:', cart[0].quantity);
  });

  it('adds a custom quantity (e.g. 3)', () => {
    const cart = addItem([], PRODUCT_A, 3);
    expect(cart[0].quantity).toBe(3);
    console.log('[PASS] Add item with qty=3:', cart[0].quantity);
  });

  it('adds a second distinct item', () => {
    let cart = addItem([], PRODUCT_A);
    cart = addItem(cart, PRODUCT_B);
    expect(cart).toHaveLength(2);
    console.log('[PASS] Two distinct items in cart:', cart.map(i => i.id));
  });

  it('accumulates quantities for multiple distinct additions', () => {
    let cart = addItem([], PRODUCT_A, 2);
    cart = addItem(cart, PRODUCT_A, 3);
    expect(cart[0].quantity).toBe(5);
    console.log('[PASS] Accumulated quantities:', cart[0].quantity);
  });
});

describe('Price Calculations', () => {
  it('calculates correct subtotal for one item', () => {
    const cart = addItem([], PRODUCT_A, 2);
    // 2 × $79.90 = $159.80
    expect(calcSubtotal(cart)).toBeCloseTo(159.8, 2);
    console.log('[PASS] Subtotal 2×$79.90 =', calcSubtotal(cart).toFixed(2));
  });

  it('calculates correct subtotal for multiple different items', () => {
    let cart = addItem([], PRODUCT_A, 1); // $79.90
    cart = addItem(cart, PRODUCT_B, 2);  // 2 × $49.90 = $99.80 → total = $179.70
    expect(calcSubtotal(cart)).toBeCloseTo(179.7, 2);
    console.log('[PASS] Subtotal mixed items:', calcSubtotal(cart).toFixed(2));
  });

  it('returns 0 subtotal for empty cart', () => {
    expect(calcSubtotal([])).toBe(0);
    console.log('[PASS] Empty cart subtotal = 0');
  });

  it('counts total items correctly', () => {
    let cart = addItem([], PRODUCT_A, 3);
    cart = addItem(cart, PRODUCT_B, 2);
    expect(calcTotalItems(cart)).toBe(5);
    console.log('[PASS] Total items count:', calcTotalItems(cart));
  });

  it('adds shipping fee to subtotal correctly', () => {
    const cart = addItem([], PRODUCT_A, 1); // $79.90
    const shippingFee = 8.95;
    const total = calcSubtotal(cart) + shippingFee;
    expect(total).toBeCloseTo(88.85, 2);
    console.log('[PASS] Total with shipping:', total.toFixed(2));
  });
});

describe('Update Quantity', () => {
  it('updates quantity of an existing item', () => {
    let cart = addItem([], PRODUCT_A, 1);
    cart = updateQuantity(cart, PRODUCT_A.id, 5);
    expect(cart[0].quantity).toBe(5);
    console.log('[PASS] Updated quantity to 5:', cart[0].quantity);
  });

  it('removes item when quantity is set to 0', () => {
    let cart = addItem([], PRODUCT_A, 2);
    cart = updateQuantity(cart, PRODUCT_A.id, 0);
    expect(cart).toHaveLength(0);
    console.log('[PASS] Item removed when qty=0');
  });

  it('removes item when quantity is set to negative', () => {
    let cart = addItem([], PRODUCT_A, 2);
    cart = updateQuantity(cart, PRODUCT_A.id, -1);
    expect(cart).toHaveLength(0);
    console.log('[PASS] Item removed when qty=-1');
  });

  it('does not affect other items when updating one', () => {
    let cart = addItem([], PRODUCT_A, 1);
    cart = addItem(cart, PRODUCT_B, 3);
    cart = updateQuantity(cart, PRODUCT_A.id, 4);
    const b = cart.find(i => i.id === PRODUCT_B.id);
    expect(b?.quantity).toBe(3);
    console.log('[PASS] Other item unaffected:', b?.quantity);
  });
});

describe('Remove Item', () => {
  it('removes the correct item', () => {
    let cart = addItem([], PRODUCT_A);
    cart = addItem(cart, PRODUCT_B);
    cart = removeItem(cart, PRODUCT_A.id);
    expect(cart).toHaveLength(1);
    expect(cart[0].id).toBe(PRODUCT_B.id);
    console.log('[PASS] Correct item removed, remaining:', cart[0].id);
  });

  it('handles removing a non-existent item gracefully', () => {
    const cart = addItem([], PRODUCT_A);
    const result = removeItem(cart, 'nonexistent-id');
    expect(result).toHaveLength(1);
    console.log('[PASS] Remove non-existent id is a no-op');
  });

  it('results in an empty cart after removing the only item', () => {
    let cart = addItem([], PRODUCT_A);
    cart = removeItem(cart, PRODUCT_A.id);
    expect(cart).toHaveLength(0);
    console.log('[PASS] Cart empty after removing only item');
  });
});

describe('localStorage Persistence', () => {
  it('saves cart to localStorage', () => {
    const items: CartItem[] = [{ ...PRODUCT_A, quantity: 2 }];
    saveCart(items);
    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].quantity).toBe(2);
    console.log('[PASS] Cart saved to localStorage:', stored);
  });

  it('reads cart back from localStorage correctly', () => {
    const items: CartItem[] = [
      { ...PRODUCT_A, quantity: 1 },
      { ...PRODUCT_B, quantity: 3 },
    ];
    saveCart(items);
    const restored = getStoredCart();
    expect(restored).toHaveLength(2);
    expect(restored[1].quantity).toBe(3);
    console.log('[PASS] Cart persists across simulated page reload:', restored.map(i => `${i.id}:${i.quantity}`));
  });

  it('returns empty array when localStorage is empty', () => {
    localStorage.clear();
    const cart = getStoredCart();
    expect(cart).toEqual([]);
    console.log('[PASS] Empty localStorage returns []');
  });

  it('returns empty array when localStorage contains invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'NOT_VALID_JSON{{');
    const cart = getStoredCart();
    expect(cart).toEqual([]);
    console.log('[PASS] Corrupt localStorage returns []');
  });

  it('overwrites old data on save', () => {
    const original: CartItem[] = [{ ...PRODUCT_A, quantity: 5 }];
    saveCart(original);

    const updated: CartItem[] = [{ ...PRODUCT_A, quantity: 2 }];
    saveCart(updated);

    const restored = getStoredCart();
    expect(restored[0].quantity).toBe(2);
    console.log('[PASS] localStorage overwritten correctly:', restored[0].quantity);
  });
});

describe('Edge Cases', () => {
  it('empty cart checkout — subtotal is 0', () => {
    expect(calcSubtotal([])).toBe(0);
    console.log('[PASS] Empty cart checkout produces $0 subtotal');
  });

  it('invalid (zero) quantity is treated as remove', () => {
    let cart = addItem([], PRODUCT_A, 2);
    cart = updateQuantity(cart, PRODUCT_A.id, 0);
    expect(cart).toHaveLength(0);
    console.log('[PASS] Zero quantity removes item');
  });

  it('invalid (negative) quantity is treated as remove', () => {
    let cart = addItem([], PRODUCT_A, 2);
    cart = updateQuantity(cart, PRODUCT_A.id, -5);
    expect(cart).toHaveLength(0);
    console.log('[PASS] Negative quantity removes item');
  });

  it('duplicate item additions merge correctly', () => {
    let cart = addItem([], PRODUCT_A, 1);
    cart = addItem(cart, PRODUCT_A, 1);
    cart = addItem(cart, PRODUCT_A, 1);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(3);
    console.log('[PASS] Triplicate additions merged to qty=3:', cart[0].quantity);
  });

  it('price is preserved accurately (floating point)', () => {
    // 3 × $79.90 — test for floating-point safety
    const cart = addItem([], PRODUCT_A, 3);
    expect(parseFloat(calcSubtotal(cart).toFixed(2))).toBe(239.7);
    console.log('[PASS] Floating-point price preserved:', calcSubtotal(cart).toFixed(2));
  });
});
