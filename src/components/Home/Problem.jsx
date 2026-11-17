"use client";

import React, { useRef, useEffect, useState } from "react";
import { User, Clock, XCircle, Trophy } from "lucide-react";

const stages = [
  {
    num: "01",
    title: "Visitor lands",
    desc: "Intent is high — they're ready to hire.",
    icon: User,
    status: "normal",
  },
  {
    num: "02",
    title: "Nobody responds",
    desc: "Your form sits there. Phone rings out.",
    icon: Clock,
    status: "warning",
  },
  {
    num: "03",
    title: "Tab closed",
    desc: "They go back to the search results.",
    icon: XCircle,
    status: "warning",
  },
  {
    num: "04",
    title: "Competitor wins",
    desc: "Whoever answered first gets the job.",
    icon: Trophy,
    status: "lost",
  },
];

const pains = [
  "Speed beats reputation when someone's basement is flooding.",
  "It collects requests nobody sees until hours later.",
  "Nights and weekends are when emergencies - and lost jobs - happen.",
  "Every unanswered visitor is money you paid to book a competitor's job.",
];

export default function Problem() {
  const stepsRef = useRef(null);
  const [lineDrawn, setLineDrawn] = useState(false);

  // Draw the connecting line once the steps scroll into view.
  useEffect(() => {
    const el = stepsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLineDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="problem" className="sec">
      <div className="wrap">
        <div className="head head--split">
          <h2 data-reveal>
            You&apos;re paying for traffic.
            <span className="h-second">Your competitors are booking it.</span>
          </h2>
          <p className="lead" data-reveal style={{ "--i": 1 }}>
            A homeowner with a burst pipe doesn&apos;t fill out a contact form and
            wait. They open three tabs and hire whoever answers first.
          </p>
        </div>

        <div ref={stepsRef} className={`steps-wrap ${lineDrawn ? "is-in" : ""}`}>
          <span className="steps__line" aria-hidden="true">
            <i />
          </span>
          <ol className="steps">
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <li key={stage.num} data-reveal style={{ "--i": i + 1 }}>
                <span className="steps__icon">
                  <Icon size={24} aria-hidden="true" />
                </span>
                <h3>{stage.title}</h3>
                <p>{stage.desc}</p>
              </li>
            );
          })}
          </ol>
        </div>

        <div className="pains">
          <div data-reveal>
            <h3>
              Your ad spend. <br /> Their job.
            </h3>
            <p>Stop leaking high-intent leads to your competitors.</p>
          </div>
          <ul>
            {pains.map((pain, i) => (
              <li key={i} data-reveal style={{ "--i": i + 1 }}>
                <XCircle aria-hidden="true" />
                <span>{pain}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
