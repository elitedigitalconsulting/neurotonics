'use client';

/**
 * BrainCanvas — Premium Three.js WebGL brain visualisation
 *
 * Renders a bioluminescent 3D brain matching the reference image aesthetic:
 *   • Dense cellular surface network via WireframeGeometry (shows all triangle edges)
 *     → creates the fine, irregular cell-like mesh covering the brain surface
 *   • Dark solid brain mesh as depth base — glowing network appears on top
 *   • Multi-layer glowing edge wireframe overlay for outer halo/bloom
 *   • Dense surface neural-pathway tubes with additive blending
 *   • Ambient particle field mixing surface and orbital particles
 *   • Concentric halo planes for fake volumetric bloom
 *   • Scroll-driven rotation + "brain activation" lighting surge
 *   • Rhythmic pulse animation (idle heartbeat glow)
 *   • Mouse-tracking subtle tilt
 *   • Desktop: brain offset right so text occupies the left half
 *   • Low-performance device fallback (reduced geometry, lower DPR)
 *   • Fully disposed on unmount to avoid memory leaks
 *   • Respects prefers-reduced-motion
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ─── Configuration ──────────────────────────────────────────────────── */

const BRAIN_RADIUS      = 1.55;   // larger brain fills more of the viewport
const PARTICLE_COUNT    = 900;
const NEURAL_PATH_COUNT   = 130;
// Viewport width above which the brain is offset right (aligns with text layout)
const DESKTOP_BREAKPOINT_WIDTH = 860;

// Pure electric-blue bioluminescent palette — matching reference image
// Colours are biased toward the site's navy/blue brand palette (#0a195a, #1e3a8a)
// with vivid electric accents to reproduce the reference brain aesthetic.
const COL_DEEP_BLUE    = 0x000d1a;  // near-black dark navy base
const COL_MID_BLUE     = 0x0033aa;  // medium brand-consistent blue
const COL_BRIGHT_BLUE  = 0x1155ee;  // vivid electric blue (main network colour)
const COL_CYAN         = 0x3377ff;  // bright blue (reference mid-tone)
const COL_BRIGHT_CYAN  = 0x66aaff;  // bright blue highlight
const COL_ICE_BLUE     = 0xaaccff;  // near-white blue for hottest highlights

// Multicoloured neural-pathway palette — the coloured threads visible in the reference image
const NEURAL_PATH_PALETTE: readonly number[] = [
  0xff3322, // red
  0xff6633, // orange-red
  0x22ee55, // green
  0x00ccff, // cyan
  0x4488ff, // blue
  0xffdd22, // yellow
  0xff44aa, // pink
  0xffffff, // bright white
  0x88ffcc, // mint
  0xff8833, // orange
] as const;

/* ─── Helpers ────────────────────────────────────────────────────────── */

/**
 * Displace a normalised vertex to carve brain-like gyri / sulci.
 * Returns a signed scalar displacement applied along the surface normal.
 */
function brainDisplace(v: THREE.Vector3): number {
  const { x, y, z } = v.clone().normalize();

  // Major lobe shapes — low-frequency, high-amplitude waves
  let d = 0;
  d += Math.sin(x * 8.0 + y * 5.0) * 0.055;
  d += Math.cos(y * 7.0 + z * 6.0) * 0.048;
  d += Math.sin(z * 9.0 + x * 4.0) * 0.042;
  d += Math.cos(x * 6.0 + z * 7.0) * 0.036;
  d += Math.sin(y * 5.0 + z * 4.5) * 0.028;

  // Frontal / parietal lobe division
  d += Math.sin(z * 3.5) * 0.024;

  // Cerebellum — depression at rear-bottom
  const rearBottom = -z * 0.65 + -y * 0.55;
  if (rearBottom > 0.3) d -= rearBottom * 0.070;

  // Deep longitudinal fissure along the midline — key for brain anatomy
  d -= Math.exp(-x * x * 60) * 0.072;

  // Secondary sulci — mid-frequency detail
  d += Math.sin(x * 13 + y * 10 + z * 8)  * 0.026;
  d += Math.cos(x * 11 + z * 9  + y * 12) * 0.022;

  // Fine sulci texture layers — creates the micro-wrinkle pattern
  d += Math.sin(x * 20 + y * 16 + z * 11) * 0.018;
  d += Math.cos(x * 16 + y * 12 + z * 18) * 0.015;
  d += Math.sin(x * 24 + z * 13 + y *  8) * 0.011;
  d += Math.cos(y * 22 + z * 15 + x * 10) * 0.009;
  d += Math.sin(x * 30 + y * 24 + z * 17) * 0.007;

  return d;
}

