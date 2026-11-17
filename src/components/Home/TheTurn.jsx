"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { AlertCircle, CheckCircle2, Sunrise, Moon } from "lucide-react";

// Story Sequence
const storySequence = [
  { time: "9:47 PM", title: "Water heater burst" },
  { time: "11:26 PM", title: "Basement flooding" },
  { time: "1:03 AM", title: "AC out, newborn" },
  { time: "7:02 AM", title: "Morning" },
];

// [ms from start, step, processing, clock]
const TIMELINE = [
  [500, 0, true, "9:47 PM"],
  [2500, 0, false, "9:47 PM"],
  [4000, 1, true, "11:26 PM"],
  [6000, 1, false, "11:26 PM"],
  [7500, 2, true, "1:03 AM"],
  [9500, 2, false, "1:03 AM"],
  [11000, 3, false, "7:02 AM"],
];
const LOOP_MS = 18000;

export default function TheTurn() {
  const sectionRef = useRef(null);

  // Animation timeline states
  const [step, setStep] = useState(-1);
  const [processing, setProcessing] = useState(false);
  const [currentTime, setCurrentTime] = useState("9:47 PM");
  const [isOnScreen, setIsOnScreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [runId, setRunId] = useState(0);

  // Reduced motion: hold the finished morning.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsPaused(true);
      setStep(3);
      setCurrentTime("7:02 AM");
    }
  }, []);

  // Plays only while on screen.
  useEffect(() => {
    if (!sectionRef.current) return;
    const io = new IntersectionObserver(([entry]) => setIsOnScreen(entry.isIntersecting), {
      threshold: 0.3,
    });
    io.observe(sectionRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!isOnScreen || isPaused) return;
    let timeouts = [];

    const playStory = () => {
      setStep(-1);
      setProcessing(false);
      setCurrentTime("9:47 PM");
      timeouts = TIMELINE.map(([at, s, p, clock]) =>
        setTimeout(() => {
          setCurrentTime(clock);
          setStep(s);
          setProcessing(p);
        }, at),
      );
      timeouts.push(setTimeout(playStory, LOOP_MS));
    };

    playStory();
    return () => timeouts.forEach(clearTimeout);
  }, [isOnScreen, isPaused, runId]);

  const replay = useCallback(() => {
    setIsPaused(false);
    setRunId((n) => n + 1);
  }, []);

  const isMorning = step === 3;

  return (
    <section ref={sectionRef} className="sec band" id="turn">
      <div className="wrap">
        <div className="head head--split turn__head">
          <div style={{ display: "grid", gap: "var(--space-lg)", justifyItems: "start" }}>
            <span className="turn__clock" role="status" aria-live="polite" data-reveal>
              {isMorning ? <Sunrise aria-hidden="true" /> : <Moon aria-hidden="true" />}
              <span>{currentTime}</span>
            </span>
            <h2 data-reveal style={{ "--i": 1 }}>
              <span key={isMorning ? "am" : "pm"}>
                {isMorning
                  ? "7:02 AM looks completely different."
                  : "While your competitors are sleeping…"}
              </span>
            </h2>
          </div>
          <p className="lead" data-reveal style={{ "--i": 2 }}>
            Same website. Same three visitors. One difference: someone answered
            in under a second — every time.
          </p>
        </div>

        <div className="diptych" data-reveal style={{ "--i": 1 }}>
          {/* Without CloseDesk (Losing) */}
          <div className="diptych__pane">
            <div className="diptych__label">Without CloseDesk</div>
            <ul className="diptych__rows">
              {storySequence.slice(0, 3).map((lead, idx) =>
                step >= idx ? (
                  <StoryRow
                    key={`loss-${idx}-${runId}`}
                    title={lead.title}
                    time={lead.time}
                    type="loss"
                    isProcessing={step === idx && processing}
                  />
                ) : null,
              )}
            </ul>
            <p className="diptych__sum" data-on={isMorning ? "true" : "false"}>
              <AlertCircle size={20} style={{ color: "var(--color-loss)" }} aria-hidden="true" />
              Three urgent jobs came in overnight. All three hired whoever
              answered first.
            </p>
          </div>

          {/* With CloseDesk (Winning) */}
          <div className="diptych__pane diptych__pane--win">
            <div className="diptych__label">With CloseDesk</div>
            <ul className="diptych__rows">
              {storySequence.slice(0, 3).map((lead, idx) =>
                step >= idx ? (
                  <StoryRow
                    key={`win-${idx}-${runId}`}
                    title={lead.title}
                    time={lead.time}
                    type="win"
                    isProcessing={step === idx && processing}
                  />
                ) : null,
              )}
            </ul>
            <p className="diptych__sum" data-on={isMorning ? "true" : "false"}>
              <CheckCircle2 size={20} style={{ color: "var(--color-accent)" }} aria-hidden="true" />
              Each one answered instantly, qualified like a dispatcher,
              booked, team notified, and logged in Pulse — before you woke up.
            </p>
          </div>
        </div>

        <div className="loop-ctl">
          <button
            type="button"
            className="tlink"
            aria-pressed={isPaused}
            onClick={() => setIsPaused((p) => !p)}
          >
            {isPaused ? "Play the night" : "Pause the night"}
          </button>
          <button type="button" className="tlink" onClick={replay}>
            Replay from 9:47 PM
          </button>
        </div>
      </div>
    </section>
  );
}

// --- Subcomponent for Animated Rows ---

function StoryRow({ title, time, type, isProcessing }) {
  const isLoss = type === "loss";

  return (
    <li className="story">
      <div>
        <b>{title}</b>
        <small>{time}</small>
      </div>

      {isProcessing ? (
        <span className="story__state story__state--wait">
          {isLoss ? (
            "Ringing…"
          ) : (
            <>
              <i aria-hidden="true" />
              AI Typing
            </>
          )}
        </span>
      ) : (
        <span className={`story__state ${isLoss ? "story__state--loss" : "story__state--win"}`}>
          {isLoss ? "GONE" : "BOOKED"}
        </span>
      )}
    </li>
  );
}
