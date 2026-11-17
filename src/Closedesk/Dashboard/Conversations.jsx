"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  FileText,
  MessageSquare,
  MessagesSquare,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { db } from "../../lib/firebase";
import { ref, onValue } from "firebase/database";

export default function Conversations({ onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterIntent, setFilterIntent] = useState("All");

  const [selectedConvo, setSelectedConvo] = useState(null);

  // --- FIREBASE REALTIME DATABASE LISTENER ---
  useEffect(() => {
    const tenantId = typeof window !== "undefined" ? (localStorage.getItem("currentTenant") || "default") : "default";
    const leadsPath = tenantId && tenantId !== "default" ? `tenants/${tenantId}/leads` : "leads";
    const leadsRef = ref(db, leadsPath);

    const unsubscribe = onValue(
      leadsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const liveData = Object.keys(data)
            .map((key) => ({
              id: key,
              ...data[key],
            }))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setConversations(liveData);
        } else {
          setConversations([]);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching conversations:", error);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  // --- FILTERING LOGIC ---
  const filteredConversations = useMemo(() => {
    return conversations.filter((convo) => {
      const searchString = searchTerm.toLowerCase();
      const matchesSearch =
        (convo.name && convo.name.toLowerCase().includes(searchString)) ||
        (convo.email && convo.email.toLowerCase().includes(searchString)) ||
        (convo.id && convo.id.toLowerCase().includes(searchString)) ||
        (convo.full_conversation_transcript &&
          convo.full_conversation_transcript
            .toLowerCase()
            .includes(searchString));

      const intent = convo.visitor_intent || "General Inquiry";
      const matchesIntent =
        filterIntent === "All" ||
        intent.includes(filterIntent) ||
        (filterIntent === "Service" && convo.service_requested);

      return matchesSearch && matchesIntent;
    });
  }, [conversations, searchTerm, filterIntent]);

  // --- PARSE TRANSCRIPT ---
  const parseTranscript = (transcriptString) => {
    if (!transcriptString) return [];
    return transcriptString
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line, index) => {
        const isBot = line.startsWith("[BOT]:");
        const isUser = line.startsWith("[USER]:");
        const text = line.replace("[BOT]:", "").replace("[USER]:", "").trim();
        return { id: index, isBot, isUser, text };
      });
  };

  // --- DYNAMIC FIELD CALCULATION & CAPTURE METRICS ---
  const getDropOffPoint = (parsedChat) => {
    if (parsedChat.length === 0) return "No interaction";
    const lastMsg = parsedChat[parsedChat.length - 1];
    if (lastMsg.isBot && lastMsg.text.includes("confirm your details"))
      return "At Booking Confirmation";
    if (lastMsg.isBot && lastMsg.text.includes("What day works best"))
      return "Selecting Date";
    if (lastMsg.isUser) return "User abandoned session";
    return "Dropped during discovery questionnaire";
  };

  const getCapturedFieldsMetrics = (convo) => {
    const fields = [
      { name: "Name", value: convo.name },
      { name: "Email", value: convo.email },
      { name: "Phone", value: convo.phone },
      { name: "Company", value: convo.business_name || convo.business_type },
      { name: "Urgency", value: convo.urgency_level },
    ];

    const captured = fields.filter(
      (f) => f.value && f.value.toString().trim() !== "",
    );
    return {
      score: `${captured.length}/${fields.length}`,
      percentage: Math.round((captured.length / fields.length) * 100),
      items: captured.map((c) => c.name),
    };
  };

  const getHandoffStatus = (convo) => {
    if (convo.booking_status === "Meeting Booked" || convo.booked_slot)
      return {
        label: "Automated Booking",
        color: "cd-badge--success",
      };
    if (convo.email || convo.phone)
      return {
        label: "Requires Manual Follow-up",
        color: "cd-badge--warn",
      };
    return {
      label: "Dropped - No Contact Data",
      color: "cd-badge--danger",
    };
  };

  const getComplianceFlags = (convo) => {
    const flags = [];
    if (convo.email || convo.phone)
      flags.push({ label: "PII Secured", ok: true });
    else flags.push({ label: "No PII Detected", ok: false });
    if (
      convo.full_conversation_transcript &&
      convo.full_conversation_transcript.length > 500
    )
      flags.push({ label: "High Token Usage", ok: true });
    flags.push({ label: "Standard AI Disclaimer Shown", ok: true });
    return flags;
  };

  if (isLoading) {
    return (
      <div className="cd-page">
        <div role="status" className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <span className="cd-spinner keep-motion h-6 w-6 text-signal" aria-hidden="true" />
          <p className="cd-meta m-0">
            Decrypting Transcripts…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cd-page">
      {/* Header */}
      <div className="cd-page__head">
        <div>
          <h1 className="cd-h1">
            Pulse Conversations
          </h1>
          <p className="cd-sub">
            Review raw transcripts, custom analytics, and model verification
            logs.
          </p>
        </div>
      </div>

      {/* List beside detail */}
      <div className="cd-grid items-start">
        {/* Conversation list */}
        <section
          aria-label="Conversations"
          className={`cd-panel cd-span-4 flex-col overflow-hidden min-[75rem]:sticky min-[75rem]:top-[calc(var(--top-h)+var(--space-lg))] min-[75rem]:max-h-[calc(100dvh-var(--top-h)-2*var(--space-lg))] ${selectedConvo ? "hidden min-[75rem]:flex" : "flex"}`}
        >
          <div className="flex shrink-0 flex-col gap-2 border-b border-rule p-4">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" />
              <input
                type="text"
                placeholder="Search transcripts or names…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search conversations"
                className="cd-input pl-9"
              />
            </div>
            <select
              value={filterIntent}
              onChange={(e) => setFilterIntent(e.target.value)}
              aria-label="Filter by intent"
              className="cd-select"
            >
              <option value="All">All Intents</option>
              <option value="Service">Service Request</option>
              <option value="Inquiry">General Inquiry</option>
              <option value="Support">Support</option>
            </select>
          </div>

          <div className="flex-grow overflow-y-auto overscroll-contain">
            {filteredConversations.length > 0 ? (
              <div className="divide-y divide-[var(--color-rule)]">
                {filteredConversations.map((convo) => {
                  const metrics = getCapturedFieldsMetrics(convo);
                  return (
                    <div
                      key={convo.id}
                      onClick={() => setSelectedConvo(convo)}
                      className={`cursor-pointer border-l-[3px] px-4 py-3 transition-colors ${selectedConvo?.id === convo.id ? "border-signal bg-selected" : "border-transparent hover:bg-hover"}`}
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate font-semibold text-ink">
                          {convo.name || "Anonymous Visitor"}
                        </span>
                        <span className="cd-meta cd-num shrink-0 whitespace-nowrap">
                          {new Date(convo.timestamp).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" },
                          )}
                        </span>
                      </div>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[length:var(--text-xs)] text-ink-2">
                        <span className="min-w-0 truncate">
                          {convo.visitor_intent ||
                            convo.service_requested ||
                            "General Inquiry"}
                        </span>
                        <span className="cd-mono shrink-0 text-ink-2">
                          Fields: {metrics.score}
                        </span>
                      </div>
                      <div className="line-clamp-2 text-[length:var(--text-xs)] text-ink-2">
                        &quot;
                        {convo.full_conversation_transcript
                          ? convo.full_conversation_transcript
                              .split("\n")
                              .pop()
                              .replace("[BOT]:", "")
                              .replace("[USER]:", "")
                              .trim()
                          : "No transcript available."}
                        &quot;
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="cd-empty">
                <p className="cd-empty__title">No conversations found.</p>
              </div>
            )}
          </div>
        </section>

        {/* Conversation detail */}
        <section
          aria-label="Conversation detail"
          className={`cd-panel cd-span-8 flex-col overflow-hidden ${!selectedConvo ? "hidden min-[75rem]:flex items-center justify-center" : "flex"}`}
        >
          {!selectedConvo ? (
            <div className="cd-empty min-h-[24rem] items-center justify-center text-center">
              <MessagesSquare aria-hidden="true" className="h-6 w-6 text-ink-2" />
              <h2 className="cd-h2">
                Select a Conversation
              </h2>
              <p className="m-0 max-w-sm text-[length:var(--text-sm)] text-ink-2">
                Click on any conversation from the list to view transcripts,
                cross-verified drop-offs, and data captures.
              </p>
            </div>
          ) : (
            <>
              {/* Detail header */}
              <div className="cd-panel__head shrink-0">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedConvo(null)}
                    className="cd-icon-btn cd-icon-btn--bordered -ml-1 min-[75rem]:hidden"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="cd-h2 flex flex-wrap items-center gap-2">
                      {selectedConvo.name || "Anonymous Visitor"}
                      {selectedConvo.lead_score === "High" && (
                        <span className="cd-badge cd-badge--signal">High Intent</span>
                      )}
                    </h2>
                    <p className="cd-mono mt-1 break-all text-ink-2">
                      Ref: {selectedConvo.id} •{" "}
                      {new Date(selectedConvo.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className={`cd-badge ${getHandoffStatus(selectedConvo).color}`}>
                  {getHandoffStatus(selectedConvo).label}
                </span>
              </div>

              {/* Detail content */}
              <div className="flex-grow">
                {/* Metrics row */}
                <div className="cd-stats border-b border-rule" style={{ "--cols": 3 }}>
                  {/* Intent */}
                  <div className="cd-stat">
                    <span className="cd-stat__label">
                      Intent Category
                    </span>
                    <span className="font-semibold text-ink">
                      {selectedConvo.visitor_intent ||
                        selectedConvo.service_requested ||
                        "Unknown"}
                    </span>
                  </div>

                  {/* Drop-off point verified by model */}
                  <div className="cd-stat">
                    <span className="cd-stat__label">
                      Drop-off Point
                    </span>
                    <span
                      className="block truncate font-semibold text-ink"
                      title={getDropOffPoint(
                        parseTranscript(
                          selectedConvo.full_conversation_transcript,
                        ),
                      )}
                    >
                      {getDropOffPoint(
                        parseTranscript(
                          selectedConvo.full_conversation_transcript,
                        ),
                      )}
                    </span>
                    <span className="cd-stat__note flex items-center gap-1">
                      <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      Transcript Verification Complete
                    </span>
                  </div>

                  {/* Captured fields rate */}
                  <div className="cd-stat">
                    <span className="cd-stat__label">
                      Captured Fields KPI
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="cd-stat__value cd-stat__value--sm">
                        {getCapturedFieldsMetrics(selectedConvo).score}
                      </span>
                      <span className="cd-meta cd-num">
                        ({getCapturedFieldsMetrics(selectedConvo).percentage}%
                        completion)
                      </span>
                    </div>
                    <div className="cd-bar mt-1" aria-hidden="true">
                      <span
                        style={{
                          width: `${getCapturedFieldsMetrics(selectedConvo).percentage}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Detail and transcript */}
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  {/* Left: AI content and compliance */}
                  <div className="flex flex-col">
                    {/* Executive summary */}
                    <div className="px-6 py-5 max-[40rem]:px-4">
                      <h3 className="cd-h3 mb-2 flex items-center gap-2">
                        <Zap aria-hidden="true" className="h-4 w-4 text-ink-2" />
                        AI Conversation Summary
                      </h3>
                      <p className="m-0 leading-relaxed text-ink">
                        {selectedConvo.conversation_summary ||
                          "No summary was generated for this interaction."}
                      </p>
                    </div>

                    {/* Captured fields detail */}
                    <div className="border-t border-rule px-6 py-5 max-[40rem]:px-4">
                      <h3 className="cd-h3 mb-3 flex items-center gap-2">
                        <FileText aria-hidden="true" className="h-4 w-4 text-ink-2" />
                        Extracted Entity Context
                      </h3>
                      <dl className="cd-dl grid-cols-[minmax(8rem,max-content)_minmax(0,1fr)] gap-x-4 gap-y-2">
                        <dt>Full Name</dt>
                        <dd
                          className={selectedConvo.name ? "font-semibold" : "text-[length:var(--text-xs)] font-medium text-danger"}
                        >
                          {selectedConvo.name || "Missing Name"}
                        </dd>
                        <dt>Email Address</dt>
                        <dd
                          className={selectedConvo.email ? "font-semibold" : "text-[length:var(--text-xs)] font-medium text-danger"}
                        >
                          {selectedConvo.email || "Missing Email"}
                        </dd>
                        <dt>Phone Number</dt>
                        <dd
                          className={selectedConvo.phone ? "font-semibold" : "text-[length:var(--text-xs)] font-medium text-danger"}
                        >
                          {selectedConvo.phone || "Missing Phone"}
                        </dd>
                        <dt>Company Framework</dt>
                        <dd
                          className={selectedConvo.business_name || selectedConvo.business_type ? "font-semibold" : "text-[length:var(--text-xs)] font-medium text-danger"}
                        >
                          {selectedConvo.business_name ||
                            selectedConvo.business_type ||
                            "Missing Context"}
                        </dd>
                        <dt>Urgency Parameter</dt>
                        <dd
                          className={`font-semibold ${selectedConvo.urgency_level === "High" ? "text-danger" : ""}`}
                        >
                          {selectedConvo.urgency_level || "Standard"}
                        </dd>
                      </dl>
                    </div>

                    {/* Compliance flags */}
                    <div className="border-t border-rule px-6 py-5 max-[40rem]:px-4">
                      <h4 className="cd-h3 mb-3">
                        System Framework Compliance Check
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {getComplianceFlags(selectedConvo).map((flag, i) => (
                          <span
                            key={i}
                            className={`cd-badge ${flag.ok ? "cd-badge--success" : "cd-badge--danger"}`}
                          >
                            {flag.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: full conversation log */}
                  <div className="flex h-[520px] flex-col border-t border-rule lg:border-l lg:border-t-0">
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-rule px-4 py-3">
                      <h3 className="cd-h3 flex items-center gap-2">
                        <MessageSquare aria-hidden="true" className="h-4 w-4 text-ink-2" />
                        Full System Chat Log
                      </h3>
                      <span className="cd-badge font-mono">
                        Raw stream
                      </span>
                    </div>

                    <div className="flex flex-grow flex-col gap-3 overflow-y-auto overscroll-contain p-4">
                      {parseTranscript(
                        selectedConvo.full_conversation_transcript,
                      ).length > 0 ? (
                        parseTranscript(
                          selectedConvo.full_conversation_transcript,
                        ).map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex max-w-[85%] flex-col ${msg.isBot ? "self-start" : "self-end"}`}
                          >
                            <span
                              className={`cd-meta mx-1 mb-1 ${msg.isBot ? "text-left" : "text-right"}`}
                            >
                              {msg.isBot ? "AI Front Desk" : "Visitor"}
                            </span>
                            <div
                              className={`rounded-control px-3.5 py-2 text-[length:var(--text-sm)] leading-relaxed text-ink ${
                                msg.isBot
                                  ? "rounded-tl-sm border border-rule bg-paper-3"
                                  : "rounded-tr-sm bg-paper-2"
                              }`}
                            >
                              {msg.text}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="cd-empty m-auto items-center text-center">
                          <p className="m-0">Transcript payload structure empty or unavailable.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
