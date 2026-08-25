"use client";

import { useEffect, useRef } from "react";

type Color = [number, number, number];

type PixelCell = {
  x: number;
  y: number;
  localX: number;
  localY: number;
  threshold: number;
  colorPhase: number;
  sectionPhase: number;
  opacity: number;
  targetOpacity: number;
  color: Color;
  targetColor: Color;
  offsetX: number;
  offsetY: number;
  targetOffsetX: number;
  targetOffsetY: number;
};

type ClusterDefinition = {
  x: number;
  y: number;
  columns: number;
  rows: number;
  seed: number;
  hotspotX: number;
  hotspotY: number;
};

type AnimatedCluster = {
  cells: PixelCell[];
  phase: number;
  speed: number;
  hotspotX: number;
  hotspotY: number;
};

const COLORS: readonly Color[] = [
  [38, 84, 255],
  [157, 125, 245],
  [242, 211, 105],
  [151, 218, 125],
];

const CLUSTERS: ClusterDefinition[] = [
  { x: 0.02, y: 0.23, columns: 19, rows: 15, seed: 1.7, hotspotX: -0.25, hotspotY: 0.18 },
  { x: 0.97, y: 0.17, columns: 20, rows: 14, seed: 4.2, hotspotX: 0.2, hotspotY: -0.15 },
  { x: 0.985, y: 0.55, columns: 15, rows: 20, seed: 7.8, hotspotX: -0.18, hotspotY: 0.28 },
  { x: 0.035, y: 0.7, columns: 17, rows: 13, seed: 11.4, hotspotX: 0.22, hotspotY: -0.2 },
  { x: 0.8, y: 0.93, columns: 19, rows: 11, seed: 15.1, hotspotX: -0.3, hotspotY: -0.12 },
];

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edgeStart: number, edgeEnd: number, value: number) {
  const amount = clamp((value - edgeStart) / Math.max(0.0001, edgeEnd - edgeStart));
  return amount * amount * (3 - 2 * amount);
}

function hash(x: number, y: number, seed: number) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function ellipse(x: number, y: number, centerX: number, centerY: number, radiusX: number, radiusY: number) {
  const dx = (x - centerX) / radiusX;
  const dy = (y - centerY) / radiusY;
  return Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
}

function isProtectedContentArea(x: number, y: number, width: number, height: number) {
  const normalizedX = x / width;
  const normalizedY = y / height;
  const horizontalInset = width < 640 ? 0.12 : 0.16;
  return (
    normalizedY > 0.11 &&
    normalizedY < 0.88 &&
    normalizedX > horizontalInset &&
    normalizedX < 1 - horizontalInset
  );
}

function copyColor(color: Color): Color {
  return [color[0], color[1], color[2]];
}

function paletteColor(position: number): Color {
  const wrappedPosition = ((position % COLORS.length) + COLORS.length) % COLORS.length;
  const index = Math.floor(wrappedPosition);
  const nextIndex = (index + 1) % COLORS.length;
  const amount = wrappedPosition - index;
  const current = COLORS[index];
  const next = COLORS[nextIndex];
  return [
    current[0] + (next[0] - current[0]) * amount,
    current[1] + (next[1] - current[1]) * amount,
    current[2] + (next[2] - current[2]) * amount,
  ];
}

function createClusters(width: number, height: number, stepX: number, stepY: number): AnimatedCluster[] {
  return CLUSTERS.map((cluster, clusterIndex) => {
    const cells: PixelCell[] = [];
    const centerX = Math.round((width * cluster.x) / stepX) * stepX;
    const centerY = Math.round((height * cluster.y) / stepY) * stepY;
    const halfColumns = cluster.columns / 2;
    const halfRows = cluster.rows / 2;

    for (let row = 0; row < cluster.rows; row += 1) {
      for (let column = 0; column < cluster.columns; column += 1) {
        const localX = (column - halfColumns) / halfColumns;
        const localY = (row - halfRows) / halfRows;
        const envelope = Math.max(
          ellipse(localX, localY, 0, 0, 1, 0.94),
          ellipse(localX, localY, cluster.hotspotX, cluster.hotspotY, 0.66, 0.7),
        );
        if (envelope <= 0.035) continue;

        const x = centerX + Math.round(column - halfColumns) * stepX;
        const y = centerY + Math.round(row - halfRows) * stepY;
        if (isProtectedContentArea(x, y, width, height)) continue;

        const threshold = 0.2 + hash(column, row, cluster.seed) * 0.62;
        const colorPhase = hash(column + 19, row - 7, cluster.seed) * COLORS.length;
        const sectionColumn = Math.floor((localX + 1) * 1.8);
        const sectionRow = Math.floor((localY + 1) * 1.6);
        const sectionPhase = hash(sectionColumn, sectionRow, cluster.seed + 3.8) * Math.PI * 2;
        const initialColor = paletteColor(colorPhase);
        const initialOpacity = smoothstep(threshold - 0.12, threshold + 0.08, envelope) * (0.18 + envelope * 0.56);

        cells.push({
          x,
          y,
          localX,
          localY,
          threshold,
          colorPhase,
          sectionPhase,
          opacity: initialOpacity,
          targetOpacity: initialOpacity,
          color: copyColor(initialColor),
          targetColor: copyColor(initialColor),
          offsetX: 0,
          offsetY: 0,
          targetOffsetX: 0,
          targetOffsetY: 0,
        });
      }
    }

    return {
      cells,
      phase: cluster.seed * 0.73 + clusterIndex * 1.17,
      speed: 0.72 + clusterIndex * 0.075,
      hotspotX: cluster.hotspotX,
      hotspotY: cluster.hotspotY,
    };
  });
}

