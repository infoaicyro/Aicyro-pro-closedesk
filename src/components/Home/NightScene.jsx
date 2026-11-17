"use client";

import React, { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { Moon, Sunrise } from "lucide-react";

const TIMELINE_STEPS = [
  {
    id: 1,
    time: "9:47 PM",
    tag: "Fort Worth · Water Damage",
    leadName: "Fort Worth Homeowner",
    message:
      "Water heater burst, there's water pouring everywhere. Can anyone come tonight??",
    lossAmount: "$3,400",
    stamp: "GONE — NO REPLY",
    competitor: "Hired competitor running 24/7 ads",
    tabsOpen: "3 competitor tabs open",
  },
  {
    id: 2,
    time: "11:26 PM",
    tag: "Arlington · Flooding",
    leadName: "Arlington Property Owner",
    message:
      "Basement flooding from storm drain, need emergency pump out ASAP. Are you open?",
    lossAmount: "$2,800",
    stamp: "HIRED SOMEONE ELSE",
    competitor: "Hired firm that answered in 18 seconds",
    tabsOpen: "4 competitor tabs open",
  },
  {
    id: 3,
    time: "1:03 AM",
    tag: "Fort Worth · HVAC Outage",
    leadName: "Fort Worth Family",
    message:
      "AC died and we have a newborn in the house. Please tell me someone's there to dispatch.",
    lossAmount: "$4,200",
    stamp: "GONE — NO REPLY",
    competitor: "Booked with 24/7 AI-equipped competitor",
    tabsOpen: "2 competitor tabs open",
  },
];

const MORNING = 3; // index of the 7:02 AM entry
const amountOf = (s) => Number(s.replace(/[^0-9]/g, ""));
const lossUpTo = (index) =>
  TIMELINE_STEPS.slice(0, Math.min(index + 1, TIMELINE_STEPS.length)).reduce(
    (sum, step) => sum + amountOf(step.lossAmount),
    0,
  );
const money = (n) => `-$${Math.round(n).toLocaleString("en-US")}`;

// "Fort Worth · Water Damage" is shown as two facts, the place over the job.
const splitTag = (tag) => tag.split(" · ");

export default function NightScene() {
  // Without script (or with reduced motion) the whole night shows at once.
  const [active, setActive] = useState(MORNING);
  const [shown, setShown] = useState(lossUpTo(MORNING));
  const entryRefs = useRef([]);
  const shownRef = useRef(shown);

  // As each entry crosses the middle of the screen, the night moves on to it.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setActive(-1);
    setShown(0);
    shownRef.current = 0;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number(entry.target.dataset.step);
          if (entry.isIntersecting) {
            setActive((prev) => Math.max(prev, index));
          } else if (entry.boundingClientRect.top > 0) {
            // scrolled back up past it
            setActive((prev) => Math.min(prev, index - 1));
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    entryRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  // The overnight total counts toward its new value.
  useEffect(() => {
    const target = lossUpTo(active);
    const controls = animate(shownRef.current, target, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        shownRef.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [active]);

  const isMorning = active >= MORNING;
  const progress = Math.max(0, active + 1) / (MORNING + 1);

  return (
    <section id="night" className="night">
      <div className="wrap night__grid">
        {/* ============ the pinned side: the claim and the running cost ============ */}
        <div className="night__pin">
          <h2 data-reveal>
            Your next customer isn&apos;t waiting until morning.
            <span className="h-second">And neither is your competitor.</span>
          </h2>
          <p className="lead" data-reveal style={{ "--i": 1 }}>
            He answered every call during the day. But when midnight pipes burst
            and heaters die, homeowners hire the first business that answers.
          </p>

          <div className="night__meter" data-reveal style={{ "--i": 2 }}>
            <div className="night__total" aria-live="polite">
              <span className="num">{money(shown)}</span>
              <small>Lost Overnight</small>
            </div>

            <div className="night__clock">
              <div className="night__clock-ends">
                <span>
                  <Moon aria-hidden="true" /> 9:47 PM
                </span>
                <span>
                  7:02 AM <Sunrise aria-hidden="true" />
                </span>
              </div>
              <div className="night__bar" aria-hidden="true">
                <i style={{ transform: `scaleX(${progress})` }} />
              </div>
            </div>
          </div>
        </div>

        {/* ============ the scrolling side: the night, entry by entry ============ */}
        <ol className="night__log" aria-label="Three overnight leads">
          {TIMELINE_STEPS.map((step, i) => {
            const [place, job] = splitTag(step.tag);
            return (
              <li
                key={step.id}
                ref={(el) => (entryRefs.current[i] = el)}
                data-step={i}
                className={`night__entry ${active >= i ? "is-lit" : ""}`}
              >
                <time className="night__time">{step.time}</time>

                <div className="night__body">
                  <p className="night__where">
                    <b>{place}</b>
                    <span>{job}</span>
                  </p>

                  <p className="night__bubble">{step.message}</p>
                  <p className="night__tabs">{step.tabsOpen}</p>

                  <div className="night__outcome">
                    <div>
                      <span className="night__stamp">{step.stamp}</span>
                      <span className="night__who">{step.competitor}</span>
                    </div>
                    <div className="night__loss">
                      <small>Lost Ticket Value</small>
                      <b className="num">{step.lossAmount}</b>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}

          {/* 7:02 AM: the morning after */}
          <li
            ref={(el) => (entryRefs.current[MORNING] = el)}
            data-step={MORNING}
            className={`night__entry night__entry--dawn ${isMorning ? "is-lit" : ""}`}
          >
            <time className="night__time">7:02 AM</time>
            <div className="night__body">
              <p className="night__where">
                <b>7:02 AM Wakeup, 0 Missed Calls</b>
              </p>
              <p className="night__morning">
                All 3 homeowners hired competitors hours ago. Your phone never
                rang because emergency visitors don&apos;t leave voicemails.
              </p>
              <div className="night__answer">
                <strong>Speed to lead is everything after dark.</strong>
                <p>
                  Homeowners don&apos;t wait hours for a call back. CloseDesk
                  responds in under 1 second, qualifies the issue, and books the
                  emergency on your calendar while you sleep.
                </p>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}
