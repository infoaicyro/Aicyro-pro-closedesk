"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Headphones,
  Settings2,
  MoonStar,
  Zap,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
} from "lucide-react";

const comparisonData = {
  human: {
    id: "human",
    title: "Human Answering Service",
    icon: Headphones,
    storyCloseDesk:
      "Answers in < 1s, qualifies the emergency, and books the job immediately.",
    storyRival:
      "Lead is put on hold. Operator takes a generic message and tells them you'll call back tomorrow.",
    metrics: [
      {
        label: "Response speed",
        us: "Under a second, 24/7",
        them: "Hold times vary at night",
        win: true,
      },
      {
        label: "Qualifies the job",
        us: "Like a dispatcher: issue, urgency, location",
        them: "Takes a basic message, follows a generic script",
        win: true,
      },
      {
        label: "Books the job",
        us: "Creates the booking and notifies team instantly",
        them: "Usually relays a message for you to call back",
        win: true,
      },
      {
        label: "Setup effort for you",
        us: "None — done-for-you build & install",
        them: "Low — but you write and update the scripts",
        win: true,
      },
      {
        label: "Where it wins",
        us: "Website leads, after-hours demand",
        them: "Phone-first businesses (leads who only call)",
        win: "tie",
      },
    ],
  },
  diy: {
    id: "diy",
    title: "DIY Chat Widget",
    icon: Settings2,
    storyCloseDesk:
      "Proactively guides the visitor, captures details, and secures the booking.",
    storyRival:
      "Sits silently in the corner. If clicked, it asks for an email and promises a reply during business hours.",
    metrics: [
      {
        label: "Response speed",
        us: "Under a second, 24/7",
        them: "Instant — if you've configured it well",
        win: "tie",
      },
      {
        label: "Qualifies the job",
        us: "Like a dispatcher: issue, urgency, location",
        them: "Only as well as you script it yourself",
        win: true,
      },
      {
        label: "Books the job",
        us: "Creates the booking and notifies team instantly",
        them: "Rarely — most collect an email at best",
        win: true,
      },
      {
        label: "Setup effort for you",
        us: "None — done-for-you build & install",
        them: "High — you build, test, and babysit it forever",
        win: true,
      },
      {
        label: "Where it wins",
        us: "Website leads, after-hours demand",
        them: "Tinkerers with time and low-urgency services",
        win: true,
      },
    ],
  },
  nothing: {
    id: "nothing",
    title: "Do Nothing",
    icon: MoonStar,
    storyCloseDesk:
      "Turns a panicked late-night visitor into a confirmed job on your morning calendar.",
    storyRival:
      "The visitor sees you are closed, hits the 'Back' button, and hires the next company on Google.",
    metrics: [
      {
        label: "Response speed",
        us: "Under a second, 24/7",
        them: "Next business day, if the form gets read",
        win: true,
      },
      {
        label: "Qualifies the job",
        us: "Like a dispatcher: issue, urgency, location",
        them: "No",
        win: true,
      },
      {
        label: "Books the job",
        us: "Creates the booking and notifies team instantly",
        them: "No",
        win: true,
      },
      {
        label: "Setup effort for you",
        us: "None — done-for-you build & install",
        them: "None",
        win: "tie",
      },
      {
        label: "Where it wins",
        us: "Website leads, after-hours demand",
        them: "Businesses with more work than they can take",
        win: true,
      },
    ],
  },
};

const EASE_OUT = [0.16, 1, 0.3, 1];

export default function Compare() {
  const [activeTab, setActiveTab] = useState("human");
  const activeData = comparisonData[activeTab];
  const tabs = Object.values(comparisonData);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  // Arrow keys move between tabs
  const onTabKey = (e, index) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setActiveTab(tabs[next].id);
    document.getElementById(`cmp-tab-${tabs[next].id}`)?.focus();
  };

  return (
    <section id="compare" className="sec">
      <div className="wrap">
        <div className="head head--split">
          <h2 data-reveal>CloseDesk vs. everything else you&apos;re considering.</h2>
          <p className="lead" data-reveal style={{ "--i": 1 }}>
            You&apos;re comparing anyway. Here is the honest head-to-head reality of
            what happens when a lead lands on your site after hours.
          </p>
        </div>

        <div className="cmp" data-reveal style={{ "--i": 1 }}>
          <div className="cmp__tabs">
            <LayoutGroup id="compare-tabs">
              <div className="seg" role="tablist" aria-label="Comparison options">
                {tabs.map((tab, index) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      id={`cmp-tab-${tab.id}`}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls="cmp-panel"
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => handleTabChange(tab.id)}
                      onKeyDown={(e) => onTabKey(e, index)}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="compare-thumb"
                          className="seg__thumb"
                          transition={{ duration: 0.42, ease: EASE_OUT }}
                        />
                      )}
                      <Icon size={16} aria-hidden="true" />
                      {tab.title}
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>
          </div>

          <div className="cmp__board" id="cmp-panel" role="tabpanel" aria-labelledby={`cmp-tab-${activeTab}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.34, ease: EASE_OUT } }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.18, ease: [0.7, 0, 0.84, 0] } }}
              >
                <div className="cmp__stories">
                  <div className="cmp__story cmp__story--us">
                    <small>
                      <Zap size={14} aria-hidden="true" /> The CloseDesk Outcome
                    </small>
                    <p>
                      <time>11:42 PM</time> {activeData.storyCloseDesk}
                    </p>
                  </div>
                  <div className="cmp__story cmp__story--them">
                    <small>
                      <Clock size={14} aria-hidden="true" /> With {activeData.title}
                    </small>
                    <p>
                      <time>11:42 PM</time> {activeData.storyRival}
                    </p>
                  </div>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th scope="col">Feature Metric</th>
                      <th scope="col" className="us">CloseDesk</th>
                      <th scope="col">{activeData.title}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeData.metrics.map((metric, idx) => (
                      <tr key={idx} className="cmp__row" style={{ "--i": idx }}>
                        <td>{metric.label}</td>
                        <td className="us">
                          <span className="cell">
                            <CheckCircle2 aria-hidden="true" />
                            {metric.us}
                          </span>
                        </td>
                        <td>
                          <span className="cell">
                            {metric.win === "tie" ? (
                              <AlertCircle aria-hidden="true" />
                            ) : (
                              <XCircle aria-hidden="true" />
                            )}
                            {metric.them}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="caveat" data-reveal>
          <strong>The honest caveat:</strong>
          <p>
            If most of your leads phone you directly and your website gets little
            traffic, a human answering service may serve you better than we can —
            and we&apos;ll tell you exactly that on an audit call. CloseDesk earns its
            keep where the leads land: on your website, usually after hours.
          </p>
        </div>
      </div>
    </section>
  );
}