function sampleMovingField(cell: PixelCell, cluster: AnimatedCluster, time: number) {
  const clusterTime = time * cluster.speed + cluster.phase;
  const primaryCenterX = Math.sin(clusterTime * 0.83) * 0.22;
  const primaryCenterY = Math.cos(clusterTime * 0.67) * 0.16;
  const secondaryCenterX = cluster.hotspotX + Math.cos(clusterTime * 0.58 + 1.4) * 0.18;
  const secondaryCenterY = cluster.hotspotY + Math.sin(clusterTime * 0.76 + 0.7) * 0.2;
  const primaryRadiusX = 0.78 + Math.sin(clusterTime * 0.52) * 0.12;
  const primaryRadiusY = 0.66 + Math.cos(clusterTime * 0.46) * 0.11;

  const primary = ellipse(
    cell.localX,
    cell.localY,
    primaryCenterX,
    primaryCenterY,
    primaryRadiusX,
    primaryRadiusY,
  );
  const secondary = ellipse(
    cell.localX,
    cell.localY,
    secondaryCenterX,
    secondaryCenterY,
    0.54,
    0.58,
  );
  const flowingBand = 0.58 + Math.sin(
    cell.localX * 3.7 - cell.localY * 2.5 + clusterTime * 1.3,
  ) * 0.2 + Math.cos(cell.localY * 4.1 + clusterTime * 0.91) * 0.12;

  return clamp(Math.max(primary * 0.9, secondary) * flowingBand * 1.34);
}

function interpolate(current: number, target: number, easing: number) {
  return current + (target - current) * easing;
}

