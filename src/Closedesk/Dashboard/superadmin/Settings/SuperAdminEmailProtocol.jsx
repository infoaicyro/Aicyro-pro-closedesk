// src/Closedesk/Dashboard/superadmin/Settings/SuperAdminEmailProtocol.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Check, ChevronDown, CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { db } from "../../../../lib/firebase";
import { ref, onValue, update } from "firebase/database";
import { createPulseLogger } from "../../../../lib/loggerPresets";

const pulseLogger = createPulseLogger("SuperAdminEmailProtocol");

const InfoIcon = ({ text }) => (
  <span className="relative group inline-flex items-center ml-1.5 align-middle">
    <Info aria-hidden="true" className="w-3.5 h-3.5 text-ink-2 group-hover:text-ink transition-colors cursor-help" />
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[220px] p-3 bg-ink text-paper text-[length:var(--text-2xs)] font-normal rounded-control z-[100] text-left leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
      {text}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-ink"></span>
    </span>
  </span>
);

// 🔥 Comprehensive Provider List
const PROVIDER_OPTIONS = [
  { id: "google_oauth", label: "Google / G Suite Workspace" },
  { id: "microsoft", label: "Microsoft 365 / Outlook" },
  { id: "hostinger", label: "Hostinger Mail" },
  { id: "namecheap", label: "Namecheap (PrivateEmail)" },
  { id: "cpanel", label: "Standard cPanel (Bluehost, SiteGround, HostGator, A2)" },
  { id: "titan", label: "Titan Email" },
  { id: "dreamhost", label: "DreamHost" },
  { id: "inmotion", label: "InMotion Hosting" },
  { id: "rackspace", label: "Rackspace Email" },
  { id: "yandex", label: "Yandex 360 / Mail" },
  { id: "custom_smtp", label: "Custom SMTP Server" },
];

// 🔥 Pre-configured hidden host/port combinations
const STATIC_SMTP_CONFIGS = {
  hostinger: { host: "smtp.hostinger.com", port: "465" },
  namecheap: { host: "mail.privateemail.com", port: "465" },
  titan: { host: "smtp.titan.email", port: "465" },
  dreamhost: { host: "smtp.dreamhost.com", port: "465" },
  rackspace: { host: "secure.emailsrvr.com", port: "465" },
  yandex: { host: "smtp.yandex.com", port: "465" }
};

