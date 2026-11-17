"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { motion, LayoutGroup } from "framer-motion";
import CountUp from "../Essential/CountUp";
import {
  ArrowRight,
  Zap,
  MapPin,
  Phone,
  CheckCircle2,
  Wrench,
  Flame,
  Droplets,
  ShieldCheck,
  Activity,
  RotateCcw,
  AlertTriangle,
  MessageSquare,
  FileText,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";

const chatSequence = [
  {
    id: 1,
    type: "user",
    text: "Water is coming through my ceiling. Do you handle emergency water damage??",
    time: "11:42 PM",
    delay: 1000,
  },
  {
    id: 2,
    type: "ai",
    text: "Yes, we run 24/7 emergency crews. Is the water still actively leaking right now?",
    time: "11:42 PM",
    delay: 1600,
  },
  {
    id: 3,
    type: "user",
    text: "Yes, it's getting worse. 412 Maple Ct.",
    time: "11:43 PM",
    delay: 1400,
  },
  {
    id: 4,
    type: "ai",
    text: "Got it. Marking this urgent. What's the best phone number for our on-call tech to reach you at?",
    time: "11:43 PM",
    delay: 1800,
  },
  {
    id: 5,
    type: "user",
    text: "(512) 839-2041. Can someone call me right now?",
    time: "11:43 PM",
    delay: 1200,
  },
  {
    id: 6,
    type: "action",
    text: "Urgent Lead Captured and Dispatched",
    time: "11:43 PM",
    delay: 800,
  },
];

const INDUSTRIES_CONFIG = [
  { name: "HVAC", icon: Flame },
  { name: "Plumbing", icon: Droplets },
  { name: "Restoration", icon: ShieldCheck },
  { name: "Roofing", icon: Activity },
  { name: "Pest Control", icon: ShieldCheck },
  { name: "Electrical", icon: Zap },
  { name: "Water Mitigation", icon: Droplets },
  { name: "Appliance Repair", icon: Wrench },
];

const EASE_OUT = [0.16, 1, 0.3, 1];

export default function Hero({ onOpenPopup }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState("conversation"); // "conversation" | "ticket"
  const [isDispatched, setIsDispatched] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isOnScreen, setIsOnScreen] = useState(true);
  const chatScrollRef = useRef(null);
  const consoleRef = useRef(null);

  const isRunning = !isPaused && isOnScreen;

  // Reduced motion: show the finished conversation at once and hold still.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMessages(chatSequence);
      setIsDispatched(true);
      setStep(chatSequence.length);
      setIsPaused(true);
    }
  }, []);

  // The console only plays while it is on screen.
  useEffect(() => {
    if (!consoleRef.current) return;
    const io = new IntersectionObserver(([entry]) => setIsOnScreen(entry.isIntersecting), {
      threshold: 0.15,
    });
    io.observe(consoleRef.current);
    return () => io.disconnect();
  }, []);

  // Autonomous Chat Simulation Engine
  useEffect(() => {
    if (!isRunning) {
      setIsTyping(false);
      return;
    }
    let timer;
    if (step < chatSequence.length) {
      const item = chatSequence[step];
      if (item.type === "ai") {
        setIsTyping(true);
        timer = setTimeout(() => {
          setIsTyping(false);
          setMessages((prev) => [...prev, item]);
          setStep((s) => s + 1);
        }, item.delay);
      } else {
        timer = setTimeout(() => {
          if (item.type === "action") {
            setIsDispatched(true);
          }
          setMessages((prev) => [...prev, item]);
          setStep((s) => s + 1);
        }, item.delay);
      }
    } else {
      // Loop replay after pause
      timer = setTimeout(() => {
        handleReset();
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [step, isRunning]);

  // Keep chat pinned to bottom, gliding
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const handleReset = () => {
    setMessages([]);
    setIsDispatched(false);
    setActiveTab("conversation");
    setStep(0);
  };

  const handleReplay = () => {
    handleReset();
    setIsPaused(false);
  };

  return (
    <>
      <section id="top" className="hero">
        <div className="hero__bg" aria-hidden="true" />
        <div className="wrap">
          <div className="hero__grid">
            {/* ================= THE PITCH ================= */}
            <div className="hero__copy">
              <a href="#founding25" className="announce settle" style={{ "--i": 0 }}>
                Founding 25 Launch Program: Now Open
              </a>

              <h1 className="settle" style={{ "--i": 1 }}>
                Turn field-service website visitors into booked jobs, 24/7.
              </h1>

              <p className="lead settle" style={{ "--i": 2 }}>
                CloseDesk by Aicyro is a done-for-you AI booking desk that responds
                to your website visitors instantly, qualifies urgent service
                requests, captures contact details, and books quote calls,
                inspections, and service visits{" "}
                <strong>before they call a competitor.</strong>
              </p>

              <div className="hero__actions settle" style={{ "--i": 3 }}>
                <button type="button" onClick={onOpenPopup} className="btn">
                  Claim a Founding 25 Spot
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/free-website-audit")}
                  className="btn btn--quiet"
                >
                  Get a Free Website Lead Audit
                </button>
              </div>

              <div className="figs settle" style={{ "--i": 4 }}>
                <div>
                  <b><CountUp value="< 1.2s" duration={1.6} /></b>
                  <span>Response speed</span>
                </div>
                <div>
                  <b>24/7/365</b>
                  <span>After-hours live</span>
                </div>
                <div>
                  <b>$0</b>
                  <span>Build fee waived</span>
                </div>
              </div>
            </div>

            {/* ================= THE CONSOLE ================= */}
            <div className="settle" style={{ "--i": 3 }} ref={consoleRef}>
              <div className="console" aria-label="CloseDesk Dispatch Console, an illustration of an 11:42 PM water-damage lead">
                <div className="console__bar">
                  <div className="console__name">
                    <b>CloseDesk Dispatch Console</b>
                    <span>Autonomous emergency triage</span>
                  </div>

                  <div className="console__tools">
                    <LayoutGroup id="console-tabs">
                      <div className="seg" role="tablist" aria-label="Console view">
                        {[
                          { id: "conversation", label: "Live Stream", Icon: MessageSquare },
                          { id: "ticket", label: "Tech Voucher", Icon: FileText },
                        ].map(({ id, label, Icon }) => (
                          <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === id}
                            onClick={() => setActiveTab(id)}
                          >
                            {activeTab === id && (
                              <motion.span
                                layoutId="console-thumb"
                                className="seg__thumb"
                                transition={{ duration: 0.38, ease: EASE_OUT }}
                              />
                            )}
                            <Icon size={14} aria-hidden="true" />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </LayoutGroup>

                    <button
                      type="button"
                      onClick={() => setIsPaused((p) => !p)}
                      aria-label={isPaused ? "Play simulation" : "Pause simulation"}
                      aria-pressed={isPaused}
                      className="icon-btn"
                    >
                      {isPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleReplay}
                      aria-label="Replay simulation"
                      className="icon-btn"
                    >
                      <RotateCcw aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Console Body: Live Conversation Stream */}
                {activeTab === "conversation" && (
                  <div ref={chatScrollRef} className="console__body" aria-live="polite" data-lenis-prevent>
                    {messages.map((m) => {
                      if (m.type === "action") {
                        return (
                          <div key={m.id} className="dispatch">
                            <p>
                              <CheckCircle2 size={18} aria-hidden="true" />
                              <span>{m.text}: Calendar Synced</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => setActiveTab("ticket")}
                              className="tlink"
                            >
                              Inspect Ticket
                              <ChevronRight size={14} aria-hidden="true" />
                            </button>
                          </div>
                        );
                      }
                      const isAi = m.type === "ai";
                      return (
                        <div key={m.id} className={`msg ${isAi ? "msg--ai" : "msg--user"}`}>
                          <div className="msg__meta">
                            <b>{isAi ? "CloseDesk AI Desk" : "Homeowner"}</b>
                            <span className="num">{m.time}</span>
                          </div>
                          <div className="msg__bubble">{m.text}</div>
                        </div>
                      );
                    })}

                    {isTyping && (
                      <div className="typing" aria-label="CloseDesk is typing">
                        <i />
                        <i />
                        <i />
                      </div>
                    )}
                  </div>
                )}

                {/* Console Body: Synchronized Technician Dispatch Voucher */}
                {activeTab === "ticket" && (
                  <div className="console__body" data-lenis-prevent>
                    <div className="ticket">
                      <div className="ticket__top">
                        <span className="ticket__prio">
                          <AlertTriangle size={16} aria-hidden="true" />
                          Priority 1 Emergency Ticket
                        </span>
                        <span className="muted num" style={{ fontSize: "var(--text-xs)" }}>
                          Dispatched 11:43:12 PM
                        </span>
                      </div>

                      <dl>
                        <div className="full">
                          <dt>Reported Incident</dt>
                          <dd>Water leaking actively through ceiling, spreading rapidly</dd>
                        </div>
                        <div>
                          <dt>Service Location</dt>
                          <dd style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                            <MapPin size={14} aria-hidden="true" style={{ color: "var(--color-accent)" }} />
                            412 Maple Ct.
                          </dd>
                        </div>
                        <div>
                          <dt>Caller Contact</dt>
                          <dd style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                            <Phone size={14} aria-hidden="true" style={{ color: "var(--color-accent)" }} />
                            <span className="num">(512) 839-2041</span>
                          </dd>
                        </div>
                        <div>
                          <dt>Estimated Job Value</dt>
                          <dd className="big num">$1,250 to $3,500</dd>
                        </div>
                        <div>
                          <dt>Triage Time</dt>
                          <dd className="num">&lt; 1.2s instant hold</dd>
                        </div>
                      </dl>

                      <div className="ticket__done">
                        <span>
                          <CheckCircle2 size={16} aria-hidden="true" />
                          On-Call Tech Notified via SMS and Calendar
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTab("conversation")}
                          className="tlink"
                        >
                          View Live Stream
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Console Command Footer */}
                <div className="console__foot">
                  <span>24/7 AI Engine: Emergency response speed &lt; 1.2s</span>
                  <button type="button" onClick={handleReplay} className="tlink">
                    Simulate Urgent Lead
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TRADES ================= */}
      <div className="trades">
        <div className="wrap trades__row" data-reveal>
          <span>Custom engineered for high-urgency field service trades:</span>
          <ul>
            {INDUSTRIES_CONFIG.map(({ name, icon: IconComponent }) => (
              <li key={name}>
                <IconComponent aria-hidden="true" />
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
