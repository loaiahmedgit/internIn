"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Ambient full-bleed particle field behind the hero, inspired by base.org's
 * canvas hero background (inspected via their DOM: a full-bleed three.js
 * canvas masked to white at the center and edges — the mask itself already
 * exists in Hero() in landing-page.tsx). This is a deliberate, scoped
 * exception to design-system/internin/MASTER.md's "no 3D" rule — see the
 * note added there. Kept restrained: slow drift, low opacity, brand colors
 * only, no bloom/glow, respects prefers-reduced-motion.
 *
 * Gotcha that made the first version invisible: with an OrthographicCamera,
 * three.js's Points vertex shader skips the sizeAttenuation branch entirely
 * (it only applies for perspective cameras), so PointsMaterial.size is
 * effectively raw CSS pixels here, not a fraction of world-space frustum
 * size. A "world unit" size like 0.014 rendered as a sub-pixel, invisible
 * dot. Size below is a real pixel value.
 */
export function HeroThreeField() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const initialAspect = Math.max(0.5, container.clientWidth / Math.max(1, container.clientHeight));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-initialAspect, initialAspect, 1, -1, 0.1, 10);
    camera.position.z = 2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    container.appendChild(renderer.domElement);

    const ROWS = 15;
    const COLS = Math.round(ROWS * initialAspect * 1.35);
    const COUNT = COLS * ROWS;

    const positions = new Float32Array(COUNT * 3);
    const basePositions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const navy = new THREE.Color("#213248");
    const teal = new THREE.Color("#1ba59c");

    let i = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++, i++) {
        const x = (col / (COLS - 1)) * 2 * initialAspect - initialAspect;
        const y = (row / (ROWS - 1)) * 2 - 1;
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = 0;
        basePositions[i * 3] = x;
        basePositions[i * 3 + 1] = y;

        const mixed = navy.clone().lerp(teal, 0.45 + Math.random() * 0.55);
        colors[i * 3] = mixed.r;
        colors[i * 3 + 1] = mixed.g;
        colors[i * 3 + 2] = mixed.b;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2.6 * pixelRatio,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    function resize() {
      if (!container) return;
      const { clientWidth: w, clientHeight: h } = container;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      const aspect = w / h;
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const timer = new THREE.Timer();
    let frameId = 0;

    function renderStaticFrame() {
      renderer.render(scene, camera);
    }

    function animate() {
      timer.update();
      const t = timer.getElapsed();
      const pos = geometry.attributes.position as THREE.BufferAttribute;
      for (let idx = 0; idx < COUNT; idx++) {
        const bx = basePositions[idx * 3];
        const by = basePositions[idx * 3 + 1];
        const wave = Math.sin(bx * 2.1 + t * 0.35) * 0.025 + Math.cos(by * 2.6 + t * 0.28) * 0.025;
        pos.setXYZ(idx, bx, by + wave, wave * 0.5);
      }
      pos.needsUpdate = true;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }

    if (prefersReducedMotion) {
      renderStaticFrame();
    } else {
      animate();
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} aria-hidden="true" className="absolute inset-0" />;
}
