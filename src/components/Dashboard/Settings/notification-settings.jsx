// src/components/Dashboard/Settings/notification-settings.jsx
"use client";

import { useState, useEffect } from "react";
import { db } from "../../../lib/firebase";
import { ref, onValue, update } from "firebase/database";
import { createPulseLogger } from "../../../lib/loggerPresets";

const pulseLogger = createPulseLogger("NotificationSettings");

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState({
    emailAlerts: true,
    smsAlerts: false,
    urgentOnly: false,
    adminEmail: "",
    adminPhone: "",
  });

  // 🔥 NEW: Dynamic Sender Configuration State
  const [emailConfig, setEmailConfig] = useState({
    senderName: "Aicyro Pulse",
    smtpEmail: "",
    smtpPassword: "",
  });

  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
  };

  useEffect(() => {
    // Load Admin Alert Preferences
    const prefsRef = ref(db, "users/root/notifications");
    const unsubPrefs = onValue(prefsRef, (snapshot) => {
      if (snapshot.exists()) setPreferences(snapshot.val());
    });

    // 🔥 NEW: Load Outgoing Sender Config
    const configRef = ref(db, "settings/email_config");
    const unsubConfig = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) setEmailConfig(snapshot.val());
    });

    return () => {
      unsubPrefs();
      unsubConfig();
    };
  }, []);

  const handleSavePreferences = async () => {
    setIsSavingPrefs(true);
    pulseLogger.info("settings_update", "notification_preferences_updated");
    try {
      await update(ref(db, "users/root/notifications"), preferences);
      showToast("Alert preferences saved successfully!");
    } catch (error) {
      pulseLogger.error("settings_update", "notification_preferences_failed", { error });
      showToast("Failed to save alert preferences.", "error");
    }
    setIsSavingPrefs(false);
  };

  const handleSaveEmailConfig = async () => {
    setIsSavingEmail(true);
    pulseLogger.info("settings_update", "sender_email_config_updated");
    try {
      await update(ref(db, "settings/email_config"), emailConfig);
      showToast("Sender email configuration updated!");
    } catch (error) {
      pulseLogger.error("settings_update", "sender_email_config_failed", { error });
      showToast("Failed to save sender configuration.", "error");
    }
    setIsSavingEmail(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 animate-acy-fade font-sans">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-[var(--foreground)] tracking-tight">Notification Settings</h1>
        <p className="text-[var(--foreground-muted)] text-sm mt-1">Manage how you receive alerts and configure your automated sender.</p>
      </div>

      {/* 🔥 NEW: Outgoing Email (SMTP) Configuration */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-5 sm:p-8 shadow-sm mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)] blur-[100px] opacity-10 pointer-events-none"></div>
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-1 relative z-10">Outgoing Sender Configuration</h2>
        <p className="text-xs text-[var(--foreground-muted)] mb-6 relative z-10">Configure the exact Gmail account Aicyro uses to dispatch confirmation emails and alerts.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 relative z-10">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-1.5 block">Sender Name (From)</label>
            <input type="text" value={emailConfig.senderName} onChange={(e) => setEmailConfig({...emailConfig, senderName: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors" placeholder="e.g., Aicyro Support" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-1.5 block">Gmail Address</label>
            <input type="email" value={emailConfig.smtpEmail} onChange={(e) => setEmailConfig({...emailConfig, smtpEmail: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors" placeholder="your.business@gmail.com" />
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-1.5 block">Gmail App Password</label>
            <input type="password" value={emailConfig.smtpPassword} onChange={(e) => setEmailConfig({...emailConfig, smtpPassword: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors font-mono" placeholder="16-character App Password" />
            <p className="text-[10px] text-[var(--foreground-muted)] mt-2">You must use a Google App Password, not your standard account password. <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-[var(--primary)] hover:underline font-bold">Generate one here</a>.</p>
          </div>
        </div>
        
        <div className="flex justify-end relative z-10">
          <button onClick={handleSaveEmailConfig} disabled={isSavingEmail} className="px-6 py-2.5 bg-[var(--primary)] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-[0_0_15px_var(--lead-glow)] hover:scale-105 transition-all disabled:opacity-50">
            {isSavingEmail ? "Saving..." : "Save Sender"}
          </button>
        </div>
      </div>

      {/* Admin Alert Routing Preferences */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-5 sm:p-8 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-1">Admin Alert Routing</h2>
        <p className="text-xs text-[var(--foreground-muted)] mb-6">Choose where and when you want to be notified about new leads.</p>
        
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 border border-[var(--border-color)] rounded-xl bg-[var(--background)]/50">
            <div>
              <h3 className="text-sm font-bold text-[var(--foreground)]">Email Notifications</h3>
              <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">Receive an email when a high-intent lead is captured.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" checked={preferences.emailAlerts} onChange={(e) => setPreferences({ ...preferences, emailAlerts: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-[var(--foreground-muted)] opacity-30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)] peer-checked:opacity-100 shadow-inner"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)] mb-1.5 block">Admin Receiving Email</label>
              <input type="email" value={preferences.adminEmail} onChange={(e) => setPreferences({ ...preferences, adminEmail: e.target.value })} className="w-full bg-[var(--background)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors" placeholder="admin@yourcompany.com" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-[var(--border-color)] rounded-xl bg-[var(--background)] hover:border-[var(--primary)]/50 transition-colors w-full">
                <input type="checkbox" checked={preferences.urgentOnly} onChange={(e) => setPreferences({ ...preferences, urgentOnly: e.target.checked })} className="w-4 h-4 accent-[var(--primary)]" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[var(--foreground)]">Urgent / Bookings Only</span>
                  <span className="text-[10px] text-[var(--foreground-muted)]">Ignore low-intent tire kickers</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button onClick={handleSavePreferences} disabled={isSavingPrefs} className="px-6 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] hover:text-[var(--primary)] hover:border-[var(--primary)]/50 text-xs font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-50">
            {isSavingPrefs ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      <div className={`fixed bottom-6 right-6 z-[100] transition-all duration-500 ease-out ${toast.show ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"}`}>
        <div className="app-toast border border-[var(--border-color)] shadow-[0_10px_40px_rgba(0,0,0,0.3)] rounded-2xl p-4 pr-10 flex items-center gap-3 relative overflow-hidden backdrop-blur-xl bg-[var(--card-bg)]">
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${toast.type === "success" ? "bg-green-500" : "bg-red-500"}`}></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5 text-[var(--foreground-muted)]">System Notification</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">{toast.message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}