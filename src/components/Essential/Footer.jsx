"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const columns = [
  {
    title: "Platform",
    links: [
      { name: "How it works", href: "/#problem" },
      { name: "Compare options", href: "/#compare" },
      { name: "Who it's not for", href: "/#notfor" },
      { name: "Pricing", href: "/#pricing" },
    ],
  },
  {
    title: "Program",
    links: [
      { name: "Founding 25 Launch", href: "/#founding25" },
      { name: "Why trust us", href: "/#trust" },
      { name: "Straight answers", href: "/#faq" },
      { name: "Free Lead Audit", href: "/free-website-audit" },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Privacy Policy", href: "/privacy" },
      { name: "Terms of Service", href: "/termofuse" },
      { name: "Cookie Policy", href: "/cookie" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot__mast">
          <div data-reveal>
            {/* The wordmark signs off with "by Aicyro" at its bottom-right corner */}
            <div className="foot__sig" aria-hidden="true">
              <div className="foot__word">
                {"CloseDesk".split("").map((ch, i) => (
                  <span key={i} className={i >= 5 ? "is-accent" : undefined} style={{ "--i": i }}>
                    {ch}
                  </span>
                ))}
              </div>
              <span className="foot__by">by Aicyro</span>
            </div>
            <p>
              CloseDesk by Aicyro — the 24/7 AI booking desk for field-service
              businesses. Stop losing website visitors to faster competitors.
            </p>
          </div>

          <nav className="foot__cols" aria-label="Footer">
            {columns.map((col, i) => (
              <div key={col.title} data-reveal style={{ "--i": i + 1 }}>
                <h2>{col.title}</h2>
                <ul>
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>{link.name}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="foot__legal">
          <p>
            © {new Date().getFullYear()} Aicyro. CloseDesk and Pulse are products
            of Aicyro. All rights reserved.
          </p>
          <span>
            <ShieldCheck aria-hidden="true" />
            Your leads and conversations belong to you.
          </span>
        </div>
      </div>
    </footer>
  );
}
