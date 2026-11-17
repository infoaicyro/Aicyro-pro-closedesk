"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { ref, get, set } from "firebase/database";
import { db } from "../../../../lib/firebase"; // Adjust path if needed
import ClientManagement from "../ClientManagement";

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
  // Default to light if nothing is provided
  const resolvedMode = mode || "light";

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

// Helper function to read local storage synchronously on mount
const getInitialSettings = () => {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem("aicyro_appearance_superadmin");
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
};

export default function SuperAdminAppearance() {
  // --- Initialize state synchronously from Local Storage to prevent FOUC, defaulting to "light"
  const [activeMode, setActiveMode] = useState(
    () => getInitialSettings()?.mode || "light",
  );
  const [activeHue, setActiveHue] = useState(
    () => getInitialSettings()?.hue || "default",
  );
  const [accentShade, setAccentShade] = useState(
    () => getInitialSettings()?.shade || 500,
  );

  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });
  const [username, setUsername] = useState(null);

  const [activePreview, setActivePreview] = useState("clients");

  // Fetch Super Admin User
  useEffect(() => {
    const storedUser = localStorage.getItem("currentSuperAdmin");
    if (storedUser) {
      setUsername(storedUser);
    }
  }, []);

  // Fetch saved theme from Firebase on mount
  useEffect(() => {
    const loadPreferencesFromDB = async () => {
      const activeUser = username || localStorage.getItem("currentSuperAdmin");
      if (!activeUser) return;

      try {
        const appearanceRef = ref(
          db,
          `superAdminSettings/${activeUser}/appearance`,
        );
        const snapshot = await get(appearanceRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          setActiveMode(data.mode || "light");
          setActiveHue(data.hue || "default");
          setAccentShade(data.shade || 500);

          // Keep local storage in sync with DB
          localStorage.setItem(
            "aicyro_appearance_superadmin",
            JSON.stringify(data),
          );
        }
      } catch (error) {
        console.error("Failed to load settings", error);
      }
    };

    loadPreferencesFromDB();
  }, [username]);

  // Save selected theme back to Firebase
  const savePreferencesToDB = async () => {
    const activeUser = username || localStorage.getItem("currentSuperAdmin");
    if (!activeUser) {
      showToast("Error: No admin logged in.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        mode: activeMode,
        hue: activeHue,
        shade: accentShade,
      };

      const appearanceRef = ref(
        db,
        `superAdminSettings/${activeUser}/appearance`,
      );
      await set(appearanceRef, payload);

      localStorage.setItem(
        "aicyro_appearance_superadmin",
        JSON.stringify(payload),
      );

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

  // Apply theme dynamically as user tweaks controls
  useEffect(() => {
    applyThemeToDOM(activeMode, activeHue, accentShade);
  }, [activeMode, activeHue, accentShade]);

  // On unmount or initial load, ensure the active theme matches saved preference
  useEffect(() => {
    return () => {
      const savedSettings = JSON.parse(
        localStorage.getItem("aicyro_appearance_superadmin"),
      );
      if (savedSettings) {
        applyThemeToDOM(
          savedSettings.mode || "light",
          savedSettings.hue || "default",
          savedSettings.shade || 500,
        );
      } else {
        applyThemeToDOM("light", "default", 500);
      }
    };
  }, []);

  const resetTheme = () => {
    setActiveMode("light");
    setActiveHue("default");
    setAccentShade(500);
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
          <nav aria-label="Breadcrumb" className="cd-meta flex items-center gap-1">
            Settings <ChevronRight aria-hidden="true" className="w-3.5 h-3.5" />{" "}
            <span className="font-semibold text-ink">Appearance</span>
          </nav>
          <h1 className="cd-h1 mt-1">Appearance</h1>
          <p className="cd-sub">Customize your console mode and accent color.</p>
        </div>
      </div>

      <div className="cd-grid items-start">
        {/* Controls - Left Column */}
        <div className="cd-span-4 flex flex-col gap-4">
          {/* Mode Selection */}
          <section className="cd-panel">
            <div className="cd-panel__head">
              <h2 className="cd-h2">Mode</h2>
            </div>
            <div className="cd-panel__body">
              {/* Changed to 2 columns since System is removed */}
              <div className="cd-seg w-full" role="group" aria-label="Mode">
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
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4"
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
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4"
                        aria-hidden="true"
                      >
                        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
                      </svg>
                    ),
                  },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActiveMode(m.id)}
                    aria-pressed={activeMode === m.id}
                    className="flex-1 inline-flex items-center justify-center gap-2"
                  >
                    {m.icon}
                    <span>{m.label}</span>
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
              <div className="grid grid-cols-4 gap-2" role="group" aria-label="Color Theme">
                {THEME_HUES.map((hue) => (
                  <button
                    key={hue.id}
                    type="button"
                    onClick={() => {
                      setActiveHue(hue.id);
                      setAccentShade(500);
                    }}
                    aria-pressed={activeHue === hue.id}
                    className={`flex flex-col items-center gap-2 px-1 py-2.5 rounded-control border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                      activeHue === hue.id
                        ? "border-signal bg-selected"
                        : "border-rule hover:bg-hover"
                    }`}
                  >
                    <span
                      className="w-7 h-7 rounded-full"
                      style={{ background: hue.color }}
                      aria-hidden="true"
                    />
                    <span
                      className={`inline-flex items-center gap-1 text-[length:var(--text-2xs)] ${activeHue === hue.id ? "font-semibold text-ink" : "font-medium text-ink-2"}`}
                    >
                      {activeHue === hue.id && (
                        <svg
                          className="w-3 h-3"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                      {hue.name}
                    </span>
                  </button>
                ))}
              </div>

              <hr className="cd-divider" />

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="cd-h3">
                    <label htmlFor="sa-accent-shade">Accent Shade</label>
                  </h3>
                  <span className="cd-badge font-mono cd-num">{accentShade}</span>
                </div>
                <div
                  className="relative h-3 rounded-full flex items-center border border-rule"
                  style={{ background: sliderGradient }}
                >
                  <input
                    id="sa-accent-shade"
                    type="range"
                    min="50"
                    max="950"
                    step="10"
                    value={accentShade}
                    onChange={(e) => setAccentShade(Number(e.target.value))}
                    className="w-full appearance-none bg-transparent cursor-pointer relative z-10 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-paper-3 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-paper-3 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-ink [&::-moz-range-thumb]:rounded-full"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Form footer: reset and save */}
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={resetTheme} className="cd-btn cd-btn--quiet">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
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
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <path d="M17 21v-8H7v8M7 3v5h8" />
                </svg>
              )}
              Save Changes
            </button>
          </div>
        </div>

        {/* Live Component Preview */}
        <section className="cd-panel cd-span-8 overflow-hidden flex flex-col">
          <div className="cd-panel__head">
            <h2 className="cd-h2">Live Preview</h2>
          </div>

          <div className="cd-tabs px-6" role="tablist" aria-label="Live Preview">
            <button
              type="button"
              role="tab"
              onClick={() => setActivePreview("clients")}
              aria-selected={activePreview === "clients"}
            >
              Clients
            </button>
            <button
              type="button"
              role="tab"
              onClick={() => setActivePreview("billing")}
              aria-selected={activePreview === "billing"}
            >
              Billing
            </button>
          </div>

          <div className="relative w-full h-[550px] md:h-[700px] bg-paper overflow-hidden">
            <div
              className="absolute top-0 left-0 w-[150%] h-[150%] origin-top-left overflow-y-auto overflow-x-hidden custom-scrollbar"
              style={{ transform: "scale(0.6666)" }}
            >
              <div className="pointer-events-auto w-full p-4">
                {activePreview === "clients" && <ClientManagement />}
                {activePreview === "billing" && (
                  <div className="cd-empty">
                    <p className="cd-empty__title">Billing Preview Coming Soon</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Toast Notification */}
      <div
        role="status"
        aria-live="polite"
        className={`cd-toast transition-opacity ${toast.show ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <svg
          className="w-[18px] h-[18px] shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span className="font-medium">{toast.message}</span>
      </div>
    </div>
  );
}
