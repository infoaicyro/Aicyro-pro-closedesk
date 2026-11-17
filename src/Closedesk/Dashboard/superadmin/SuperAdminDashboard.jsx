// src/Closedesk/Dashboard/superadmin/SuperAdminDashboard.jsx
"use client";

import React, { useState } from "react";
import { ChevronDown, LogOut, Menu, Settings, Shield, Users, X } from "lucide-react";
import ClientManagement from "./ClientManagement";
import SuperAdminAppearance from "./Settings/SuperAdminAppearance";
import SuperAdminEmailProtocol from "./Settings/SuperAdminEmailProtocol";

export default function SuperAdminDashboard({ onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState("clients");
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  const handleNavClick = (view) => {
    setActiveView(view);
    setIsSidebarOpen(false);

    if (view === "appearance" || view === "email_protocol") {
      setIsSettingsExpanded(true);
    }
  };

  const isSettingsActive = activeView === "appearance" || activeView === "email_protocol";

  return (
    <div className="cd-app">
      <div className="cd-shell">
        <div
          className={`cd-scrim ${isSidebarOpen ? "is-open" : ""}`}
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />

        <aside className={`cd-side ${isSidebarOpen ? "is-open" : ""}`} aria-label="Super admin navigation">
          <div className="cd-side__brand">
            <span className="cd-side__mark grid place-items-center bg-paper-2 text-ink">
              <Shield aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="cd-wordmark">System Admin</span>
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
            <p className="cd-side__heading">Global Management</p>

            <button
              type="button"
              onClick={() => handleNavClick("clients")}
              className="cd-nav-item"
              aria-current={activeView === "clients" ? "page" : undefined}
            >
              <Users aria-hidden="true" />
              Clients
            </button>

            <div>
              <button
                type="button"
                onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
                className="cd-nav-item"
                aria-expanded={isSettingsExpanded}
                aria-controls="cd-sa-nav-settings"
              >
                <Settings aria-hidden="true" />
                <span className={isSettingsActive ? "font-semibold text-ink" : undefined}>Settings</span>
                <ChevronDown aria-hidden="true" className="cd-nav-item__chev" />
              </button>
              {isSettingsExpanded && (
                <div id="cd-sa-nav-settings" className="cd-nav-sub">
                  <button
                    type="button"
                    onClick={() => handleNavClick("email_protocol")}
                    className="cd-nav-item cd-nav-item--sub"
                    aria-current={activeView === "email_protocol" ? "page" : undefined}
                  >
                    Notifications Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavClick("appearance")}
                    className="cd-nav-item cd-nav-item--sub"
                    aria-current={activeView === "appearance" ? "page" : undefined}
                  >
                    Appearance
                  </button>
                </div>
              )}
            </div>
          </nav>

          <div className="cd-side__foot">
            <button type="button" onClick={onLogout} className="cd-nav-item cd-nav-item--danger">
              <LogOut aria-hidden="true" />
              End Session
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
            <p className="cd-top__title">Super Admin Console</p>
            <div className="cd-top__actions">
              <p className="cd-meta">Viewing: {activeView.replace("_", " ")}</p>
            </div>
          </header>

          <main id="main" className="flex-grow">
            {activeView === "clients" ? (
              <ClientManagement />
            ) : activeView === "appearance" ? (
              <SuperAdminAppearance />
            ) : activeView === "email_protocol" ? (
              <SuperAdminEmailProtocol />
            ) : (
              <div className="cd-page">
                <section className="cd-panel">
                  <div className="cd-empty">
                    <h2 className="cd-empty__title">
                      {activeView.replace("_", " ")} Under Construction
                    </h2>
                    <p>Check back later.</p>
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
