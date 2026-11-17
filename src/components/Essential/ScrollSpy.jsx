"use client";

import { useEffect } from "react";
import { useRouter } from "next/router";

// Marks the table-of-contents link for the section being read on the
// document pages (privacy, terms, cookies). Any nav link pointing at "#id"
// inside .doc-pod is tracked; the current one gets aria-current="true".
export default function ScrollSpy() {
  const router = useRouter();

  useEffect(() => {
    let io;
    // wait for the page transition to mount the new page
    const timer = setTimeout(() => {
      const links = [...document.querySelectorAll('.doc-pod nav a[href^="#"]')];
      if (!links.length) return;
      const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));

      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            links.forEach((a) => a.removeAttribute("aria-current"));
            byId.get(entry.target.id)?.setAttribute("aria-current", "true");
          });
        },
        { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
      );
      byId.forEach((_, id) => {
        const el = document.getElementById(id);
        if (el) io.observe(el);
      });
    }, 700);

    return () => {
      clearTimeout(timer);
      io?.disconnect();
    };
  }, [router.pathname]);

  return null;
}
