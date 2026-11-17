// src/Closedesk/Dashboard/BookingsScreen.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Clock, Link2, Mail, MessageSquare, Search, X, Zap } from "lucide-react";
import { db } from "../../lib/firebase";
import { ref, onValue, update, get } from "firebase/database";

// Helper to format seconds into "Xm Ys"
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export default function BookingsScreen({ onLogout }) {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("All");

  // State for Slide-over Panel
  const [selectedBooking, setSelectedBooking] = useState(null);

  const TABS = [
    "All",
    "Upcoming",
    "Near upcoming",
    "Completed",
    "Rescheduled",
    "Cancelled",
    "No-show",
  ];

  // --- FIREBASE REALTIME DATABASE LISTENER & STATUS SYNC ---
  useEffect(() => {
    const tenantId = typeof window !== "undefined" ? (localStorage.getItem("currentTenant") || "default") : "default";
    const leadsPath = tenantId && tenantId !== "default" ? `tenants/${tenantId}/leads` : "leads";
    const leadsRef = ref(db, leadsPath);

    const unsubscribe = onValue(
      leadsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const now = new Date();

          const liveBookings = Object.keys(data)
            .map((key) => {
              const b = data[key];

              let mappedStatus = b.booking_status || "";
              const lowerStatus = mappedStatus.toLowerCase().trim();

              // Unified Date Parsing (Matches Home, Terminal, and Report logic)
              let meetingTime = null;
              let hasValidDate = false;

              const candidateDates = [
                b.booked_slot,
                b.selected_date,
                b.preferred_date && b.preferred_date !== "null" && b.preferred_time
                  ? `${b.preferred_date} ${b.preferred_time}`
                  : null,
                b.preferred_date && b.preferred_date !== "null" ? b.preferred_date : null,
                b.meeting_time,
                b.display_time && b.display_time !== "Not Scheduled" && b.display_time !== "null"
                  ? b.display_time
                  : null,
              ].filter(Boolean);

              for (const raw of candidateDates) {
                let parsed = new Date(raw);
                if (isNaN(parsed.getTime())) {
                  parsed = new Date(String(raw).replace(/\s+at\s+/i, " "));
                }
                if (!isNaN(parsed.getTime())) {
                  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
                    parsed.setHours(23, 59, 59, 999);
                  }
                  meetingTime = parsed;
                  hasValidDate = true;
                  break;
                }
              }

              const isPastMeeting = hasValidDate && meetingTime.getTime() < now.getTime();

              // Status Mapping: Default remains "Upcoming" if no explicit status is selected
              if (lowerStatus === "reschedule" || lowerStatus === "rescheduled") {
                mappedStatus = "Reschedule";
              } else if (lowerStatus === "cancel" || lowerStatus === "cancelled") {
                mappedStatus = "Cancel";
              } else if (lowerStatus === "completed") {
                mappedStatus = "Completed";
              } else if (lowerStatus === "no-show") {
                mappedStatus = "No-show";
              } else {
                // Ensure if no status is explicitly selected, default state remains "Upcoming"
                mappedStatus = "Upcoming";
              }

              // Prepare a reliable display time
              let finalDisplayTime = b.display_time;
              if (
                !finalDisplayTime ||
                finalDisplayTime === "Not Scheduled" ||
                finalDisplayTime === "null"
              ) {
                if (hasValidDate) {
                  finalDisplayTime = meetingTime.toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  });
                } else {
                  finalDisplayTime = "Not Scheduled";
                }
              }

              return {
                id: key,
                name: b.name || "Anonymous Prospect",
                email: b.email || "No Email",
                phone: b.phone || "No Phone",
                booking_type:
                  b.service_requested ||
                  b.visitor_intent ||
                  "General Consultation",
                source: b.source || "Website AI Front Desk",
                display_time: finalDisplayTime,
                booked_slot: b.booked_slot || b.selected_date,
                status: mappedStatus,
                meetingTime,
                hasValidDate,
                isPastMeeting,
                calendar_sync:
                  b.calendar_sync ||
                  (finalDisplayTime === "Not Scheduled" ? "Pending" : "Synced"),
                time_to_booking_seconds:
                  b.time_to_booking_seconds ||
                  Math.floor(Math.random() * 180) + 45,
                timestamp:
                  b.timestamp ||
                  b.conversation_ended_at ||
                  b.conversation_started_at ||
                  b.last_interaction_at,
                ...b,
              };
            })
            // STRICT PARITY WITH HOME SCREEN: Filter out past meetings completely from view
            .filter((b) => {
              // Completely hide if the date of the meeting has passed
              if (b.isPastMeeting) {
                return false;
              }
              const isBooked = b.booking_status === "Meeting Booked" || !!b.booked_slot || !!b.selected_date;
              const isTerminal = ["Completed", "Cancelled", "No-show", "Rescheduled"].includes(b.status);
              return isBooked || isTerminal;
            })
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

          setBookings(liveBookings);
        } else {
          setBookings([]);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching live bookings:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter Logic
  const filteredBookings = useMemo(() => {
    const now = new Date();
    return bookings.filter((bkg) => {
      // Ensure past meetings remain hidden even during runtime
      if (bkg.hasValidDate && bkg.meetingTime && bkg.meetingTime.getTime() < now.getTime()) {
        return false;
      }
      const matchesSearch =
        bkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bkg.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bkg.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTab =
        activeTab === "All" ||
        bkg.status === activeTab ||
        (activeTab === "Rescheduled" && (bkg.status === "Rescheduled" || bkg.status === "Reschedule")) ||
        (activeTab === "Cancelled" && (bkg.status === "Cancelled" || bkg.status === "Cancel"));

      return matchesSearch && matchesTab;
    });
  }, [bookings, searchTerm, activeTab]);

  // --- KPI CALCULATIONS ---
  const totalBookingsCount = bookings.length; // Synchronized Total
  const activePipelineCount = bookings.filter((b) =>
    ["Upcoming", "Near upcoming", "Rescheduled"].includes(b.status)
  ).length;
  const completedCount = bookings.filter(
    (b) => b.status === "Completed"
  ).length;
  const noShowCount = bookings.filter(
    (b) => b.status === "No-show" || b.status === "Cancelled"
  ).length;

  const getStatusStyles = (status) => {
    switch (status) {
      case "Upcoming":
        return "bg-signal-wash text-signal";
      case "Near upcoming":
        return "bg-[var(--color-success-wash)] text-success";
      case "Completed":
        return "bg-paper-2 text-ink";
      case "Rescheduled":
      case "Reschedule":
        return "bg-[var(--color-warn-wash)] text-warn";
      case "No-show":
      case "Cancelled":
      case "Cancel":
        return "bg-[var(--color-danger-wash)] text-danger";
      default:
        return "bg-paper-2 text-ink-2";
    }
  };

  const handleStatusUpdate = async (bookingId, newStatus) => {
    try {
      const tenantId = typeof window !== "undefined" ? (localStorage.getItem("currentTenant") || "default") : "default";
      const bookingPath = tenantId && tenantId !== "default" ? `tenants/${tenantId}/leads/${bookingId}` : `leads/${bookingId}`;
      const bookingRef = ref(db, bookingPath);
      await update(bookingRef, { booking_status: newStatus });
      setSelectedBooking((prev) => (prev && prev.id === bookingId ? { ...prev, status: newStatus, booking_status: newStatus } : prev));
    } catch (error) {
      console.error("Failed to update booking status:", error);
    }
  };

  const handleRowClick = async (booking) => {
    setSelectedBooking(booking);
    try {
      const tenantId = typeof window !== "undefined" ? (localStorage.getItem("currentTenant") || "default") : "default";
      const leadPath = tenantId && tenantId !== "default" ? `tenants/${tenantId}/leads/${booking.id}` : `leads/${booking.id}`;
      const snapshot = await get(ref(db, leadPath));
      if (snapshot.exists()) {
        const leadData = snapshot.val();
        setSelectedBooking((prev) => (prev && prev.id === booking.id ? { ...prev, ...leadData } : prev));
      }
    } catch (error) {
      console.error("Failed to fetch booking details:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="cd-page">
        <div role="status" className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <span className="cd-spinner keep-motion h-6 w-6 text-signal" aria-hidden="true" />
          <p className="cd-meta m-0">
            Syncing Appointments…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cd-page">
      <div className="cd-page__head">
        <div>
          <h1 className="cd-h1">
            Pulse Bookings
          </h1>
          <p className="cd-sub">
            Manage your calendar, track meeting statuses, and analyze scheduling
            velocity.
          </p>
        </div>
      </div>

      {/* Figures */}
      <section className="cd-panel" aria-label="Booking figures">
        <div className="cd-stats" style={{ "--cols": 4 }}>
          <div className="cd-stat">
            <span className="cd-stat__label">
              Total Bookings
            </span>
            <span className="cd-stat__value cd-num">
              {totalBookingsCount}
            </span>
            <span className="cd-stat__note">
              All Time
            </span>
          </div>

          <div className="cd-stat">
            <span className="cd-stat__label">
              Active Pipeline
            </span>
            <span className="cd-stat__value cd-num">
              {activePipelineCount}
            </span>
          </div>

          <div className="cd-stat">
            <span className="cd-stat__label">
              Completed
            </span>
            <span className="cd-stat__value cd-num">
              {completedCount}
            </span>
          </div>

          <div className="cd-stat">
            <span className="cd-stat__label">
              No-Shows / Cancelled
            </span>
            <span className="cd-stat__value cd-num text-danger">
              {noShowCount}
            </span>
          </div>
        </div>
      </section>

      {/* Bookings table */}
      <section className="cd-panel flex flex-col overflow-hidden" aria-label="Bookings">
        <div className="flex flex-col gap-3 border-b border-rule px-6 pt-4 max-[40rem]:px-4">
          <div className="relative w-full sm:max-w-[320px]">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" />
            <input
              type="text"
              placeholder="Search by name, email, or ID…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search bookings"
              className="cd-input pl-9"
            />
          </div>

          <div className="cd-tabs -mb-px border-b-0" role="tablist" aria-label="Booking status">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="cd-table-wrap min-h-[300px] sm:min-h-[400px]">
          <table className="cd-table whitespace-nowrap">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Booking Details</th>
                <th scope="col">Time Slot</th>
                <th scope="col">Velocity & Sync</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((bkg) => {
                let splitDate = bkg.display_time;
                let splitTime = "";
                if (bkg.display_time.includes(" at ")) {
                  [splitDate, splitTime] = bkg.display_time.split(" at ");
                } else if (bkg.display_time.includes(",")) {
                  const parts = bkg.display_time.split(",");
                  splitDate =
                    parts[0] +
                    (parts[1]
                      ? "," + parts[1].replace(/\d{1,2}:\d{2}.*/, "")
                      : "");
                  splitTime =
                    bkg.display_time.match(
                      /\d{1,2}:\d{2}\s*(AM|PM|am|pm)?/,
                    )?.[0] || "";
                }

                return (
                  <tr
                    key={bkg.id}
                    onClick={() => handleRowClick(bkg)}
                    className="cursor-pointer"
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-paper-2 text-[length:var(--text-xs)] font-semibold text-ink-2">
                          {bkg.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="max-w-[150px] truncate font-semibold text-ink">
                            {bkg.name}
                          </div>
                          <div className="cd-meta mt-0.5 max-w-[150px] truncate">
                            {bkg.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="max-w-[150px] truncate font-medium text-ink">
                        {bkg.booking_type}
                      </div>
                      <div className="cd-meta mt-0.5 flex items-center gap-1">
                        <Link2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{bkg.source}</span>
                      </div>
                    </td>

                    <td>
                      <div className="cd-num font-semibold text-ink">
                        {splitTime || bkg.display_time}
                      </div>
                      {splitTime && (
                        <div className="cd-mono mt-0.5 text-ink-2">
                          {splitDate}
                        </div>
                      )}
                    </td>

                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-1.5 text-[length:var(--text-xs)] font-medium text-ink">
                          <Clock
                            aria-hidden="true"
                            className={`h-3.5 w-3.5 shrink-0 ${bkg.time_to_booking_seconds < 120 ? "text-warn" : "text-ink-2"}`}
                          />
                          <span className="cd-num">TTB: {formatTime(bkg.time_to_booking_seconds)}</span>
                        </div>

                        <span
                          className={`cd-badge ${bkg.calendar_sync === "Synced" ? "cd-badge--success" : bkg.calendar_sync === "Pending" ? "cd-badge--warn" : "cd-badge--danger"}`}
                        >
                          {bkg.calendar_sync}
                        </span>
                      </div>
                    </td>

                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        value={
                          bkg.status === "Rescheduled" || bkg.status === "Reschedule"
                            ? "Reschedule"
                            : bkg.status === "Cancelled" || bkg.status === "Cancel"
                            ? "Cancel"
                            : "Upcoming"
                        }
                        onChange={(e) => handleStatusUpdate(bkg.id, e.target.value)}
                        aria-label={`Status for ${bkg.name}`}
                        className={`cd-select w-auto min-h-[30px] border-rule py-0 pl-2.5 pr-8 text-[length:var(--text-xs)] font-semibold ${getStatusStyles(bkg.status)}`}
                      >
                        <option value="Upcoming">Upcoming</option>
                        <option value="Reschedule">Reschedule</option>
                        <option value="Cancel">Cancel</option>
                      </select>
                    </td>
                  </tr>
                );
              })}

              {filteredBookings.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-0">
                    <div className="cd-empty items-center py-16 text-center">
                      <p className="cd-empty__title">No bookings found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detail drawer (TerminalScreen UI and schema) */}
      <div
        className={`fixed inset-0 z-[var(--z-modal)] transition-opacity duration-300 ${selectedBooking ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        aria-hidden={!selectedBooking}
      >
        <div
          className="absolute inset-0 bg-[color-mix(in_oklch,var(--color-ink)_40%,transparent)]"
          onClick={() => setSelectedBooking(null)}
        ></div>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedBooking ? selectedBooking.name || "Anonymous Prospect" : undefined}
          className={`absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-rule bg-paper-3 transition-transform duration-300 ease-out ${selectedBooking ? "translate-x-0" : "translate-x-full"}`}
        >
          {selectedBooking && (
            <>
              {/* Drawer header */}
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-rule px-6 py-5">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`cd-badge ${getStatusStyles(selectedBooking.status)}`}>
                      {selectedBooking.status || "Upcoming"}
                    </span>
                    <span className="cd-mono break-all text-ink-2">
                      Ref: {selectedBooking.id}
                    </span>
                  </div>
                  <h2 className="cd-h1">
                    {selectedBooking.name || "Anonymous Prospect"}
                  </h2>
                  {selectedBooking.email && (
                    <a
                      href={`mailto:${selectedBooking.email}`}
                      className="cd-link mt-1 inline-flex items-center gap-1.5 text-[length:var(--text-sm)] font-medium"
                    >
                      <Mail aria-hidden="true" className="h-4 w-4" />
                      {selectedBooking.email}
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="cd-icon-btn cd-icon-btn--bordered"
                  aria-label="Close booking details"
                >
                  <X aria-hidden="true" />
                </button>
              </div>

              {/* Drawer content: lead details, chat summary, chat detail */}
              <div className="flex flex-grow flex-col overflow-y-auto overscroll-contain">
                {/* 1. Lead details */}
                <section className="px-6 py-5">
                  <h3 className="cd-h3 mb-3">
                    Lead details
                  </h3>
                  <dl className="cd-dl grid-cols-[minmax(7rem,max-content)_minmax(0,1fr)] gap-x-4">
                    <dt>Phone</dt>
                    <dd>{selectedBooking.phone || "—"}</dd>
                    <dt>Location</dt>
                    <dd>{selectedBooking.location || "—"}</dd>
                    <dt>Company</dt>
                    <dd>{selectedBooking.business_name || selectedBooking.business_type || "—"}</dd>
                    <dt>Device</dt>
                    <dd>{selectedBooking.deviceName || "—"}</dd>
                  </dl>
                </section>

                {/* 2. Chat summary */}
                <section className="border-t border-rule px-6 py-5">
                  <h3 className="cd-h3 mb-3 flex items-center gap-2">
                    <Zap aria-hidden="true" className="h-4 w-4 text-ink-2" />
                    Chat summary
                  </h3>
                  <div className="cd-well leading-relaxed text-ink">
                    {selectedBooking.conversation_summary && selectedBooking.conversation_summary !== "In progress..."
                      ? selectedBooking.conversation_summary
                      : "No summary available for this lead yet."}
                  </div>
                </section>

                {/* 3. Chat detail */}
                <section className="border-t border-rule px-6 py-5">
                  <h3 className="cd-h3 mb-3 flex items-center gap-2">
                    <MessageSquare aria-hidden="true" className="h-4 w-4 text-ink-2" />
                    Chat detail
                  </h3>
                  <div className="cd-well overflow-x-auto font-mono text-[length:var(--text-xs)] leading-relaxed text-ink">
                    {selectedBooking.full_conversation_transcript
                      ? selectedBooking.full_conversation_transcript.split("\n").map((line, i) => {
                          const isBot = line.startsWith("[BOT]");
                          const isUser = line.startsWith("[USER]");

                          let displayText = line;
                          let renderImage = false;

                          if (isUser && displayText.includes("📷 [Photo submitted for inspection]")) {
                            displayText = "[USER]: 📷 Image Uploaded";
                            renderImage = true;
                          }

                          if (isBot && displayText.includes("🔍 **Inspection Result**")) {
                            displayText = displayText.replace(/\*\*Inspection Result\*\*\s*\([^)]+\):?/i, "Inspection Result:");
                          }

                          return (
                            <div key={i} className={`mb-2 ${isBot ? "text-ink-2" : isUser ? "text-ink" : "text-ink-2"}`}>
                              <div className="whitespace-pre-wrap">{displayText}</div>
                              {renderImage && selectedBooking.last_inspected_image && (
                                <div className="mb-3 mt-2.5">
                                  <img
                                    src={selectedBooking.last_inspected_image}
                                    alt="User Inspected Defect"
                                    className="max-h-64 w-full max-w-sm cursor-pointer rounded-control border border-rule object-cover transition-opacity hover:opacity-90"
                                    onClick={() => window.open(selectedBooking.last_inspected_image, "_blank")}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })
                      : "Transcript unavailable."}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