/**
 * Build a displaced icosahedron that approximates brain topology.
 * detail 6 → high-res solid mesh; detail 4 → edge wireframe base.
 */
function buildBrainGeometry(detail: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(BRAIN_RADIUS, detail);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v   = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);

    // Oval vertical compression
    v.y *= 0.88;
    // Forebrain protrusion
    v.z += v.z > 0 ? 0.10 : -0.04;
    // Slight lateral compression
    v.x *= 0.95;

    const d = brainDisplace(v);
    v.addScaledVector(v.clone().normalize(), d);

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Build a displaced sphere that approximates a human head profile (side view).
 * Face/forehead protrudes along +z (toward camera). Jaw tapers below.
 * Scaled so the brain (radius ~1.55) sits naturally in the upper cranium.
 */
function buildHeadGeometry(): THREE.BufferGeometry {
  const R   = 2.0;
  const geo = new THREE.SphereGeometry(R, 40, 40);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v   = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = v.x / R, ny = v.y / R, nz = v.z / R;

    // Narrow left–right, elongate vertically for a realistic skull proportion
    v.x *= 0.86;
    v.y *= 1.06;

    // Face / forehead protrusion — front half, central vertical band
    if (nz > 0) {
      const bandH = Math.max(0, 1 - Math.abs(ny - 0.08) * 1.85);
      v.z += nz * bandH * 0.60;
    }

    // Nose bump — small forward protrusion at mid-face centre
    if (nz > 0.55 && ny > -0.18 && ny < 0.14 && Math.abs(nx) < 0.22) {
      const noseR = 1 - Math.abs(nx) / 0.22;
      const noseV = 1 - Math.abs(ny - 0.0) / 0.22;
      const noseFwd = (nz - 0.55) / 0.45;
      v.z += noseR * noseV * noseFwd * 0.40;
    }

    // Flatten back of cranium slightly
    if (nz < -0.32) {
      v.z += (nz + 0.32) * 0.20;
    }

    // Jaw / chin — lower portion tapers to a rounded chin point
    if (ny < -0.50) {
      const cf      = Math.min(1, (-ny - 0.50) / 0.50);
      const frontW  = Math.max(0, nz * 0.5 + 0.5);
      v.x *= (1 - cf * 0.52 * frontW);
      v.z *= (1 - cf * 0.42 * Math.max(0, nz + 0.2));
      v.y -= cf * 0.26 * R;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}


/**
 * Generate a smooth Catmull-Rom spline biased towards the brain surface.
 * Surface-biased paths (r ≈ 0.75–1.0) create the realistic vein/neuron look.
 */
function randomNeuralPath(rng: () => number): THREE.Vector3[] {
  const count  = 4 + Math.floor(rng() * 6);
  const points: THREE.Vector3[] = [];

  for (let i = 0; i < count; i++) {
    const theta = rng() * Math.PI * 2;
    const phi   = Math.acos(2 * rng() - 1);
    const r     = BRAIN_RADIUS * (0.72 + rng() * 0.26); // biased to surface

    points.push(new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta) * 0.95,
      r * Math.sin(phi) * Math.sin(theta) * 0.88,
      r * Math.cos(phi),
    ));
  }

  return points;
}

/** Seeded pseudo-RNG — deterministic layout across renders */
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ─── Component ──────────────────────────────────────────────────────── */

interface Props {
  className?: string;
}

