"use client";

import React, { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

// Counts every number inside a string up from zero the first time it scrolls
// into view: "$250–350" runs both ends, "$2,000" keeps its comma.
// The server renders the final text, so it reads correctly without script.
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

const parts = (text) => {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(NUMBER)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const raw = m[0];
    out.push({
      value: Number(raw.replace(/,/g, "")),
      comma: raw.includes(","),
      decimals: raw.includes(".") ? raw.split(".")[1].length : 0,
    });
    last = m.index + raw.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
};

const format = (n, { comma, decimals }) => {
  const fixed = n.toFixed(decimals);
  if (!comma) return fixed;
  const [int, dec] = fixed.split(".");
  return Number(int).toLocaleString("en-US") + (dec ? `.${dec}` : "");
};

export default function CountUp({ value, duration = 1.4, className }) {
  const ref = useRef(null);
  const pieces = parts(value);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    setProgress(0);

    let controls;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        controls = animate(0, 1, {
          duration,
          ease: [0.16, 1, 0.3, 1],
          onUpdate: setProgress,
        });
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      controls?.stop();
    };
  }, [duration]);

  return (
    <span ref={ref} className={className} aria-label={value}>
      <span aria-hidden="true">
        {pieces.map((p, i) =>
          p.text !== undefined ? (
            <React.Fragment key={i}>{p.text}</React.Fragment>
          ) : (
            <React.Fragment key={i}>{format(p.value * progress, p)}</React.Fragment>
          ),
        )}
      </span>
    </span>
  );
}
