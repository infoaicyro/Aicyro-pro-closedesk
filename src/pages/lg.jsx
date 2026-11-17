// src/pages/lg.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { ref, onValue, get } from "firebase/database";
import {
  Activity,
  Users,
  CalendarCheck,
  ChartLine,
  Cookie,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";

import LoginScreen from "../Closedesk/Dashboard/LoginScreen";
import SuperAdminLoginScreen from "../Closedesk/Dashboard/superadmin/superadminlogin";
import SuperAdminDashboard from "../Closedesk/Dashboard/superadmin/SuperAdminDashboard";

import HomeScreen from "../Closedesk/Dashboard/HomeScreen";
import TerminalScreen from "../Closedesk/Dashboard/TerminalScreen";
import BookingsScreen from "../Closedesk/Dashboard/Booking";
import Insight from "@/Closedesk/Dashboard/Insight";
import Conversations from "../Closedesk/Dashboard/Conversations";
import Report from "../Closedesk/Dashboard/Report";

import PasswordChange from "../Closedesk/Dashboard/Settings/PasswordChange";
import BusinessProfile from "../Closedesk/Dashboard/Settings/BusinessProfile";
import ChatbotSettings from "../Closedesk/Dashboard/Settings/Chatbotsetting";
import NotificationSettings from "../Closedesk/Dashboard/Settings/notification-settings";
import Apearance from "../Closedesk/Dashboard/Settings/apearance";

import LiveNotifications from "../Closedesk/Dashboard/LiveNotifications";
import CookieDataDisplay from "../Closedesk/Dashboard/CookieDataDisplay";

// Implement the new Website Logger
import { createWebsiteLogger } from "../lib/loggerPresets";
const logger = createWebsiteLogger("DashboardLayout");

// --- THEME HUES FOR GLOBAL CSS CALCULATION ---
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

const mockNotifications = [
  {
    id: 1,
    title: "Urgent Lead Captured",
    message: "John Doe requested a demo.",
    time: "5m ago",
    unread: true,
  },
  {
    id: 2,
    title: "Chatbot Alert",
    message: "A visitor asked to speak with a human.",
    time: "1h ago",
    unread: true,
  },
  {
    id: 3,
    title: "Weekly Summary",
    message: "Your Pulse performance report is ready.",
    time: "1d ago",
    unread: false,
  },
];

export default function LeadsDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginView, setLoginView] = useState("user"); // 'user' or 'superadmin'
  const [currentView, setCurrentView] = useState("home");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarBrandName, setSidebarBrandName] = useState("Aicyro Pulse");
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  // =========================================================================
  // --- TERMINATE SESSION ON PAGE RELOAD ---
  // =========================================================================
  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.removeItem("currentUser");
      localStorage.removeItem("currentSuperAdmin");
      localStorage.removeItem("currentTenant");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // --- FETCH BUSINESS NAME FROM FIREBASE ---
  useEffect(() => {
    if (isAuthenticated) {
      const brandRef = ref(
        db,
        "settings/business_profile/basic_info/businessName",
      );
      const unsubscribe = onValue(brandRef, (snapshot) => {
        if (snapshot.exists() && snapshot.val().trim() !== "") {
          setSidebarBrandName(snapshot.val());
        } else {
          setSidebarBrandName("Aicyro Pulse");
        }
      });
      return () => unsubscribe();
    }
  }, [isAuthenticated]);

  // --- GLOBAL THEME INITIALIZATION ---
  useEffect(() => {
    const applyGlobalTheme = async () => {
      const superAdminName = localStorage.getItem("currentSuperAdmin");
      const standardUserName = localStorage.getItem("currentUser");
      const activeUser = superAdminName || standardUserName;

      if (!activeUser || !isAuthenticated) {
        const fallbackTheme = localStorage.getItem("theme") || "light";
        document.documentElement.setAttribute("data-theme", fallbackTheme);
        return;
      }

      try {
        const themePath = superAdminName
          ? `superAdminSettings/${activeUser}/appearance`
          : `users/${activeUser}/appearance`;

        const appearanceRef = ref(db, themePath);
        const snapshot = await get(appearanceRef);

        if (snapshot.exists()) {
          const {
            mode = "system",
            hue = "default",
            shade = 500,
          } = snapshot.val();
          let resolvedMode = mode;
          if (resolvedMode === "system") {
            resolvedMode = window.matchMedia("(prefers-color-scheme: dark)")
              .matches
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

          const baseColor =
            THEME_HUES.find((h) => h.id === hue)?.color || "#8a2be2";
          let adjustedPrimary = baseColor;
          let adjustedSecondary = baseColor;

          if (shade !== 500) {
            const isDark = shade > 500;
            const intensity = Math.abs(shade - 500) / 450;
            if (isDark) {
              const mixPercent = intensity * 70;
              adjustedPrimary = `color-mix(in srgb, black ${mixPercent}%, ${baseColor})`;
              adjustedSecondary = `color-mix(in srgb, black ${Math.min(100, mixPercent + 15)}%, ${baseColor})`;
            } else {
              const mixPercent = intensity * 85;
              adjustedPrimary = `color-mix(in srgb, white ${mixPercent}%, ${baseColor})`;
              adjustedSecondary = `color-mix(in srgb, white ${Math.max(0, mixPercent - 10)}%, ${baseColor})`;
            }
          }

          document.documentElement.style.setProperty(
            "--primary",
            adjustedPrimary,
          );
          document.documentElement.style.setProperty(
            "--secondary",
            adjustedSecondary,
          );
        } else {
          const localStorageKey = superAdminName
            ? "aicyro_appearance_superadmin"
            : "aicyro_appearance";
          const localSettings = JSON.parse(
            localStorage.getItem(localStorageKey),
          );
          if (localSettings) {
            let resMode =
              localSettings.mode === "system"
                ? window.matchMedia("(prefers-color-scheme: dark)").matches
                  ? "dark"
                  : "light"
                : localSettings.mode;
            const tStr =
              localSettings.hue === "default"
                ? resMode
                : `${localSettings.hue}-${resMode}`;
            document.documentElement.setAttribute("data-theme", tStr);
          } else {
            document.documentElement.setAttribute("data-theme", "light");
          }
        }
      } catch (error) {
        logger.error("theme", "load_failed", { error });
      }
    };

    applyGlobalTheme();
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleOsChange = () => applyGlobalTheme();
    mediaQuery.addEventListener("change", handleOsChange);
    return () => mediaQuery.removeEventListener("change", handleOsChange);
  }, [isAuthenticated]);

  const handleNavClick = (view) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
    if (
      [
        "business_profile",
        "chatbot_settings",
        "notification_settings",
        "apearance",
      ].includes(view)
    ) {
      setIsSettingsExpanded(true);
    }
  };

  const handleLogout = async () => {
    try {
      const isSuperAdmin = Boolean(localStorage.getItem("currentSuperAdmin"));
      const logoutEndpoint = isSuperAdmin ? "/api/superadmin/logout" : "/api/logout";
      const token = localStorage.getItem("cd_session_token");
      await fetch(logoutEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest",
          ...(token ? { "x-cd-session": token } : {}),
        },
        credentials: "include",
      });
    } catch (e) {
      console.warn("Logout notification failed:", e);
    }
    setIsAuthenticated(false);
    setIsSidebarOpen(false);
    setLoginView("user");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("currentSuperAdmin");
    localStorage.removeItem("currentTenant");
    localStorage.removeItem("cd_session_token");
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.removeProperty("--primary");
    document.documentElement.style.removeProperty("--secondary");
  };

  // 1. Check Super Admin Login State
  const isSuperAdminLoggedIn =
    typeof window !== "undefined" &&
    localStorage.getItem("currentSuperAdmin") !== null;

  // 2. Handle Unauthenticated Views
  if (!isAuthenticated) {
    if (loginView === "superadmin") {
      return (
        <SuperAdminLoginScreen
          onLoginSuccess={() => setIsAuthenticated(true)}
          onNavigateToUserLogin={() => {
            localStorage.removeItem("currentSuperAdmin");
            setLoginView("user");
          }}
        />
      );
    }
    return (
      <LoginScreen
        onLoginSuccess={() => setIsAuthenticated(true)}
        onNavigateToSuperAdmin={() => {
          localStorage.removeItem("currentUser");
          localStorage.removeItem("currentTenant");
          setLoginView("superadmin");
        }}
      />
    );
  }

  // 3. Handle Authenticated Super Admin View (Strictly gated by loginView and superadmin session)
  if (isSuperAdminLoggedIn && loginView === "superadmin") {
    return <SuperAdminDashboard onLogout={handleLogout} />;
  }

  // 4. Handle Authenticated Standard User View
  const getHeaderTitle = () => {
    const titles = {
      home: "Pulse Overview",
      terminal: "Leads Terminal",
      bookings: "Bookings",
      insight: "Insight Overview",
      cookie_data: "Visitor Cookie Data",
      conversations: "Conversations",
      reports: "Reports",
      business_profile: "Business Profile",
      chatbot_settings: "Chatbot Settings",
      apearance: "Appearance Settings",
      notification_settings: "Notification Settings",
      password_change: "Account Security",
    };
    return titles[currentView] || "Dashboard";
  };

  // Flat main menu, in this order; Insight opens the Insight Overview directly
  const mainNav = [
    { view: "home", label: "Pulse", Icon: Activity },
    { view: "cookie_data", label: "Cookie", Icon: Cookie },
    { view: "terminal", label: "Leads", Icon: Users },
    { view: "bookings", label: "Booking", Icon: CalendarCheck },
    { view: "insight", label: "Insight", Icon: ChartLine },
    { view: "reports", label: "Reports", Icon: FileText },
  ];

  const settingsNav = [
    { view: "business_profile", label: "Business Profile" },
    { view: "chatbot_settings", label: "Chatbot Configuration" },
    { view: "notification_settings", label: "Notification Settings" },
    { view: "apearance", label: "Appearance Themes" },
  ];

  const isSettingsActive = settingsNav.some((item) => item.view === currentView);

  const navProps = (view) => ({
    type: "button",
    onClick: () => handleNavClick(view),
    "aria-current": currentView === view ? "page" : undefined,
  });

  return (
    <div className="cd-app">
      <div className="cd-shell">
        <div
          className={`cd-scrim ${isSidebarOpen ? "is-open" : ""}`}
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />

        <aside className={`cd-side ${isSidebarOpen ? "is-open" : ""}`} aria-label="Dashboard navigation">
          <div className="cd-side__brand">
            <img src="/icon.png" alt="" width="28" height="28" className="cd-side__mark" />
            <span className="cd-wordmark" title={sidebarBrandName}>
              {sidebarBrandName} <span className="text-ink-2">Pulse</span>
            </span>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="cd-icon-btn cd-menu-btn ml-auto"
              aria-label="Close navigation"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <nav className="cd-side__scroll">
            <p className="cd-side__heading">Main menu</p>

            {mainNav.map(({ view, label, Icon }) => (
              <button key={view} className="cd-nav-item" {...navProps(view)}>
                <Icon aria-hidden="true" />
                {label}
              </button>
            ))}

            <p className="cd-side__heading">Workspace</p>

            <div>
              <button
                type="button"
                onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
                className="cd-nav-item"
                aria-expanded={isSettingsExpanded}
                aria-controls="cd-nav-settings"
              >
                <Settings aria-hidden="true" />
                <span className={isSettingsActive ? "font-semibold text-ink" : undefined}>Settings</span>
                <ChevronDown aria-hidden="true" className="cd-nav-item__chev" />
              </button>
              {isSettingsExpanded && (
                <div id="cd-nav-settings" className="cd-nav-sub">
                  {settingsNav.map(({ view, label }) => (
                    <button key={view} className="cd-nav-item cd-nav-item--sub" {...navProps(view)}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="cd-side__foot">
            <button type="button" onClick={handleLogout} className="cd-nav-item cd-nav-item--danger">
              <LogOut aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </aside>

        <div className="cd-main">
          <header className="cd-top">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="cd-icon-btn cd-icon-btn--bordered cd-menu-btn"
              aria-label="Open navigation"
              aria-expanded={isSidebarOpen}
            >
              <Menu aria-hidden="true" />
            </button>
            <p className="cd-top__title">{getHeaderTitle()}</p>
            <div className="cd-top__actions">
              <LiveNotifications onNavigate={handleNavClick} />
            </div>
          </header>

          <main id="main" className="flex-grow">
            {currentView === "home" && <HomeScreen onLogout={handleLogout} />}
            {currentView === "terminal" && (
              <TerminalScreen onLogout={handleLogout} />
            )}
            {currentView === "bookings" && (
              <BookingsScreen onLogout={handleLogout} />
            )}
            {currentView === "insight" && <Insight onLogout={handleLogout} />}
            {currentView === "cookie_data" && <CookieDataDisplay />}
            {currentView === "reports" && <Report onLogout={handleLogout} />}
            {currentView === "business_profile" && (
              <BusinessProfile onNavigate={handleNavClick} />
            )}
            {currentView === "apearance" && <Apearance />}
            {currentView === "chatbot_settings" && <ChatbotSettings />}
            {currentView === "notification_settings" && <NotificationSettings />}
            {currentView === "password_change" && (
              <PasswordChange onNavigate={handleNavClick} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
