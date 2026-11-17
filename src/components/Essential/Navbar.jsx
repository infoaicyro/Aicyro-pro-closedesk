"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import { scrollToTarget } from "./SmoothScroll";

const navLinks = [
  { name: "How it works", href: "/#problem" },
  { name: "Pricing", href: "/#pricing" },
  { name: "Compare", href: "/#compare" },
  { name: "Who it's not for", href: "/#notfor" },
  { name: "Straight answers", href: "/#faq" },
];

export function BrandMark({ className = "brand__mark" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="var(--primary)"
        d="M56.6,79.5c1.28-2.92,2.85-5.7,4.29-8.53q6.24-12.24,12.52-24.45c.14-.26.3-.5.51-.87l5.59,9.65L93.2,79a4.74,4.74,0,0,1,.24.51Z"
      />
      <path
        fill="var(--foreground)"
        d="M23.88,79.5a69.14,69.14,0,0,1,3.69-6.63Q38,54.81,48.42,36.77q4.52-7.79,9-15.57c.53-.93.87-.93,1.4,0,1.34,2.29,2.65,4.61,4,6.91a2,2,0,0,1-.4,1.28C56.81,39,51.36,48.67,45.83,58.3c-3.77,6.57-7.55,13.14-11.26,19.75a4.15,4.15,0,0,1-1.08,1.45Z"
      />
      <path
        fill="var(--primary)"
        d="M33.49,79.5c1.72-3.43,3.74-6.69,5.64-10q9-15.9,18.17-31.78c1.83-3.2,3.68-6.39,5.52-9.59,1.27,2.16,2.53,4.32,3.84,6.46.32.53,0,.86-.2,1.23Q61.74,44.19,57,52.57,49.59,65.66,42.2,78.76c-.13.23-.32.44-.24.74Z"
      />
      <path
        fill="var(--foreground)"
        d="M6.56,20.59H43.83L24.07,54.76C18.2,43.32,12.42,32,6.56,20.59Z"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

export default function Navbar({ onOpenPopup }) {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLight, setIsLight] = useState(true);
  const [activeSection, setActiveSection] = useState("");
  const progressRef = useRef(null);

  // Glass on scroll, retract when reading down, return when scrolling up.
  // Where CSS scroll timelines are missing, the progress hairline is driven here, without re-rendering.
  useEffect(() => {
    let ticking = false;
    let lastY = window.scrollY;
    const cssTimeline =
      typeof CSS !== "undefined" && CSS.supports && CSS.supports("animation-timeline: scroll()");

    const update = () => {
      const y = window.scrollY;
      setIsScrolled(y > 20);
      setIsHidden(y > 480 && y > lastY + 4);
      if (y < lastY - 4 || y < 480) setIsHidden(false);
      lastY = y;

      if (!cssTimeline && progressRef.current) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progressRef.current.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      }
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Sync toggle UI with saved preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("closeDesk-theme") || "light";
    setIsLight(savedTheme === "light");
  }, []);

  // Track which section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { root: null, rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );

    navLinks.forEach((link) => {
      const element = document.getElementById(link.href.substring(2));
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  // Escape closes the drawer
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKey = (e) => e.key === "Escape" && setIsMobileMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobileMenuOpen]);

  const toggleTheme = () => {
    const newTheme = isLight ? "dark" : "light";
    const root = document.documentElement;

    // Swap every colour in one frame: per-element colour transitions are switched off
    // while the theme changes, so nothing keeps sliding after the switch.
    const apply = () => {
      root.classList.add("theme-switching");
      try {
        localStorage.setItem("closeDesk-theme", newTheme);
      } catch (_) {}
      setIsLight(newTheme === "light");
      window.dispatchEvent(new Event("closeDesk-theme-change"));
      void root.offsetWidth; // commit the new colours before transitions come back
    };
    const restoreTransitions = () => root.classList.remove("theme-switching");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // No crossfade when unsupported, under reduced motion, or when the page is not painting frames
    if (!document.startViewTransition || reduced || document.visibilityState !== "visible") {
      apply();
      requestAnimationFrame(restoreTransitions);
      return;
    }

    // One short crossfade between the two finished states is the only motion
    const transition = document.startViewTransition(apply);
    transition.finished.finally(restoreTransitions);
  };

  const handleNavClick = (e, href) => {
    if (href.includes("#")) {
      const targetId = href.split("#")[1];
      const elem = document.getElementById(targetId);

      // On the home page, glide; elsewhere let the link route to /#section.
      if (elem) {
        e.preventDefault();
        setActiveSection(targetId);
        if (targetId === "top") scrollToTarget(0);
        else scrollToTarget(elem);
        if (window.history?.replaceState) window.history.replaceState(null, "", `#${targetId}`);
      }
    }
    setIsMobileMenuOpen(false);
  };

  const handleClaim = () => {
    setIsMobileMenuOpen(false);
    if (onOpenPopup) {
      onOpenPopup();
      return;
    }
    router.push("/#founding25");
  };

  return (
    <nav
      className={`nav ${isScrolled ? "is-scrolled" : ""} ${isHidden && !isMobileMenuOpen ? "is-hidden" : ""}`}
      aria-label="Main"
    >
      <div className="wrap nav__row">
        <Link
          href="/#top"
          onClick={(e) => handleNavClick(e, "/#top")}
          className="brand"
          aria-label="CloseDesk Home"
        >
          <BrandMark />
          <span className="brand__word">
            Close<span>Desk</span>
          </span>
          <span className="brand__by only-wide">by Aicyro</span>
        </Link>

        <ul className="nav__links only-wide">
          {navLinks.map((link) => {
            const isActive = activeSection === link.href.substring(2);
            return (
              <li key={link.name}>
                <a
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="nav__link"
                  aria-current={isActive ? "true" : undefined}
                >
                  {link.name}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="nav__actions">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="icon-btn"
          >
            <span className="theme-icon" data-on={isLight ? "true" : "false"}>
              <SunIcon />
            </span>
            <span className="theme-icon" data-on={!isLight ? "true" : "false"}>
              <MoonIcon />
            </span>
          </button>

          <button type="button" onClick={handleClaim} className="btn btn--sm only-wide">
            Claim a Spot
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="nav-drawer"
            className="icon-btn burger only-narrow"
          >
            <span />
            <span />
          </button>
        </div>
      </div>

      <div className="progress" ref={progressRef} aria-hidden="true" />

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            id="nav-drawer"
            className="drawer only-narrow"
            style={{ flexDirection: "column", transformOrigin: "top" }}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.2, ease: [0.7, 0, 0.84, 0] } }}
          >
            <div className="wrap">
              <ul>
                {navLinks.map((link, i) => {
                  const isActive = activeSection === link.href.substring(2);
                  return (
                    <motion.li
                      key={link.name}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: 0.04 + i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
                    >
                      <a
                        href={link.href}
                        onClick={(e) => handleNavClick(e, link.href)}
                        aria-current={isActive ? "true" : undefined}
                      >
                        {link.name}
                      </a>
                    </motion.li>
                  );
                })}
              </ul>
              <div className="drawer__cta">
                <button type="button" onClick={handleClaim} className="btn btn--block">
                  Claim a Founding 25 Spot
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
