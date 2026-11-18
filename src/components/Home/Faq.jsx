"use client";

import React, { useState } from "react";

export const faqData = [
  {
    question: "Where are you based?",
    answer:
      "We're a global AI product team with our hub in Pakistan, and our entire focus is U.S. field service. Our working day covers your after-hours — which is exactly the problem we solve. Three things protect you: your data stays yours in writing, our process is documented, and every call happens in your business hours. We put this answer first because it's the question people are most hesitant to ask.",
  },
  {
    question: "How much does it cost?",
    answer:
      "Founding 25 members: the $2,000 done-for-you build is included, and the monthly rate is $250–350 locked for life — your exact rate in that range depends on your trade and lead volume and is confirmed on the call. After the founding round, standard pricing is planned at $400–500/mo. Full breakdown is in the pricing section above.",
  },
  {
    question: "Is this just a chat widget on my site?",
    answer:
      "No. CloseDesk is an AI booking desk: it answers in under a second, qualifies like a dispatcher — issue, urgency, location — captures full contact and job details, creates the booking, notifies your team instantly, and logs everything in Pulse. A widget collects messages; CloseDesk books jobs.",
  },
  {
    question: "What if it gives a customer a wrong answer?",
    answer:
      "Every conversation is logged in Pulse, so nothing happens invisibly. During your first 60 days we review conversations and tighten the qualification flow — that's what the optimization period is for. And CloseDesk is built to book and dispatch, not to quote prices or make promises you haven't approved: its job is to capture the job details and get your team involved fast.",
  },
  {
    question: "What do I have to do on my end?",
    answer:
      "Almost nothing. It's done-for-you: we audit your lead flow, build CloseDesk around your trade and service area, install it, wire your notifications, and optimize it for 60 days. You take the booked jobs.",
  },
  {
    question: "Who owns the leads and conversation data?",
    answer:
      "You do — in writing. Every lead, transcript, and booking belongs to your business, and it's all visible to you in Pulse.",
  },
  {
    question: "How do I know it's actually working?",
    answer:
      "You watch it work. Pulse shows every conversation, every qualified lead, and every booked job. Nothing on this page pretends to be live data — the conversation up top and the night scene are labeled illustrations, because every real number we publish will come from a real client and say so.",
  },
  {
    question: "Why should I be one of the first clients?",
    answer:
      "Honest trade: you're helping us build our public track record, and in exchange you get the $2,000 build included and a founder rate locked for life. That's the whole deal — early clients take a little more on faith and pay meaningfully less, forever.",
  },
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState(0); // Opens the first FAQ by default

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="sec">
      <div className="wrap rowset">
        <div className="rowset__head">
          <h2 data-reveal>The questions everyone asks. Answered plainly.</h2>
          <p className="lead" data-reveal style={{ "--i": 1 }}>
            Including the uncomfortable ones. If your question isn&apos;t here, ask
            it on the call — you&apos;ll get the same straight answer.
          </p>
        </div>

        <ul className="faq">
          {faqData.map((item, index) => {
            const isOpen = openIndex === index;
            const contentId = `faq-content-${index}`;
            const buttonId = `faq-button-${index}`;

            return (
              <li key={index} data-reveal style={{ "--i": Math.min(index, 4) }}>
                <h3 style={{ fontSize: "inherit", maxWidth: "none", margin: 0 }}>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    onClick={() => toggleFaq(index)}
                    className="faq__q"
                  >
                    <span>{item.question}</span>
                    <span className="faq__icon" aria-hidden="true" />
                  </button>
                </h3>

                <div
                  id={contentId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="faq__a"
                  data-open={isOpen ? "true" : "false"}
                  inert={isOpen ? undefined : true}
                >
                  <div>
                    <p>{item.answer}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
