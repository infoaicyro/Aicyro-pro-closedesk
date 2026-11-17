// src/Closedesk/Dashboard/Report.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "../../lib/firebase";
import { ref, onValue } from "firebase/database";
import { Check, Download, FileText, Mail, X } from "lucide-react";

const REPORT_TYPES = [
  { id: "weekly_lead", label: "Lead Generation", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { id: "monthly_perf", label: "Overall Performance", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
  { id: "booked_appt", label: "Booked Appointments", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { id: "missed_opp", label: "Missed Opportunities", icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { id: "after_hours", label: "After-Hours Leads", icon: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" },
  { id: "convo_insight", label: "Conversation Insights", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { id: "est_opp", label: "Estimated Opportunity", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
];

export default function Report({ onLogout }) {
  const [leads, setLeads] = useState([]);
  const [analytics, setAnalytics] = useState({ visitors: 0, opens: 0, convos: 0 });
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
    const analyticsPath = isTenant ? `tenants/${tenantId}/analytics/summary` : "analytics/summary";
    const profilePath = isTenant ? `tenants/${tenantId}/business_profile/basic_info` : "settings/business_profile/basic_info";

    const leadsRef = ref(db, leadsPath);
    const analyticsRef = ref(db, analyticsPath);
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
            lead_score: formattedScore
          };
        });

        setLeads(liveData.filter((lead) => lead.timestamp).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      } else {
        setLeads([]);
      }
      setIsLoading(false);
    });

    const unsubscribeAnalytics = onValue(analyticsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAnalytics({
          visitors: data.total_website_visitors || 0,
          opens: data.total_chatbot_opens || 0,
          convos: data.total_conversations_started || 0,
        });
      }
    });

    const unsubscribeProfile = onValue(profileRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.avgJobValue) {
        setAvgJobValue(Number(data.avgJobValue) || 1200);
      }
    });

    return () => {
      unsubscribeLeads();
      unsubscribeAnalytics();
      unsubscribeProfile();
    };
  }, []);

  const filteredLeads = useMemo(() => {
    const now = new Date();
    return leads.filter((lead) => {
      if (!lead.timestamp) return false;
      const leadDate = new Date(lead.timestamp);
      if (isNaN(leadDate.getTime())) return false;
      const diffMs = now.getTime() - leadDate.getTime();

      if (dateRange === "Last 24 Hours") return diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000;
      if (dateRange === "Last 7 Days") return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
      if (dateRange === "Last 30 Days") return diffMs >= 0 && diffMs <= 30 * 24 * 60 * 60 * 1000;
      if (dateRange === "This Quarter") {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const leadQuarter = Math.floor(leadDate.getMonth() / 3);
        return leadDate.getFullYear() === now.getFullYear() && leadQuarter === currentQuarter;
      }
      if (dateRange === "Year to Date") return leadDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [leads, dateRange]);

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

    const filterRatio = leads.length > 0 ? filteredLeads.length / leads.length : 0;
    const scaledVisitors = Math.max(Math.round(analytics.visitors * filterRatio), filteredLeads.length);
    const scaledOpens = Math.max(Math.round(analytics.opens * filterRatio), filteredLeads.length);
    const scaledConvos = Math.max(Math.round(analytics.convos * filterRatio), filteredLeads.length);

    let summary = [];
    let processedLeads = [];

    switch (activeReport.id) {
      case "weekly_lead":
        processedLeads = filteredLeads;
        mapToChart(processedLeads);
        summary = [
          { label: "Total Leads Captured", val: processedLeads.length.toLocaleString() },
          { label: "High Intent", val: processedLeads.filter((l) => l.lead_score === "High").length.toLocaleString() },
          { label: "Conversion Rate", val: scaledConvos > 0 ? `${((processedLeads.length / scaledConvos) * 100).toFixed(1)}%` : "0%" },
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

      case "missed_opp":
        processedLeads = filteredLeads.filter((l) => l.booking_status !== "Meeting Booked" && !l.booked_slot && !l.selected_date);
        mapToChart(processedLeads);
        const qualifiedMissedLeads = processedLeads.filter((l) => l.lead_score === "High" || l.lead_score === "Medium").length;
        summary = [
          { label: "Unbooked Leads", val: processedLeads.length.toLocaleString() },
          { label: "Dropped Convos", val: Math.max(scaledConvos - filteredLeads.length, 0).toLocaleString() },
          { label: "Potential Lost Value", val: `$${(qualifiedMissedLeads * avgJobValue).toLocaleString()}` },
        ];
        break;

      case "after_hours":
        processedLeads = filteredLeads.filter((l) => l.after_hours_flag === true);
        mapToChart(processedLeads);
        summary = [
          { label: "After-Hours Captured", val: processedLeads.length.toLocaleString() },
          { label: "Pct of Total Leads", val: filteredLeads.length > 0 ? `${((processedLeads.length / filteredLeads.length) * 100).toFixed(1)}%` : "0%" },
          { label: "Saved Opportunity", val: `$${(processedLeads.filter((l) => l.lead_score === "High" || l.lead_score === "Medium").length * avgJobValue).toLocaleString()}` },
        ];
        break;

      case "est_opp":
        processedLeads = filteredLeads.filter((l) => l.lead_score === "High" || l.lead_score === "Medium");
        mapToChart(processedLeads, avgJobValue);
        const totalValue = processedLeads.length * avgJobValue;
        const bookedValue = filteredLeads.filter((l) => l.booking_status === "Meeting Booked" || !!l.booked_slot || !!l.selected_date).length * avgJobValue;
        summary = [
          { label: "Total Pipeline Value", val: `$${totalValue.toLocaleString()}` },
          { label: "Avg Appointment Value", val: `$${avgJobValue.toLocaleString()}` },
          { label: "Secured Revenue", val: `$${bookedValue.toLocaleString()}`, highlight: true },
        ];
        break;

      case "convo_insight":
      case "monthly_perf":
      default:
        processedLeads = filteredLeads;
        mapToChart(processedLeads);
        summary = [
          { label: "Website Visitors", val: scaledVisitors.toLocaleString() },
          { label: "Chatbot Opens", val: scaledOpens.toLocaleString() },
          { label: "Conversations Started", val: scaledConvos.toLocaleString() },
        ];
        break;
    }

    return { summary, chartBuckets: buckets, tableData: processedLeads };
  }, [activeReport, filteredLeads, analytics, avgJobValue, dateRange, leads.length]);

  const svgWidth = 800;
  const svgHeight = 260;
  const chartPaddingLeft = 40;
  const chartPaddingRight = 20;
  const chartPaddingTop = 30;
  const chartPaddingBottom = 40;

  const graphInnerWidth = svgWidth - chartPaddingLeft - chartPaddingRight;
  const graphInnerHeight = svgHeight - chartPaddingTop - chartPaddingBottom;
  const maxChartVal = Math.max(...reportData.chartBuckets.map((d) => d.val), 1);

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

  return (
    <div className="cd-page printable-report-container">
      <div className="cd-page__head no-print">
        <div>
          <h1 className="cd-h1">Pulse Reports</h1>
          <p className="cd-sub">Generate, analyze, and export your lead and conversation data.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 min-[75rem]:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 no-print">
          <section className="cd-panel">
            <div className="cd-panel__head">
              <h2 id="report-type-title" className="cd-h2">Report Type</h2>
            </div>
            <div className="flex flex-col gap-0.5 p-2" role="group" aria-labelledby="report-type-title">
              {REPORT_TYPES.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setActiveReport(report)}
                  aria-pressed={activeReport.id === report.id}
                  className={`flex min-h-9 w-full items-center gap-3 rounded-control px-3 text-left text-[length:var(--text-sm)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${activeReport.id === report.id ? "bg-selected font-semibold text-ink" : "font-medium text-ink-2 hover:bg-hover hover:text-ink"}`}
                >
                  <svg className={`h-4 w-4 shrink-0 ${activeReport.id === report.id ? "text-signal" : "text-ink-2"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={report.icon} /></svg>
                  <span className="truncate">{report.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="cd-panel">
            <div className="cd-panel__head">
              <h2 id="report-params-title" className="cd-h2">Global Parameters</h2>
            </div>
            <div className="cd-panel__body">
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="cd-select" aria-labelledby="report-params-title">
                <option value="Last 24 Hours">Last 24 Hours</option>
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="Last 30 Days">Last 30 Days</option>
                <option value="This Quarter">This Quarter</option>
                <option value="Year to Date">Year to Date</option>
              </select>
            </div>
          </section>
        </div>

        <section className="cd-panel flex flex-col printable-area">
          <div className="cd-panel__head">
            <div>
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
                <span className="cd-stat__value cd-num">{card.val}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-b border-rule p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="cd-h3">Trend Visualization</h3>
              <span className="cd-badge no-print">Live runtime scaling</span>
            </div>

            <div className="relative h-[260px] w-full">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-full w-full overflow-visible" aria-hidden="true">
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                  const yPos = chartPaddingTop + ratio * graphInnerHeight;
                  return (
                    <g key={i}>
                      <line x1={chartPaddingLeft} y1={yPos} x2={svgWidth - chartPaddingRight} y2={yPos} stroke="var(--color-rule)" strokeWidth="1" />
                      <text x={chartPaddingLeft - 10} y={yPos + 4} textAnchor="end" fill="var(--color-ink-2)" className="cd-num text-[length:var(--text-2xs)]">
                        {activeReport.id === "est_opp" ? `$${Math.round((1 - ratio) * maxChartVal).toLocaleString()}` : Math.round((1 - ratio) * maxChartVal).toLocaleString()}
                      </text>
                    </g>
                  );
                })}
                {reportData.chartBuckets.map((data, idx) => {
                  const totalBars = reportData.chartBuckets.length;
                  const barSpacing = graphInnerWidth / totalBars;
                  const barWidth = Math.max(barSpacing * 0.65, 2);
                  const barX = chartPaddingLeft + idx * barSpacing + (barSpacing - barWidth) / 2;
                  const barHeight = (data.val / maxChartVal) * graphInnerHeight;
                  const barY = svgHeight - chartPaddingBottom - barHeight;
                  const isDense = totalBars >= 24;
                  const showLabel = !isDense || idx % Math.ceil(totalBars / 6) === 0;

                  return (
                    <g key={idx} className="cursor-crosshair" onMouseEnter={() => setHoveredBar(idx)} onMouseLeave={() => setHoveredBar(null)}>
                      <rect x={chartPaddingLeft + idx * barSpacing} y={chartPaddingTop} width={barSpacing} height={graphInnerHeight} fill={hoveredBar === idx ? "var(--color-hover)" : "transparent"} />
                      <rect x={barX} y={barY} width={barWidth} height={barHeight} rx={Math.min(barWidth / 3, 2)} fill="var(--color-accent)" />
                      {showLabel && <text x={barX + barWidth / 2} y={svgHeight - chartPaddingBottom + 18} textAnchor="middle" fill="var(--color-ink-2)" className="cd-num text-[length:var(--text-2xs)]">{data.label}</text>}
                    </g>
                  );
                })}
              </svg>

              {hoveredBar !== null && reportData.chartBuckets[hoveredBar] && (
                <div className="pointer-events-none absolute z-50 rounded-control border border-rule bg-paper-3 px-3 py-2" style={{ left: `${(hoveredBar / reportData.chartBuckets.length) * 100}%`, top: "10%", transform: "translateX(-50%)" }}>
                  <p className="m-0 text-[length:var(--text-2xs)] text-ink-2">{reportData.chartBuckets[hoveredBar].label}</p>
                  <p className="m-0 text-[length:var(--text-sm)] font-semibold text-ink cd-num">
                    {activeReport.id === "est_opp" ? `$${reportData.chartBuckets[hoveredBar].val.toLocaleString()}` : `${reportData.chartBuckets[hoveredBar].val.toLocaleString()} Units`}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="px-6 pb-2 pt-5">
              <h3 className="cd-h3">Extracted Report Records</h3>
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
                    {reportData.tableData.slice(0, 8).map((lead) => (
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
                <p className="m-0">No data matching this report criteria for the selected timeframe.</p>
              </div>
            )}
            {reportData.tableData.length > 8 && <p className="cd-meta m-0 border-t border-rule px-6 py-3 no-print">+ {reportData.tableData.length - 8} more records (Export to view all)</p>}
          </div>
        </section>
      </div>

      <div role="status" aria-live="polite" className={`cd-toast motion-safe:transition-opacity ${toast.show ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        {toast.type === "success" ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" /> : <X aria-hidden="true" className="h-4 w-4 shrink-0" />}
        <div className="min-w-0">
          <p className="m-0 text-[length:var(--text-2xs)] opacity-80">System Notification</p>
          <p className="m-0 font-semibold">{toast.message}</p>
        </div>
        <button type="button" onClick={() => setToast({ ...toast, show: false })} aria-label="Dismiss notification" tabIndex={toast.show ? 0 : -1} className="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control opacity-80 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: landscape; margin: 0; } html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; width: 100vw; height: 100vh; margin: 0; padding: 0; } body * { visibility: hidden; } .printable-report-container { padding: 0 !important; margin: 0 !important; } .printable-area, .printable-area * { visibility: visible; } .printable-area { position: absolute; left: 0; top: 0; width: 100vw; min-height: 100vh; border: none !important; box-shadow: none !important; background: var(--color-paper) !important; } .no-print { display: none !important; } }` }} />
    </div>
  );
}
