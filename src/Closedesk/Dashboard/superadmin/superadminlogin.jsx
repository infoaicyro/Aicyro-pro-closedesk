// src/Closedesk/Dashboard/superadmin/superadminlogin.jsx
"use client";

import { useState, useEffect } from "react";
import { CircleAlert } from "lucide-react";
import { ref, get } from "firebase/database";
import { db } from "../../../lib/firebase";

import { createWebsiteLogger } from "../../../lib/loggerPresets";
import { generateCorrelationId } from "../../../lib/tracer";

const baseLogger = createWebsiteLogger("SuperAdminLogin");

// Helper function to generate a random 6-character CAPTCHA
const generateCaptcha = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};


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
  let adjustedPrimary = baseColor,
    adjustedSecondary = baseColor;

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

export default function SuperAdminLoginScreen({
  onLoginSuccess,
  onNavigateToUserLogin,
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- CAPTCHA & BRUTE FORCE STATE ---
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaValue, setCaptchaValue] = useState("");
  const [userCaptchaInput, setUserCaptchaInput] = useState("");



  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.removeProperty("--primary");
    document.documentElement.style.removeProperty("--secondary");

    const fetchTheme = async () => {
      try {
        const lastAdmin = localStorage.getItem("currentSuperAdmin") || "admin";
        const appearanceRef = ref(
          db,
          `superAdminSettings/${lastAdmin}/appearance`,
        );
        const snapshot = await get(appearanceRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          applyThemeToDOM(
            data.mode || "light",
            data.hue || "default",
            data.shade || 500,
          );
        } else {
          const saved = JSON.parse(
            localStorage.getItem("aicyro_appearance_superadmin"),
          );
          if (saved) {
            applyThemeToDOM(
              saved.mode || "light",
              saved.hue || "default",
              saved.shade || 500,
            );
          }
        }
      } catch (error) {
        baseLogger.error("theme", "load_failed", { error });
      }
    };

    fetchTheme();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();

    const txId = generateCorrelationId();
    const txLogger = baseLogger.child({
      correlation: { correlation_id: txId },
    });

    setIsLoading(true);
    setError("");

    txLogger.info("auth", "superadmin_login_attempt", {
      context: { user_id: username },
    });

    try {
      const response = await fetch("/api/superadmin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.token) {
          localStorage.setItem("cd_session_token", data.token);
        }
        localStorage.setItem("currentSuperAdmin", data.name);
        setFailedAttempts(0);
        setShowCaptcha(false);

        txLogger.info("auth", "superadmin_login_success", {
          context: { user_id: username },
        });
        onLoginSuccess();
      } else {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        txLogger.warn("auth", "superadmin_login_invalid", {
          context: { user_id: username, attempts: newAttempts },
        });

        if (newAttempts >= 3) {
          setCaptchaValue(generateCaptcha());
          setShowCaptcha(true);
          setError("Too many failed attempts. Please solve the CAPTCHA to continue.");
        } else {
          setError(`Invalid super admin credentials. (${3 - newAttempts} attempts left)`);
        }
      }
    } catch (err) {
      txLogger.error("auth", "superadmin_login_error", {
        error: err,
        context: { user_id: username },
      });
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };



  const handleCaptchaSubmit = (e) => {
    e.preventDefault();
    if (userCaptchaInput.toUpperCase() === captchaValue) {
      setShowCaptcha(false);
      setFailedAttempts(0);
      setUserCaptchaInput("");
      setError("");
      setPassword("");
    } else {
      setError("Incorrect CAPTCHA. Please try again.");
      setCaptchaValue(generateCaptcha());
      setUserCaptchaInput("");
    }
  };

  return (
    <div className="cd-app">
      <main className="cd-auth">
        <div className="cd-auth__card">
          <header>
            <div className="cd-auth__brand">
              <img src="/icon.png" alt="" width="28" height="28" className="cd-side__mark" />
              <h1 className="cd-wordmark m-0">Super Admin Portal</h1>
            </div>
            <p className="cd-sub">
              {showCaptcha ? "Security Verification Required" : "Restricted access. Sign in to continue."}
            </p>
          </header>

          <section className="cd-panel">
            <div className="cd-panel__body flex flex-col gap-4">
              <div aria-live="polite">
                {error && (
                  <div className="cd-alert cd-alert--danger">
                    <CircleAlert aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {showCaptcha ? (
                // --- CAPTCHA FORM ---
                <form onSubmit={handleCaptchaSubmit} className="flex flex-col gap-4">
                  <div className="cd-well flex flex-col gap-2">
                    <span className="cd-label">Type this code</span>
                    <div className="font-mono text-[length:var(--text-xl)] font-semibold text-ink select-none line-through decoration-[var(--color-muted)] decoration-2">
                      {captchaValue}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={userCaptchaInput}
                    onChange={(e) => setUserCaptchaInput(e.target.value.toUpperCase())}
                    className="cd-input font-mono"
                    placeholder="Enter CAPTCHA"
                    aria-label="Enter CAPTCHA"
                    required
                  />

                  <button type="submit" className="cd-btn cd-btn--block">
                    Verify & Return to Login
                  </button>
                </form>
              ) : (
                // --- STANDARD LOGIN FORM ---
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div className="cd-field">
                    <label htmlFor="username" className="cd-label">
                      Username
                    </label>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="cd-input"
                      placeholder="Enter admin username"
                      required
                    />
                  </div>

                  <div className="cd-field">
                    <label htmlFor="password" className="cd-label">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="cd-input"
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    aria-busy={isLoading}
                    className="cd-btn cd-btn--block mt-1"
                  >
                    {isLoading ? (
                      <>
                        <span className="cd-spinner keep-motion" aria-hidden="true" />
                        Authenticating…
                      </>
                    ) : (
                      "Secure Admin Login"
                    )}
                  </button>
                </form>
              )}
            </div>
          </section>

          <p className="cd-meta">
            Not a super admin?{" "}
            <button type="button" onClick={onNavigateToUserLogin} className="cd-link">
              Standard Login
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
