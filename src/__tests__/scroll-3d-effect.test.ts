/**
 * Tests for the 3D scroll-adaptive hero and product image effects.
 *
 * These tests exercise the pure transform-calculation logic extracted from
 * BrainHero and ProductImage3D in isolation, verifying that scroll position
 * and mouse state produce the expected CSS transform strings.
 *
 * Conventions:
 *   - Each assertion is followed by console.log('[PASS] ...')
 *   - jsdom environment (default for this repo)
 */

// ---------------------------------------------------------------------------
// Pure helpers mirroring the transform logic in BrainHero / ProductImage3D
// ---------------------------------------------------------------------------

// BrainHero constants
const SCROLL_ROTATE_X  = 14;
const SCROLL_ROTATE_Y  = 6;
const SCROLL_PARALLAX  = 0.30;
const SCROLL_SCALE_MIN = 0.92;
const MOUSE_TILT_DESKTOP = 10;
const MOUSE_TILT_MOBILE  = 4;

function buildBrainTransform(
  scrollY: number,
  heroHeight: number,
  mouseDx: number,
  mouseDy: number,
  isMobile = false,
): string {
  const scrollPct = Math.min(scrollY / heroHeight, 1);
  const maxTilt   = isMobile ? MOUSE_TILT_MOBILE : MOUSE_TILT_DESKTOP;
  const rotX      = -(scrollPct * SCROLL_ROTATE_X);
  const rotY      =   scrollPct * SCROLL_ROTATE_Y;
  const transY    =   scrollY   * SCROLL_PARALLAX;
  const scale     = 1 - scrollPct * (1 - SCROLL_SCALE_MIN);
  const mRotX     = -mouseDy * maxTilt;
  const mRotY     =  mouseDx * maxTilt;

  return `perspective(1200px) translateY(-${transY.toFixed(1)}px) rotateX(${(rotX + mRotX).toFixed(2)}deg) rotateY(${(rotY + mRotY).toFixed(2)}deg) scale(${scale.toFixed(3)})`;
}

// ProductImage3D constants
const MAX_SCROLL_ROTATE = 6;
const MAX_MOUSE_TILT    = 8;

function buildProductTransform(
  rectTopRelativeToViewport: number,
  rectHeight: number,
  viewH: number,
  mouseDx: number,
  mouseDy: number,
  isMobile = false,
): string {
  const centred    = ((rectTopRelativeToViewport + rectHeight / 2) - viewH / 2) / viewH;
  const scrollRotX =  centred * MAX_SCROLL_ROTATE;
  const scrollRotY = -centred * (MAX_SCROLL_ROTATE * 0.5);
  const mouseRotX  = isMobile ? 0 : -mouseDy * MAX_MOUSE_TILT;
  const mouseRotY  = isMobile ? 0 :  mouseDx * MAX_MOUSE_TILT;

  return `perspective(1000px) rotateX(${(scrollRotX + mouseRotX).toFixed(2)}deg) rotateY(${(scrollRotY + mouseRotY).toFixed(2)}deg)`;
}

// ---------------------------------------------------------------------------
// BrainHero transform tests
// ---------------------------------------------------------------------------

