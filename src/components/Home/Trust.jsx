"use client";

import React from "react";

const trustData = [
  {
    title: "Your data is yours — in writing",
    description:
      "Every lead, conversation, and booking belongs to your business. It's in the agreement, not just on this page.",
  },
  {
    title: "A documented process",
    description:
      "Every step of the build follows a written process, and every call happens in your business hours.",
  },
  {
    title: "Results visible in Pulse",
    description:
      "Leads, bookings, and outcomes live in your Pulse dashboard — you see exactly what CloseDesk is producing.",
  },
];

export default function Trust() {
  return (
    <section id="trust" className="sec sec--top0">
      <div className="wrap">
        <div className="head">
          <h2 data-reveal style={{ fontSize: "var(--text-display-s)", maxWidth: "24ch" }}>
            No black box. No lock-in. No guesswork.
          </h2>
        </div>

        <div className="promises">
          {trustData.map((item, index) => (
            <div key={index} data-reveal style={{ "--i": index + 1 }}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