function drawGridLockedCell(
  context: CanvasRenderingContext2D,
  cell: PixelCell,
  stepX: number,
  stepY: number,
  cellWidth: number,
  cellHeight: number,
) {
  if (cell.opacity < 0.01) return;

  const offsetInCellsX = cell.offsetX / stepX;
  const offsetInCellsY = cell.offsetY / stepY;
  const baseOffsetColumn = Math.floor(offsetInCellsX);
  const baseOffsetRow = Math.floor(offsetInCellsY);
  const fractionX = offsetInCellsX - baseOffsetColumn;
  const fractionY = offsetInCellsY - baseOffsetRow;
  const red = Math.round(cell.color[0]);
  const green = Math.round(cell.color[1]);
  const blue = Math.round(cell.color[2]);

  for (let row = 0; row <= 1; row += 1) {
    const rowWeight = row === 0 ? 1 - fractionY : fractionY;
    if (rowWeight <= 0.005) continue;

    for (let column = 0; column <= 1; column += 1) {
      const columnWeight = column === 0 ? 1 - fractionX : fractionX;
      const alpha = cell.opacity * rowWeight * columnWeight;
      if (alpha < 0.008) continue;

      const x = cell.x + (baseOffsetColumn + column) * stepX;
      const y = cell.y + (baseOffsetRow + row) * stepY;
      context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`;
      context.fillRect(Math.round(x), Math.round(y), cellWidth, cellHeight);
    }
  }
}

export function HeroPixelField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !parent || !context) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let prefersReducedMotion = motionQuery.matches;
    let isVisible = true;
    let animationFrame: number | null = null;
    let resizeFrame: number | null = null;
    let previousFrameTime = performance.now();
    let clusters: AnimatedCluster[] = [];
    let cellWidth = 5;
    let cellHeight = 4;
    let stepX = 9;
    let stepY = 8;
    let canvasWidth = 0;
    let canvasHeight = 0;

    const draw = () => {
      context.clearRect(0, 0, canvasWidth, canvasHeight);
      for (const cluster of clusters) {
        for (const cell of cluster.cells) {
          drawGridLockedCell(context, cell, stepX, stepY, cellWidth, cellHeight);
        }
      }
    };

    const animate = (timestamp: number) => {
      const deltaSeconds = Math.min(0.05, Math.max(0, timestamp - previousFrameTime) / 1000);
      previousFrameTime = timestamp;
      const motionScale = prefersReducedMotion ? 0.6 : 1;
      const fieldTime = timestamp * 0.001 * motionScale;
      const opacityEase = 1 - Math.exp(-deltaSeconds * (prefersReducedMotion ? 3.8 : 6.2));
      const colorEase = 1 - Math.exp(-deltaSeconds * 3.4);
      const offsetEase = 1 - Math.exp(-deltaSeconds * 3.8);

      for (const cluster of clusters) {
        const clusterTime = fieldTime * cluster.speed + cluster.phase;

        for (const cell of cluster.cells) {
          const field = sampleMovingField(cell, cluster, fieldTime);
          const thresholdDrift = Math.sin(clusterTime * 0.74 + cell.localX * 2.2 - cell.localY * 1.7) * 0.075;
          const visibility = smoothstep(
            cell.threshold + thresholdDrift - 0.14,
            cell.threshold + thresholdDrift + 0.08,
            field,
          );
          cell.targetOpacity = visibility * Math.min(0.78, 0.16 + field * 0.66);
          cell.targetColor = paletteColor(cell.colorPhase + field * 1.9 + clusterTime * 0.34);

          if (prefersReducedMotion) {
            cell.targetOffsetX = 0;
            cell.targetOffsetY = 0;
          } else {
            cell.targetOffsetX = Math.sin(clusterTime * 0.73 + cell.sectionPhase) * stepX * 0.72;
            cell.targetOffsetY = Math.cos(clusterTime * 0.61 + cell.sectionPhase * 1.13) * stepY * 0.62;
          }

          cell.opacity = interpolate(cell.opacity, cell.targetOpacity, opacityEase);
          cell.color[0] = interpolate(cell.color[0], cell.targetColor[0], colorEase);
          cell.color[1] = interpolate(cell.color[1], cell.targetColor[1], colorEase);
          cell.color[2] = interpolate(cell.color[2], cell.targetColor[2], colorEase);
          cell.offsetX = interpolate(cell.offsetX, cell.targetOffsetX, offsetEase);
          cell.offsetY = interpolate(cell.offsetY, cell.targetOffsetY, offsetEase);
        }
      }

      draw();
      animationFrame = window.requestAnimationFrame(animate);
    };

    const stopAnimation = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
    };

    const updateAnimation = () => {
      stopAnimation();
      if (isVisible && !document.hidden) {
        previousFrameTime = performance.now();
        animationFrame = window.requestAnimationFrame(animate);
      }
    };

    const resize = () => {
      const bounds = parent.getBoundingClientRect();
      canvasWidth = Math.max(1, Math.round(bounds.width));
      canvasHeight = Math.max(1, Math.round(bounds.height));
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

      canvas.width = Math.round(canvasWidth * pixelRatio);
      canvas.height = Math.round(canvasHeight * pixelRatio);
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const isCompact = canvasWidth < 640;
      cellWidth = isCompact ? 4 : 6;
      cellHeight = isCompact ? 4 : 5;
      stepX = cellWidth + (isCompact ? 4 : 5);
      stepY = cellHeight + (isCompact ? 4 : 5);
      clusters = createClusters(canvasWidth, canvasHeight, stepX, stepY);
      updateAnimation();
    };

    const scheduleResize = () => {
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        resize();
      });
    };

    const handleMotionPreference = () => {
      prefersReducedMotion = motionQuery.matches;
    };
    const handleVisibility = () => updateAnimation();

    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(parent);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? true;
      updateAnimation();
    });
    intersectionObserver.observe(canvas);
    motionQuery.addEventListener("change", handleMotionPreference);
    document.addEventListener("visibilitychange", handleVisibility);
    resize();

    return () => {
      stopAnimation();
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      motionQuery.removeEventListener("change", handleMotionPreference);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 size-full"
      aria-hidden="true"
    />
  );
}
