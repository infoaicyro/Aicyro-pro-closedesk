"use client";

import { useEffect } from "react";
import Lenis from "lenis";

const NAV_OFFSET = -88;

// Inertial scrolling for the public site. The instance is exposed on
// window.__lenis so the nav can glide to a section, and in-page anchor links
// (href="#...") are smoothed with the nav's height taken off.
export default function SmoothScroll() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
      anchors: { offset: NAV_OFFSET },
    });
    window.__lenis = lenis;

    let animationFrameId;
    function raf(time) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }
    animationFrameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
      if (window.__lenis === lenis) delete window.__lenis;
    };
  }, []);

  return null;
}

// Glide to an element or a y position, with Lenis when it runs, natively when it does not.
export function scrollToTarget(target, { immediate = false } = {}) {
  if (typeof window === "undefined") return;
  const lenis = window.__lenis;
  if (lenis) {
    lenis.scrollTo(target, { offset: typeof target === "number" ? 0 : NAV_OFFSET, immediate, duration: 1.1 });
    return;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const top =
    typeof target === "number"
      ? target
      : target.getBoundingClientRect().top + window.scrollY + NAV_OFFSET;
  window.scrollTo({ top, behavior: immediate || reduced ? "auto" : "smooth" });
}
