// src/Closedesk/Dashboard/Settings/notification-settings.jsx
"use client";

import { useState, useEffect } from "react";
import { CircleAlert, CircleCheck, Mail } from "lucide-react";
import { db } from "../../../lib/firebase";
// Added 'push' to the import list to create new alerts
import { ref, onValue, update, push } from "firebase/database";
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

  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false); // State for the test button
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
  };

  useEffect(() => {
    const prefsRef = ref(db, "users/root/notifications");
    const unsubPrefs = onValue(prefsRef, (snapshot) => {
      if (snapshot.exists()) setPreferences(snapshot.val());
    });
    return () => unsubPrefs();
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

  // Trigger a dummy alert to verify email dispatch
  const handleTestEmail = async () => {
    setIsSendingTest(true);
    pulseLogger.info("settings_update", "test_email_triggered");
    try {
      const alertsRef = ref(db, "email_alerts");
      await push(alertsRef, {
        status: "pending",
        event_type: "end",
        title: "Aicyro Pulse - Test Routing Alert",
        message: "This is a test alert to verify your routing configuration is working correctly.",
        lead_data: {
          name: "Test System",
          email: "noreply@aicyro.com",
          phone: "N/A",
          urgency_level: "Low",
          conversation_summary: "System generated test email to verify routing preferences."
        },
        timestamp: Date.now()
      });
      showToast("Test email triggered! Check your inbox.");
    } catch (error) {
      pulseLogger.error("settings_update", "test_email_failed", { error });
      showToast("Failed to trigger test email.", "error");
    }
    setIsSendingTest(false);
  };

  return (
    <div className="cd-page">
      <div className="cd-page__head">
        <div>
          <h1 className="cd-h1">Admin Routing</h1>
          <p className="cd-sub">Where internal lead alerts are delivered.</p>
        </div>
      </div>

      <section className="cd-panel w-full max-w-[48rem]">
        <div className="cd-panel__head">
          <div className="min-w-0">
            <h2 className="cd-h2">Enable Email Alerts</h2>
            <p className="cd-meta mt-1">Receive immediate ping on new leads.</p>
          </div>
          <input
            type="checkbox"
            role="switch"
            aria-label="Enable Email Alerts"
            checked={preferences.emailAlerts}
            onChange={(e) => setPreferences({ ...preferences, emailAlerts: e.target.checked })}
            className="cd-switch"
          />
        </div>

        <div className="cd-panel__body flex flex-col gap-5">
          <div className="cd-field">
            <label className="flex flex-col gap-2">
              <span className="cd-label">Destination Address</span>
              <input
                type="email"
                value={preferences.adminEmail}
                onChange={(e) => setPreferences({ ...preferences, adminEmail: e.target.value })}
                className="cd-input"
                placeholder="admin@yourcompany.com"
              />
            </label>
          </div>

          <hr className="cd-divider" />

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={preferences.urgentOnly}
              onChange={(e) => setPreferences({ ...preferences, urgentOnly: e.target.checked })}
              className="cd-check mt-0.5 shrink-0"
            />
            <span className="flex flex-col gap-1">
              <span className="cd-label">Urgent / Bookings Only</span>
              <span className="cd-meta">Ignore low-intent tire kickers. Perfect for high-volume sites.</span>
            </span>
          </label>
        </div>

        <div className="cd-panel__foot">
          <button
            type="button"
            onClick={handleTestEmail}
            disabled={isSendingTest}
            aria-busy={isSendingTest}
            className="cd-btn cd-btn--quiet mr-auto"
          >
            <Mail aria-hidden="true" />
            {isSendingTest ? "Triggering..." : "Send Test Alert"}
          </button>

          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={isSavingPrefs}
            aria-busy={isSavingPrefs}
            className="cd-btn"
          >
            {isSavingPrefs && <span className="cd-spinner keep-motion" aria-hidden="true" />}
            {isSavingPrefs ? "Updating..." : "Save Rules"}
          </button>
        </div>
      </section>

      <div
        role="status"
        aria-live="polite"
        className={`cd-toast transition-opacity ${toast.show ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {toast.type === "success" ? (
          <CircleCheck aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
        ) : (
          <CircleAlert aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
        )}
        <p className="font-medium">{toast.message}</p>
      </div>
    </div>
  );
}
