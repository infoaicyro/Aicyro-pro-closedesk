"use client";

import React from "react";
import Link from "next/link";

export default function FinalCTA() {
  return (
    <section className="sec sec--l rule-top">
      <div className="wrap close">
        <h2 data-reveal>
          The next urgent lead is coming tonight.
          <br />
          Who&apos;s going to answer it?
        </h2>

        <p className="lead" data-reveal style={{ "--i": 1 }}>
          Claim a Founding 25 spot, or start with a free website lead audit.
        </p>

        <div className="close__actions" data-reveal style={{ "--i": 2 }}>
          <a href="#founding25" className="btn">
            Claim a Founding 25 Spot
          </a>
          <Link href="/free-website-audit" className="btn btn--quiet">
            Get a Free Website Lead Audit
          </Link>
        </div>
      </div>
    </section>
  );
}