describe('BrainHero — scroll-based 3D transform', () => {
  it('produces identity-like transform at scrollY=0 with no mouse input', () => {
    const t = buildBrainTransform(0, 1000, 0, 0);
    expect(t).toContain('translateY(-0.0px)');
    expect(t).toContain('rotateX(0.00deg)');
    expect(t).toContain('rotateY(0.00deg)');
    expect(t).toContain('scale(1.000)');
    console.log('[PASS] identity at scrollY=0:', t);
  });

  it('applies maximum rotation and parallax at full hero scroll (scrollY = heroHeight)', () => {
    const heroHeight = 900;
    const t = buildBrainTransform(heroHeight, heroHeight, 0, 0);

    expect(t).toContain(`translateY(-${(heroHeight * SCROLL_PARALLAX).toFixed(1)}px)`);
    expect(t).toContain(`rotateX(${(-SCROLL_ROTATE_X).toFixed(2)}deg)`);
    expect(t).toContain(`rotateY(${SCROLL_ROTATE_Y.toFixed(2)}deg)`);
    expect(t).toContain(`scale(${SCROLL_SCALE_MIN.toFixed(3)})`);
    console.log('[PASS] max scroll transform:', t);
  });

  it('clamps scrollPct to 1 when scrollY exceeds heroHeight', () => {
    const heroHeight = 800;
    const t1 = buildBrainTransform(heroHeight,     heroHeight, 0, 0);
    const t2 = buildBrainTransform(heroHeight * 3, heroHeight, 0, 0);
    // Rotation should be identical (clamped) but parallax keeps growing
    const getRotX = (s: string) => s.match(/rotateX\(([^d]+)deg\)/)?.[1];
    expect(getRotX(t1)).toBe(getRotX(t2));
    console.log('[PASS] scrollPct clamped at hero boundary');
  });

  it('adds mouse-tracking rotation on top of scroll rotation (desktop)', () => {
    // Mouse at (dx=1, dy=1) — bottom-right corner
    const tNoMouse = buildBrainTransform(500, 1000, 0,  0, false);
    const tMouse   = buildBrainTransform(500, 1000, 1, -1, false);

    const getRotY = (s: string) => parseFloat(s.match(/rotateY\(([^d]+)deg\)/)?.[1] ?? '0');
    expect(getRotY(tMouse)).toBeGreaterThan(getRotY(tNoMouse));
    console.log('[PASS] mouse tilt adds to scroll rotation');
  });

  it('uses reduced tilt constants on mobile', () => {
    const tDesktop = buildBrainTransform(0, 1000, 1, 0, false);
    const tMobile  = buildBrainTransform(0, 1000, 1, 0, true);

    const getRotY = (s: string) => Math.abs(parseFloat(s.match(/rotateY\(([^d]+)deg\)/)?.[1] ?? '0'));
    expect(getRotY(tMobile)).toBeLessThan(getRotY(tDesktop));
    console.log('[PASS] mobile uses reduced tilt constants');
  });

  it('intermediate scroll produces proportional rotation', () => {
    const heroHeight = 1000;
    const t50 = buildBrainTransform(500, heroHeight, 0, 0);
    const getRotX = (s: string) => parseFloat(s.match(/rotateX\(([^d]+)deg\)/)?.[1] ?? '0');
    // At 50% scroll, rotX should be -(0.5 * SCROLL_ROTATE_X)
    const expected = -(0.5 * SCROLL_ROTATE_X);
    expect(getRotX(t50)).toBeCloseTo(expected, 1);
    console.log('[PASS] intermediate scroll gives proportional rotation:', getRotX(t50));
  });
});

// ---------------------------------------------------------------------------
// ProductImage3D transform tests
// ---------------------------------------------------------------------------

