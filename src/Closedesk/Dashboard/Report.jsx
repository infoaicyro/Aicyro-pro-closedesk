// src/Closedesk/Dashboard/Report.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "../../lib/firebase";
import { ref, onValue } from "firebase/database";
import {
  CalendarCheck,
  ChartColumn,
  CircleX,
  Download,
  FileText,
  Mail,
  MessagesSquare,
  Moon,
  TrendingUp,
  X,
  Check,
} from "lucide-react";

const REPORT_TYPES = [
  { id: "weekly_lead", label: "Lead Generation", Icon: ChartColumn },
  { id: "monthly_perf", label: "Overall Performance", Icon: TrendingUp },
  { id: "booked_appt", label: "Booked Appointments", Icon: CalendarCheck },
  { id: "missed_opp", label: "Missed Opportunities", Icon: CircleX },
  { id: "after_hours", label: "After-Hours Leads", Icon: Moon },
  { id: "convo_insight", label: "Conversation Insights", Icon: MessagesSquare },
];

const DATE_RANGES = ["Last 24 Hours", "Last 7 Days", "Last 30 Days", "This Quarter", "Year to Date"];

// One definition of "inside the selected timeframe", shared by leads and tracking events
const isInRange = (date, dateRange, now = new Date()) => {
  if (!date || isNaN(date.getTime())) return false;
  const diffMs = now.getTime() - date.getTime();
  if (dateRange === "Last 24 Hours") return diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000;
  if (dateRange === "Last 7 Days") return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
  if (dateRange === "Last 30 Days") return diffMs >= 0 && diffMs <= 30 * 24 * 60 * 60 * 1000;
  if (dateRange === "This Quarter") {
    return date.getFullYear() === now.getFullYear() && Math.floor(date.getMonth() / 3) === Math.floor(now.getMonth() / 3);
  }
  if (dateRange === "Year to Date") return date.getFullYear() === now.getFullYear();
  return true;
};

const UNAVAILABLE = "Unavailable";
const LOADING = "…";
// undefined = event history still loading, null = not readable
const pending = (v) => (v === undefined ? LOADING : v === null ? UNAVAILABLE : null);

