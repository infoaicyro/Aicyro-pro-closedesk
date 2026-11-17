"use client";

import { useEffect, useState } from "react";
import { Check, CircleCheck, RotateCcw, Save } from "lucide-react";
import { ref, get, set } from "firebase/database";
import { db } from "../../../lib/firebase";
import HomeScreen from "../HomeScreen";
import TerminalScreen from "../TerminalScreen";
import Booking from "../Booking";

const THEME_HUES = [
  { id: "default", name: "Default", color: "#8a2be2" },
  { id: "red", name: "Red", color: "#ef4444" },
  { id: "orange", name: "Orange", color: "#f97316" },
  { id: "yellow", name: "Yellow", color: "#f59e0b" },
  { id: "green", name: "Green", color: "#10b981" },
  { id: "blue", name: "Blue", color: "#3b82f6" },
  { id: "indigo", name: "Indigo", color: "#6366f1" },
  { id: "violet", name: "Violet", color: "#8b5cf6" },
];

const applyThemeToDOM = (mode, hue, shade) => {
  let resolvedMode = mode;
  if (resolvedMode === "system") {
    resolvedMode = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  const themeString =
    hue === "default"
      ? resolvedMode === "dark"
        ? "dark"
        : "light"
      : `${hue}-${resolvedMode}`;
  document.documentElement.setAttribute("data-theme", themeString);

  const baseColor = THEME_HUES.find((h) => h.id === hue)?.color || "#8a2be2";
  let adjustedPrimary = baseColor;
  let adjustedSecondary = baseColor;

  if (shade !== 500) {
    const isDark = shade > 500;
    const intensity = Math.abs(shade - 500) / 450;
    if (isDark) {
      adjustedPrimary = `color-mix(in srgb, black ${intensity * 70}%, ${baseColor})`;
      adjustedSecondary = `color-mix(in srgb, black ${Math.min(100, intensity * 70 + 15)}%, ${baseColor})`;
    } else {
      adjustedPrimary = `color-mix(in srgb, white ${intensity * 85}%, ${baseColor})`;
      adjustedSecondary = `color-mix(in srgb, white ${Math.max(0, intensity * 85 - 10)}%, ${baseColor})`;
    }
  }

  document.documentElement.style.setProperty("--primary", adjustedPrimary);
  document.documentElement.style.setProperty("--secondary", adjustedSecondary);
};

export default function AppearanceSettings() {
  const [activeMode, setActiveMode] = useState("system");
  const [activeHue, setActiveHue] = useState("default");
  const [accentShade, setAccentShade] = useState(500);
  const [applyScope, setApplyScope] = useState("global");

  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });
  const [username, setUsername] = useState(null);

  // NEW: State to manage the active preview tab
  const [activePreview, setActivePreview] = useState("home");

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      setUsername(storedUser);
    }
  }, []);

  useEffect(() => {
    const loadPreferencesFromDB = async () => {
      const activeUser = username || localStorage.getItem("currentUser");
      if (!activeUser) return;

      try {
        const appearanceRef = ref(db, `users/${activeUser}/appearance`);
        const snapshot = await get(appearanceRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          setActiveMode(data.mode || "system");
          setActiveHue(data.hue || "default");
          setAccentShade(data.shade || 500);
          setApplyScope(data.applyScope || "global");
        } else {
          const savedSettings = JSON.parse(
            localStorage.getItem("aicyro_appearance"),
          );
          if (savedSettings) {
            setActiveMode(savedSettings.mode || "system");
            setActiveHue(savedSettings.hue || "default");
            setAccentShade(savedSettings.shade || 500);
            setApplyScope(savedSettings.applyScope || "global");
          }
        }
      } catch (error) {
        console.error("Failed to load settings", error);
      }
    };

    loadPreferencesFromDB();
  }, [username]);

  const savePreferencesToDB = async () => {
    const activeUser = username || localStorage.getItem("currentUser");
    if (!activeUser) {
      showToast("Error: No user logged in.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        mode: activeMode,
        hue: activeHue,
        shade: accentShade,
        applyScope: applyScope,
      };

      const appearanceRef = ref(db, `users/${activeUser}/appearance`);
      await set(appearanceRef, payload);

      localStorage.setItem("aicyro_appearance", JSON.stringify(payload));

      showToast("Appearance settings saved securely.");
    } catch (error) {
      console.error("Failed to save settings", error);
      showToast("Error saving settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  useEffect(() => {
    applyThemeToDOM(activeMode, activeHue, accentShade);
  }, [activeMode, activeHue, accentShade]);

  useEffect(() => {
    return () => {
      const savedSettings = JSON.parse(
        localStorage.getItem("aicyro_appearance"),
      );
      if (savedSettings) {
        applyThemeToDOM(
          savedSettings.mode || "system",
          savedSettings.hue || "default",
          savedSettings.shade || 500,
        );
      } else {
        applyThemeToDOM("system", "default", 500);
      }
    };
  }, []);

  const resetTheme = () => {
    setActiveMode("system");
    setActiveHue("default");
    setAccentShade(500);
    setApplyScope("global");
    showToast("Reset to defaults (Click Save to apply).");
  };

  const activeBaseColor =
    THEME_HUES.find((h) => h.id === activeHue)?.color || "#8a2be2";
  const sliderGradient = `linear-gradient(to right, color-mix(in srgb, white 85%, ${activeBaseColor}) 0%, ${activeBaseColor} 50%, color-mix(in srgb, black 70%, ${activeBaseColor}) 100%)`;

  return (
    <div className="cd-page">
      {/* Header */}
      <div className="cd-page__head">
        <div>
          <h1 className="cd-h1">Appearance</h1>
          <p className="cd-sub">
            Customize your dashboard mode, accent color, and visual
            preference.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={resetTheme}
            className="cd-btn cd-btn--quiet"
          >
            <RotateCcw aria-hidden="true" />
            Reset
          </button>
          <button
            type="button"
            onClick={savePreferencesToDB}
            disabled={isSaving}
            aria-busy={isSaving}
            className="cd-btn"
          >
            {isSaving ? (
              <span className="cd-spinner keep-motion" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      <div className="cd-grid items-start">
        {/* Controls - Left Column */}
        <div className="cd-span-5 flex flex-col gap-[var(--space-lg)]">
          {/* Mode Selection */}
          <section className="cd-panel">
            <div className="cd-panel__head">
              <h2 className="cd-h2">Mode</h2>
            </div>
            <div className="cd-panel__body">
              <div className="cd-seg flex w-full">
                {[
                  {
                    id: "light",
                    label: "Light",
                    icon: (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                      </svg>
                    ),
                  },
                  {
                    id: "dark",
                    label: "Dark",
                    icon: (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      >
                        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
                      </svg>
                    ),
                  },
                  {
                    id: "system",
                    label: "System",
                    icon: (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      >
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8M12 17v4" />
                      </svg>
                    ),
                  },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActiveMode(m.id)}
                    aria-pressed={activeMode === m.id}
                    className="inline-flex flex-1 items-center justify-center gap-2"
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Theme Scope Selection */}
          <section className="cd-panel">
            <div className="cd-panel__head">
              <div className="min-w-0">
                <h2 className="cd-h2">Theme Scope</h2>
                <p className="cd-meta mt-1">
                  Choose where this theme should be applied.
                </p>
              </div>
            </div>
            <div className="cd-panel__body">
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: "dashboard",
                    label: "Pulse Only",
                    sub: "Only styles the dashboard ",
                    icon: (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      >
                        <rect
                          x="3"
                          y="3"
                          width="18"
                          height="18"
                          rx="2"
                          ry="2"
                        />
                        <path d="M3 9h18M9 21V9" />
                      </svg>
                    ),
                  },
                  {
                    id: "global",
                    label: "Entire Website",
                    sub: "Applies to public pages and admin",
                    icon: (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                    ),
                  },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setApplyScope(s.id)}
                    aria-pressed={applyScope === s.id}
                    className={`flex min-w-0 flex-col items-start gap-1 rounded-control border px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                      applyScope === s.id
                        ? "border-signal bg-selected text-ink"
                        : "border-rule text-ink-2 hover:bg-hover hover:text-ink"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {s.icon} {s.label}
                    </span>
                    <span className="text-[length:var(--text-2xs)] leading-snug text-ink-2">
                      {s.sub}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Color Selection & Shade Bar */}
          <section className="cd-panel">
            <div className="cd-panel__head">
              <h2 className="cd-h2">Color Theme</h2>
            </div>

            <div className="cd-panel__body flex flex-col gap-6">
              <div className="grid grid-cols-4 gap-2">
                {THEME_HUES.map((hue) => (
                  <button
                    key={hue.id}
                    type="button"
                    onClick={() => {
                      setActiveHue(hue.id);
                      setAccentShade(500);
                    }}
                    aria-pressed={activeHue === hue.id}
                    className={`flex min-w-0 flex-col items-center gap-2 rounded-control border px-1 py-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                      activeHue === hue.id
                        ? "border-signal bg-selected"
                        : "border-rule hover:bg-hover"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-8 w-8 place-items-center rounded-full text-signal-ink"
                      style={{ background: hue.color }}
                    >
                      {activeHue === hue.id && (
                        <Check className="h-4 w-4" strokeWidth={3} />
                      )}
                    </span>
                    <span
                      className={`text-[length:var(--text-2xs)] ${activeHue === hue.id ? "font-semibold text-ink" : "font-medium text-ink-2"}`}
                    >
                      {hue.name}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-rule pt-5">
                <div className="flex items-center justify-between">
                  <h3 className="cd-h3">
                    Accent Shade
                  </h3>
                  <span className="cd-badge cd-num">
                    {accentShade}
                  </span>
                </div>
                <div
                  className="relative flex h-3 items-center rounded-full"
                  style={{ background: sliderGradient }}
                >
                  <input
                    type="range"
                    min="50"
                    max="950"
                    step="10"
                    value={accentShade}
                    onChange={(e) => setAccentShade(Number(e.target.value))}
                    aria-label="Accent Shade"
                    className="relative z-10 h-6 w-full cursor-pointer appearance-none rounded-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-paper-3 [&::-moz-range-thumb]:bg-signal [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-paper-3 [&::-webkit-slider-thumb]:bg-signal"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Live Component Preview */}
        <section className="cd-panel cd-span-7 flex flex-col overflow-hidden lg:sticky lg:top-[calc(var(--top-h)+var(--space-lg))]">
          <div className="cd-panel__head">
            <h2 className="cd-h2">Live Preview</h2>
          </div>

          {/* LIVE PREVIEW NAVBAR */}
          <div className="cd-tabs px-[var(--space-lg)]" role="tablist" aria-label="Live Preview">
            <button
              type="button"
              role="tab"
              aria-selected={activePreview === "home"}
              onClick={() => setActivePreview("home")}
            >
              Dashboard
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activePreview === "terminal"}
              onClick={() => setActivePreview("terminal")}
            >
              Terminal
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activePreview === "booking"}
              onClick={() => setActivePreview("booking")}
            >
              Booking
            </button>
          </div>

          {/* FULLY FUNCTIONAL SCALED COMPONENTS */}
          <div className="relative h-[550px] w-full overflow-hidden bg-paper md:h-[650px]" role="tabpanel">
            <div
              className="absolute left-0 top-0 h-[150%] w-[150%] origin-top-left overflow-y-auto overflow-x-hidden custom-scrollbar"
              style={{ transform: "scale(0.6666)" }}
            >
              <div className="pointer-events-auto w-full">
                {activePreview === "home" && <HomeScreen />}
                {activePreview === "terminal" && <TerminalScreen />}
                {activePreview === "booking" && <Booking />}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={`cd-toast transition-opacity ${toast.show ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <CircleCheck aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
        <span className="font-medium">{toast.message}</span>
      </div>
    </div>
  );
}
