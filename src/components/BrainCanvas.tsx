'use client';

/**
 * BrainCanvas — Three.js WebGL scene
 *
 * Renders a translucent glass human head with a procedural 3D brain inside.
 * Features:
 *   • Glass head (MeshPhysicalMaterial, transmission)
 *   • Procedurally displaced brain mesh with fold-like gyri / sulci
 *   • Glowing neural pathway tubes that activate on scroll
 *   • Ambient particle field orbiting the head
 *   • Scroll-driven rotation + lighting intensity ("brain activation")
 *   • Mouse-tracking subtle rotation
 *   • Fully disposed on unmount to avoid memory leaks
 *   • Respects prefers-reduced-motion
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ─── Configuration ──────────────────────────────────────────────────── */

const BRAIN_RADIUS  = 1.0;
const HEAD_RADIUS   = 1.32;
const PARTICLE_COUNT = 600;
const NEURAL_PATH_COUNT = 70;

// Brand palette
const COL_MID_BLUE   = 0x1e3a8a;
const COL_LIGHT_BLUE = 0x3b82f6;
const COL_CYAN       = 0x06b6d4;
const COL_NEURAL     = 0x60a5fa;

/* ─── Helpers ────────────────────────────────────────────────────────── */

/** Displace vertex to create brain-like gyri/sulci topology */
function brainDisplace(v: THREE.Vector3): number {
  const { x, y, z } = v.clone().normalize();

  // Major lobe shapes — low-frequency waves
  let d = 0;
  d += Math.sin(x * 9  + y * 4.5) * 0.036;
  d += Math.cos(y * 7  + z * 5.5) * 0.028;
  d += Math.sin(z * 8  + x * 3.5) * 0.022;
  d += Math.cos(x * 6  + z * 6.0) * 0.018;

  // Cerebellum bump at rear-bottom
  const rearBottom = -z * 0.7 + -y * 0.6;
  if (rearBottom > 0.35) d -= rearBottom * 0.04;

  // Mid-line fissure (longitudinal sulcus)
  d -= Math.exp(-x * x * 80) * 0.025;

  // Finer folds (sulci texture)
  d += Math.sin(x * 18 + y * 14 + z * 9)  * 0.011;
  d += Math.cos(x * 14 + y * 10 + z * 16) * 0.009;
  d += Math.sin(x * 22 + z * 11 + y * 7)  * 0.006;

  return d;
}

/** Build the brain geometry from an icosahedron with vertex displacement */
function buildBrainGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(BRAIN_RADIUS, 6);
  geo.computeVertexNormals();

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v   = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);

    // Flatten top/bottom slightly — more oval
    v.y *= 0.88;
    // Push forward — forebrain protrudes more
    v.z += v.z > 0 ? 0.06 : -0.02;

    const d = brainDisplace(v);
    v.addScaledVector(v.clone().normalize(), d);

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/** Build head skull geometry (smooth ellipsoid) */
function buildHeadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(HEAD_RADIUS, 64, 64);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v   = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.y *= 1.12; // slightly taller
    v.z *= 0.95;
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/** Generate a smooth random Catmull-Rom spline inside the brain volume */
function randomNeuralPath(rng: () => number): THREE.Vector3[] {
  const count  = 5 + Math.floor(rng() * 5);
  const points: THREE.Vector3[] = [];

  for (let i = 0; i < count; i++) {
    const theta = rng() * Math.PI * 2;
    const phi   = Math.acos(2 * rng() - 1);
    const r     = BRAIN_RADIUS * (0.2 + rng() * 0.72);

    points.push(new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.88,
      r * Math.cos(phi),
    ));
  }

  return points;
}

