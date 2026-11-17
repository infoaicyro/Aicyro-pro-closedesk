"use client";

import React from "react";
import { Check } from "lucide-react";
import CountUp from "../Essential/CountUp";

export default function Offer({ onOpenPopup }) {
  return (
    <section id="founding25" className="sec band">
      <div className="wrap offer">
        <div>
          <h2 data-reveal>Founder pricing, locked for life.</h2>
          <p className="lead" data-reveal style={{ "--i": 1, marginTop: "var(--space-lg)" }}>
            We&apos;re taking a limited group of founding clients through the
            full done-for-you build — and locking their rate permanently.
          </p>

          <ul className="offer__list">
            <li data-reveal style={{ "--i": 2 }}>
              <Check aria-hidden="true" />
              <span>
                Done-for-you implementation: audit, custom build, install,
                notifications — the full $2,000 build, included.
              </span>
            </li>
            <li data-reveal style={{ "--i": 3 }}>
              <Check aria-hidden="true" />
              <span>60 days of hands-on optimization after launch.</span>
            </li>
            <li data-reveal style={{ "--i": 4 }}>
              <Check aria-hidden="true" />
              <span>
                Founder monthly rate ($250–350/mo) locked for life — never
                raised, ever.
              </span>
            </li>
          </ul>

          <div data-reveal style={{ "--i": 5 }}>
            <button type="button" onClick={onOpenPopup} className="btn">
              Claim a Founding 25 Spot
            </button>
          </div>
        </div>

        <div className="receipt" data-reveal style={{ "--i": 2 }}>
          <div>
            <div className="receipt__label">Implementation value</div>
            <div className="receipt__price">
              <s><CountUp value="$2,000" /></s>
              <span>Waived</span>
            </div>
            <p className="ink" style={{ marginTop: "var(--space-sm)" }}>
              included for Founding 25 members
            </p>
          </div>

          <hr />

          <p>
            Standard pricing after the founding round is planned at
            $400–500/mo. Founding members lock a $250–350/mo rate for the
            life of their account.
          </p>

          <hr />

          <p className="ink">
            Prefer to start smaller? Book a free website lead audit —
            we&apos;ll show you exactly where after-hours leads are slipping
            away.
          </p>

          {/* ===== TICKET H8: PILOT_QUOTE slot (hidden by default) ===== */}
          <div id="pilot-quote" className="hidden">
            <p className="ink">
              &ldquo;[PILOT_QUOTE_APPROVED_TEXT]&rdquo;
            </p>
            <p>[PILOT_NAME] / [PILOT_COMPANY] / [PILOT_TRADE]</p>
          </div>
          {/* ===== END TICKET H8 ===== */}
        </div>
      </div>
    </section>
  );
}