export default function Report({ onLogout }) {
  const [leads, setLeads] = useState([]);
  // Raw tracking events ({ type, time }) recorded by /api/analytics.
  // undefined = still loading, null = not readable, array = loaded
  const [analyticsEvents, setAnalyticsEvents] = useState(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [activeReport, setActiveReport] = useState(REPORT_TYPES[0]);
  const [isExporting, setIsExporting] = useState(null);
  const [dateRange, setDateRange] = useState("Last 7 Days");
  const [avgJobValue, setAvgJobValue] = useState(1200);

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [hoveredBar, setHoveredBar] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
  };

  useEffect(() => {
    const tenantId = typeof window !== "undefined" ? (localStorage.getItem("currentTenant") || "default") : "default";
    const isTenant = tenantId && tenantId !== "default";

    const leadsPath = isTenant ? `tenants/${tenantId}/leads` : "leads";
    const visitorsPath = isTenant ? `tenants/${tenantId}/analytics/visitors` : "analytics/visitors";
    const profilePath = isTenant ? `tenants/${tenantId}/business_profile/basic_info` : "settings/business_profile/basic_info";

    const leadsRef = ref(db, leadsPath);
    const profileRef = ref(db, profilePath);

    const unsubscribeLeads = onValue(leadsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const liveData = Object.keys(data).map((key) => {
          const item = data[key];

          let formattedScore = "Low";
          if (item.lead_score) {
            formattedScore = item.lead_score.charAt(0).toUpperCase() + item.lead_score.slice(1).toLowerCase();
          }

          return {
            id: key,
            ...item,
            timestamp: item.last_interaction_at || item.conversation_started_at || null,
            lead_score: formattedScore,
          };
        });

        setLeads(liveData.filter((lead) => lead.timestamp).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      } else {
        setLeads([]);
      }
      setIsLoading(false);
    });

    // Per-visitor tracking events (analytics/visitors/{anonId}/events/{eventId}: { event_type, timestamp })
    const unsubscribeVisitors = onValue(
      ref(db, visitorsPath),
      (snapshot) => {
        const visitors = snapshot.val() || {};
        const events = [];
        Object.values(visitors).forEach((visitor) => {
          Object.values((visitor && visitor.events) || {}).forEach((ev) => {
            const time = ev && ev.timestamp ? Date.parse(ev.timestamp) : NaN;
            if (ev && ev.event_type && !Number.isNaN(time)) events.push({ type: ev.event_type, time });
          });
        });
        setAnalyticsEvents(events);
      },
      (error) => {
        console.warn("Visitor event history is not readable; visitor figures are unavailable:", error);
        setAnalyticsEvents(null);
      }
    );

    const unsubscribeProfile = onValue(profileRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.avgJobValue) {
        setAvgJobValue(Number(data.avgJobValue) || 1200);
      }
    });

    return () => {
      unsubscribeLeads();
      unsubscribeVisitors();
      unsubscribeProfile();
    };
  }, []);

  const filteredLeads = useMemo(() => {
    const now = new Date();
    return leads.filter((lead) => lead.timestamp && isInRange(new Date(lead.timestamp), dateRange, now));
  }, [leads, dateRange]);

  // Real counts of tracking events inside the timeframe (null when the history is not readable)
  const eventCounts = useMemo(() => {
    if (analyticsEvents === undefined) return { visitors: undefined, opens: undefined, convos: undefined };
    if (analyticsEvents === null) return { visitors: null, opens: null, convos: null };
    const now = new Date();
    const count = (type) => analyticsEvents.filter((ev) => ev.type === type && isInRange(new Date(ev.time), dateRange, now)).length;
    return { visitors: count("page_view"), opens: count("chatbot_opened"), convos: count("conversation_started") };
  }, [analyticsEvents, dateRange]);

  const reportData = useMemo(() => {
    let buckets = [];
    let mapToChart = () => {};
    const now = new Date();

    if (dateRange === "Last 24 Hours") {
      const nowHour = new Date();
      nowHour.setMinutes(0, 0, 0);
      for (let i = 23; i >= 0; i--) {
        const d = new Date(nowHour);
        d.setHours(d.getHours() - i);
        buckets.push({ label: d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }), matchKey: `${d.getDate()}-${d.getHours()}`, val: 0 });
      }
      mapToChart = (leadsToMap, valMultiplier = 1) => {
        leadsToMap.forEach((lead) => {
          if (!lead.timestamp) return;
          const ld = new Date(lead.timestamp);
          const b = buckets.find((x) => x.matchKey === `${ld.getDate()}-${ld.getHours()}`);
          if (b) b.val += valMultiplier;
        });
      };
    } else if (dateRange === "Last 7 Days" || dateRange === "Last 30 Days") {
      const days = dateRange === "Last 7 Days" ? 7 : 30;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        buckets.push({ label: days === 7 ? d.toLocaleDateString("en-US", { weekday: "short" }) : d.getDate().toString(), matchKey: d.toDateString(), val: 0 });
      }
      mapToChart = (leadsToMap, valMultiplier = 1) => {
        leadsToMap.forEach((lead) => {
          if (!lead.timestamp) return;
          const b = buckets.find((x) => x.matchKey === new Date(lead.timestamp).toDateString());
          if (b) b.val += valMultiplier;
        });
      };
    } else {
      const startMonth = dateRange === "This Quarter" ? Math.floor(now.getMonth() / 3) * 3 : 0;
      for (let i = startMonth; i <= now.getMonth(); i++) {
        const d = new Date(now.getFullYear(), i, 1);
        buckets.push({ label: d.toLocaleDateString("en-US", { month: "short" }), matchKey: `${d.getFullYear()}-${d.getMonth()}`, val: 0 });
      }
      mapToChart = (leadsToMap, valMultiplier = 1) => {
        leadsToMap.forEach((lead) => {
          if (!lead.timestamp) return;
          const ld = new Date(lead.timestamp);
          const b = buckets.find((x) => x.matchKey === `${ld.getFullYear()}-${ld.getMonth()}`);
          if (b) b.val += valMultiplier;
        });
      };
    }

    const { visitors, opens } = eventCounts;
    // Every captured lead came through a conversation, so conversations are at least the
    // leads in range. The event history misses some conversation starts, never adds them.
    const convos = typeof eventCounts.convos === "number" ? Math.max(eventCounts.convos, filteredLeads.length) : eventCounts.convos;
    const figure = (value) => pending(value) ?? value.toLocaleString();

    let summary = [];
    let processedLeads = [];

    switch (activeReport.id) {
      case "weekly_lead":
        processedLeads = filteredLeads;
        mapToChart(processedLeads);
        summary = [
          { label: "Total Leads Captured", val: processedLeads.length.toLocaleString() },
          { label: "High Intent", val: processedLeads.filter((l) => l.lead_score === "High").length.toLocaleString() },
          { label: "Conversion Rate", val: pending(convos) ?? (convos > 0 ? `${((processedLeads.length / convos) * 100).toFixed(1)}%` : "0%") },
        ];
        break;

      case "booked_appt":
        processedLeads = filteredLeads.filter((l) => l.booking_status === "Meeting Booked" || !!l.booked_slot || !!l.selected_date);
        mapToChart(processedLeads);
        summary = [
          { label: "Total Bookings", val: processedLeads.length.toLocaleString() },
          { label: "Booking Rate", val: filteredLeads.length > 0 ? `${((processedLeads.length / filteredLeads.length) * 100).toFixed(1)}%` : "0%" },
          { label: "Sync Success", val: processedLeads.filter((l) => l.calendar_sync !== "Failed").length.toLocaleString() },
        ];
        break;

      case "missed_opp": {
        processedLeads = filteredLeads.filter((l) => l.booking_status !== "Meeting Booked" && !l.booked_slot && !l.selected_date);
        mapToChart(processedLeads);
        const qualifiedMissedLeads = processedLeads.filter((l) => l.lead_score === "High" || l.lead_score === "Medium").length;
        summary = [
          { label: "Unbooked Leads", val: processedLeads.length.toLocaleString() },
          { label: "Dropped Convos", val: pending(convos) ?? Math.max(convos - filteredLeads.length, 0).toLocaleString() },
          { label: "Potential Lost Value", val: `$${(qualifiedMissedLeads * avgJobValue).toLocaleString()}` },
        ];
        break;
      }

      case "after_hours":
        processedLeads = filteredLeads.filter((l) => l.after_hours_flag === true);
        mapToChart(processedLeads);
        summary = [
          { label: "After-Hours Captured", val: processedLeads.length.toLocaleString() },
          { label: "Pct of Total Leads", val: filteredLeads.length > 0 ? `${((processedLeads.length / filteredLeads.length) * 100).toFixed(1)}%` : "0%" },
          { label: "Saved Opportunity", val: `$${(processedLeads.filter((l) => l.lead_score === "High" || l.lead_score === "Medium").length * avgJobValue).toLocaleString()}` },
        ];
        break;

      case "convo_insight":
      case "monthly_perf":
      default:
        processedLeads = filteredLeads;
        mapToChart(processedLeads);
        summary = [
          { label: "Website Visitors", val: figure(visitors) },
          { label: "Chatbot Opens", val: figure(opens) },
          { label: "Conversations Started", val: figure(convos) },
        ];
        break;
    }

    return { summary, chartBuckets: buckets, tableData: processedLeads };
  }, [activeReport, filteredLeads, eventCounts, avgJobValue, dateRange]);

  const chartW = 800;
  const chartH = 220;
  const peakValue = Math.max(...reportData.chartBuckets.map((d) => d.val), 0);
  const maxChartVal = Math.max(peakValue, 1);
  // Gridlines on whole values: zero, a rounded middle, the peak
  const chartTicks = [...new Set([0, Math.round(maxChartVal / 2), maxChartVal])];
  const formatChartValue = (v) => v.toLocaleString();

  const executeCSVExport = () => {
    const escapeCSV = (str) => {
      if (str === null || str === undefined) return "";
      let s = String(str);
      if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
      return s.replace(/"/g, '""');
    };
    const headers = ["Lead ID,Name,Email,Phone,Business Name,Service Requested,Status,Lead Score,Date"];
    const rows = reportData.tableData.map((l) => `"${escapeCSV(l.id)}","${escapeCSV(l.name || "")}","${escapeCSV(l.email || "")}","${escapeCSV(l.phone || "")}","${escapeCSV(l.business_name || "")}","${escapeCSV(l.service_requested || "")}","${escapeCSV(l.booking_status || "")}","${escapeCSV(l.lead_score || "")}","${l.timestamp ? new Date(l.timestamp).toLocaleDateString() : "N/A"}"`);
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Aicyro_${activeReport.id}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const executeEmailExport = () => {
    const subject = encodeURIComponent(`Aicyro Pulse: ${activeReport.label} (${dateRange})`);
    const bodyText = `Report: ${activeReport.label}\nTimeframe: ${dateRange}\n\n--- SUMMARY ---\n${reportData.summary.map((s) => `${s.label}: ${s.val}`).join("\n")}\n\nTotal Records: ${reportData.tableData.length}\n\nPlease login to the Aicyro dashboard for full interactive details.`;
    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
  };

  const handleExport = (type) => {
    setIsExporting(type);
    setTimeout(() => {
      try {
        if (type === "csv") executeCSVExport();
        if (type === "pdf") window.print();
        if (type === "email") executeEmailExport();
        showToast(`${activeReport.label} successfully generated as ${type.toUpperCase()}`, "success");
      } catch (e) {
        showToast(`Failed to export ${type.toUpperCase()}`, "error");
      }
      setIsExporting(null);
    }, 800);
  };

  if (isLoading) {
    return (
      <div className="cd-page">
        <div className="cd-panel">
          <div className="cd-empty items-center py-16" role="status">
            <span className="cd-spinner keep-motion text-signal" aria-hidden="true" />
            <p className="cd-meta">Compiling Reports…</p>
          </div>
        </div>
      </div>
    );
  }

  const hovered = hoveredBar !== null ? reportData.chartBuckets[hoveredBar] : null;
  const shownRecords = reportData.tableData.slice(0, 8);

  return (
    <div className="cd-page printable-report-container">
      {/* Page head: the screen's name and the one parameter every report shares */}
      <div className="cd-page__head no-print">
        <div>
          <h1 className="cd-h1">Pulse Reports</h1>
          <p className="cd-sub">Generate, analyze, and export your lead and conversation data.</p>
        </div>
        <label className="cd-field min-w-[12rem]">
          <span className="cd-label">Timeframe</span>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="cd-select">
            {DATE_RANGES.map((range) => (
              <option key={range} value={range}>{range}</option>
            ))}
          </select>
        </label>
      </div>

      {/* The six reports as one tab strip; tabs wrap instead of scrolling sideways */}
      <div className="cd-tabs no-print flex-wrap gap-y-1 overflow-x-visible" role="tablist" aria-label="Report Type">
        {REPORT_TYPES.map((report) => {
          const selected = activeReport.id === report.id;
          const TabIcon = report.Icon;
          return (
            <button
              key={report.id}
              type="button"
              role="tab"
              id={`report-tab-${report.id}`}
              aria-selected={selected}
              aria-controls="report-sheet"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveReport(report)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const i = REPORT_TYPES.findIndex((r) => r.id === activeReport.id);
                const next = REPORT_TYPES[(i + (e.key === "ArrowRight" ? 1 : REPORT_TYPES.length - 1)) % REPORT_TYPES.length];
                setActiveReport(next);
                document.getElementById(`report-tab-${next.id}`)?.focus();
              }}
              className="inline-flex items-center gap-2"
            >
              <TabIcon aria-hidden="true" className={`h-4 w-4 shrink-0 ${selected ? "text-signal" : ""}`} />
              {report.label}
            </button>
          );
        })}
      </div>

      {/* The report sheet: the same object on screen and on paper */}
      <section id="report-sheet" role="tabpanel" aria-labelledby={`report-tab-${activeReport.id}`} className="cd-panel printable-area">
        <div className="cd-panel__head">
          <div className="min-w-0">
            <h2 className="cd-h2">{activeReport.label}</h2>
            <p className="cd-meta mt-0.5">Data preview for {dateRange}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 no-print">
            <button type="button" onClick={() => handleExport("csv")} disabled={isExporting !== null} aria-busy={isExporting === "csv"} className="cd-btn cd-btn--quiet cd-btn--sm">
              {isExporting === "csv" ? <span className="cd-spinner keep-motion" aria-hidden="true" /> : <Download aria-hidden="true" />}
              CSV
            </button>
            <button type="button" onClick={() => handleExport("pdf")} disabled={isExporting !== null} aria-busy={isExporting === "pdf"} className="cd-btn cd-btn--quiet cd-btn--sm">
              {isExporting === "pdf" ? <span className="cd-spinner keep-motion" aria-hidden="true" /> : <FileText aria-hidden="true" />}
              PDF
            </button>
            <button type="button" onClick={() => handleExport("email")} disabled={isExporting !== null} aria-busy={isExporting === "email"} className="cd-btn cd-btn--sm">
              {isExporting === "email" ? <span className="cd-spinner keep-motion" aria-hidden="true" /> : <Mail aria-hidden="true" />}
              Email
            </button>
          </div>
        </div>

        <div className="cd-stats border-b border-rule" style={{ "--cols": 3 }}>
          {reportData.summary.map((card, i) => (
            <div key={`${activeReport.id}-${i}`} className="cd-stat">
              <span className="cd-stat__label">{card.label}</span>
              <span className={`cd-stat__value cd-num ${card.val === UNAVAILABLE || card.val === LOADING ? "text-ink-2 !text-[length:var(--text-lg)]" : ""}`}>{card.val}</span>
            </div>
          ))}
        </div>

        {/* Trend: one accent series, zero baseline, hairline grid */}
        <figure className="m-0 flex flex-col gap-3 border-b border-rule px-6 py-5">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="cd-h3">Trend Visualization</span>
            <span className="cd-meta cd-num" aria-live="polite">
              {hovered ? `${hovered.label}: ${formatChartValue(hovered.val)}` : `Peak ${formatChartValue(peakValue)}`}
            </span>
          </figcaption>

          {/* Axis text is HTML so it never stretches; the SVG only draws marks */}
          <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3">
            <div className="relative h-[220px]" aria-hidden="true">
              {chartTicks.map((tick) => (
                <span
                  key={tick}
                  className="absolute right-0 -translate-y-1/2 whitespace-nowrap text-[length:var(--text-2xs)] text-ink-2 cd-num"
                  style={{ top: `${(1 - tick / maxChartVal) * 100}%` }}
                >
                  {formatChartValue(tick)}
                </span>
              ))}
            </div>

            <div className="relative h-[220px]">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                role="img"
                aria-label={`${activeReport.label}, ${dateRange}, peak ${formatChartValue(peakValue)}`}
              >
                {chartTicks.map((tick) => {
                  const y = (1 - tick / maxChartVal) * chartH;
                  return <line key={tick} x1="0" y1={y} x2={chartW} y2={y} stroke="var(--color-rule)" strokeWidth="1" vectorEffect="non-scaling-stroke" />;
                })}
                {reportData.chartBuckets.map((data, idx) => {
                  const slot = chartW / reportData.chartBuckets.length;
                  const barWidth = Math.max(slot * 0.6, 1);
                  const barHeight = (data.val / maxChartVal) * chartH;
                  const isHovered = hoveredBar === idx;
                  return (
                    <g key={idx} className="cursor-crosshair" onMouseEnter={() => setHoveredBar(idx)} onMouseLeave={() => setHoveredBar(null)}>
                      <rect x={idx * slot} y="0" width={slot} height={chartH} fill={isHovered ? "var(--color-hover)" : "transparent"} />
                      <rect x={idx * slot + (slot - barWidth) / 2} y={chartH - barHeight} width={barWidth} height={barHeight} fill="var(--color-accent)" opacity={hoveredBar === null || isHovered ? 1 : 0.55} />
                    </g>
                  );
                })}
              </svg>
            </div>

            <div aria-hidden="true" />
            <div className="flex pt-2" aria-hidden="true">
              {reportData.chartBuckets.map((data, idx) => {
                const total = reportData.chartBuckets.length;
                const showLabel = total < 24 || idx % Math.ceil(total / 6) === 0;
                return (
                  <span key={idx} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[length:var(--text-2xs)] text-ink-2 cd-num">
                    {showLabel ? data.label : ""}
                  </span>
                );
              })}
            </div>
          </div>
        </figure>

        {/* Records */}
        <div className="flex flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 pb-2 pt-5">
            <h3 className="cd-h3">Extracted Report Records</h3>
            <span className="cd-meta cd-num">{reportData.tableData.length.toLocaleString()} records</span>
          </div>
          {reportData.tableData.length > 0 ? (
            <div className="cd-table-wrap">
              <table className="cd-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Service</th>
                    <th scope="col">Date</th>
                    <th scope="col" className="is-num">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shownRecords.map((lead) => (
                    <tr key={lead.id}>
                      <td className="max-w-[16rem] truncate font-medium">{lead.name || "Unknown Visitor"}</td>
                      <td className="max-w-[16rem] truncate text-ink-2">{lead.service_requested || lead.visitor_intent || "General Inquiry"}</td>
                      <td className="whitespace-nowrap text-ink-2 cd-num">{lead.timestamp ? new Date(lead.timestamp).toLocaleDateString() : "N/A"}</td>
                      <td className="is-num">
                        <span className={`cd-badge ${lead.booking_status === "Meeting Booked" || lead.booked_slot || lead.selected_date ? "cd-badge--success" : lead.lead_score === "High" ? "cd-badge--signal" : ""}`}>
                          {lead.booking_status === "Meeting Booked" || lead.booked_slot || lead.selected_date ? "Booked" : lead.lead_score === "High" ? "High Intent" : "Captured"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="cd-empty">
              <p className="cd-empty__title">No records for this timeframe</p>
              <p className="m-0">No data matching this report criteria for the selected timeframe.</p>
            </div>
          )}
          {reportData.tableData.length > 8 && (
            <p className="cd-meta m-0 border-t border-rule px-6 py-3 no-print">
              Showing 8 of {reportData.tableData.length.toLocaleString()} records. Export CSV to view all.
            </p>
          )}
        </div>
      </section>

      <div role="status" aria-live="polite" className={`cd-toast motion-safe:transition-opacity ${toast.show ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        {toast.type === "success" ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" /> : <X aria-hidden="true" className="h-4 w-4 shrink-0" />}
        <p className="m-0 min-w-0 font-semibold">{toast.message}</p>
        <button type="button" onClick={() => setToast({ ...toast, show: false })} aria-label="Dismiss notification" tabIndex={toast.show ? 0 : -1} className="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control opacity-80 transition-opacity hover:opacity-100 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: landscape; margin: 0; } html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; width: 100vw; height: 100vh; margin: 0; padding: 0; } body * { visibility: hidden; } .printable-report-container { padding: 0 !important; margin: 0 !important; } .printable-area, .printable-area * { visibility: visible; } .printable-area { position: absolute; left: 0; top: 0; width: 100vw; min-height: 100vh; border: none !important; box-shadow: none !important; background: var(--color-paper) !important; } .no-print { display: none !important; } }` }} />
    </div>
  );
}
