"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, CircleAlert, CircleCheck, Lock } from "lucide-react";
// IMPORTANT: Import Realtime Database methods
import { db } from "../../../lib/firebase";
import { ref, get, update } from "firebase/database";

export default function PasswordChange({ onNavigate }) {
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });
  const [currentUser, setCurrentUser] = useState(null);

  // Retrieve the logged-in user's name when the component mounts
  useEffect(() => {
    // Make sure this matches exactly how your LoginScreen saves the user state
    const savedUser = localStorage.getItem("loggedInUser");
    if (savedUser) {
      setCurrentUser(savedUser);
    } else {
      // Fallback for testing if localStorage isn't set
      setCurrentUser("admin");
    }
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(
      () => setToast({ show: false, message: "", type: "success" }),
      3500,
    );
  };

  const handleInputChange = (e) => {
    setPasswords((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();

    // 1. Basic Frontend Validation
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      showToast("Please fill in all fields.", "error");
      return;
    }
    if (passwords.new !== passwords.confirm) {
      showToast("New passwords do not match.", "error");
      return;
    }
    if (passwords.new.length < 4) {
      showToast("Password must be at least 4 characters.", "error");
      return;
    }

    setIsSaving(true);

    try {
      // Server-side password update & session rotation (CD02)
      const token = localStorage.getItem("cd_session_token");
      const response = await fetch("/api/user/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest",
          ...(token ? { "x-cd-session": token } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.new,
          confirmPassword: passwords.confirm,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.token) {
          localStorage.setItem("cd_session_token", data.token);
        }
        showToast("Password updated successfully!", "success");
        setPasswords({ current: "", new: "", confirm: "" });

        setTimeout(() => {
          if (onNavigate) onNavigate("business_profile");
        }, 1500);
      } else {
        showToast(data.error || "Failed to update password.", "error");
      }
    } catch (error) {
      console.error("Password update error:", error);
      showToast(
        "Failed to update password. Check console for details.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="cd-page">
      <div className="cd-page__head">
        <div>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate("business_profile")}
            className="cd-btn cd-btn--ghost cd-btn--sm -ml-2 mb-2"
          >
            <ArrowLeft aria-hidden="true" />
            Back to Profile
          </button>
          <h1 className="cd-h1">Change Password</h1>
          <p className="cd-sub">
            Update credentials for user:{" "}
            <span className="font-semibold text-ink">{currentUser}</span>
          </p>
        </div>
      </div>

      <form
        onSubmit={handleUpdatePassword}
        className="cd-panel w-full max-w-[40rem]"
      >
        <div className="cd-panel__body flex flex-col gap-5">
          <label className="cd-field">
            <span className="cd-label">Current Password</span>
            <input
              type="password"
              name="current"
              value={passwords.current}
              onChange={handleInputChange}
              placeholder="Enter current password"
              className="cd-input"
            />
          </label>

          <hr className="cd-divider" />

          <div className="cd-grid">
            <label className="cd-field cd-span-6">
              <span className="cd-label">New Password</span>
              <input
                type="password"
                name="new"
                value={passwords.new}
                onChange={handleInputChange}
                placeholder="Enter new password"
                className="cd-input"
              />
            </label>

            <label className="cd-field cd-span-6">
              <span className="cd-label">Confirm New Password</span>
              <input
                type="password"
                name="confirm"
                value={passwords.confirm}
                onChange={handleInputChange}
                placeholder="Re-enter new password"
                className="cd-input"
              />
            </label>
          </div>
        </div>

        <div className="cd-panel__foot">
          <button
            type="submit"
            disabled={isSaving}
            aria-busy={isSaving}
            className="cd-btn"
          >
            {isSaving ? (
              <span className="cd-spinner keep-motion" aria-hidden="true" />
            ) : (
              <Lock aria-hidden="true" />
            )}
            Update Database Password
          </button>
        </div>
      </form>

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
            Security Notice
          </p>
          <p className="font-medium">{toast.message}</p>
        </div>
      </div>
    </div>
  );
}
