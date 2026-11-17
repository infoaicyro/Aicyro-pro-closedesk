// src/Closedesk/Dashboard/TerminalScreen.jsx
"use client";

import { useState, useEffect } from "react";
import {
  ChevronRight,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
  Zap,
} from "lucide-react";
import { createPulseLogger } from "../../lib/loggerPresets";
import { recordAuditTrail } from "../../lib/auditTracer";

const pulseLogger = createPulseLogger("TerminalScreen");
const isBookedLead = (lead) =>
  lead.booking_status === "Meeting Booked" || Boolean(lead.booked_slot) || Boolean(lead.selected_date);

const getStatusBadge = (lead) =>
  isBookedLead(lead) ? (
    <span className="cd-badge cd-badge--success">Booked</span>
  ) : (
    <span className="cd-badge">Captured</span>
  );


export default function LeadScreen({ onLogout }) {
  const [leads, setLeads] = useState([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);

  const [selectedLead, setSelectedLead] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterScore, setFilterScore] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDate, setFilterDate] = useState("All");

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterUrgency, setFilterUrgency] = useState("All");
  const [filterHasContact, setFilterHasContact] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setIsLoadingLeads(true);
    try {
      const storedTenant = typeof window !== "undefined" ? localStorage.getItem("currentTenant") : null;
      const url = storedTenant && storedTenant !== "default"
        ? `/api/leads?tenant=${encodeURIComponent(storedTenant)}`
        : "/api/leads";
      const headers = storedTenant && storedTenant !== "default"
        ? { "x-tenant-id": storedTenant }
        : {};
      const response = await fetch(url, { headers });
      const data = await response.json();

      const leadsObj = data.leads || data || {};
      let leadsArray = [];

      if (leadsObj && typeof leadsObj === "object") {
        leadsArray = Object.keys(leadsObj).map((key) => {
          const lead = leadsObj[key];

          let formattedScore = "Low";
          if (lead.lead_score) {
            formattedScore = lead.lead_score.charAt(0).toUpperCase() + lead.lead_score.slice(1).toLowerCase();
          }

          let formattedUrgency = "Low";
          if (lead.urgency_level) {
            formattedUrgency = lead.urgency_level.charAt(0).toUpperCase() + lead.urgency_level.slice(1).toLowerCase();
          }

          return {
            ...lead,
            id: lead.firebaseId || key,
            name: lead.name || "Anonymous",
            timestamp: lead.last_interaction_at || lead.conversation_started_at || null,
            deviceName: lead.deviceName || "Unknown Device",
            lead_score: formattedScore,
            visitor_intent: lead.visitor_intent || "Unknown",
            booking_status: lead.booking_status || "Captured",
            email: lead.email || "",
            phone: lead.phone || "",
            business_name: lead.business_name || "",
            business_type: lead.business_type || "",
            location: lead.location || "",
            urgency_level: formattedUrgency,
            conversation_summary: lead.conversation_summary || "",
            full_conversation_transcript: lead.full_conversation_transcript || "",
            last_inspected_image: lead.last_inspected_image || "", // Fetched for the transcript image UI
          };
        });
      }

      leadsArray.sort((a, b) => {
        const dateA = new Date(a.timestamp || 0).getTime();
        const dateB = new Date(b.timestamp || 0).getTime();
        return dateB - dateA;
      });

      setLeads(leadsArray);
    } catch (error) {
      console.error("Failed to fetch leads", error);
      setLeads([]);
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const openLeadDetails = (lead) => {
    setSelectedLead(lead);
    setIsPanelOpen(true);
  };

  const closeLeadDetails = () => {
    setIsPanelOpen(false);
    setTimeout(() => setSelectedLead(null), 300);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterScore("All");
    setFilterStatus("All");
    setFilterDate("All");
    setDateFrom("");
    setDateTo("");
    setFilterUrgency("All");
    setFilterHasContact(false);
  };

  const filteredLeads = leads.filter((lead) => {
    const searchString = searchTerm.toLowerCase();

    const matchesSearch =
      !searchTerm ||
      lead.name?.toLowerCase().includes(searchString) ||
      lead.email?.toLowerCase().includes(searchString) ||
      lead.phone?.toLowerCase().includes(searchString) ||
      lead.business_name?.toLowerCase().includes(searchString) ||
      lead.business_type?.toLowerCase().includes(searchString) ||
      lead.location?.toLowerCase().includes(searchString) ||
      lead.id?.toLowerCase().includes(searchString);

    const matchesScore = filterScore === "All" || lead.lead_score?.toLowerCase() === filterScore.toLowerCase();

    // Unified Booking Check
    const matchesStatus =
      filterStatus === "All"
        ? true
        : filterStatus === "Booked"
          ? lead.booking_status === "Meeting Booked" || !!lead.booked_slot || !!lead.selected_date
          : filterStatus === "Unbooked"
            ? lead.booking_status !== "Meeting Booked" && !lead.booked_slot && !lead.selected_date
            : true;

    const matchesUrgency = filterUrgency === "All" || lead.urgency_level?.toLowerCase() === filterUrgency.toLowerCase();
    const matchesContact = !filterHasContact || !!(lead.email || lead.phone);

    let matchesDate = true;
    if (!lead.timestamp) {
      if (filterDate !== "All" || dateFrom || dateTo) matchesDate = false;
    } else {
      const leadTime = new Date(lead.timestamp).getTime();

      if (dateFrom || dateTo) {
        if (dateFrom && leadTime < new Date(dateFrom).getTime()) matchesDate = false;
        if (dateTo && leadTime > new Date(dateTo).setHours(23, 59, 59, 999)) matchesDate = false;
      } else if (filterDate !== "All") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();
        const ONE_DAY = 24 * 60 * 60 * 1000;

        if (filterDate === "Today") {
          matchesDate = leadTime >= todayTime;
        } else if (filterDate === "3Days") {
          matchesDate = leadTime >= todayTime - 3 * ONE_DAY;
        } else if (filterDate === "7Days") {
          matchesDate = leadTime >= todayTime - 7 * ONE_DAY;
        } else if (filterDate === "30Days") {
          matchesDate = leadTime >= todayTime - 30 * ONE_DAY;
        }
      }
    }

    return matchesSearch && matchesScore && matchesStatus && matchesUrgency && matchesContact && matchesDate;
  });

  const totalLeads = filteredLeads.length;
  // Unified Booking Metric Calculation
  const bookedMeetings = filteredLeads.filter(
    (lead) => lead.booking_status === "Meeting Booked" || !!lead.booked_slot || !!lead.selected_date
  ).length;

  const highIntentLeads = filteredLeads.filter(
    (lead) => lead.lead_score === "High"
  ).length;

  const conversionRate = totalLeads > 0 ? Math.round((bookedMeetings / totalLeads) * 100) : 0;

  const headSelect =
    "cd-select w-auto min-h-[30px] py-0 pl-2 pr-8 text-[length:var(--text-xs)] font-semibold";

  return (
    <div className="cd-page">
      <div className="cd-page__head">
        <div>
          <h1 className="cd-h1">Lead Terminal</h1>
          <p className="cd-sub">Review intercepted traffic, conversation logs, and captured intel.</p>
        </div>
      </div>

      <section className="cd-panel" aria-label="Lead figures">
        <div className="cd-stats" style={{ "--cols": 4 }}>
          {[
            { label: "Total Captures", value: totalLeads, highlight: false },
            { label: "Meetings Booked", value: bookedMeetings, highlight: true },
            { label: "High Intent", value: highIntentLeads, highlight: false },
            { label: "Booking Rate", value: `${conversionRate}%`, highlight: false },
          ].map((stat, i) => (
            <div key={i} className="cd-stat">
              <span className="cd-stat__label">{stat.label}</span>
              <span className={`cd-stat__value cd-num ${stat.highlight ? "text-signal" : ""}`}>{stat.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="cd-panel relative flex flex-col overflow-hidden" aria-label="Lead queue" aria-busy={isLoadingLeads}>
        {isLoadingLeads && (
          <div
            role="status"
            aria-label="Loading leads"
            className="absolute inset-0 z-20 flex items-center justify-center bg-[color-mix(in_oklch,var(--color-paper-3)_80%,transparent)] text-signal"
          >
            <span className="cd-spinner keep-motion h-6 w-6" aria-hidden="true" />
          </div>
        )}

        <div className="cd-panel__head">
          <div className="relative min-w-0 flex-1 basis-64">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" />
            <input
              type="text"
              placeholder="Search leads, emails, business, or locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search leads"
              className="cd-input pl-9"
            />
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              aria-expanded={showAdvancedFilters}
              aria-pressed={showAdvancedFilters}
              className={`cd-btn cd-btn--quiet ${showAdvancedFilters ? "border-signal bg-selected" : ""}`}
            >
              <SlidersHorizontal aria-hidden="true" />
              Advanced Filters
            </button>
            <button type="button" onClick={fetchLeads} className="cd-btn cd-btn--quiet" aria-busy={isLoadingLeads}>
              <RefreshCw aria-hidden="true" className={isLoadingLeads ? "motion-safe:animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="grid grid-cols-1 items-end gap-4 border-b border-rule bg-paper-2 px-6 py-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="cd-field">
              <span className="cd-label">Start Date</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="cd-input" />
            </label>
            <label className="cd-field">
              <span className="cd-label">End Date</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="cd-input" />
            </label>
            <label className="cd-field">
              <span className="cd-label">Urgency Level</span>
              <select value={filterUrgency} onChange={(e) => setFilterUrgency(e.target.value)} className="cd-select">
                <option value="All">All Urgency Levels</option>
                <option value="High">High Urgency</option>
                <option value="Medium">Medium Urgency</option>
                <option value="Low">Low Urgency</option>
              </select>
            </label>
            <label className="flex min-h-[var(--control-h)] cursor-pointer items-center gap-2.5">
              <input type="checkbox" checked={filterHasContact} onChange={(e) => setFilterHasContact(e.target.checked)} className="cd-check" />
              <span className="text-[length:var(--text-sm)] font-medium text-ink">Requires Contact Info</span>
            </label>
            <div className="flex justify-end md:col-span-2 lg:col-span-4">
              <button type="button" onClick={clearAllFilters} className="cd-btn cd-btn--ghost cd-btn--sm">
                Clear All Filters
              </button>
            </div>
          </div>
        )}

        <div className="cd-table-wrap min-h-[24rem]">
          <table className="cd-table whitespace-nowrap">
            <thead>
              <tr>
                <th scope="col">Prospect & Ref ID</th>
                <th scope="col">Inquiry & Location</th>
                <th scope="col">
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filter by status" className={headSelect}>
                    <option value="All">Status (all)</option>
                    <option value="Booked">Booked</option>
                    <option value="Unbooked">Unbooked</option>
                  </select>
                </th>
                <th scope="col">
                  <select value={filterScore} onChange={(e) => setFilterScore(e.target.value)} aria-label="Filter by score" className={headSelect}>
                    <option value="All">Score (all)</option>
                    <option value="High">High intent</option>
                    <option value="Medium">Medium intent</option>
                    <option value="Low">Low intent</option>
                  </select>
                </th>
                <th scope="col">
                  <select value={filterDate} onChange={(e) => { setFilterDate(e.target.value); if (e.target.value !== "All") { setDateFrom(""); setDateTo(""); } }} aria-label="Filter by date" className={`${headSelect} ${dateFrom || dateTo ? "border-signal text-signal" : ""}`}>
                    {dateFrom || dateTo ? (<option value="Custom">Custom range</option>) : (<><option value="All">All time</option><option value="Today">Today</option><option value="3Days">Last 3 days</option><option value="7Days">Last 7 days</option><option value="30Days">Last 30 days</option></>)}
                  </select>
                </th>
                <th scope="col" className="text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead, idx) => (
                <tr key={idx} onClick={() => openLeadDetails(lead)} className="cursor-pointer active:bg-selected focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
                  <td>
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-paper-2 text-[length:var(--text-xs)] font-semibold text-ink-2">
                        {lead.name && lead.name !== "Anonymous" ? lead.name.charAt(0).toUpperCase() : "?"}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink">{lead.name || "Anonymous"}</span>
                          {lead.id && <span className="cd-mono text-ink-2">{lead.id.substring(0, 8)}</span>}
                        </div>
                        <div className="cd-meta mt-0.5">{lead.email || lead.phone || "No Contact Provided"}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="max-w-[180px] truncate font-medium text-ink">{lead.business_name || lead.business_type || lead.service_requested || "General Inquiry"}</div>
                    <div className="cd-meta mt-0.5 max-w-[180px] truncate">{lead.location ? `${lead.location} • ` : ""}{lead.visitor_intent || "N/A"}</div>
                  </td>
                  <td>
                    {getStatusBadge(lead)}
                  </td>
                  <td>
                    <div className="flex flex-col items-start gap-0.5">
                      <span className={`cd-badge ${lead.lead_score === "High" ? "cd-badge--signal" : ""}`}>{lead.lead_score || "N/A"}</span>
                      {lead.urgency_level && lead.urgency_level !== "Low" && <span className={`text-[length:var(--text-2xs)] font-medium ${lead.urgency_level === "High" ? "text-danger" : "text-warn"}`}>{lead.urgency_level} Urgency</span>}
                    </div>
                  </td>
                  <td className="cd-mono text-ink-2">{lead.timestamp ? new Date(lead.timestamp).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }) : "N/A"}</td>
                  <td className="text-right">
                    <button type="button" className="cd-btn cd-btn--ghost cd-btn--sm">
                      View
                      <ChevronRight aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredLeads.length === 0 && !isLoadingLeads && (
                <tr>
                  <td colSpan="6" className="p-0">
                    <div className="cd-empty items-center py-16 text-center">
                      <SearchX aria-hidden="true" className="h-6 w-6 text-ink-2" />
                      <p className="cd-empty__title">No leads found matching your criteria.</p>
                      <button type="button" onClick={clearAllFilters} className="cd-link text-[length:var(--text-xs)]">Clear all filters</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div
        className={`fixed inset-0 z-[var(--z-modal)] transition-opacity duration-300 ${isPanelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        aria-hidden={!isPanelOpen}
      >
        <div className="absolute inset-0 bg-[color-mix(in_oklch,var(--color-ink)_40%,transparent)]" onClick={closeLeadDetails}></div>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedLead ? selectedLead.name || "Anonymous Prospect" : undefined}
          className={`absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-rule bg-paper-3 transition-transform duration-300 ease-out ${isPanelOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          {selectedLead && (
            <>
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-rule px-6 py-5">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`cd-badge ${isBookedLead(selectedLead) ? "cd-badge--success" : ""}`}>
                      {selectedLead.booking_status || "Captured"}
                    </span>
                    <span className="cd-mono break-all text-ink-2">Ref: {selectedLead.id}</span>
                  </div>
                  <h2 className="cd-h1">{selectedLead.name || "Anonymous Prospect"}</h2>
                  {selectedLead.email && (
                    <a href={`mailto:${selectedLead.email}`} className="cd-link mt-1 inline-flex items-center gap-1.5 text-[length:var(--text-sm)] font-medium">
                      <Mail aria-hidden="true" className="h-4 w-4" />
                      {selectedLead.email}
                    </a>
                  )}
                </div>
                <button type="button" onClick={closeLeadDetails} className="cd-icon-btn cd-icon-btn--bordered" aria-label="Close lead details">
                  <X aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-grow flex-col overflow-y-auto overscroll-contain">
                <section className="grid grid-cols-1 gap-6 px-6 py-5 sm:grid-cols-2">
                  <div>
                    <h3 className="cd-h3 mb-3">Client Profile</h3>
                    <dl className="cd-dl grid-cols-[minmax(5rem,max-content)_minmax(0,1fr)] gap-x-4">
                      <dt>Phone</dt><dd>{selectedLead.phone || "—"}</dd>
                      <dt>Location</dt><dd>{selectedLead.location || "—"}</dd>
                      <dt>Company</dt><dd>{selectedLead.business_name || selectedLead.business_type || "—"}</dd>
                      <dt>Device</dt><dd>{selectedLead.deviceName || "—"}</dd>
                    </dl>
                  </div>

                  <div>
                    <h3 className="cd-h3 mb-3">System Metrics</h3>
                    <dl className="cd-dl grid-cols-[minmax(5rem,max-content)_minmax(0,1fr)] gap-x-4">
                      <dt>Lead Score</dt><dd className={`font-semibold ${selectedLead.lead_score === "High" ? "text-signal" : ""}`}>{selectedLead.lead_score || "—"}</dd>
                      <dt>Urgency</dt><dd className={selectedLead.urgency_level === "High" ? "font-medium text-danger" : ""}>{selectedLead.urgency_level || "—"}</dd>
                      <dt>Intent</dt><dd>{selectedLead.visitor_intent || "—"}</dd>
                      <dt>Target Meeting</dt><dd className="font-semibold">{selectedLead.booked_slot || selectedLead.selected_date || selectedLead.display_time || "—"}</dd>
                    </dl>
                  </div>
                </section>

                <section className="border-t border-rule px-6 py-5">
                  <h3 className="cd-h3 mb-3 flex items-center gap-2">
                    <Zap aria-hidden="true" className="h-4 w-4 text-ink-2" />
                    AI Conversation Summary
                  </h3>
                  <div className="cd-well leading-relaxed text-ink">
                    {selectedLead.conversation_summary && selectedLead.conversation_summary !== "In progress..." ? selectedLead.conversation_summary : "No summary available for this lead yet."}
                  </div>
                </section>

                {/* Transcript with the Firebase Storage image inline */}
                <section className="border-t border-rule px-6 py-5">
                  <h3 className="cd-h3 mb-3 flex items-center gap-2">
                    <MessageSquare aria-hidden="true" className="h-4 w-4 text-ink-2" />
                    Conversation Transcript
                  </h3>
                  <div className="cd-well overflow-x-auto font-mono text-[length:var(--text-xs)] leading-relaxed text-ink">
                    {selectedLead.full_conversation_transcript
                      ? selectedLead.full_conversation_transcript.split("\n").map((line, i) => {
                          const isBot = line.startsWith("[BOT]");
                          const isUser = line.startsWith("[USER]");

                          let displayText = line;
                          let renderImage = false;

                          // User Image Logic: Replace ugly text string and flag UI to render actual image
                          if (isUser && displayText.includes("📷 [Photo submitted for inspection]")) {
                            displayText = "[USER]: 📷 Image Uploaded";
                            renderImage = true;
                          }

                          // Bot Vision Logic: Strip model name (e.g. "(gpt-4o-mini)") and extra asterisks from inspection results
                          if (isBot && displayText.includes("🔍 **Inspection Result**")) {
                            displayText = displayText.replace(/\*\*Inspection Result\*\*\s*\([^)]+\):?/i, "Inspection Result:");
                          }

                          return (
                            <div key={i} className={`mb-2 ${isBot ? "text-ink-2" : isUser ? "text-ink" : "text-ink-2"}`}>
                              <div className="whitespace-pre-wrap">{displayText}</div>
                              {renderImage && selectedLead.last_inspected_image && (
                                <div className="mb-3 mt-2.5">
                                  <img
                                    src={selectedLead.last_inspected_image}
                                    alt="User Inspected Defect"
                                    className="max-h-64 w-full max-w-sm cursor-pointer rounded-control border border-rule object-cover transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                                    onClick={() => window.open(selectedLead.last_inspected_image, "_blank")}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })
                      : "Transcript unavailable."}
                  </div>
                </section>

                {selectedLead.generated_body && (
                  <section className="border-t border-rule px-6 py-5">
                    <h3 className="cd-h3 mb-3 flex items-center gap-2">
                      <Mail aria-hidden="true" className="h-4 w-4 text-ink-2" />
                      Automated Email Dispatch
                    </h3>
                    <div className="cd-well">
                      <div className="mb-3 flex flex-col gap-1 border-b border-rule pb-3">
                        <span className="cd-label text-ink-2">Subject</span>
                        <span className="font-medium text-ink">{selectedLead.generated_subject}</span>
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed text-ink-2">
                        {selectedLead.generated_body}
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
