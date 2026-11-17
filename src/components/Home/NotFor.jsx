"use client";

import React from "react";
import { X } from "lucide-react";

const notForData = [
  {
    title: "You're not running ads or SEO",
    description:
      "CloseDesk converts visitors you already have. If nobody lands on your website, there's nothing for us to answer. Fix traffic first — then talk to us.",
  },
  {
    title: "You have no real after-hours demand",
    description:
      "If your jobs are all scheduled weeks out and nothing is ever urgent, the 24/7 booking desk solves a problem you don't have.",
  },
  {
    title: "You can't take more jobs",
    description:
      "If your crews are booked solid for months, more booked jobs just means more cancellations. Come back when you're hiring.",
  },
  {
    title: "Your website barely works",
    description:
      "CloseDesk lives on your site. If the site itself is broken or you don't control it, we'd be installing a booking desk in a building with no door.",
  },
];

export default function NotFor() {
  return (
    <section id="notfor" className="sec">
      <div className="wrap rowset">
        <div className="rowset__head">
          <h2 data-reveal>We turn down businesses that fit these. Honestly.</h2>
          <p className="lead" data-reveal style={{ "--i": 1 }}>
            A bad-fit client gets no results and costs both of us. If any of
            these describe you, CloseDesk isn&apos;t your answer yet — and we&apos;ll say
            so.
          </p>
        </div>

        <ul className="rows">
          {notForData.map((item, index) => (
            <li key={index} data-reveal style={{ "--i": index }}>
              <span className="rows__x">
                <X aria-hidden="true" strokeWidth={2.5} />
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