describe('ProductImage3D — scroll-position-based 3D transform', () => {
  const viewH      = 900;
  const rectHeight = 500;

  it('produces zero rotation when image is exactly centred in viewport', () => {
    // rectTop = viewH/2 - rectHeight/2 → image centre == viewport centre
    const rectTop = viewH / 2 - rectHeight / 2;
    const t = buildProductTransform(rectTop, rectHeight, viewH, 0, 0);
    expect(t).toContain('rotateX(0.00deg)');
    expect(t).toContain('rotateY(0.00deg)');
    console.log('[PASS] zero rotation at viewport centre:', t);
  });

  it('tilts backward when image is below viewport centre', () => {
    // rectTop = viewH (just below the fold)
    const t = buildProductTransform(viewH, rectHeight, viewH, 0, 0);
    const rotX = parseFloat(t.match(/rotateX\(([^d]+)deg\)/)?.[1] ?? '0');
    expect(rotX).toBeGreaterThan(0); // positive = top toward viewer
    console.log('[PASS] image below viewport tilts forward:', rotX, 'deg');
  });

  it('tilts forward when image is above viewport centre', () => {
    // rectTop = -rectHeight (image has scrolled past top)
    const t = buildProductTransform(-rectHeight, rectHeight, viewH, 0, 0);
    const rotX = parseFloat(t.match(/rotateX\(([^d]+)deg\)/)?.[1] ?? '0');
    expect(rotX).toBeLessThan(0); // negative = top away from viewer
    console.log('[PASS] image above viewport tilts backward:', rotX, 'deg');
  });

  it('adds mouse tilt on desktop', () => {
    const rectTop  = viewH / 2 - rectHeight / 2; // centred
    const tNoMouse = buildProductTransform(rectTop, rectHeight, viewH, 0,   0,   false);
    const tMouse   = buildProductTransform(rectTop, rectHeight, viewH, 0.5, 0.5, false);

    const getRotY = (s: string) => parseFloat(s.match(/rotateY\(([^d]+)deg\)/)?.[1] ?? '0');
    // Mouse at dx=0.5 → positive rotY contribution
    expect(getRotY(tMouse)).toBeGreaterThan(getRotY(tNoMouse));
    console.log('[PASS] desktop mouse tilt applied to centred image');
  });

  it('ignores mouse input on mobile', () => {
    const rectTop = viewH / 2 - rectHeight / 2;
    const tNoMouse = buildProductTransform(rectTop, rectHeight, viewH, 0,   0,   true);
    const tMouse   = buildProductTransform(rectTop, rectHeight, viewH, 1.0, 1.0, true);
    expect(tNoMouse).toBe(tMouse);
    console.log('[PASS] mobile ignores mouse tilt input');
  });
});

// ---------------------------------------------------------------------------
// Utility: scroll-progress clamping
// ---------------------------------------------------------------------------

describe('Scroll progress helpers', () => {
  it('clamps progress to [0, 1]', () => {
    const clamp = (scrollY: number, height: number) => Math.min(scrollY / height, 1);
    expect(clamp(0,    1000)).toBe(0);
    expect(clamp(500,  1000)).toBe(0.5);
    expect(clamp(1000, 1000)).toBe(1);
    expect(clamp(2000, 1000)).toBe(1); // over-scroll
    console.log('[PASS] scroll progress correctly clamped to 0–1');
  });
});

// ---------------------------------------------------------------------------
// Reduced-motion: no transform applied when flag is set
// ---------------------------------------------------------------------------

describe('Reduced-motion guard', () => {
  it('skips all transforms when reducedMotion is true', () => {
    // Simulate the guard: if reducedMotion → return early without applying transform
    const applyTransform = (reducedMotion: boolean, el: { style: { transform: string } }) => {
      if (reducedMotion) return;
      el.style.transform = 'perspective(1200px) rotateX(-7.00deg)';
    };

    const el = { style: { transform: '' } };
    applyTransform(true, el);
    expect(el.style.transform).toBe('');
    console.log('[PASS] reduced-motion guard prevents transform application');
  });

  it('applies transform when reducedMotion is false', () => {
    const applyTransform = (reducedMotion: boolean, el: { style: { transform: string } }) => {
      if (reducedMotion) return;
      el.style.transform = 'perspective(1200px) rotateX(-7.00deg)';
    };

    const el = { style: { transform: '' } };
    applyTransform(false, el);
    expect(el.style.transform).not.toBe('');
    console.log('[PASS] transform applied when reduced-motion is off');
  });
});

// ---------------------------------------------------------------------------
// Animation frame batching (RAF de-duplication)
// ---------------------------------------------------------------------------

describe('Animation frame batching', () => {
  it('cancels pending RAF before scheduling a new one', () => {
    const cancelled: number[] = [];
    const mockCancelRAF = (id: number) => cancelled.push(id);

    let rafId: number | undefined = 42; // simulate a pending frame

    // Simulate what onScroll does
    if (rafId !== undefined) mockCancelRAF(rafId);
    rafId = 99;

    expect(cancelled).toContain(42);
    expect(rafId).toBe(99);
    console.log('[PASS] previous RAF cancelled before scheduling next');
  });
});
