// src/Closedesk/Dashboard/HomeScreen.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "../../lib/firebase";
import { ref, onValue } from "firebase/database";

// Chart tones: one accent series, a lighter step of it, then neutrals
const TONE = {
  accent: "var(--color-accent)",
  accentStep: "color-mix(in oklch, var(--color-accent) 45%, var(--color-paper-3))",
  neutral: "color-mix(in oklch, var(--color-muted) 70%, var(--color-paper-3))",
  faint: "var(--color-rule)",
};

export default function HomeScreen({ onLogout }) {
  const [leads, setLeads] = useState([]);

  // Real-time Analytics States (Top of Funnel)
  const [totalWebsiteVisitors, setTotalWebsiteVisitors] = useState(0);
  const [totalChatbotOpens, setTotalChatbotOpens] = useState(0);
  const [totalConversationsStarted, setTotalConversationsStarted] = useState(0);

  // Bot Config State
  const [botConfig, setBotConfig] = useState({
    botName: "Loading...",
    botIdentity: "Loading...",
    escalationRule: "Loading...",
    bookingRule: "Loading...",
  });

  // Raw tracking events ({ type, time }) recorded by /api/analytics.
  // null = not loaded or not readable; the chart and windowed figures then fall back honestly.
  const [analyticsEvents, setAnalyticsEvents] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [animateCharts, setAnimateCharts] = useState(false);
  const [timeFrame, setTimeFrame] = useState("All");
  const [avgJobValue, setAvgJobValue] = useState(1200);

  // --- FIREBASE REALTIME DATABASE LISTENERS ---
  useEffect(() => {
    // 1. Listen for Actual Leads (Single Source of Truth across all pages)
    const activeTenant = typeof window !== "undefined" ? localStorage.getItem("currentTenant") : null;
    const leadsPath = activeTenant && activeTenant !== "default" ? `tenants/${activeTenant}/leads` : "leads";
    const leadsRef = ref(db, leadsPath);
    const unsubscribeLeads = onValue(
      leadsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const leadsArray = Object.keys(data)
            .map((key) => {
              const l = data[key];
              // Standardize formatting to match the Terminal
              let formattedScore = "Low";
              if (l.lead_score) {
                formattedScore = l.lead_score.charAt(0).toUpperCase() + l.lead_score.slice(1).toLowerCase();
              }
              return {
                ...l,
                id: l.firebaseId || key,
                name: l.name || "Anonymous",
                timestamp: l.last_interaction_at || l.conversation_started_at || null,
                lead_score: formattedScore,
                booking_status: l.booking_status || "Captured",
                email: l.email || "",
                phone: l.phone || "",
              };
            })
            .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

          setLeads(leadsArray);
        } else {
          setLeads([]);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching leads:", error);
        setIsLoading(false);
      }
    );

    // 2. Listen for Analytics Summary (Visitors & Opens)
    const analyticsPath = activeTenant && activeTenant !== "default" ? `tenants/${activeTenant}/analytics/summary` : "analytics/summary";
    const analyticsRef = ref(db, analyticsPath);
    const unsubscribeAnalytics = onValue(analyticsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTotalWebsiteVisitors(data.total_website_visitors || 0);
        setTotalChatbotOpens(data.total_chatbot_opens || 0);
        setTotalConversationsStarted(data.total_conversations_started || 0);
      }
    });

    // 2b. Listen for the per-visitor tracking events behind those totals
    //     (analytics/visitors/{anonId}/events/{eventId}: { event_type, timestamp })
    const visitorsPath = activeTenant && activeTenant !== "default" ? `tenants/${activeTenant}/analytics/visitors` : "analytics/visitors";
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
        console.warn("Visitor event history is not readable; daily visitor figures are unavailable:", error);
        setAnalyticsEvents(null);
      }
    );

    // 3. Listen for Chatbot Config Data
    const configRef = ref(db, "settings/chatbot_config");
    const unsubscribeConfig = onValue(configRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBotConfig({
          botName: data.botName || "Raja G.",
          botIdentity: data.botIdentity || "The Booker for Aicyro",
          escalationRule: data.escalationRule || "email_admin",
          bookingRule: data.bookingRule || "Strict Funnel",
        });
      }
    });

    // 4. Listen for Business Profile Data
    const profileRef = ref(db, "settings/business_profile/basic_info");
    const unsubscribeProfile = onValue(profileRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.avgJobValue) {
        setAvgJobValue(Number(data.avgJobValue) || 1200);
      }
    });

    return () => {
      unsubscribeLeads();
      unsubscribeAnalytics();
      unsubscribeVisitors();
      unsubscribeConfig();
      unsubscribeProfile();
    };
  }, []);

  // Trigger animations after loading
  useEffect(() => {
    if (!isLoading) {
      setAnimateCharts(false);
      const timer = setTimeout(() => setAnimateCharts(true), 150);
      return () => clearTimeout(timer);
    }
  }, [isLoading, timeFrame]);

  // --- DATA FILTERING & EXACT CALCULATIONS ---
  const filteredLeads = useMemo(() => {
    if (timeFrame === "All") return leads;
    const todayTime = new Date().setHours(0, 0, 0, 0);
    const ONE_DAY = 24 * 60 * 60 * 1000;
    return leads.filter((lead) => {
      if (!lead.timestamp) return false;
      return new Date(lead.timestamp).getTime() >= todayTime - timeFrame * ONE_DAY;
    });
  }, [leads, timeFrame]);

  // Unified Metric Definitions
  const leadsCaptured = filteredLeads.length;

  const bookedAppointments = filteredLeads.filter((l) => 
    l.booking_status === "Meeting Booked" || !!l.booked_slot || !!l.selected_date
  ).length;

  const qualifiedLeads = filteredLeads.filter((l) => 
    l.lead_score === "High" || l.lead_score === "Medium"
  ).length;

  const highLeads = filteredLeads.filter((l) => l.lead_score === "High").length;
  const mediumLeads = filteredLeads.filter((l) => l.lead_score === "Medium").length;
  const lowLeads = Math.max(leadsCaptured - highLeads - mediumLeads, 0);
  const maxScoreCount = Math.max(highLeads, mediumLeads, lowLeads, 1);

  const afterHoursLeads = filteredLeads.filter((l) => l.after_hours_flag === true).length;
  const businessHoursLeads = Math.max(leadsCaptured - afterHoursLeads, 0);
  const maxTimingCount = Math.max(afterHoursLeads, businessHoursLeads, 1);

  // Top-of-funnel figures. "All" uses the stored totals; a 7 or 30 day window counts the
  // real tracking events inside it (the same window the leads filter uses).
  const countEventsInWindow = (type) => {
    if (!analyticsEvents) return null;
    const windowStart = new Date().setHours(0, 0, 0, 0) - timeFrame * 24 * 60 * 60 * 1000;
    return analyticsEvents.filter((ev) => ev.type === type && ev.time >= windowStart).length;
  };
  const scaledVisitors = timeFrame === "All" ? totalWebsiteVisitors : countEventsInWindow("page_view");
  const scaledOpens = timeFrame === "All" ? totalChatbotOpens : countEventsInWindow("chatbot_opened");
  const scaledConvos = timeFrame === "All" ? totalConversationsStarted : countEventsInWindow("conversation_started");
  const formatFigure = (value) => (value === null ? "Unavailable" : value.toLocaleString());