export default function SuperAdminEmailProtocol() {
  const [emailConfig, setEmailConfig] = useState({
    senderName: "Aicyro Pulse",
    smtpEmail: "",
    smtpPassword: "",
    provider: "google_oauth", 
    smtpService: "google_oauth", // Used exclusively for UI dropdown state
    smtpHost: "",
    smtpPort: "465",
    refreshToken: "",
  });

  const [savedProvider, setSavedProvider] = useState("");
  const [savedService, setSavedService] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const popupRef = useRef(null);
  
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
  };

  useEffect(() => {
    const configRef = ref(db, "settings/email_config");
    const unsubConfig = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // Derive the UI service state if not explicitly saved
        let derivedService = data.smtpService;
        if (!derivedService) {
          if (data.provider === "custom") derivedService = "custom_smtp";
          else derivedService = data.provider;
        }

        setEmailConfig((prev) => ({ ...prev, ...data, smtpService: derivedService }));
        setSavedProvider(data.provider || "");
        setSavedService(derivedService || "");
      }
    });

        const handleMessage = (event) => {
      // 🚨 SECURITY: Strict origin and source window verification
      if (typeof window !== "undefined" && event.origin !== window.location.origin) {
        return;
      }
      if (popupRef.current && event.source && event.source !== popupRef.current) {
        return;
      }

      const data = event.data;
      if (data?.type === "CLOSEDESK_OAUTH_STATUS") {
        if (data.status === "connected") {
          showToast("Account connected successfully!");
        } else {
          showToast(data.error || "Account connection failed.", "error");
        }
      } else if (data?.type === "OAUTH_SUCCESS") {
        showToast("Account connected successfully!");
      } else if (data?.type === "OAUTH_ERROR") {
        showToast("Account connection failed or was cancelled.", "error");
      }
    };
    window.addEventListener("message", handleMessage);

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      unsubConfig();
      window.removeEventListener("message", handleMessage);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleProviderSelect = (serviceId) => {
    let updates = { smtpService: serviceId };
    
    if (serviceId === "google_oauth" || serviceId === "microsoft") {
      updates.provider = serviceId;
    } else {
      // Must be saved as "custom" so the Cloud Function processes it correctly
      updates.provider = "custom";
      if (STATIC_SMTP_CONFIGS[serviceId]) {
        updates.smtpHost = STATIC_SMTP_CONFIGS[serviceId].host;
        updates.smtpPort = STATIC_SMTP_CONFIGS[serviceId].port;
      }
    }
    
    setEmailConfig(prev => ({ ...prev, ...updates }));
    setIsDropdownOpen(false);
  };

  const handleSaveEmailConfig = async () => {
    setIsSavingEmail(true);
    pulseLogger.info("settings_update", "sender_email_config_updated");
    
    let finalConfig = { ...emailConfig };
    
    // Hard-enforce the correct host details right before saving
    if (STATIC_SMTP_CONFIGS[finalConfig.smtpService]) {
      finalConfig.smtpHost = STATIC_SMTP_CONFIGS[finalConfig.smtpService].host;
      finalConfig.smtpPort = STATIC_SMTP_CONFIGS[finalConfig.smtpService].port;
    }

    try {
      const token = localStorage.getItem("cd_session_token");
      const res = await fetch("/api/superadmin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest",
          ...(token ? { "x-cd-session": token } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          section: "email_config",
          payload: finalConfig,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save email settings");
      }

      showToast("Sender configuration updated!");
    } catch (error) {
      pulseLogger.error("settings_update", "sender_email_config_failed", { error });
      showToast("Failed to save sender configuration: " + error.message, "error");
    }
    setIsSavingEmail(false);
  };

  const confirmDisconnectAccount = async () => {
    setShowDisconnectConfirm(false);
    setIsDisconnecting(true);
    try {
      const token = localStorage.getItem("cd_session_token");
      const disconnectPayload = {
        refreshToken: null,
        clientId: null,
        clientSecret: null,
        smtpEmail: "",
        connectedAt: null,
        provider: "custom",
        smtpService: "custom_smtp",
      };
      const res = await fetch("/api/superadmin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest",
          ...(token ? { "x-cd-session": token } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          section: "email_config",
          payload: disconnectPayload,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to disconnect account");
      }

      setEmailConfig((prev) => ({
        ...prev,
        refreshToken: "",
        clientId: "",
        clientSecret: "",
        smtpEmail: "",
        provider: "custom",
        smtpService: "custom_smtp",
      }));
      setSavedProvider("");
      setSavedService("");
      pulseLogger.info("settings_update", "account_disconnected");
      showToast("Account successfully disconnected.");
    } catch (error) {
      pulseLogger.error("settings_update", "account_disconnect_failed", { error });
      showToast("Failed to disconnect account.", "error");
    }
    setIsDisconnecting(false);
  };

  const openOAuthPopup = (provider) => {
    const width = 550;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    popupRef.current = window.open(
      `/api/auth/${provider}/login`,
      "OAuthLoginPopup",
      `width=${width},height=${height},top=${top},left=${left}`
    );
  };

  // UI rendering flags
  const isGoogleConnected = savedProvider === "google_oauth" && !!emailConfig.refreshToken;
  const isMicrosoftConnected = savedProvider === "microsoft" && !!emailConfig.refreshToken;
  const isGoogleView = emailConfig.smtpService === "google_oauth";
  const isMicrosoftView = emailConfig.smtpService === "microsoft";
  const isStaticSmtpView = Object.keys(STATIC_SMTP_CONFIGS).includes(emailConfig.smtpService);
  const isDynamicSmtpView = ["custom_smtp", "cpanel", "inmotion"].includes(emailConfig.smtpService);
  
  const currentProviderLabel = PROVIDER_OPTIONS.find(p => p.id === emailConfig.smtpService)?.label || "Select Provider";
  const activeProviderName = PROVIDER_OPTIONS.find(p => p.id === savedService)?.label || "";

  return (
    <div className="cd-page">
      <div className="cd-page__head">
        <div>
          <h1 className="cd-h1">Outgoing Email Protocol</h1>
          <p className="cd-sub">The engine used to dispatch automated confirmation emails.</p>
        </div>
      </div>

      <section className="cd-panel w-full max-w-[50rem]">
        <div className="cd-panel__body flex flex-col gap-5">
          {/* Sleek Custom Dropdown Menu */}
          <div className="cd-field relative z-20" ref={dropdownRef}>
            <label className="cd-label">Email Service Provider</label>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-haspopup="true"
              aria-expanded={isDropdownOpen}
              className="cd-input flex items-center justify-between gap-2 text-left cursor-pointer"
            >
              <span className="truncate">{currentProviderLabel}</span>
              <ChevronDown
                aria-hidden="true"
                className={`w-4 h-4 shrink-0 text-ink-2 transition-transform motion-reduce:transition-none ${isDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isDropdownOpen && (
              <div className="cd-popover top-full left-0 mt-1 w-full max-h-64 overflow-y-auto py-1">
                {PROVIDER_OPTIONS.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => handleProviderSelect(provider.id)}
                    aria-current={emailConfig.smtpService === provider.id ? "true" : undefined}
                    className={`w-full text-left px-3 py-2 text-[length:var(--text-sm)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${emailConfig.smtpService === provider.id ? "bg-selected text-ink font-semibold" : "text-ink-2 hover:bg-hover hover:text-ink"}`}
                  >
                    {provider.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="cd-field">
            <span className="cd-label inline-flex items-center">
              Sender Name
              <InfoIcon text="The name leads see in their inbox (e.g., 'Aicyro Support')." />
            </span>
            <input type="text" value={emailConfig.senderName} onChange={(e) => setEmailConfig({...emailConfig, senderName: e.target.value})} className="cd-input" placeholder="e.g., Aicyro Support" />
          </label>

          {isGoogleView && (
            <div className="cd-well flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="cd-h3">Google Account Connection</h3>
                  <p className="cd-meta mt-0.5">
                    {isGoogleConnected ? `Connected as ${emailConfig.smtpEmail}` : "Connect your Google account securely with 1 click."}
                  </p>
                </div>
                {isGoogleConnected && (
                  <span className="cd-badge cd-badge--success">
                    <Check aria-hidden="true" />Connected
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {!isGoogleConnected && (
                  <div className="flex-1 flex flex-col gap-3">
                    {savedService && savedService !== "google_oauth" && (
                      <p className="cd-alert bg-[var(--color-warn-wash)]">
                        <TriangleAlert aria-hidden="true" className="text-warn" />
                        <span>
                          <strong className="font-semibold">Safe Switch:</strong> You are currently using {activeProviderName}. If this Google login is cancelled, your {activeProviderName} connection remains intact.
                        </span>
                      </p>
                    )}
                    <button type="button" onClick={() => openOAuthPopup('google')} className="cd-btn cd-btn--quiet cd-btn--block">
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                      {savedService && savedService !== "google_oauth" ? "Switch to Google" : "Sign in with Google"}
                    </button>
                  </div>
                )}

                {isGoogleConnected && (
                  <button type="button" onClick={() => setShowDisconnectConfirm(true)} disabled={isDisconnecting} className="cd-btn cd-btn--danger cd-btn--block">
                    {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                  </button>
                )}
              </div>
            </div>
          )}

          {isMicrosoftView && (
            <div className="cd-well flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="cd-h3">Microsoft Account Connection</h3>
                  <p className="cd-meta mt-0.5">
                    {isMicrosoftConnected ? `Connected as ${emailConfig.smtpEmail}` : "Connect your Hotmail or Outlook account securely with 1 click."}
                  </p>
                </div>
                {isMicrosoftConnected && (
                  <span className="cd-badge cd-badge--success">
                    <Check aria-hidden="true" />Connected
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {!isMicrosoftConnected && (
                  <div className="flex-1 flex flex-col gap-3">
                    {savedService && savedService !== "microsoft" && (
                      <p className="cd-alert bg-[var(--color-warn-wash)]">
                        <TriangleAlert aria-hidden="true" className="text-warn" />
                        <span>
                          <strong className="font-semibold">Safe Switch:</strong> You are currently using {activeProviderName}. If this Microsoft login is cancelled, your {activeProviderName} connection remains intact.
                        </span>
                      </p>
                    )}
                    <button type="button" onClick={() => openOAuthPopup('microsoft')} className="cd-btn cd-btn--quiet cd-btn--block">
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 21 21" aria-hidden="true"><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#00a4ef" d="M1 11h9v9H1z"/><path fill="#7fba00" d="M11 1h9v9h-9z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>
                      {savedService && savedService !== "microsoft" ? "Switch to Microsoft" : "Sign in with Microsoft"}
                    </button>
                  </div>
                )}

                {isMicrosoftConnected && (
                  <button type="button" onClick={() => setShowDisconnectConfirm(true)} disabled={isDisconnecting} className="cd-btn cd-btn--danger cd-btn--block">
                    {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                  </button>
                )}
              </div>
            </div>
          )}

          {isStaticSmtpView && (
            <div className="flex flex-col gap-5">
              <label className="cd-field">
                <span className="cd-label">{currentProviderLabel} Address</span>
                <input type="email" value={emailConfig.smtpEmail} onChange={(e) => setEmailConfig({...emailConfig, smtpEmail: e.target.value})} className="cd-input" placeholder="contact@yourdomain.com" />
              </label>
              <label className="cd-field">
                <span className="cd-label">Mailbox Password</span>
                <input type="password" value={emailConfig.smtpPassword} onChange={(e) => setEmailConfig({...emailConfig, smtpPassword: e.target.value})} className="cd-input" placeholder="••••••••••••••••" />
              </label>
            </div>
          )}

          {isDynamicSmtpView && (
            <div className="flex flex-col gap-5">
              <label className="cd-field">
                <span className="cd-label">Email Address</span>
                <input type="email" value={emailConfig.smtpEmail} onChange={(e) => setEmailConfig({...emailConfig, smtpEmail: e.target.value})} className="cd-input" placeholder="hello@company.com" />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <label className="cd-field">
                  <span className="cd-label">SMTP Host</span>
                  <input type="text" value={emailConfig.smtpHost} onChange={(e) => setEmailConfig({...emailConfig, smtpHost: e.target.value})} className="cd-input font-mono" placeholder={emailConfig.smtpService === "cpanel" ? "mail.yourdomain.com" : "smtp.mailserver.com"} />
                </label>
                <label className="cd-field">
                  <span className="cd-label">SMTP Port</span>
                  <input type="text" value={emailConfig.smtpPort} onChange={(e) => setEmailConfig({...emailConfig, smtpPort: e.target.value})} className="cd-input font-mono" placeholder="465 or 587" />
                </label>
              </div>
              <label className="cd-field">
                <span className="cd-label">SMTP Password</span>
                <input type="password" value={emailConfig.smtpPassword} onChange={(e) => setEmailConfig({...emailConfig, smtpPassword: e.target.value})} className="cd-input" placeholder="••••••••••••••••" />
              </label>
            </div>
          )}
        </div>

        {(isStaticSmtpView || isDynamicSmtpView) && (
          <div className="cd-panel__foot">
            <button type="button" onClick={handleSaveEmailConfig} disabled={isSavingEmail} aria-busy={isSavingEmail} className="cd-btn">
              {isSavingEmail ? "Deploying..." : "Deploy Config"}
            </button>
          </div>
        )}
      </section>

      <div
        role="status"
        aria-live="polite"
        className={`cd-toast transition-opacity ${toast.show ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {toast.type === "success" ? (
          <CircleCheck aria-hidden="true" className="w-[18px] h-[18px] shrink-0" />
        ) : (
          <CircleAlert aria-hidden="true" className="w-[18px] h-[18px] shrink-0" />
        )}
        <p className="font-medium">{toast.message}</p>
      </div>

      {showDisconnectConfirm && (
        <div className="cd-overlay">
          <div
            className="cd-dialog p-6 max-w-[26rem]"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sa-disconnect-title"
          >
            <div className="flex items-center gap-3 mb-3">
              <TriangleAlert aria-hidden="true" className="w-5 h-5 shrink-0 text-danger" />
              <h3 id="sa-disconnect-title" className="cd-h2">Disconnect Account?</h3>
            </div>
            <p className="cd-sub mb-6">
              Lead alerts will stop sending automatically until you reconnect a valid email provider. Are you sure you want to proceed?
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowDisconnectConfirm(false)} className="cd-btn cd-btn--quiet">Cancel</button>
              <button type="button" onClick={confirmDisconnectAccount} className="cd-btn cd-btn--danger">Yes, Disconnect</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
