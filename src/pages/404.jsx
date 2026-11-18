"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft } from "lucide-react";
import Navbar from "../components/Essential/Navbar";
import Seo from "../components/Essential/Seo";

export default function Custom404() {
  const router = useRouter();

  return (
    <>
      <Seo title="Page not found | CloseDesk by Aicyro" description="This page does not exist." noindex />
      <Navbar />
      <main id="main" className="nf">
        <div className="wrap nf__grid">
          <figure className="nf__fig settle" style={{ "--i": 0 }}>
            <div className="nf__num" aria-hidden="true">
              {["4", "0", "4"].map((d, i) => (
                <span key={i} style={{ "--i": i }}>
                  {d}
                </span>
              ))}
            </div>
            <figcaption>Signal 404: Route Not Resolved</figcaption>
          </figure>

          <div className="nf__copy">
            <h1 className="settle" style={{ "--i": 2 }}>
              This destination is off the network.
            </h1>
            <p className="lead settle" style={{ "--i": 3 }}>
              The page you requested does not exist, has been archived, or was
              moved. CloseDesk monitors all incoming traffic, but this route
              leads nowhere.
            </p>

            <div className="close__actions settle" style={{ "--i": 4 }}>
              <Link href="/" className="btn">
                Return Home
              </Link>
              <button type="button" onClick={() => router.back()} className="btn btn--quiet">
                <ArrowLeft size={18} aria-hidden="true" />
                Go Back
              </button>
            </div>

            <p className="muted num settle" style={{ "--i": 5, fontSize: "var(--text-sm)" }}>
              Code: ERR_PATH_UNMAPPED
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
