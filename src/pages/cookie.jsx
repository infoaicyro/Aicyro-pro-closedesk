// src/pages/cookie.jsx
"use client";

import React from "react";
import Seo from "../components/Essential/Seo";
import Navbar from "../components/Essential/Navbar";
import Footer from "../components/Essential/Footer";
import { ShieldCheck, Lock, CheckCircle2, Mail, ExternalLink } from "lucide-react";

export default function CookiePolicy() {
  const sections = [
    { id: "zero-tracking", title: "1. Zero-Tracking Commitment" },
    { id: "personalization", title: "2. Deal Personalization Cookies" },
    { id: "categories", title: "3. Categories of Cookies We Maintain" },
    { id: "rights", title: "4. Your Control and Revocation Rights" },
    { id: "contact", title: "5. Contact Our Privacy Team" },
  ];

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] transition-colors duration-200">
      <Seo
        title="Strict Cookie Policy | Aicyro"
        description="Learn how Aicyro strictly uses first-party cookies solely for deal personalization and core functionality without invasive third-party tracking."
      />

      {/* Decorative Grid Background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(var(--grid-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(circle at center, black 40%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(circle at center, black 40%, transparent 90%)",
        }}
        aria-hidden="true"
      />

      <Navbar />

      <main id="main" className="wrap doc relative z-10 flex-grow">
        {/* Document Masthead */}
        <div className="doc__head settle">

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--foreground)] leading-[1.1] mb-4 text-balance">
            Cookie Policy
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-[var(--foreground-muted)]">
            <span className="tabular-nums">Effective Date: July 6, 2026</span>
            <span>Zero Third-Party Advertising Trackers</span>
          </div>
        </div>

        {/* 12-Column Grid: Sticky Index Sidebar + Reading Track */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          
          {/* Table of Contents Sticky Sidebar (Columns 1-4) */}
          <aside className="lg:col-span-4 lg:sticky lg:top-28 space-y-8">
            <div className="doc-pod">
              <span className="text-xs font-bold text-[var(--foreground)] block mb-4">
                Table of Contents
              </span>
              <nav className="space-y-2">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block text-xs sm:text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--primary)] transition-colors duration-150 py-1"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>

            {/* Privacy Guarantee Pod */}
            <div className="doc-pod">
              <div className="flex items-center gap-2.5 text-[var(--primary)] font-bold text-xs mb-3">
                <ShieldCheck size={18} aria-hidden="true" />
                <span>Zero-Tracking Architecture</span>
              </div>
              <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                We do not sell data, load Meta pixels, or run retargeting pixels. Cookies are solely used for session authentication and deal personalization.
              </p>
            </div>
          </aside>

          {/* Document Content Track (Columns 5-12) */}
          <div className="lg:col-span-8 max-w-[70ch]">
            
            {/* Section 1 */}
            <section id="zero-tracking" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                1. Our Zero-Tracking Commitment
              </h2>
              <div className="space-y-4 text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed">
                <p>
                  At AICYRO, we operate under a strict privacy-first architecture.
                  Unlike conventional platforms,{" "}
                  <strong className="text-[var(--foreground)] font-semibold">
                    we do not use third-party advertising cookies, cross-site
                    trackers, or data-harvesting scripts
                  </strong>{" "}
                  (such as Meta Pixels or ad retargeting networks).
                </p>
                <p>
                  Our website uses cookies exclusively to ensure system security and
                  to customize specific AI automation deal offers based on your
                  self-selected industry and business needs.
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section id="personalization" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                2. How We Use Deal Personalization Cookies
              </h2>
              <div className="space-y-4 text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed">
                <p>
                  When you opt into deal personalization via our consent banner, we
                  store a secure, first-party cookie containing only non-sensitive
                  workflow choices:
                </p>
                <div className="grid grid-cols-1 gap-3 pt-2">
                  <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border-color)]">
                    <span className="font-semibold text-[var(--foreground)] block text-sm mb-1">
                      Industry Sector
                    </span>
                    <span className="text-xs sm:text-sm text-[var(--foreground-muted)]">
                      Adapts AI chatbot demo templates and live previews to your sector.
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border-color)]">
                    <span className="font-semibold text-[var(--foreground)] block text-sm mb-1">
                      Automation Goals
                    </span>
                    <span className="text-xs sm:text-sm text-[var(--foreground-muted)]">
                      Tailors proposed package tiers and integration spotlights (e.g., n8n, CRM sync).
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border-color)]">
                    <span className="font-semibold text-[var(--foreground)] block text-sm mb-1">
                      Discount and Offer Tier
                    </span>
                    <span className="text-xs sm:text-sm text-[var(--foreground-muted)]">
                      Locks in promotional pricing customized for your business scale.
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/20 text-xs text-[var(--foreground-muted)]">
                  All personalization data stays on your local browser and is strictly protected with <code className="bg-[var(--border-color)]/40 px-1.5 py-0.5 rounded font-mono text-xs">SameSite=Strict</code> and <code className="bg-[var(--border-color)]/40 px-1.5 py-0.5 rounded font-mono text-xs">Secure</code> flags.
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section id="categories" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                3. Categories of Cookies We Maintain
              </h2>
              <div className="space-y-4 text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed">
                <div>
                  <h3 className="text-base font-bold text-[var(--foreground)] mb-1">
                    A. Essential System Cookies
                  </h3>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    Required for basic website functioning, user authentication
                    sessions, and DDoS load balancing. These do not store personal
                    profiles.
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--border-color)]">
                  <h3 className="text-base font-bold text-[var(--foreground)] mb-1">
                    B. Deal Personalization Cookies (Opt-In Only)
                  </h3>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    Stored only when you explicitly select your industry preferences
                    on our banner. These expire automatically after 30 days or can be
                    cleared instantly from your browser settings.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section id="rights" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                4. Your Control and Revocation Rights
              </h2>
              <div className="text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed">
                <p>
                  You maintain 100% control over your stored preferences. You can
                  clear or disable cookies at any time through your browser’s
                  privacy settings without losing access to core website features.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section id="contact" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                5. Contact Our Privacy Team
              </h2>
              <address className="not-italic bg-[var(--background)] p-6 rounded-xl border border-[var(--border-color)] mt-4 block">
                <strong className="text-[var(--foreground)] block mb-1 text-base font-bold">
                  AICYRO Solutions
                </strong>
                <span className="text-[var(--foreground-muted)] text-sm">Email: </span>
                <a
                  href="mailto:info@aicyro.com"
                  className="text-[var(--primary)] hover:underline font-medium text-sm inline-flex items-center gap-1"
                >
                  <span>info@aicyro.com</span>
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              </address>
            </section>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
