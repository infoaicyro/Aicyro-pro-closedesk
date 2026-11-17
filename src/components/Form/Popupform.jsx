"use client";

import React, { useEffect, useState } from "react";
import {
  submitFoundingApplication,
  submitFoundingSegmentation,
} from "@/lib/foundingApplicationClient";
import { CheckCircle2, ArrowRight, X, Sparkles, Building2, Globe, Phone, Mail, User } from "lucide-react";

export default function Popupform({ isOpen, onClose }) {
  const [mounted, setMounted] = useState(false);

  // 1. Step & State Management
  const [step, setStep] = useState(1); // 1: Main form, 2: Segmentation, 3: Final Success
  const [formData, setFormData] = useState({
    name: "",
    business: "",
    website: "",
    phone: "",
    email: "",
    industry: "",
  });
  const [segmentationAnswer, setSegmentationAnswer] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Store the Firebase reference generated in Step 1 to update it in Step 2
  const [dbRef, setDbRef] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Reset state when opened
      setStep(1);
      setErrors({});
      setSubmitError("");
      setSegmentationAnswer("");
      setDbRef(null);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
    // Clear error for field when user starts typing
    if (errors[e.target.id]) {
      setErrors((prev) => ({ ...prev, [e.target.id]: false }));
    }
    setSubmitError("");
  };

  // Auto-prefix https:// on blur
  const handleWebsiteBlur = (e) => {
    let val = e.target.value.trim();
    if (val && !/^https?:\/\//i.test(val)) {
      val = "https://" + val;
      setFormData((prev) => ({ ...prev, website: val }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    if (!formData.name.trim()) newErrors.name = true;
    if (!formData.business.trim()) newErrors.business = true;
    if (!formData.website.trim()) newErrors.website = true;
    if (!formData.phone.trim()) newErrors.phone = true;
    if (!formData.industry) newErrors.industry = true;
    if (!formData.email.trim() || !emailRegex.test(formData.email)) {
      newErrors.email = true;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 2. Main Form Submit (Saves to Firebase)
  const handleMainSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const reference = await submitFoundingApplication(formData, "desktop_modal");

      // Save the server reference to append segmentation in step 2
      setDbRef(reference);
      setIsSubmitting(false);
      setStep(2);
    } catch (err) {
      console.error("Firebase submit error:", err);
      setIsSubmitting(false);
      setSubmitError("Could not submit your application. Please check connection and try again.");
    }
  };

  // 3. Segmentation Form Submit (Appends to Firebase record)
  const handleSegmentationSubmit = async (e) => {
    e.preventDefault();
    if (!dbRef) {
      setStep(3);
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await submitFoundingSegmentation(dbRef, segmentationAnswer);

      setIsSubmitting(false);
      setStep(3);
    } catch (err) {
      console.error("Firebase update error:", err);
      setIsSubmitting(false);
      // Still allow them to see success
      setStep(3);
    }
  };

  if (!isOpen || !mounted) return null;

  const inputClass = (fieldId) =>
    `w-full bg-[var(--background)] border ${
      errors[fieldId] ? "border-[var(--logo-politico-red)]" : "border-[var(--border-color)]"
    } rounded-xl text-[var(--foreground)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors duration-150 placeholder:text-[var(--foreground-muted)]/70`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div className="relative w-full max-w-xl bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-sm z-10 overflow-hidden my-auto transition-transform duration-200">
        
        {/* Top Accent Strip */}
        <div className="h-1.5 w-full bg-[var(--primary)]" />

        {/* Modal Header & Close Button */}
        <div className="p-6 sm:p-8">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] border border-transparent hover:border-[var(--border-color)] transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--primary)]"
            aria-label="Close modal"
          >
            <X size={18} aria-hidden="true" />
          </button>

          {/* STEP 1: Main Application */}
          {step === 1 && (
            <div>
              <div className="mb-6 pr-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--background)] border border-[var(--border-color)] mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" aria-hidden="true" />
                  <span className="text-xs font-semibold text-[var(--foreground)]">
                    Founding 25 Launch Program
                  </span>
                </div>
                <h2
                  id="modal-title"
                  className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] tracking-tight leading-tight mb-2"
                >
                  Claim a Founding 25 Spot
                </h2>
                <p className="text-xs sm:text-sm text-[var(--foreground-muted)] leading-relaxed">
                  We are opening CloseDesk to the first 25 field-service businesses. Done-for-you setup, locked-in founder pricing, and 60-day direct optimization.
                </p>
              </div>

              {/* Inclusions Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6 p-4 rounded-xl bg-[var(--background)] border border-[var(--border-color)]">
                {[
                  "Done-for-you turnkey setup",
                  "Custom trade-specific AI flow",
                  "Lead capture and triage (< 1.2s)",
                  "Technician calendar sync",
                  "Full desk telemetry access",
                  "60-day performance warranty",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-medium text-[var(--foreground)]">
                    <CheckCircle2 size={14} className="text-[var(--primary)] shrink-0" aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Form Fields */}
              <form onSubmit={handleMainSubmit} className="space-y-3.5" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="name" className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g. John Miller"
                      className={inputClass("name")}
                    />
                  </div>
                  <div>
                    <label htmlFor="business" className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
                      Business Name
                    </label>
                    <input
                      type="text"
                      id="business"
                      value={formData.business}
                      onChange={handleChange}
                      placeholder="e.g. Miller Plumbing & HVAC"
                      className={inputClass("business")}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="website" className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    id="website"
                    value={formData.website}
                    onChange={handleChange}
                    onBlur={handleWebsiteBlur}
                    placeholder="https://example.com"
                    className={inputClass("website")}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="phone" className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="(555) 000-0000"
                      className={inputClass("phone")}
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
                      Work Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="john@example.com"
                      className={inputClass("email")}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="industry" className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
                    Primary Service Trade
                  </label>
                  <select
                    id="industry"
                    value={formData.industry}
                    onChange={handleChange}
                    className={`${inputClass("industry")} cursor-pointer`}
                  >
                    <option value="" disabled>Select your trade…</option>
                    <option value="hvac">HVAC</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="restoration">Restoration & Water Mitigation</option>
                    <option value="roofing">Roofing</option>
                    <option value="pest-control">Pest Control</option>
                    <option value="electrical">Electrical</option>
                    <option value="appliance">Appliance Repair</option>
                    <option value="other">Other Field Service</option>
                  </select>
                </div>

                {submitError && (
                  <p className="text-xs font-semibold text-[var(--logo-politico-red)] pt-1">
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[var(--primary)] hover:bg-[var(--secondary)] text-[var(--color-accent-ink)] font-bold rounded-xl shadow-xs transition-colors duration-150 motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 text-base cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
                >
                  <span>{isSubmitting ? "Submitting Application..." : "Claim a Founding 25 Spot"}</span>
                  <ArrowRight size={17} className="shrink-0" aria-hidden="true" />
                </button>
              </form>
            </div>
          )}

          {/* STEP 2: Segmentation Question */}
          {step === 2 && (
            <div className="py-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-semibold mb-3">
                <Sparkles size={13} aria-hidden="true" />
                <span>Step 2 of 2: Customization</span>
              </div>
              <h2 className="text-2xl font-bold text-[var(--foreground)] tracking-tight mb-2">
                Almost done! What is your biggest lead challenge?
              </h2>
              <p className="text-xs sm:text-sm text-[var(--foreground-muted)] mb-5 leading-relaxed">
                Tell us what you want more of from your website so we can configure your live desk prototype before our review call.
              </p>

              <form onSubmit={handleSegmentationSubmit} className="space-y-4">
                <textarea
                  required
                  rows={4}
                  value={segmentationAnswer}
                  onChange={(e) => {
                    setSegmentationAnswer(e.target.value);
                    setSubmitError("");
                  }}
                  placeholder="e.g. Capturing after-hours emergencies, pre-qualifying homeowners before driving out, cutting callback lag..."
                  className="w-full bg-[var(--background)] border border-[var(--border-color)] rounded-xl text-[var(--foreground)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors duration-150 placeholder:text-[var(--foreground-muted)]/70 resize-none"
                />

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[var(--primary)] hover:bg-[var(--secondary)] text-[var(--color-accent-ink)] font-bold rounded-xl shadow-xs transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
                  >
                    <span>{isSubmitting ? "Saving Preferences..." : "Complete Application"}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-4 py-3.5 text-xs font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-150 cursor-pointer"
                  >
                    Skip
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 3: Success Confirmation */}
          {step === 3 && (
            <div className="py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={30} aria-hidden="true" />
              </div>

              <h2 className="text-2xl font-bold text-[var(--foreground)] tracking-tight mb-2">
                Founding Spot Application Received
              </h2>

              <p className="text-xs sm:text-sm text-[var(--foreground-muted)] mb-6 max-w-sm mx-auto leading-relaxed">
                Thank you for applying. We are currently verifying the 25 cohort openings. Our team will review your website and reach out via email within 24 hours.
              </p>

              <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border-color)] text-xs text-[var(--foreground-muted)] text-left mb-6 space-y-1.5">
                <div className="font-semibold text-[var(--foreground)]">Next Steps:</div>
                <div>1. We run an automated lead flow audit on your site URL.</div>
                <div>2. We configure a live demo booking desk for your trade.</div>
                <div>3. You receive an invitation link to review your desk.</div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-[var(--card-bg)] hover:bg-[var(--background)] text-[var(--foreground)] font-semibold rounded-xl border border-[var(--border-color)] transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                Close Window
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
