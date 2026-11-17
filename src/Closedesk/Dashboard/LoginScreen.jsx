// src/Closedesk/Dashboard/LoginScreen.jsx
"use client";

import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { ref, get } from "firebase/database";
import { db } from "../../lib/firebase";

import { createWebsiteLogger } from "../../lib/loggerPresets";
import { generateCorrelationId } from "../../lib/tracer";

const baseLogger = createWebsiteLogger("PulseLogin");

// Helper function to generate a random 6-character CAPTCHA
const generateCaptcha = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};


const checkUserMatch = (user, targetUser, targetPass) => {
  if (!user || typeof user !== "object") return false;
  const uName = (user.name || user.username || "").trim().toLowerCase();
  const tName = (targetUser || "").trim().toLowerCase();
  const uPass = String(user.password || "").trim();
  const tPass = String(targetPass || "").trim();
  return Boolean(uName && uPass && uName === tName && uPass === tPass);
};

export default function LoginScreen({
  onLoginSuccess,
  onNavigateToSuperAdmin,
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



  const handleLogin = async (e) => {
    e.preventDefault();

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError("Please enter both username and password.");
      return;
    }

    const txId = generateCorrelationId();
    const txLogger = baseLogger.child({
      correlation: { correlation_id: txId },
    });

    setIsLoading(true);
    setError("");

    txLogger.info("auth", "login_attempt", { context: { user_id: cleanUsername } });

    try {
      let isSuccess = false;
      let resolvedTenantId = "default";
      let resolvedUserName = cleanUsername;

      // -------------------------------------------------------------
      // 1. Try Backend API first (Enforces rate-limits & audit trails)
      // -------------------------------------------------------------
      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-requested-with": "XMLHttpRequest",
          },
          credentials: "include",
          body: JSON.stringify({
            username: cleanUsername,
            password: cleanPassword,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            isSuccess = true;
            resolvedTenantId = data.tenant_id || "default";
            if (data.token) {
              localStorage.setItem("cd_session_token", data.token);
            }
          }
        }
      } catch (apiErr) {
        console.warn("Backend /api/login endpoint call failed, falling back to direct Firebase verification:", apiErr);
      }

      // -------------------------------------------------------------
      // 2. Direct Firebase Realtime DB Verification (Fallback / Offline)
      // -------------------------------------------------------------
      if (!isSuccess) {
        // A. Check root 'login' array (Default / Primary Users)
        try {
          const loginSnap = await get(ref(db, "login"));
          if (loginSnap.exists()) {
            const rawLogin = loginSnap.val();
            const userList = Array.isArray(rawLogin) ? rawLogin : Object.values(rawLogin);
            const matchedUser = userList.find((u) => checkUserMatch(u, cleanUsername, cleanPassword));
            if (matchedUser) {
              isSuccess = true;
              resolvedUserName = matchedUser.name || matchedUser.username || cleanUsername;
              resolvedTenantId = "default";
            }
          }
        } catch (dbErr) {
          console.warn("Root login check error:", dbErr);
        }

        // B. Check all multi-tenant partitions in 'tenants/*/users'
        if (!isSuccess) {
          try {
            const tenantsSnap = await get(ref(db, "tenants"));
            if (tenantsSnap.exists()) {
              const tenantsVal = tenantsSnap.val();
              for (const [tId, tData] of Object.entries(tenantsVal)) {
                if (tData && tData.users) {
                  const userList = Array.isArray(tData.users)
                    ? tData.users
                    : Object.values(tData.users);
                  const matchedTenantUser = userList.find((u) =>
                    checkUserMatch(u, cleanUsername, cleanPassword)
                  );
                  if (matchedTenantUser) {
                    isSuccess = true;
                    resolvedUserName =
                      matchedTenantUser.name ||
                      matchedTenantUser.username ||
                      cleanUsername;
                    resolvedTenantId = tId;
                    break;
                  }
                }
              }
            }
          } catch (tenantDbErr) {
            console.warn("Tenants users check error:", tenantDbErr);
          }
        }
      }

      // -------------------------------------------------------------
      // 3. Evaluate Authentication Result
      // -------------------------------------------------------------
      if (isSuccess) {
        localStorage.removeItem("currentSuperAdmin");
        localStorage.setItem("currentUser", resolvedUserName);
        localStorage.setItem("currentTenant", resolvedTenantId);
        setFailedAttempts(0);
        setShowCaptcha(false);

        txLogger.info("auth", "login_success", {
          context: { user_id: resolvedUserName, tenant_id: resolvedTenantId },
        });

        if (typeof onLoginSuccess === "function") {
          onLoginSuccess({
            user: resolvedUserName,
            tenantId: resolvedTenantId,
          });
        }
      } else {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        txLogger.warn("auth", "login_failed_invalid_credentials", {
          context: { user_id: cleanUsername, attempts: newAttempts },
        });

        if (newAttempts >= 3) {
          setCaptchaValue(generateCaptcha());
          setShowCaptcha(true);
          setError("Too many failed attempts. Please solve the CAPTCHA to continue.");
        } else {
          setError(`Invalid username or password. (${3 - newAttempts} attempts left)`);
        }
      }
    } catch (err) {
      txLogger.error("auth", "login_error", {
        error: err,
        context: { user_id: cleanUsername },
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
              <h1 className="cd-wordmark m-0">Aicyro Pulse</h1>
            </div>
            <p className="cd-sub">
              {showCaptcha ? "Security Verification Required" : "Sign in to access your tenant dashboard"}
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
                      placeholder="Enter your username"
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
                      "Secure Sign In"
                    )}
                  </button>
                </form>
              )}
            </div>
          </section>

          <p className="cd-meta">
            Platform Administrator?{" "}
            <button type="button" onClick={onNavigateToSuperAdmin} className="cd-link">
              Super Admin Login
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
