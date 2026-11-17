"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { ChartColumn, CircleAlert, Zap } from "lucide-react";

// Chart styling: one accent series, neutral axes, hairline grid, plain tooltip
const AXIS_TICK = { fill: "var(--color-ink-2)", fontSize: 12 };
const TOOLTIP_STYLE = {
  backgroundColor: "var(--color-paper-3)",
  border: "1px solid var(--color-rule)",
  borderRadius: "8px",
  color: "var(--color-ink)",
  fontSize: "13px",
};
const TOOLTIP_LABEL_STYLE = { color: "var(--color-ink)", fontWeight: 600 };
const TOOLTIP_ITEM_STYLE = { color: "var(--color-ink)" };

export default function Insight() {
  const [insights, setInsights] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchExistingInsights = async () => {
      try {
        const tenantId = typeof window !== "undefined" ? (localStorage.getItem("currentTenant") || "default") : "default";
        const res = await fetch(`/api/insights?tenant=${encodeURIComponent(tenantId)}`, {
          headers: { "x-tenant-id": tenantId },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.kpis) {
            setInsights(data);
          }
        }
      } catch (_) {}
    };
    fetchExistingInsights();
  }, []);

  const handleGetInsights = async () => {
    setIsGenerating(true);
    setError("");
    try {
      const tenantId = typeof window !== "undefined" ? (localStorage.getItem("currentTenant") || "default") : "default";
      const response = await fetch(`/api/insights?tenant=${encodeURIComponent(tenantId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to generate insights");
      }

      const data = await response.json();
      setInsights(data);
    } catch (err) {
      console.error(err);
      setError(
        "An error occurred while generating insights. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="cd-page">
      {/* Header */}
      <div className="cd-page__head">
        <div>
          <h1 className="cd-h1">Business Intelligence</h1>
          <p className="cd-sub">
            Analyze your AI Front Desk conversations to uncover actionable
            trends.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGetInsights}
          disabled={isGenerating}
          aria-busy={isGenerating}
          className="cd-btn"
        >
          {isGenerating ? (
            <>
              <span className="cd-spinner keep-motion" aria-hidden="true" />
              Analyzing Data…
            </>
          ) : (
            <>
              <Zap aria-hidden="true" />
              Get Insights
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="cd-alert cd-alert--danger" role="alert">
          <CircleAlert aria-hidden="true" />
          <p className="m-0">{error}</p>
        </div>
      )}

      {!insights && !isGenerating && !error && (
        <div className="cd-panel">
          <div className="cd-empty">
            <ChartColumn aria-hidden="true" className="h-6 w-6 text-ink-2" />
            <p className="m-0 max-w-[60ch]">
              Click the button above to run the AI model over your recent
              conversation logs. It will extract key business metrics, drop-off
              points, and generate visualizations.
            </p>
          </div>
        </div>
      )}

      {insights && (
        <>
          {/* KPI figures */}
          <section className="cd-panel" aria-label="Key figures">
            <div className="cd-stats" style={{ "--cols": 4 }}>
              <KpiCard
                title="Total Chats"
                value={insights.kpis.total_conversations}
                icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                highlight
              />
              <KpiCard
                title="Booking Conv."
                value={insights.kpis.conversion_rate}
                icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                highlight
              />
              <KpiCard
                title="Top Service"
                value={insights.kpis.top_service}
                icon="M13 10V3L4 14h7v7l9-11h-7z"
              />
              <KpiCard
                title="After-Hours Leads"
                value={insights.kpis.after_hours_stat}
                icon="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </div>
            <div className="cd-stats border-t border-rule" style={{ "--cols": 4 }}>
              <KpiCard
                title="Top Drop-off"
                value={insights.kpis.top_dropoff}
                icon="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
              <KpiCard
                title="Pricing Inquiries"
                value={insights.kpis.pricing_inquiries_stat}
                icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <KpiCard
                title="Urgent Requests"
                value={insights.kpis.urgent_requests_stat}
                icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
              <KpiCard
                title="Top Objection"
                value={insights.kpis.top_objection}
                icon="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </div>
          </section>

          <div className="cd-grid">
            {/* Bar Chart - Service Demand */}
            <section className="cd-panel cd-span-6">
              <div className="cd-panel__head">
                <h2 className="cd-h2">Service Demand</h2>
              </div>
              <div className="cd-panel__body">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={insights.charts.service_demand}
                      layout="vertical"
                      margin={{ top: 0, right: 0, left: 20, bottom: 0 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        tick={AXIS_TICK}
                        width={100}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--color-hover)" }}
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={TOOLTIP_LABEL_STYLE}
                        itemStyle={TOOLTIP_ITEM_STYLE}
                      />
                      <Bar
                        dataKey="value"
                        fill="var(--color-accent)"
                        radius={[0, 2, 2, 0]}
                        barSize={20}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            {/* Visitor Intent: a labelled bar list of the same values (was a donut) */}
            <section className="cd-panel cd-span-6">
              <div className="cd-panel__head">
                <h2 className="cd-h2">Visitor Intent</h2>
              </div>
              <div className="cd-panel__body">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={insights.charts.visitor_intent}
                      layout="vertical"
                      margin={{ top: 0, right: 0, left: 20, bottom: 0 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        tick={AXIS_TICK}
                        width={100}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--color-hover)" }}
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={TOOLTIP_LABEL_STYLE}
                        itemStyle={TOOLTIP_ITEM_STYLE}
                      />
                      <Bar
                        dataKey="value"
                        fill="var(--color-accent)"
                        radius={[0, 2, 2, 0]}
                        barSize={20}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            {/* Line Chart - Time of Day Distribution */}
            <section className="cd-panel cd-span-8">
              <div className="cd-panel__head">
                <h2 className="cd-h2">Traffic Time Distribution</h2>
              </div>
              <div className="cd-panel__body">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={insights.charts.time_distribution}>
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--color-rule)"
                      />
                      <XAxis
                        dataKey="time"
                        axisLine={false}
                        tickLine={false}
                        tick={AXIS_TICK}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={AXIS_TICK}
                      />
                      <Tooltip
                        cursor={{ stroke: "var(--color-rule)" }}
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={TOOLTIP_LABEL_STYLE}
                        itemStyle={TOOLTIP_ITEM_STYLE}
                      />
                      <Line
                        type="monotone"
                        dataKey="leads"
                        stroke="var(--color-accent)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{
                          r: 4,
                          fill: "var(--color-accent)",
                          strokeWidth: 2,
                          stroke: "var(--color-paper-3)",
                        }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            {/* AI Summary Bullets */}
            <section className="cd-panel cd-span-4 flex flex-col">
              <div className="cd-panel__head">
                <h2 className="cd-h2">AI Analysis Notes</h2>
              </div>
              <div className="max-h-[300px] overflow-y-auto acy-scroll">
                <ul className="m-0 list-none divide-y divide-rule p-0">
                  {insights.detailed_bullets.map((bullet, idx) => (
                    <li
                      key={idx}
                      className="px-6 py-3 text-[length:var(--text-sm)] leading-relaxed text-ink"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

// Helper Component for the KPI figures
function KpiCard({ title, value, icon, highlight }) {
  return (
    <div className="cd-stat" data-highlight={highlight ? "true" : undefined}>
      <span className="cd-stat__label flex items-center gap-1.5">
        <svg
          className="h-3.5 w-3.5 shrink-0 text-ink-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        {title}
      </span>
      <p className="cd-stat__value cd-stat__value--sm m-0 [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}
