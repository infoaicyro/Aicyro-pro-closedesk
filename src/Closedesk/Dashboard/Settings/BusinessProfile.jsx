"use client";

import { useState, useEffect, useRef } from "react";
import { CircleAlert, CircleCheck, Upload } from "lucide-react";
import { db } from "../../../lib/firebase";
import { ref, set, get } from "firebase/database";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const DEFAULT_SCHEDULE = DAYS_OF_WEEK.reduce((acc, day) => {
  acc[day] = {
    active: day !== "Saturday" && day !== "Sunday",
    open: "09:00",
    close: "17:00",
  };
  return acc;
}, {});

// Helper function to generate time zones with GMT offsets
const generateTimezonesWithGMT = () => {
  const tzs =
    typeof Intl !== "undefined" && Intl.supportedValuesOf
      ? Intl.supportedValuesOf("timeZone")
      : [
          "UTC",
          "America/New_York",
          "America/Chicago",
          "America/Denver",
          "America/Los_Angeles",
          "Europe/London",
          "Europe/Paris",
          "Asia/Tokyo",
          "Australia/Sydney",
        ];

  return tzs
    .map((tz) => {
      try {
        // Extract the short GMT offset string (e.g., "GMT-5", "GMT+2")
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          timeZoneName: "shortOffset",
        });
        const parts = formatter.formatToParts(new Date());
        let offset =
          parts.find((p) => p.type === "timeZoneName")?.value || "GMT";

        // Normalize 'GMT' to 'GMT+0' for better consistency visually
        if (offset === "GMT") offset = "GMT+0";

        const formattedName = tz.replace(/_/g, " ");

        return {
          value: tz,
          label: `(${offset}) ${formattedName}`,
        };
      } catch (e) {
        return { value: tz, label: tz };
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

const TIMEZONE_OPTIONS = generateTimezonesWithGMT();

export default function BusinessProfile({ onNavigate }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState("/icon.png");
  const fileInputRef = useRef(null);

  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const [formData, setFormData] = useState({
    businessName: "",
    industry: "",
    website: "",
    phone: "",
    email: "",
    avgJobValue: "",
    address: "",
  });
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [timezone, setTimezone] = useState("");

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(
      () => setToast({ show: false, message: "", type: "success" }),
      3500,
    );
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const snapshot = await get(ref(db, "settings/business_profile"));
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data.basic_info)
            setFormData((prev) => ({ ...prev, ...data.basic_info }));
          if (data.operating_hours) setSchedule(data.operating_hours);

          if (data.timezone) {
            setTimezone(data.timezone);
          } else {
            setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
          }
        } else {
          setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
        }

        setLogoPreview(`/icon.png?t=${new Date().getTime()}`);
      } catch (error) {
        showToast("Failed to load profile.", "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleInputChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const handleScheduleToggle = (day) =>
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], active: !prev[day].active },
    }));
  const handleTimeChange = (day, field, value) =>
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("File size must be under 2MB", "error");
      return;
    }

    setIsUploadingLogo(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Image = event.target.result;
      setLogoPreview(base64Image);

      try {
        await set(ref(db, "settings/branding/logo"), base64Image);
        showToast("Logo updated successfully!", "success");
      } finally {
        setIsUploadingLogo(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await set(ref(db, "settings/business_profile"), {
        basic_info: formData,
        operating_hours: schedule,
        timezone: timezone,
        updated_at: new Date().toISOString(),
      });
      showToast("Business profile updated successfully!", "success");
    } catch (error) {
      showToast("Failed to save changes.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading)
    return (
      <div className="cd-page" role="status" aria-live="polite">
        <div className="cd-page__head">
          <div className="flex flex-col gap-2">
            <span className="cd-skel h-7 w-64 max-w-full" />
            <span className="cd-skel h-4 w-[24rem] max-w-full" />
          </div>
        </div>
        <div className="cd-panel">
          <div className="cd-panel__body flex flex-col gap-4">
            <p className="cd-meta">Loading Profile...</p>
            <span className="cd-skel h-9 w-full" />
            <span className="cd-skel h-9 w-2/3" />
            <span className="cd-skel h-9 w-1/2" />
          </div>
        </div>
      </div>
    );

  return (
    <div className="cd-page">
      <div className="cd-page__head">
        <div>
          <h1 className="cd-h1">Business Profile</h1>
          <p className="cd-sub">
            Configure your core identity and operational hours.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={isSaving}
          aria-busy={isSaving}
          className="cd-btn"
        >
          {isSaving && <span className="cd-spinner keep-motion" aria-hidden="true" />}
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="cd-grid items-start">
        {/* ================= LEFT COLUMN ================= */}
        <div className="cd-span-7 flex flex-col gap-[var(--space-lg)]">
          {/* Core Identity */}
          <section className="cd-panel">
            <div className="cd-panel__head">
              <h2 className="cd-h2">Core Identity</h2>
            </div>

            <div className="cd-panel__body flex flex-col gap-6">
              {/* LOGO UPLOAD SECTION */}
              <div className="cd-well flex items-center gap-4">
                <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-control bg-paper-3">
                  <img
                    src={logoPreview}
                    alt="Business Logo"
                    className="h-full w-full object-contain p-2"
                  />
                  {isUploadingLogo && (
                    <div className="absolute inset-0 grid place-items-center bg-paper-3 text-ink-2">
                      <span className="cd-spinner keep-motion" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <h3 className="cd-h3">System Logo</h3>
                  <p className="cd-meta max-w-[36ch]">
                    Updates the icon shown in the sidebar and browser tab.
                    Recommended: PNG, Square.
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png, image/jpeg, image/svg+xml"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    disabled={isUploadingLogo}
                    aria-busy={isUploadingLogo}
                    className="cd-btn cd-btn--quiet cd-btn--sm self-start"
                  >
                    <Upload aria-hidden="true" />
                    Upload New Image
                  </button>
                </div>
              </div>

              <div className="cd-grid">
                <label className="cd-field cd-span-12">
                  <span className="cd-label">Business Name</span>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleInputChange}
                    className="cd-input"
                  />
                </label>

                <label className="cd-field cd-span-6">
                  <span className="cd-label">Industry</span>
                  <input
                    type="text"
                    name="industry"
                    value={formData.industry}
                    onChange={handleInputChange}
                    className="cd-input"
                  />
                </label>
                <label className="cd-field cd-span-6">
                  <span className="cd-label">Website</span>
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    className="cd-input"
                  />
                </label>
                <label className="cd-field cd-span-6">
                  <span className="cd-label">Phone</span>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="cd-input"
                  />
                </label>
                <label className="cd-field cd-span-6">
                  <span className="cd-label">Email</span>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="cd-input"
                  />
                </label>

                <label className="cd-field cd-span-12">
                  <span className="cd-label">Address</span>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows="3"
                    className="cd-textarea"
                  />
                </label>
              </div>
            </div>
          </section>

          {/* Account Security Section */}
          <section className="cd-panel">
            <div className="cd-panel__body flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="cd-h2">Account Security</h2>
                <p className="cd-meta mt-1">
                  Manage your credentials and login methods.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate("password_change")}
                className="cd-btn cd-btn--quiet shrink-0 self-start sm:self-auto"
              >
                Change Password
              </button>
            </div>
          </section>
        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div className="cd-span-5 flex flex-col gap-[var(--space-lg)]">
          {/* Financial Settings */}
          <section className="cd-panel">
            <div className="cd-panel__head">
              <h2 className="cd-h2">Financial Settings</h2>
            </div>
            <div className="cd-panel__body">
              <label className="cd-field">
                <span className="cd-label">Average Job Value ($)</span>
                <input
                  type="number"
                  name="avgJobValue"
                  value={formData.avgJobValue}
                  onChange={handleInputChange}
                  placeholder="e.g. 1200"
                  className="cd-input cd-num"
                />
              </label>
            </div>
          </section>

          {/* Operating Schedule */}
          <section className="cd-panel">
            <div className="cd-panel__head">
              <h2 className="cd-h2">Operating Schedule</h2>
            </div>

            <div className="cd-panel__body flex flex-col gap-4">
              {/* TIME ZONE DROPDOWN (UPDATED WITH GMT) */}
              <label className="cd-field">
                <span className="cd-label">Time Zone</span>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="cd-select"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col">
                {DAYS_OF_WEEK.map((day) => {
                  const isActive = schedule[day]?.active;
                  return (
                    <div
                      key={day}
                      className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-rule py-2"
                    >
                      <div className="flex w-28 shrink-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleScheduleToggle(day)}
                          aria-pressed={Boolean(isActive)}
                          aria-label={day}
                          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${isActive ? "bg-signal" : "bg-[var(--color-muted)]"}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-paper-3 transition-transform ${isActive ? "translate-x-4" : "translate-x-0"}`}
                          />
                        </button>
                        <span className={`font-semibold ${isActive ? "text-ink" : "text-ink-2"}`}>
                          {day.substring(0, 3)}
                        </span>
                      </div>
                      {isActive ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={schedule[day]?.open || "09:00"}
                            onChange={(e) =>
                              handleTimeChange(day, "open", e.target.value)
                            }
                            aria-label={`${day} open`}
                            className="cd-input cd-num w-[8.5rem] min-h-[var(--control-h-sm)]"
                          />
                          <span className="cd-meta">to</span>
                          <input
                            type="time"
                            value={schedule[day]?.close || "17:00"}
                            onChange={(e) =>
                              handleTimeChange(day, "close", e.target.value)
                            }
                            aria-label={`${day} close`}
                            className="cd-input cd-num w-[8.5rem] min-h-[var(--control-h-sm)]"
                          />
                        </div>
                      ) : (
                        <span className="cd-badge">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Toast Notification */}
      <div
        role="status"
        aria-live="polite"
        className={`cd-toast transition-opacity ${toast.show ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {toast.type === "error" ? (
          <CircleAlert aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
        ) : (
          <CircleCheck aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-[length:var(--text-2xs)] font-semibold">
            System Update
          </p>
          <p className="font-medium">{toast.message}</p>
        </div>
      </div>
    </div>
  );
}