/** Seeded pseudo-RNG so the layout is deterministic across renders */
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
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

    /* ── Reduced-motion guard ─────────────────────────────────────── */
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ── Renderer ─────────────────────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha:     true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    el.appendChild(renderer.domElement);

    /* ── Scene ────────────────────────────────────────────────────── */
    const scene = new THREE.Scene();

    /* ── Camera ───────────────────────────────────────────────────── */
    const camera = new THREE.PerspectiveCamera(
      42,
      el.clientWidth / el.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0.18, 5.2);

    /* ── Lighting ─────────────────────────────────────────────────── */

    // Ambient
    const ambient = new THREE.AmbientLight(0x1a2a6c, 1.8);
    scene.add(ambient);

    // Key light — soft blue from upper-front
    const keyLight = new THREE.PointLight(COL_LIGHT_BLUE, 120, 22);
    keyLight.position.set(2, 3.5, 4);
    scene.add(keyLight);

    // Fill light — cool from the left
    const fillLight = new THREE.PointLight(COL_MID_BLUE, 60, 20);
    fillLight.position.set(-3, 1, 2);
    scene.add(fillLight);

    // Rim / back light — creates halo on head
    const rimLight = new THREE.PointLight(0x4fa3e0, 80, 18);
    rimLight.position.set(0, 2, -3.5);
    scene.add(rimLight);

    // Top accent — warm cyan
    const topLight = new THREE.PointLight(COL_CYAN, 50, 16);
    topLight.position.set(0, 5, 0);
    scene.add(topLight);

    // Neural glow light (starts dim — activated by scroll)
    const neuralLight = new THREE.PointLight(COL_NEURAL, 0, 10);
    neuralLight.position.set(0, 0, 0);
    scene.add(neuralLight);

    /* ── Root group (rotated by scroll / mouse) ───────────────────── */
    const root = new THREE.Group();
    scene.add(root);

    /* ── Brain mesh ───────────────────────────────────────────────── */
    const brainGeo = buildBrainGeometry();
    const brainMat = new THREE.MeshPhysicalMaterial({
      color:        0x1a2e6b,
      roughness:    0.35,
      metalness:    0.15,
      emissive:     new THREE.Color(0x0a1840),
      emissiveIntensity: 0.4,
      clearcoat:    0.6,
      clearcoatRoughness: 0.3,
    });
    const brainMesh = new THREE.Mesh(brainGeo, brainMat);
    root.add(brainMesh);

    /* ── Glass head ───────────────────────────────────────────────── */
    const headGeo = buildHeadGeometry();
    const headMat = new THREE.MeshPhysicalMaterial({
      color:           0x6ea8d8,
      roughness:       0.04,
      metalness:       0.0,
      transmission:    0.84,   // glass-like transparency
      thickness:       0.5,
      ior:             1.38,
      transparent:     true,
      opacity:         0.55,
      side:            THREE.FrontSide,
      envMapIntensity: 1.5,
      clearcoat:       1.0,
      clearcoatRoughness: 0.06,
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    root.add(headMesh);

    /* ── Inner skull wireframe (subtle depth lines) ───────────────── */
    const skullWireGeo = headGeo.clone();
    const skullWireMat = new THREE.MeshBasicMaterial({
      color:       0x4488cc,
      wireframe:   true,
      opacity:     0.04,
      transparent: true,
    });
    const skullWire = new THREE.Mesh(skullWireGeo, skullWireMat);
    skullWire.scale.setScalar(0.998);
    root.add(skullWire);

    /* ── Neural pathways (tubes inside brain) ─────────────────────── */
    const rng = seededRng(42);

    interface NeuralPath {
      mesh:     THREE.Mesh;
      mat:      THREE.MeshStandardMaterial;
      phase:    number;
      speed:    number;
    }

    const neuralPaths: NeuralPath[] = [];

    for (let i = 0; i < NEURAL_PATH_COUNT; i++) {
      const points = randomNeuralPath(rng);
      const curve  = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);

      const tubeGeo = new THREE.TubeGeometry(curve, 14, 0.008 + rng() * 0.012, 4, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color:             COL_NEURAL,
        emissive:          new THREE.Color(COL_NEURAL),
        emissiveIntensity: 0.6,
        roughness:         0.4,
        metalness:         0.1,
        transparent:       true,
        opacity:           0.0, // hidden initially; activated by scroll
        depthWrite:        false,
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      root.add(tube);

      neuralPaths.push({ mesh: tube, mat: tubeMat, phase: rng() * Math.PI * 2, speed: 0.4 + rng() * 0.8 });
    }

    /* ── Ambient particles ────────────────────────────────────────── */
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    const particleSizes     = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta  = rng() * Math.PI * 2;
      const phi    = Math.acos(2 * rng() - 1);
      // Distribute in a shell around the head
      const r      = HEAD_RADIUS * (1.06 + rng() * 0.8);

      particlePositions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 1.12;
      particlePositions[i * 3 + 2] = r * Math.cos(phi);

      particleSizes[i] = 0.5 + rng() * 1.5;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('size',     new THREE.BufferAttribute(particleSizes, 1));

    const particleMat = new THREE.PointsMaterial({
      color:       COL_CYAN,
      size:        0.025,
      sizeAttenuation: true,
      transparent: true,
      opacity:     0.55,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    /* ── Equatorial ring glow ─────────────────────────────────────── */
    const ringGeo = new THREE.TorusGeometry(HEAD_RADIUS * 1.18, 0.012, 8, 128);
    const ringMat = new THREE.MeshBasicMaterial({
      color:       COL_CYAN,
      transparent: true,
      opacity:     0.18,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    /* ── Outer halo sprite (background bloom) ─────────────────────── */
    const haloGeo = new THREE.PlaneGeometry(5.5, 5.5);
    const haloMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(COL_MID_BLUE),
      transparent: true,
      opacity:     0.12,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
      side:        THREE.FrontSide,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.z = -1.5;
    scene.add(halo);

    /* ── Environment map (simple) ─────────────────────────────────── */
    const pmremGen = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGen.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    scene.environment = envTexture;

    /* ── Resize handler ───────────────────────────────────────────── */
    const onResize = () => {
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    /* ── Scroll-driven animation state ───────────────────────────────
     * scrollProgress: 0 (top) → 1 (hero scrolled away)
     */
    let scrollProgress = 0;

    const onScroll = () => {
      const heroHeight = el.getBoundingClientRect().height || window.innerHeight;
      scrollProgress = Math.min(window.scrollY / heroHeight, 1);
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    /* ── Mouse-tracking rotation ──────────────────────────────────── */
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

    // Smoothed values
    let smoothRotX = 0;
    let smoothRotY = 0;
    let smoothAct  = 0; // neural activation

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      const dt  = Math.min((now - lastTime) / 1000, 0.05);
      lastTime  = now;
      elapsed  += dt;

      if (prefersReduced) {
        renderer.render(scene, camera);
        return;
      }

      /* ── Target rotation ──────────────────────────────────────── */
      // Scroll rotates the head to the right (Y axis) and slightly up (X)
      const targetRotY = scrollProgress * Math.PI * 1.2 + mouseX * 0.22;
      const targetRotX = -scrollProgress * 0.3          + mouseY * -0.14;

      // Slow idle sway when not scrolling
      const swayY = Math.sin(elapsed * 0.28) * 0.06;
      const swayX = Math.cos(elapsed * 0.19) * 0.025;

      // Smooth interpolation (exponential)
      const k = 1 - Math.exp(-dt * 4);
      smoothRotY += (targetRotY + swayY - smoothRotY) * k;
      smoothRotX += (targetRotX + swayX - smoothRotX) * k;

      root.rotation.y = smoothRotY;
      root.rotation.x = smoothRotX;

      /* ── Neural activation (scroll-driven) ───────────────────── */
      const actTarget = Math.pow(scrollProgress, 0.6);
      smoothAct += (actTarget - smoothAct) * (1 - Math.exp(-dt * 3));

      // Neural light intensity
      neuralLight.intensity = smoothAct * 35;

      // Key/fill light boost
      keyLight.intensity  = 120 + smoothAct * 160;
      fillLight.intensity =  60 + smoothAct *  80;

      // Brain emissive glow
      brainMat.emissiveIntensity = 0.4 + smoothAct * 1.8;
      brainMat.emissive.setRGB(
        0.04 + smoothAct * 0.12,
        0.10 + smoothAct * 0.28,
        0.26 + smoothAct * 0.60,
      );

      // Neural pathways — activate progressively, pulse with time
      neuralPaths.forEach((np, i) => {
        // Each path has its own threshold: earlier paths activate first
        const threshold = i / NEURAL_PATH_COUNT;
        const pathAct   = Math.max(0, (smoothAct - threshold * 0.4) * 2.5);
        const pulse     = (Math.sin(elapsed * np.speed + np.phase) + 1) * 0.5;
        np.mat.opacity           = Math.min(pathAct * (0.5 + pulse * 0.5), 0.88);
        np.mat.emissiveIntensity = 0.6 + smoothAct * 2.0 * pulse;
      });

      /* ── Particles ────────────────────────────────────────────── */
      particles.rotation.y  = elapsed * 0.04;
      particles.rotation.x  = elapsed * 0.015;
      particleMat.opacity   = 0.35 + smoothAct * 0.45;

      /* ── Ring ─────────────────────────────────────────────────── */
      ring.rotation.z = elapsed * 0.12;
      ringMat.opacity = 0.10 + smoothAct * 0.25;

      /* ── Halo pulse ───────────────────────────────────────────── */
      haloMat.opacity = 0.08 + smoothAct * 0.14 + Math.sin(elapsed * 0.6) * 0.02;

      /* ── Render ───────────────────────────────────────────────── */
      renderer.render(scene, camera);
    };

    frameId = requestAnimationFrame(animate);

    /* ── Cleanup ──────────────────────────────────────────────────── */
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize',     onResize);
      window.removeEventListener('scroll',     onScroll);
      window.removeEventListener('mousemove',  onMouseMove);

      // Dispose Three.js resources
      brainGeo.dispose();
      brainMat.dispose();
      headGeo.dispose();
      headMat.dispose();
      skullWireGeo.dispose();
      skullWireMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      neuralPaths.forEach((np) => {
        np.mesh.geometry.dispose();
        np.mat.dispose();
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