const conversionRate = qualifiedLeads > 0 ? ((qualifiedLeads/ leadsCaptured ) * 100).toFixed(1) : 0;
const bookingRate = leadsCaptured > 0 ? ((bookedAppointments / leadsCaptured) * 100).toFixed(1) : 0;
const estimatedValue = qualifiedLeads * avgJobValue;

  // Funnel logic
  const safeConvos = Math.max(scaledConvos ?? 0, leadsCaptured);
  const droppedConvos = Math.max(safeConvos - leadsCaptured, 0);
  const unqualifiedLeads = Math.max(leadsCaptured - qualifiedLeads, 0);
  const qualifiedUnbooked = Math.max(qualifiedLeads - bookedAppointments, 0);
  const funnelSum = droppedConvos + unqualifiedLeads + qualifiedUnbooked + bookedAppointments || 1;

  const pctBooked = (bookedAppointments / funnelSum) * 100;
  const pctQual = (qualifiedUnbooked / funnelSum) * 100;
  const pctUnqual = (unqualifiedLeads / funnelSum) * 100;
  const pctDropped = (droppedConvos / funnelSum) * 100;

  // Heatmap Logic
  const { dayCounts, maxDayCount } = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    filteredLeads.forEach((l) => {
      if (l.timestamp) counts[new Date(l.timestamp).getDay()]++;
    });
    return { dayCounts: counts, maxDayCount: Math.max(...counts, 1) };
  }, [filteredLeads]);
  const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

  // --- ACQUISITION VELOCITY CHART CALCULATIONS ---
  const effectiveTimeFrame = useMemo(() => {
    if (timeFrame !== "All") return timeFrame;
    if (!leads || leads.length === 0) return 30;
    const oldestLead = leads[leads.length - 1];
    if (!oldestLead || !oldestLead.timestamp) return 30;
    const diffTime = Math.abs(new Date() - new Date(oldestLead.timestamp));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(diffDays, 7); 
  }, [timeFrame, leads]);

  const chartData = useMemo(() => {
    let structure = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    for (let i = effectiveTimeFrame - 1; i >= 0; i--) {
      const d = new Date(todayTime - i * 86400000);
      structure.push({
        label: effectiveTimeFrame <= 7 ? d.toLocaleDateString("en-US", { weekday: "short" }) : d.getDate(),
        dateValue: d.getTime(),
        leads: 0,
        convos: 0,
        visitors: 0,
      });
    }

    filteredLeads.forEach((lead) => {
      if (!lead.timestamp) return;
      let vDate = new Date(lead.timestamp);
      vDate.setHours(0, 0, 0, 0);
      const vTime = vDate.getTime();

      const targetDay = structure.find((d) => d.dateValue === vTime);
      if (targetDay) targetDay.leads += 1;
    });

    // Real daily counts from the tracking events (page views and conversation starts)
    (analyticsEvents || []).forEach((ev) => {
      if (ev.type !== "page_view" && ev.type !== "conversation_started") return;
      const eDate = new Date(ev.time);
      eDate.setHours(0, 0, 0, 0);
      const targetDay = structure.find((d) => d.dateValue === eDate.getTime());
      if (!targetDay) return;
      if (ev.type === "page_view") targetDay.visitors += 1;
      else targetDay.convos += 1;
    });

    return structure;
  }, [filteredLeads, effectiveTimeFrame, analyticsEvents]);

  // Without readable event history only the leads line is real, so the other two are not drawn
  const hasDailyEvents = analyticsEvents !== null;

  const svgWidth = 800;
  const svgHeight = 240;
  const maxDataValue = Math.max(...chartData.map((d) => Math.max(d.visitors, d.convos, d.leads)), 10);
  const usableHeight = svgHeight - 30;

  const generateSmoothPath = (dataKey) => {
    if (chartData.length === 0) return "";
    const pointX = (index) => (index / (chartData.length - 1)) * svgWidth;
    const pointY = (index) => svgHeight - 10 - (chartData[index][dataKey] / maxDataValue) * usableHeight;

    let path = `M ${pointX(0)} ${pointY(0)}`;
    for (let i = 1; i < chartData.length; i++) {
      const p0x = pointX(i - 1);
      const p0y = pointY(i - 1);
      const p1x = pointX(i);
      const p1y = pointY(i);
      const cx1 = p0x + (p1x - p0x) / 2;
      const cx2 = p0x + (p1x - p0x) / 2;
      path += ` C ${cx1} ${p0y}, ${cx2} ${p1y}, ${p1x} ${p1y}`;
    }
    return path;
  };

  const pathVisitors = generateSmoothPath("visitors");
  const pathConvos = generateSmoothPath("convos");
  const pathLeads = generateSmoothPath("leads");


  if (isLoading) {
    return (
      <div className="cd-page">
        <div className="cd-panel">
          <div className="cd-empty items-center py-16" role="status">
            <span className="cd-spinner keep-motion text-signal" aria-hidden="true" />
            <p className="cd-meta">Syncing Telemetry…</p>
          </div>
        </div>
      </div>
    );
  }

  const topKpis = [
    { label: "Website Visitors", value: formatFigure(scaledVisitors) },
    { label: "Chatbot Opens", value: formatFigure(scaledOpens) },
    { label: "Conversations", value: formatFigure(scaledConvos) },
  ];

  const secondaryKpis = [
    { label: "Leads Captured", value: leadsCaptured.toLocaleString(), glow: true },
    { label: "Qualified Leads", value: qualifiedLeads.toLocaleString() },
    { label: "Booked Appts", value: bookedAppointments.toLocaleString(), highlight: true },
    { label: "After-Hours Leads", value: afterHoursLeads.toLocaleString() },
    { label: "Conversion Rate", value: `${conversionRate}%` },
    { label: "Booking Rate", value: `${bookingRate}%` },
  ];

  return (
    <div className="cd-page">
      <div className="cd-page__head">
        <div>
          <h1 className="cd-h1">Pulse Overview</h1>
          <p className="cd-sub">Real-time Funnel Analytics</p>
        </div>
        <div className="cd-seg" role="group" aria-label="Time frame">
          <button type="button" onClick={() => setTimeFrame("All")} aria-pressed={timeFrame === "All"}>All Data</button>
          <button type="button" onClick={() => setTimeFrame(7)} aria-pressed={timeFrame === 7}>7 Days</button>
          <button type="button" onClick={() => setTimeFrame(30)} aria-pressed={timeFrame === 30}>30 Days</button>
        </div>
      </div>

      <section className="cd-panel" aria-labelledby="pulse-metrics-title">
        <div className="cd-panel__head">
          <h2 id="pulse-metrics-title" className="cd-h2">Performance Metrics</h2>
        </div>
        <div className="cd-stats" style={{ "--cols": 5 }}>
          {topKpis.map((kpi, i) => (
            <div key={i} className="cd-stat">
              <span className="cd-stat__label">{kpi.label}</span>
              <span className="cd-stat__value cd-num">{kpi.value}</span>
            </div>
          ))}
          {secondaryKpis.slice(0, 2).map((kpi, i) => (
            <div key={i} className="cd-stat">
              <span className="cd-stat__label">{kpi.label}</span>
              <span className="cd-stat__value cd-num">{kpi.value}</span>
            </div>
          ))}
        </div>
        <div className="cd-stats border-t border-rule" style={{ "--cols": 5 }}>
          {secondaryKpis.slice(2).map((kpi, i) => (
            <div key={i} className="cd-stat">
              <span className="cd-stat__label">{kpi.label}</span>
              <span className="cd-stat__value cd-num">{kpi.value}</span>
            </div>
          ))}
          <div className="cd-stat">
            <span className="cd-stat__label flex flex-wrap items-center gap-2">
              Estimated Opportunity Value
              <span className="cd-badge">Estimate</span>
            </span>
            <span className="cd-stat__value cd-num">${estimatedValue.toLocaleString()}</span>
          </div>
        </div>
      </section>

      <div className="cd-grid">
        {/* Acquisition velocity: the primary chart */}
        <section className="cd-panel cd-span-8 flex flex-col">
          <div className="cd-panel__head">
            <div>
              <h2 className="cd-h2">Acquisition Velocity</h2>
              <p className="cd-meta mt-0.5">Visitors vs Conversations vs Leads</p>
            </div>
            <ul className="flex flex-wrap items-center gap-4 text-[length:var(--text-xs)] text-ink-2">
              {hasDailyEvents && (
                <>
                  <li className="flex items-center gap-1.5">
                    <span className="cd-chart-swatch" style={{ color: TONE.neutral }} aria-hidden="true" />
                    Visitors
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="cd-chart-swatch text-ink-2" aria-hidden="true" />
                    Convos
                  </li>
                </>
              )}
              <li className="flex items-center gap-1.5">
                <span className="cd-chart-swatch text-signal" aria-hidden="true" />
                Leads
              </li>
            </ul>
          </div>

          <div className="cd-panel__body flex-grow">
            <div className="relative h-[220px] sm:h-[280px] w-full">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-hidden pb-6 pointer-events-none" aria-hidden="true">
                {[0, 0.5, 1].map((ratio) => (
                  <line key={ratio} x1="0" x2={svgWidth} y1={svgHeight - 10 - ratio * usableHeight} y2={svgHeight - 10 - ratio * usableHeight} stroke="var(--color-rule)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                ))}
                {animateCharts && (
                  <>
                    {hasDailyEvents && (
                      <>
                        <path d={pathVisitors} stroke={TONE.neutral} strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
                        <path d={pathConvos} stroke="var(--color-ink-2)" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
                      </>
                    )}
                    <path d={`${pathLeads} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`} fill="var(--color-accent)" fillOpacity="0.08" />
                    <path d={pathLeads} stroke="var(--color-accent)" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
                  </>
                )}
              </svg>
              <div className="absolute inset-0 flex pb-6">
                {chartData.map((data, idx) => (
                  <div key={idx} className="flex-1 h-full flex flex-col justify-end relative group">
                    <div className="absolute inset-0 z-20 cursor-crosshair transition-colors group-hover:bg-hover">
                      <div className={`absolute top-0 z-30 min-w-[8rem] rounded-control border border-rule bg-paper-3 px-3 py-2 pointer-events-none opacity-0 transition-opacity group-hover:opacity-100 ${idx < 3 ? "left-0" : idx > chartData.length - 4 ? "right-0" : "left-1/2 -translate-x-1/2"}`}>
                        <span className="mb-1 block border-b border-rule pb-1 text-[length:var(--text-2xs)] font-semibold text-ink cd-num">{new Date(data.dateValue).toLocaleDateString()}</span>
                        {hasDailyEvents && (
                          <>
                            <div className="mt-1 flex justify-between gap-3 text-[length:var(--text-2xs)]">
                              <span className="flex items-center gap-1.5 text-ink-2"><span className="cd-chart-swatch" style={{ color: TONE.neutral }} aria-hidden="true" />Visitors:</span>
                              <span className="font-medium text-ink cd-num">{data.visitors}</span>
                            </div>
                            <div className="flex justify-between gap-3 text-[length:var(--text-2xs)]">
                              <span className="flex items-center gap-1.5 text-ink-2"><span className="cd-chart-swatch text-ink-2" aria-hidden="true" />Convos:</span>
                              <span className="font-medium text-ink cd-num">{data.convos}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between gap-3 text-[length:var(--text-2xs)]">
                          <span className="flex items-center gap-1.5 text-ink-2"><span className="cd-chart-swatch text-signal" aria-hidden="true" />Leads:</span>
                          <span className="font-semibold text-ink cd-num">{data.leads}</span>
                        </div>
                      </div>
                    </div>
                    {(effectiveTimeFrame <= 7 || idx % Math.ceil(effectiveTimeFrame / 7) === 0) && (
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[length:var(--text-2xs)] text-ink-2 cd-num">{data.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Funnel breakdown: one stacked bar of the four outcomes */}
        <section className="cd-panel cd-span-4 flex flex-col">
          <div className="cd-panel__head">
            <div>
              <h2 className="cd-h2">Funnel Breakdown</h2>
              <p className="cd-meta mt-0.5">Conversation progression & fallout</p>
            </div>
          </div>
          <div className="cd-panel__body flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <span className="cd-stat__label">Booked</span>
              <span className="cd-stat__value cd-num">{animateCharts ? pctBooked.toFixed(0) : 0}%</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-[2px] bg-paper-2" aria-hidden="true">
              <span className="h-full" style={{ width: `${animateCharts ? pctBooked : 0}%`, background: TONE.accent }} />
              <span className="h-full" style={{ width: `${animateCharts ? pctQual : 0}%`, background: TONE.accentStep }} />
              <span className="h-full" style={{ width: `${animateCharts ? pctUnqual : 0}%`, background: TONE.neutral }} />
              <span className="h-full" style={{ width: `${animateCharts ? pctDropped : 0}%`, background: TONE.faint }} />
            </div>
            <ul className="divide-y divide-rule">
              <li className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2 font-medium text-ink"><span className="cd-chart-swatch" style={{ color: TONE.accent }} aria-hidden="true" />Booked Appointments</span>
                <span className="font-semibold text-ink cd-num">{bookedAppointments}</span>
              </li>
              <li className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2 font-medium text-ink"><span className="cd-chart-swatch" style={{ color: TONE.accentStep }} aria-hidden="true" />Qualified (Unbooked)</span>
                <span className="font-semibold text-ink cd-num">{qualifiedUnbooked}</span>
              </li>
              <li className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2 text-ink-2"><span className="cd-chart-swatch" style={{ color: TONE.neutral }} aria-hidden="true" />Unqualified Leads</span>
                <span className="font-medium text-ink-2 cd-num">{unqualifiedLeads}</span>
              </li>
              <li className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2 text-ink-2"><span className="cd-chart-swatch" style={{ color: TONE.faint }} aria-hidden="true" />Dropped Convos</span>
                <span className="font-medium text-ink-2 cd-num">{droppedConvos}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Lead quality: labelled bar list */}
        <section className="cd-panel cd-span-4">
          <div className="cd-panel__head">
            <h2 className="cd-h2">Lead Quality Distribution</h2>
          </div>
          <div className="cd-panel__body flex flex-col gap-4">
            <div>
              <div className="mb-1.5 flex justify-between text-[length:var(--text-xs)]"><span className="font-medium text-ink">High Intent</span><span className="font-semibold text-ink cd-num">{highLeads}</span></div>
              <div className="cd-bar"><span className="motion-safe:transition-transform motion-safe:duration-700" style={{ transform: `scaleX(${animateCharts ? highLeads / maxScoreCount : 0})` }} /></div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-[length:var(--text-xs)]"><span className="font-medium text-ink">Medium Intent</span><span className="font-semibold text-ink cd-num">{mediumLeads}</span></div>
              <div className="cd-bar"><span className="motion-safe:transition-transform motion-safe:duration-700" style={{ transform: `scaleX(${animateCharts ? mediumLeads / maxScoreCount : 0})`, background: TONE.accentStep }} /></div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-[length:var(--text-xs)]"><span className="font-medium text-ink">Unqualified / Low</span><span className="font-semibold text-ink cd-num">{lowLeads}</span></div>
              <div className="cd-bar"><span className="motion-safe:transition-transform motion-safe:duration-700" style={{ transform: `scaleX(${animateCharts ? lowLeads / maxScoreCount : 0})`, background: TONE.neutral }} /></div>
            </div>
          </div>
        </section>

        {/* Automation ROI: two values compared */}
        <section className="cd-panel cd-span-4">
          <div className="cd-panel__head">
            <div>
              <h2 className="cd-h2">Automation ROI</h2>
              <p className="cd-meta mt-0.5">Capture timing vs Business Hours</p>
            </div>
          </div>
          <div className="cd-panel__body flex flex-col gap-4">
            <div>
              <div className="mb-1.5 flex justify-between text-[length:var(--text-xs)]"><span className="font-medium text-ink">Standard Hours</span><span className="font-semibold text-ink cd-num">{businessHoursLeads}</span></div>
              <div className="cd-bar"><span className="motion-safe:transition-transform motion-safe:duration-700" style={{ transform: `scaleX(${animateCharts ? businessHoursLeads / maxTimingCount : 0})`, background: TONE.neutral }} /></div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-[length:var(--text-xs)]"><span className="font-medium text-ink">24/7 AI Captured</span><span className="font-semibold text-ink cd-num">{afterHoursLeads}</span></div>
              <div className="cd-bar"><span className="motion-safe:transition-transform motion-safe:duration-700" style={{ transform: `scaleX(${animateCharts ? afterHoursLeads / maxTimingCount : 0})` }} /></div>
            </div>
          </div>
        </section>

        {/* Weekly activity: lead volume by weekday */}
        <section className="cd-panel cd-span-4">
          <div className="cd-panel__head">
            <div>
              <h2 className="cd-h2">Weekly Activity Heatmap</h2>
              <p className="cd-meta mt-0.5">Lead volume by day of the week</p>
            </div>
          </div>
          <div className="cd-panel__body">
            <div className="flex h-36 items-stretch gap-1.5">
              {dayCounts.map((count, i) => (
                <div key={i} className="group flex flex-1 flex-col items-center">
                  <span className="mb-1 text-[length:var(--text-2xs)] font-semibold text-ink cd-num opacity-0 transition-opacity group-hover:opacity-100">{count}</span>
                  <div className="relative w-full flex-1 border-b border-rule">
                    <div className="absolute inset-0 origin-bottom rounded-t-[2px] bg-[var(--color-muted)] opacity-50 group-hover:bg-signal group-hover:opacity-100 motion-safe:transition-[transform,background-color,opacity] motion-safe:duration-500" style={{ transform: `scaleY(${animateCharts ? count / maxDayCount : 0})` }} />
                  </div>
                  <span className="mt-2 text-[length:var(--text-2xs)] text-ink-2">{dayNames[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
