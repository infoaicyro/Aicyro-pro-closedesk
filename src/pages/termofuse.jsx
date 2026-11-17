// src/pages/termofuse.jsx
"use client";

import React from "react";
import Seo from "../components/Essential/Seo";
import Navbar from "../components/Essential/Navbar";
import Footer from "../components/Essential/Footer";
import { ShieldCheck, Scale, ExternalLink } from "lucide-react";

export default function TermsOfService() {
  const sections = [
    { id: "acceptance", title: "1. Acceptance of Terms" },
    { id: "about", title: "2. About AICYRO" },
    { id: "usage", title: "3. Use of the Website" },
    { id: "ip", title: "4. Intellectual Property" },
    { id: "proposals", title: "5. Service Proposals and Agreements" },
    { id: "submissions", title: "6. User Submissions" },
    { id: "third-party", title: "7. Third-Party Services" },
    { id: "warranties", title: "8. Disclaimer of Warranties" },
    { id: "liability", title: "9. Limitation of Liability" },
    { id: "indemnification", title: "10. Indemnification" },
    { id: "confidentiality", title: "11. Confidentiality" },
    { id: "termination", title: "12. Termination" },
    { id: "governing", title: "13. Governing Law" },
    { id: "changes", title: "14. Changes to These Terms" },
    { id: "contact", title: "15. Contact Information" },
  ];

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] transition-colors duration-200">
      <Seo
        title="Terms of Service | Aicyro"
        description="Read the Terms of Service for Aicyro. Understand the rules and regulations governing the use of our website and services."
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
            Terms of Service
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-[var(--foreground-muted)]">
            <span className="tabular-nums">Effective Date: June 8, 2026</span>
            <span>Worldwide Commercial Agreement</span>
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
              <nav className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-2">
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

            {/* Fair Use Pod */}
            <div className="doc-pod">
              <div className="flex items-center gap-2.5 text-[var(--primary)] font-bold text-xs mb-3">
                <Scale size={18} aria-hidden="true" />
                <span>Commercial Fairness</span>
              </div>
              <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                Clear deliverables, capped liability, intellectual property protection, and transparent dispute resolution procedures.
              </p>
            </div>
          </aside>

          {/* Document Content Track (Columns 5-12) */}
          <div className="lg:col-span-8 max-w-[70ch]">
            
            {/* Section 1 */}
            <section id="acceptance" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                1. Acceptance of Terms
              </h2>
              <div className="space-y-4 text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed">
                <p>
                  Welcome to AICYRO (&quot;Company,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). By accessing
                  or using our website, products, services, software, or related
                  offerings, you agree to be bound by these Terms of Service
                  (&quot;Terms&quot;).
                </p>
                <div className="p-3.5 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/20 text-xs sm:text-sm font-semibold text-[var(--primary)]">
                  If you do not agree with these Terms, please do not use our website or services.
                </div>
              </div>
            </section>

            {/* Section 2 */}
            <section id="about" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                2. About AICYRO
              </h2>
              <p className="text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed">
                AICYRO provides artificial intelligence solutions, software
                development, automation services, chatbot systems, consulting,
                customer engagement technologies, and related business services to
                clients worldwide.
              </p>
            </section>

            {/* Section 3 */}
            <section id="usage" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                3. Use of the Website
              </h2>
              <div className="text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed">
                <p className="mb-3">
                  You agree to use the website only for lawful purposes and in accordance with these Terms. You agree not to:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
                  <li>Violate any applicable laws or statutory regulations.</li>
                  <li>Attempt unauthorized access to our systems, servers, or networks.</li>
                  <li>Interfere with website functionality, speed, or cryptographic security.</li>
                  <li>Upload malicious code, automated bots, or exploitative scripts.</li>
                  <li>Use the website to distribute spam, unsolicited communications, or fraudulent content.</li>
                </ul>
              </div>
            </section>

            {/* Section 4 */}
            <section id="ip" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                4. Intellectual Property
              </h2>
              <div className="text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed space-y-3">
                <p>
                  All content on this website, including logos, brand marks, copywriting, graphics, diagrams, software code, UI designs, and proprietary AI workflows, are the exclusive property of AICYRO.
                </p>
                <p>
                  No content may be copied, reproduced, distributed, or modified without prior written authorization from AICYRO.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section id="proposals" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                5. Service Proposals and Agreements
              </h2>
              <div className="text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed space-y-2">
                <p>
                  Any formal proposal, scope of work, or service contract signed between AICYRO and a client constitutes an independent binding agreement.
                </p>
                <p>
                  In the event of any specific conflict between these general website Terms and a signed master service agreement, the signed agreement prevails.
                </p>
              </div>
            </section>

            {/* Section 6 */}
            <section id="submissions" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                6. User Submissions
              </h2>
              <p className="text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed">
                Information submitted via audit intake forms, lead modals, or contact desks is processed in accordance with our Privacy Policy. You represent that all submitted contact details and domain URLs are accurate and lawfully owned or authorized.
              </p>
            </section>

            {/* Section 7 */}
            <section id="third-party" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                7. Third-Party Services
              </h2>
              <p className="text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed">
                External tools (such as Calendly, CRM platforms, and telecom gateways) maintain their own independent terms of service and privacy practices. AICYRO is not liable for third-party service interruptions.
              </p>
            </section>

            {/* Section 8 */}
            <section id="warranties" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                8. Disclaimer of Warranties
              </h2>
              <p className="text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed">
                Website materials and automated audit estimations are provided on an “as is” and “as available” basis without express or implied warranties of error-free operation or uninterrupted uptime.
              </p>
            </section>

            {/* Section 9 */}
            <section id="liability" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                9. Limitation of Liability
              </h2>
              <div className="text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed space-y-3">
                <p>
                  To the maximum extent permitted by applicable law, AICYRO disclaims liability for indirect, incidental, or consequential losses resulting from website downtime or missed lead submissions.
                </p>
                <div className="p-3.5 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/20 text-xs sm:text-sm font-semibold text-[var(--primary)]">
                  Total cumulative liability shall not exceed the amount paid by the customer during the preceding twelve months.
                </div>
              </div>
            </section>

            {/* Section 10 */}
            <section id="indemnification" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                10. Indemnification
              </h2>
              <p className="text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed">
                You agree to indemnify and hold harmless AICYRO, its officers, contractors, and affiliates from third-party liabilities, damages, and reasonable legal costs resulting from unlawful misuse of our services.
              </p>
            </section>

            {/* Section 11 */}
            <section id="confidentiality" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                11. Confidentiality
              </h2>
              <p className="text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed">
                All non-public commercial discussions, software demonstrations, workflows, and lead volumes shared between parties remain strictly confidential.
              </p>
            </section>

            {/* Section 12 */}
            <section id="termination" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                12. Termination
              </h2>
              <p className="text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed">
                We reserve the right to suspend or revoke access to our website or APIs immediately upon any material breach of these terms.
              </p>
            </section>

            {/* Section 13 */}
            <section id="governing" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                13. Governing Law
              </h2>
              <p className="text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed">
                These Terms are governed by and construed under the laws of the jurisdiction in which AICYRO is registered, without reference to conflict-of-law doctrines.
              </p>
            </section>

            {/* Section 14 */}
            <section id="changes" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                14. Changes to These Terms
              </h2>
              <p className="text-sm sm:text-base text-[var(--foreground-muted)] leading-relaxed">
                We may periodically update these Terms. Continued access to the website following publication constitutes voluntary agreement with revised conditions.
              </p>
            </section>

            {/* Section 15 */}
            <section id="contact" className="doc-sec" data-reveal>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[var(--foreground)] tracking-tight">
                15. Contact Information
              </h2>
              <address className="not-italic bg-[var(--background)] p-6 rounded-xl border border-[var(--border-color)] mt-4 block space-y-2">
                <strong className="text-[var(--foreground)] block text-base font-bold">
                  AICYRO Legal Affairs
                </strong>
                <div className="text-sm text-[var(--foreground-muted)]">
                  <span>Email: </span>
                  <a
                    href="mailto:info@aicyro.com"
                    className="text-[var(--primary)] hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <span>info@aicyro.com</span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </div>
                <div className="text-sm text-[var(--foreground-muted)]">
                  <span>Website: </span>
                  <a
                    href="https://aicyro.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--primary)] hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <span>https://aicyro.com</span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </div>
              </address>
            </section>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
