"use client";

import React from "react";
import CountUp from "../Essential/CountUp";

export default function Pricing() {
  return (
    <section id="pricing" className="sec sec--top0">
      <div className="wrap">
        <div className="head head--split">
          <h2 data-reveal>Straight answers about pricing.</h2>
          <p className="lead" data-reveal style={{ "--i": 1 }}>
            Most companies in this space make you book a call to hear a number.
            Here&apos;s ours, up front.
          </p>
        </div>

        <div className="tiers">
          <PricingCard
            index={0}
            kicker="The build"
            price="$2,000"
            unit="value"
            description="The done-for-you implementation — audit, custom build around your trade and service area, install, and notification setup. Included at no charge for Founding 25 members."
          />

          <PricingCard
            index={1}
            isFeatured={true}
            kicker="Founder rate"
            price="$250–350"
            unit="/mo"
            description="The founding-round monthly rate, locked for the life of your account — it never goes up, ever. Your exact rate within this range depends on your trade and lead volume, and is confirmed on your call before you commit to anything."
          />

          <PricingCard
            index={2}
            kicker="Standard rate (after launch)"
            price="$400–500"
            unit="/mo"
            description="Where pricing is planned to land once the founding round closes. We're telling you now so the founder rate isn't a gimmick — it's simply what early clients get for helping us prove this publicly."
          />
        </div>

        <div className="note" data-reveal>
          <strong>What moves the price within the range:</strong>
          <p>
            the complexity of your qualification flow (a restoration company
            dispatching emergency crews needs more than an appliance repair
            shop), your lead volume, and how many notification routes your team
            needs. There are no per-lead fees, and no charge for the leads
            CloseDesk captures. If the numbers don&apos;t make sense for your
            business, we&apos;ll tell you on the call — a bad-fit client costs us
            more than an honest no.
          </p>
        </div>
      </div>
    </section>
  );
}

// --- Subcomponent: Pricing Tier ---

function PricingCard({ index, isFeatured, kicker, price, unit, description }) {
  return (
    <div
      className={`tier ${isFeatured ? "tier--featured" : ""}`}
      data-reveal
      style={{ "--i": index + 1 }}
    >
      <span className="tier__kicker">{kicker}</span>
      <div className="tier__price">
        <CountUp value={price} />
        <small>{unit}</small>
      </div>
      {isFeatured && <span className="tier__tag">Founding 25</span>}
      <p>{description}</p>
    </div>
  );
}
