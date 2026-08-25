"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type Key,
  type ReactNode,
} from "react";
import "./logo-loop.css";

const ANIMATION_CONFIG = {
  smoothTau: 0.25,
  minimumCopies: 2,
  copyHeadroom: 2,
};

type NodeLogo = {
  node: ReactNode;
  title?: string;
  href?: string;
  ariaLabel?: string;
};

type ImageLogo = {
  src: string;
  srcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
  alt?: string;
  title?: string;
  href?: string;
};

export type LogoItem = NodeLogo | ImageLogo;

type LogoLoopProps = {
  logos: LogoItem[];
  speed?: number;
  direction?: "left" | "right" | "up" | "down";
  width?: number | string;
  logoHeight?: number;
  gap?: number;
  pauseOnHover?: boolean;
  hoverSpeed?: number;
  fadeOut?: boolean;
  fadeOutColor?: string;
  scaleOnHover?: boolean;
  renderItem?: (item: LogoItem, key: Key) => ReactNode;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
};

type LogoLoopCssProperties = CSSProperties & {
  "--logoloop-gap": string;
  "--logoloop-logo-height": string;
  "--logoloop-fade-color"?: string;
};

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback: () => void) {
  const mediaQuery = window.matchMedia(reducedMotionQuery);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(reducedMotionQuery).matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function toCssLength(value: number | string | undefined) {
  return typeof value === "number" ? `${value}px` : value;
}

export const LogoLoop = memo(function LogoLoop({
  logos,
  speed = 120,
  direction = "left",
  width = "100%",
  logoHeight = 28,
  gap = 32,
  pauseOnHover,
  hoverSpeed,
  fadeOut = false,
  fadeOutColor,
  scaleOnHover = false,
  renderItem,
  ariaLabel = "Partner logos",
  className,
  style,
}: LogoLoopProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const sequenceRef = useRef<HTMLUListElement>(null);
  const [sequenceWidth, setSequenceWidth] = useState(0);
  const [sequenceHeight, setSequenceHeight] = useState(0);
  const [copyCount, setCopyCount] = useState(ANIMATION_CONFIG.minimumCopies);
  const [isHovered, setIsHovered] = useState(false);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const isVertical = direction === "up" || direction === "down";
  const effectiveHoverSpeed = useMemo(() => {
    if (hoverSpeed !== undefined) return hoverSpeed;
    if (pauseOnHover === true) return 0;
    if (pauseOnHover === false) return undefined;
    return 0;
  }, [hoverSpeed, pauseOnHover]);

  const targetVelocity = useMemo(() => {
    const axisDirection = isVertical
      ? direction === "up"
        ? 1
        : -1
      : direction === "left"
        ? 1
        : -1;
    const speedDirection = speed < 0 ? -1 : 1;
    return Math.abs(speed) * axisDirection * speedDirection;
  }, [direction, isVertical, speed]);

  const updateDimensions = useCallback(() => {
    const container = containerRef.current;
    const sequence = sequenceRef.current;
    if (!container || !sequence) return;

    const sequenceRect = sequence.getBoundingClientRect();
    const measuredWidth = Math.ceil(sequenceRect.width);
    const measuredHeight = Math.ceil(sequenceRect.height);

    if (isVertical) {
      const parentHeight = container.parentElement?.clientHeight ?? 0;
      if (parentHeight > 0) container.style.height = `${Math.ceil(parentHeight)}px`;
      if (measuredHeight > 0) {
        setSequenceHeight(measuredHeight);
        const viewportHeight = container.clientHeight || parentHeight || measuredHeight;
        setCopyCount(
          Math.max(
            ANIMATION_CONFIG.minimumCopies,
            Math.ceil(viewportHeight / measuredHeight) + ANIMATION_CONFIG.copyHeadroom,
          ),
        );
      }
      return;
    }

    if (measuredWidth > 0) {
      setSequenceWidth(measuredWidth);
      setCopyCount(
        Math.max(
          ANIMATION_CONFIG.minimumCopies,
          Math.ceil(container.clientWidth / measuredWidth) + ANIMATION_CONFIG.copyHeadroom,
        ),
      );
    }
  }, [isVertical]);

  useEffect(() => {
    const container = containerRef.current;
    const sequence = sequenceRef.current;
    if (!container || !sequence) return;

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateDimensions);
      updateDimensions();
      return () => window.removeEventListener("resize", updateDimensions);
    }

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);
    observer.observe(sequence);
    updateDimensions();
    return () => observer.disconnect();
  }, [gap, logoHeight, logos, updateDimensions]);

  useEffect(() => {
    const images = sequenceRef.current?.querySelectorAll("img") ?? [];
    if (images.length === 0) {
      updateDimensions();
      return;
    }

    const handleImageLoad = () => updateDimensions();
    images.forEach((image) => {
      image.addEventListener("load", handleImageLoad);
      image.addEventListener("error", handleImageLoad);
    });
    return () => {
      images.forEach((image) => {
        image.removeEventListener("load", handleImageLoad);
        image.removeEventListener("error", handleImageLoad);
      });
    };
  }, [logos, updateDimensions]);

  useEffect(() => {
    const track = trackRef.current;
    const sequenceSize = isVertical ? sequenceHeight : sequenceWidth;
    if (!track || sequenceSize <= 0 || prefersReducedMotion) return;

    let animationFrame: number | null = null;
    let lastTimestamp: number | null = null;
    let offset = 0;
    let velocity = 0;

    const animate = (timestamp: number) => {
      if (lastTimestamp === null) lastTimestamp = timestamp;
      const deltaTime = Math.max(0, timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;
      const target = isHovered && effectiveHoverSpeed !== undefined ? effectiveHoverSpeed : targetVelocity;
      const easingFactor = 1 - Math.exp(-deltaTime / ANIMATION_CONFIG.smoothTau);
      velocity += (target - velocity) * easingFactor;
      offset = ((offset + velocity * deltaTime) % sequenceSize + sequenceSize) % sequenceSize;
      track.style.transform = isVertical
        ? `translate3d(0, ${-offset}px, 0)`
        : `translate3d(${-offset}px, 0, 0)`;
      animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);
    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      track.style.transform = "";
    };
  }, [
    effectiveHoverSpeed,
    isHovered,
    isVertical,
    prefersReducedMotion,
    sequenceHeight,
    sequenceWidth,
    targetVelocity,
  ]);

  const renderLogo = useCallback(
    (item: LogoItem, key: Key) => {
      if (renderItem) {
        return (
          <li className="logoloop__item" key={key} role="listitem">
            {renderItem(item, key)}
          </li>
        );
      }

      const isNodeItem = "node" in item;
      const content = isNodeItem ? (
        <span className="logoloop__node" aria-hidden={Boolean(item.href && !item.ariaLabel)}>
          {item.node}
        </span>
      ) : (
        // This component supports arbitrary external logo files, so a plain image is intentional.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.src}
          srcSet={item.srcSet}
          sizes={item.sizes}
          width={item.width}
          height={item.height}
          alt={item.alt ?? ""}
          title={item.title}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      );
      const itemAriaLabel = isNodeItem ? (item.ariaLabel ?? item.title) : (item.alt ?? item.title);

      return (
        <li className="logoloop__item" key={key} role="listitem">
          {item.href ? (
            <a
              className="logoloop__link"
              href={item.href}
              aria-label={itemAriaLabel || "Logo link"}
              target="_blank"
              rel="noreferrer noopener"
            >
              {content}
            </a>
          ) : (
            content
          )}
        </li>
      );
    },
    [renderItem],
  );

  const renderedCopyCount = prefersReducedMotion ? 1 : copyCount;
  const logoLists = useMemo(
    () =>
      Array.from({ length: renderedCopyCount }, (_, copyIndex) => (
        <ul
          className="logoloop__list"
          key={`copy-${copyIndex}`}
          role="list"
          aria-hidden={copyIndex > 0}
          ref={copyIndex === 0 ? sequenceRef : undefined}
        >
          {logos.map((item, itemIndex) => renderLogo(item, `${copyIndex}-${itemIndex}`))}
        </ul>
      )),
    [logos, renderLogo, renderedCopyCount],
  );

  const cssVariables: LogoLoopCssProperties = {
    "--logoloop-gap": `${gap}px`,
    "--logoloop-logo-height": `${logoHeight}px`,
    ...(fadeOutColor ? { "--logoloop-fade-color": fadeOutColor } : {}),
  };
  const rootClassName = [
    "logoloop",
    isVertical ? "logoloop--vertical" : "logoloop--horizontal",
    fadeOut && "logoloop--fade",
    scaleOnHover && "logoloop--scale-hover",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const containerStyle: CSSProperties = {
    width: isVertical && toCssLength(width) === "100%" ? undefined : (toCssLength(width) ?? "100%"),
    ...cssVariables,
    ...style,
  };

  return (
    <div ref={containerRef} className={rootClassName} style={containerStyle} role="region" aria-label={ariaLabel}>
      <div
        className="logoloop__track"
        ref={trackRef}
        onMouseEnter={() => effectiveHoverSpeed !== undefined && setIsHovered(true)}
        onMouseLeave={() => effectiveHoverSpeed !== undefined && setIsHovered(false)}
      >
        {logoLists}
      </div>
    </div>
  );
});

LogoLoop.displayName = "LogoLoop";

export default LogoLoop;