export default function BrainCanvas({ className = '' }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    /* ── Accessibility / performance guards ───────────────────────── */
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Low-performance mode: undefined/low core count → reduce geometry and DPR
    // Treat undefined concurrency as low-perf to be safe on unknown devices
    const isLowPerf = (navigator.hardwareConcurrency ?? 2) <= 4;

    /* ── Renderer ─────────────────────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({
      antialias: !isLowPerf,
      alpha:     true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLowPerf ? 1.5 : 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.7;
    el.appendChild(renderer.domElement);

    /* ── Scene ────────────────────────────────────────────────────── */
    const scene = new THREE.Scene();

    /* ── Camera ───────────────────────────────────────────────────── */
    const camera = new THREE.PerspectiveCamera(
      38,
      el.clientWidth / el.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0.1, 4.2);

    /* ── Lighting ─────────────────────────────────────────────────── */

    // Dark ambient — keeps contrast high, critical for the glow look
    const ambient = new THREE.AmbientLight(0x00081a, 2.2);
    scene.add(ambient);

    // Key — strong electric blue from upper-front (boosted for reference brightness)
    const keyLight = new THREE.PointLight(COL_BRIGHT_BLUE, 520, 28);
    keyLight.position.set(2, 3.5, 5);
    scene.add(keyLight);

    // Fill — rich blue from the left
    const fillLight = new THREE.PointLight(COL_MID_BLUE, 180, 22);
    fillLight.position.set(-4, 1, 2);
    scene.add(fillLight);

    // Rim / back — creates the strong halo seen in the reference image (boosted)
    const rimLight = new THREE.PointLight(COL_CYAN, 420, 24);
    rimLight.position.set(0, 2, -4.5);
    scene.add(rimLight);

    // Top accent — bright blue (reference shows strong top illumination)
    const topLight = new THREE.PointLight(COL_BRIGHT_BLUE, 240, 22);
    topLight.position.set(0, 5.5, 0);
    scene.add(topLight);

    // Neural core glow — activated by scroll
    const coreLight = new THREE.PointLight(COL_BRIGHT_BLUE, 0, 9);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);

    /* ── Root group — scroll / mouse rotation applied here ────────── */
    const root = new THREE.Group();
    scene.add(root);

    /* ─────────────────────────────────────────────────────────────── *
     *  BRAIN CORE MESH                                                 *
     *  Dark, almost-black base — its depth/shading reveals the sulci   *
     * ─────────────────────────────────────────────────────────────── */
    const brainGeoHD = buildBrainGeometry(6); // high-detail solid
    const brainMat   = new THREE.MeshPhysicalMaterial({
      color:               0x0d0518,    // dark purple-black
      roughness:           0.5,
      metalness:           0.08,
      emissive:            new THREE.Color(0x200535), // purple emissive
      emissiveIntensity:   1.4,
      clearcoat:           0.9,
      clearcoatRoughness:  0.18,
    });
    const brainMesh = new THREE.Mesh(brainGeoHD, brainMat);
    root.add(brainMesh);

    /* ─────────────────────────────────────────────────────────────── *
     *  DENSE SURFACE WIREFRAME — the cellular network                  *
     *  WireframeGeometry shows ALL triangle edges (not just prominent  *
     *  ones), creating the fine irregular cell pattern seen in the     *
     *  reference image. High detail = smaller, denser cells.           *
     * ─────────────────────────────────────────────────────────────── */
    const denseDetail  = isLowPerf ? 6 : 9;
    const brainGeoWire = buildBrainGeometry(denseDetail);
    const denseWireGeo = new THREE.WireframeGeometry(brainGeoWire);

    // Primary dense surface — bright electric-blue cells (reference palette)
    const denseWireMat = new THREE.LineBasicMaterial({
      color:       COL_BRIGHT_BLUE,
      transparent: true,
      opacity:     0.65,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    });
    const denseSurface = new THREE.LineSegments(denseWireGeo, denseWireMat);
    root.add(denseSurface);

    // Second dense layer — slightly larger, bright-blue glow halo around each cell
    const denseWireGeo2 = denseWireGeo.clone();
    const denseWireMat2 = new THREE.LineBasicMaterial({
      color:       COL_BRIGHT_CYAN,
      transparent: true,
      opacity:     0.28,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    });
    const denseSurface2 = new THREE.LineSegments(denseWireGeo2, denseWireMat2);
    denseSurface2.scale.setScalar(1.008);
    root.add(denseSurface2);

    /* ─────────────────────────────────────────────────────────────── *
     *  GLASS HEAD — translucent human skull silhouette                 *
     *  Surrounds the brain; face protrudes along +z (toward camera).   *
     *  Brain (radius ~1.55) sits in the upper cranium with the jaw     *
     *  and neck visible below.                                          *
     * ─────────────────────────────────────────────────────────────── */
    const HEAD_OFFSET_Y = -0.38; // shift head down so brain is in upper cranium

    const headGeo = buildHeadGeometry();

    // Glass shell — semi-transparent, DoubleSide for inner+outer faces
    const headMat = new THREE.MeshPhysicalMaterial({
      color:        new THREE.Color(0x607080),
      roughness:    0.12,
      metalness:    0.08,
      transparent:  true,
      opacity:      0.11,
      side:         THREE.DoubleSide,
      depthWrite:   false,
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.renderOrder = 10;

    // Rim glow layer — back-face additive blending creates a silhouette halo
    const headRimMat = new THREE.MeshBasicMaterial({
      color:        new THREE.Color(0x3a5588),
      transparent:  true,
      opacity:      0.07,
      blending:     THREE.AdditiveBlending,
      side:         THREE.BackSide,
      depthWrite:   false,
    });
    const headRimMesh = new THREE.Mesh(headGeo, headRimMat);
    headRimMesh.scale.setScalar(1.015);
    headRimMesh.renderOrder = 9;

    // Edge wireframe — glowing structural outline of the head shape
    const headEdgeGeo = new THREE.EdgesGeometry(headGeo, 10);
    const headEdgeMat = new THREE.LineBasicMaterial({
      color:        0x7a9bbb,
      transparent:  true,
      opacity:      0.26,
      blending:     THREE.AdditiveBlending,
      depthWrite:   false,
    });
    const headEdges = new THREE.LineSegments(headEdgeGeo, headEdgeMat);
    headEdges.renderOrder = 11;

    // Neck cylinder — tapered, same glass material as head
    const neckGeo  = new THREE.CylinderGeometry(0.48, 0.60, 1.4, 18);
    const neckMesh = new THREE.Mesh(neckGeo, headMat);
    neckMesh.position.set(0, -3.10, -0.06);
    neckMesh.renderOrder = 10;

    const headGroup = new THREE.Group();
    headGroup.add(headMesh);
    headGroup.add(headRimMesh);
    headGroup.add(headEdges);
    headGroup.add(neckMesh);
    headGroup.position.y = HEAD_OFFSET_Y;
    root.add(headGroup);

    /* ─────────────────────────────────────────────────────────────── *
     *  WIREFRAME GLOW LAYERS — three concentric edge sets              *
     *  EdgesGeometry only shows topology-defining edges, giving the    *
     *  larger-scale glow halo / bloom silhouette effect                *
     * ─────────────────────────────────────────────────────────────── */

    // Shared medium-detail geometry for edge extraction (cheaper than HD)
    const brainGeoMD = buildBrainGeometry(isLowPerf ? 2 : 4);
    // EdgesGeometry at 15° threshold: keeps topology-defining edges
    const edgesBase  = new THREE.EdgesGeometry(brainGeoMD, 15);

    // Layer 1 — bright inner lines (scale 1.0, highest opacity)
    const wireMat1 = new THREE.LineBasicMaterial({
      color:       COL_ICE_BLUE,
      transparent: true,
      opacity:     0.90,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    });
    const wire1 = new THREE.LineSegments(edgesBase, wireMat1);
    root.add(wire1);

    // Layer 2 — mid glow ring (scale 1.012, bright blue tint)
    const edgesGeo2 = edgesBase.clone();
    const wireMat2  = new THREE.LineBasicMaterial({
      color:       COL_CYAN,
      transparent: true,
      opacity:     0.68,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    });
    const wire2 = new THREE.LineSegments(edgesGeo2, wireMat2);
    wire2.scale.setScalar(1.012);
    root.add(wire2);

    // Layer 3 — outermost soft haze (scale 1.030, medium blue)
    const edgesGeo3 = edgesBase.clone();
    const wireMat3  = new THREE.LineBasicMaterial({
      color:       COL_MID_BLUE,
      transparent: true,
      opacity:     0.38,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    });
    const wire3 = new THREE.LineSegments(edgesGeo3, wireMat3);
    wire3.scale.setScalar(1.030);
    root.add(wire3);

    /* ─────────────────────────────────────────────────────────────── *
     *  NEURAL SURFACE PATHWAYS                                         *
     *  Glowing tubes biased near the brain surface (gyri trace)        *
     * ─────────────────────────────────────────────────────────────── */
    const rng       = seededRng(42);
    const pathCount = isLowPerf ? 65 : NEURAL_PATH_COUNT;

    interface NeuralPath {
      mesh:        THREE.Mesh;
      mat:         THREE.MeshBasicMaterial;
      phase:       number;
      speed:       number;
      baseOpacity: number; // pre-computed so RNG stays stable per-frame
    }

    const neuralPaths: NeuralPath[] = [];

    for (let i = 0; i < pathCount; i++) {
      const points = randomNeuralPath(rng);
      const curve  = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
      const radius = 0.006 + rng() * 0.009;
      const segs   = isLowPerf ? 8 : 12;

      const tubeGeo = new THREE.TubeGeometry(curve, segs, radius, 3, false);

      // Vary colour across the multicoloured palette (reference image coloured threads)
      const palIdx = Math.floor(rng() * NEURAL_PATH_PALETTE.length);
      const col    = new THREE.Color(NEURAL_PATH_PALETTE[palIdx]);
      const baseOpacity = 0.14 + rng() * 0.22;

      const tubeMat = new THREE.MeshBasicMaterial({
        color:       col,
        transparent: true,
        opacity:     baseOpacity,
        blending:    THREE.AdditiveBlending,
        depthWrite:  false,
      });

      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      root.add(tube);

      neuralPaths.push({
        mesh: tube,
        mat:  tubeMat,
        phase:       rng() * Math.PI * 2,
        speed:       0.5 + rng() * 1.3,
        baseOpacity,
      });
    }

    /* ─────────────────────────────────────────────────────────────── *
     *  AMBIENT PARTICLE FIELD                                          *
     *  Mix of surface-near and orbital particles                       *
     * ─────────────────────────────────────────────────────────────── */
    const pCount = isLowPerf ? 450 : PARTICLE_COUNT;
    const pRng   = seededRng(99);
    const pPos   = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
      const theta     = pRng() * Math.PI * 2;
      const phi       = Math.acos(2 * pRng() - 1);
      const onSurface = pRng() > 0.45;
      // 55% close to surface, 45% in wider orbit
      const r = onSurface
        ? BRAIN_RADIUS * (0.96 + pRng() * 0.22)
        : BRAIN_RADIUS * (1.35 + pRng() * 0.75);

      pPos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta) * 0.95;
      pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.88;
      pPos[i * 3 + 2] = r * Math.cos(phi);
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));

    const particleMat = new THREE.PointsMaterial({
      color:           COL_BRIGHT_CYAN,
      size:            0.018,
      sizeAttenuation: true,
      transparent:     true,
      opacity:         0.65,
      blending:        THREE.AdditiveBlending,
      depthWrite:      false,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    /* ─────────────────────────────────────────────────────────────── *
     *  VOLUMETRIC BLOOM PLANES — fake bloom without post-processing    *
     *  Concentric screen-aligned planes with additive blending create  *
     *  the soft radial glow seen around the brain in the reference.    *
     * ─────────────────────────────────────────────────────────────── */
    interface BloomItem {
      mesh: THREE.Mesh;
      mat:  THREE.MeshBasicMaterial;
      base: number;
    }
    const bloomItems: BloomItem[] = [];

    ([
      { size: 3.4, base: 0.09,  color: COL_BRIGHT_BLUE },
      { size: 5.2, base: 0.055, color: COL_MID_BLUE    },
      { size: 7.2, base: 0.030, color: COL_DEEP_BLUE   },
    ] as const).forEach(({ size, base, color }) => {
      const geo = new THREE.PlaneGeometry(size, size);
      const mat = new THREE.MeshBasicMaterial({
        color:       new THREE.Color(color),
        transparent: true,
        opacity:     base,
        blending:    THREE.AdditiveBlending,
        depthWrite:  false,
        side:        THREE.FrontSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = -1.4;
      scene.add(mesh);
      bloomItems.push({ mesh, mat, base });
    });

    /* ── Environment map ──────────────────────────────────────────── */
    const pmremGen   = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGen.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    /* ── Resize handler ───────────────────────────────────────────── */
    const onResize = () => {
      if (!el) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener('resize', onResize);

    /* ── Scroll-driven state (0 = top, 1 = hero fully scrolled) ──── */
    let scrollProgress = 0;
    const onScroll = () => {
      const heroH = el.getBoundingClientRect().height || window.innerHeight;
      scrollProgress = Math.min(window.scrollY / heroH, 1);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    /* ── Mouse-tracking tilt ──────────────────────────────────────── */
    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
      mouseY = ((e.clientY - rect.top ) / rect.height - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    /* ── Animation loop ───────────────────────────────────────────── */
    let frameId: number;
    let elapsed  = 0;
    let lastTime = 0;

    // Smoothed animation state
    // Initialise X rotation with tilt bias so the brain shows its cortical
    // surface on load — matching the reference top-down perspective.
    const TILT_BIAS = -0.30;
    let smoothRotX = TILT_BIAS;
    let smoothRotY = 0;
    let smoothAct  = 0;  // neural activation (0–1)
    let smoothPosX = 0;  // lateral offset for right-side positioning

    const animate = (now: number) => {
      frameId  = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      elapsed += dt;

      if (prefersReduced) {
        renderer.render(scene, camera);
        return;
      }

      /* ── Lateral offset — brain sits right of centre on desktop ── */
      const targetPosX = el.clientWidth > DESKTOP_BREAKPOINT_WIDTH ? 0.72 : 0.0;
      smoothPosX += (targetPosX - smoothPosX) * (1 - Math.exp(-dt * 3));
      root.position.x = smoothPosX;

      /* ── Rotation ─────────────────────────────────────────────── */
      const targetRotY = scrollProgress * Math.PI * 1.15 + mouseX * 0.20;
      // Permanent TILT_BIAS keeps the initial view tilted toward top-down
      // so the cortical surface is prominently visible (matches reference image)
      const targetRotX = TILT_BIAS - scrollProgress * 0.26 + mouseY * -0.12;
      const swayY      = Math.sin(elapsed * 0.26) * 0.055;
      const swayX      = Math.cos(elapsed * 0.18) * 0.022;

      const k = 1 - Math.exp(-dt * 4);
      smoothRotY += (targetRotY + swayY - smoothRotY) * k;
      smoothRotX += (targetRotX + swayX - smoothRotX) * k;

      root.rotation.y = smoothRotY;
      root.rotation.x = smoothRotX;

      /* ── Neural activation driven by scroll ───────────────────── */
      const actTarget = Math.pow(scrollProgress, 0.5);
      smoothAct += (actTarget - smoothAct) * (1 - Math.exp(-dt * 3));

      // Rhythmic heartbeat-like pulse (always running)
      const pulse     = (Math.sin(elapsed * 1.9) * 0.5 + 0.5);
      const slowPulse = (Math.sin(elapsed * 0.65) * 0.5 + 0.5);

      /* ── Brain core emissive glow ─────────────────────────────── */
      // Pure electric-blue emissive to match reference (no green/cyan tint)
      brainMat.emissiveIntensity = 1.8 + smoothAct * 3.2 + pulse * 0.40;
      brainMat.emissive.setRGB(
        0.08 + smoothAct * 0.22 + pulse * 0.05,  // red — gives purple hue
        0.01 + smoothAct * 0.05,                   // tiny green
        0.21 + smoothAct * 0.48 + pulse * 0.10,  // blue
      );

      /* ── Dense cellular surface wireframe ────────────────────── */
      denseWireMat.opacity  = 0.65 + smoothAct * 0.30 + pulse * 0.12;
      denseWireMat2.opacity = 0.28 + smoothAct * 0.22 + slowPulse * 0.08;

      /* ── Wireframe glow layers ────────────────────────────────── */
      wireMat1.opacity = 0.92 + smoothAct * 0.08 + pulse     * 0.08;
      wireMat2.opacity = 0.68 + smoothAct * 0.24 + slowPulse * 0.10;
      wireMat3.opacity = 0.38 + smoothAct * 0.20;

      /* ── Lighting surge on activation ────────────────────────── */
      keyLight.intensity  = 520 + smoothAct * 420 + pulse * 140;
      rimLight.intensity  = 420 + smoothAct * 300;
      topLight.intensity  = 240 + smoothAct * 180;
      coreLight.intensity = smoothAct * 100 + pulse * 40;

      /* ── Neural pathway pulses ────────────────────────────────── */
      neuralPaths.forEach((np, i) => {
        const threshold = i / neuralPaths.length;
        // Activation front sweeps through paths as scroll increases
        const pathAct = Math.max(0, (smoothAct + 0.35 - threshold * 0.55) * 2.2);
        const p       = (Math.sin(elapsed * np.speed + np.phase) + 1) * 0.5;
        np.mat.opacity = Math.min(
          np.baseOpacity + pathAct * (0.55 + p * 0.40),
          0.94,
        );
      });

      /* ── Particles ────────────────────────────────────────────── */
      particles.rotation.y = elapsed * 0.055;
      particles.rotation.x = elapsed * 0.020;
      particleMat.opacity  = 0.55 + smoothAct * 0.35 + slowPulse * 0.08;

      /* ── Bloom planes ─────────────────────────────────────────── */
      bloomItems.forEach((b) => {
        b.mat.opacity = b.base + smoothAct * 0.065 + slowPulse * 0.022;
      });

      /* ── Render ───────────────────────────────────────────────── */
      renderer.render(scene, camera);
    };

    frameId = requestAnimationFrame(animate);

    /* ── Cleanup ──────────────────────────────────────────────────── */
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize',    onResize);
      window.removeEventListener('scroll',    onScroll);
      window.removeEventListener('mousemove', onMouseMove);

      // Dispose all Three.js GPU resources
      brainGeoHD.dispose();
      brainGeoMD.dispose();
      brainGeoWire.dispose();
      brainMat.dispose();
      denseWireGeo.dispose();
      denseWireGeo2.dispose();
      denseWireMat.dispose();
      denseWireMat2.dispose();
      headGeo.dispose();
      headMat.dispose();
      headRimMat.dispose();
      headEdgeGeo.dispose();
      headEdgeMat.dispose();
      neckGeo.dispose();
      edgesBase.dispose();
      edgesGeo2.dispose();
      edgesGeo3.dispose();
      wireMat1.dispose();
      wireMat2.dispose();
      wireMat3.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      neuralPaths.forEach((np) => {
        np.mesh.geometry.dispose();
        np.mat.dispose();
      });
      bloomItems.forEach((b) => {
        b.mesh.geometry.dispose();
        b.mat.dispose();
      });
      envTexture.dispose();
      pmremGen.dispose();
      renderer.dispose();

      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={className}
      aria-hidden="true"
    />
  );
}
