// Project Ascension — the 3D "Ascension Core".
// A faceted crystal core wrapped in an energy lattice and a drifting particle
// field. It evolves with the player's level (hue, complexity, energy) and
// bursts on level-up. Falls back silently if WebGL is unavailable.

import * as THREE from "three";

const HUES = [
  0.5, 0.52, 0.55, 0.58, 0.62, 0.66, 0.72, 0.78, 0.83, 0.88,
]; // cyan -> teal -> blue -> violet across levels 1..10

export function createCore(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    canvas.classList.add("core-fallback");
    return { setLevel() {}, pulse() {}, dispose() {} };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);

  const group = new THREE.Group();
  scene.add(group);

  // Inner solid crystal -------------------------------------------------
  const coreGeo = new THREE.IcosahedronGeometry(1.35, 1);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0a2540,
    metalness: 0.6,
    roughness: 0.2,
    flatShading: true,
    transparent: true,
    opacity: 0.92,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  // Energy lattice (wireframe shell) ------------------------------------
  const latticeGeo = new THREE.IcosahedronGeometry(1.85, 2);
  const latticeMat = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  });
  const lattice = new THREE.Mesh(latticeGeo, latticeMat);
  group.add(lattice);

  // Glowing inner pulse -------------------------------------------------
  const glowGeo = new THREE.SphereGeometry(0.55, 32, 32);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  group.add(glow);

  // Orbiting ring -------------------------------------------------------
  const ringGeo = new THREE.TorusGeometry(2.45, 0.012, 16, 120);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.5 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2.3;
  group.add(ring);

  // Particle field ------------------------------------------------------
  const COUNT = 900;
  const positions = new Float32Array(COUNT * 3);
  const radii = new Float32Array(COUNT);
  const speeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const r = 3 + Math.random() * 6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    radii[i] = r;
    speeds[i] = 0.1 + Math.random() * 0.4;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0x7dd3fc,
    size: 0.045,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // Burst sprites for level-up -----------------------------------------
  const BURST = 220;
  const burstPos = new Float32Array(BURST * 3);
  const burstVel = new Float32Array(BURST * 3);
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute("position", new THREE.BufferAttribute(burstPos, 3));
  const bMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.08,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const burst = new THREE.Points(bGeo, bMat);
  scene.add(burst);
  let burstLife = 0;

  // Lights --------------------------------------------------------------
  scene.add(new THREE.AmbientLight(0x404a6b, 1.2));
  const key = new THREE.PointLight(0x38bdf8, 60, 30);
  key.position.set(4, 5, 6);
  scene.add(key);
  const rim = new THREE.PointLight(0xa855f7, 40, 30);
  rim.position.set(-5, -3, 2);
  scene.add(rim);

  // State ---------------------------------------------------------------
  let hue = HUES[0];
  let energy = 0.1; // 0..1 progress through current level
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function applyLevel(level, pct) {
    hue = HUES[Math.min(level - 1, HUES.length - 1)];
    energy = Math.max(0.05, Math.min(1, pct));
    const baseColor = new THREE.Color().setHSL(hue, 0.75, 0.55);
    const latticeColor = new THREE.Color().setHSL(hue, 0.8, 0.7);
    coreMat.color.copy(baseColor);
    coreMat.emissive.copy(baseColor).multiplyScalar(0.25 + energy * 0.35);
    latticeMat.color.copy(latticeColor);
    pMat.color.copy(latticeColor);
    ringMat.color.setHSL((hue + 0.12) % 1, 0.8, 0.7);
    key.color.copy(baseColor);
    // higher level -> denser, faster lattice
    lattice.scale.setScalar(1 + (level - 1) * 0.015);
  }
  applyLevel(1, 0.1);

  function triggerBurst() {
    burstLife = 1;
    bMat.opacity = 1;
    for (let i = 0; i < BURST; i++) {
      burstPos[i * 3] = 0;
      burstPos[i * 3 + 1] = 0;
      burstPos[i * 3 + 2] = 0;
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize().multiplyScalar(0.06 + Math.random() * 0.12);
      burstVel[i * 3] = dir.x;
      burstVel[i * 3 + 1] = dir.y;
      burstVel[i * 3 + 2] = dir.z;
    }
    bMat.color.setHSL(hue, 0.7, 0.8);
  }

  // Interaction ---------------------------------------------------------
  function onPointer(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    pointer.tx = (cx / rect.width - 0.5) * 0.6;
    pointer.ty = (cy / rect.height - 0.5) * 0.6;
  }
  window.addEventListener("pointermove", onPointer);

  // Resize --------------------------------------------------------------
  function resize() {
    const w = canvas.clientWidth || canvas.offsetWidth || 1;
    const h = canvas.clientHeight || canvas.offsetHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // Loop ----------------------------------------------------------------
  const clock = new THREE.Clock();
  let running = true;
  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    const t = clock.getElapsedTime();
    const dt = clock.getDelta();

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    group.rotation.y = t * 0.18 + pointer.x;
    group.rotation.x = Math.sin(t * 0.25) * 0.12 + pointer.y;
    lattice.rotation.y = -t * 0.3;
    lattice.rotation.z = t * 0.12;
    ring.rotation.z = t * 0.5;

    const pulse = 1 + Math.sin(t * 2.4) * 0.06 * (0.4 + energy);
    glow.scale.setScalar(pulse * (0.7 + energy * 0.6));
    glowMat.opacity = 0.55 + energy * 0.35 + Math.sin(t * 2.4) * 0.1;

    particles.rotation.y = t * 0.04;
    particles.rotation.x = t * 0.02;

    if (burstLife > 0) {
      burstLife -= dt * 0.8;
      for (let i = 0; i < BURST; i++) {
        burstPos[i * 3] += burstVel[i * 3];
        burstPos[i * 3 + 1] += burstVel[i * 3 + 1];
        burstPos[i * 3 + 2] += burstVel[i * 3 + 2];
      }
      bGeo.attributes.position.needsUpdate = true;
      bMat.opacity = Math.max(0, burstLife);
    }

    renderer.render(scene, camera);
  }
  tick();

  return {
    setLevel: applyLevel,
    pulse: triggerBurst,
    dispose() {
      running = false;
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      renderer.dispose();
    },
  };
}
