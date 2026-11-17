"use client";

import React, { useEffect, useState } from "react";
import { ref, onValue, remove, update } from "firebase/database";
import { db } from "../../lib/firebase";
import {
  Archive,
  ArchiveRestore,
  CircleCheck,
  ExternalLink,
  Funnel,
  Info,
  Link2,
  MapPin,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";

import CookieMap from "./cookie/CookieMap";
import CookieGrid from "./cookie/CookieGrid";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const getRelativeTime = (timestamp, now) => {
  const diffInSeconds = Math.floor((now - new Date(timestamp).getTime()) / 1000);
  if (diffInSeconds < 30) return "Just now";
  if (diffInSeconds < 60) return `${diffInSeconds} sec ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hr ago`;
  return new Date(timestamp).toLocaleDateString();
};

export default function CookieDataDisplay() {
  const [cookies, setCookies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [viewMode, setViewMode] = useState("active");

  const [selectedCookies, setSelectedCookies] = useState([]);
  const [activeMapMarker, setActiveMapMarker] = useState(null); 
  
  const [toast, setToast] = useState({ visible: false, message: "", type: "info" });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: "", message: "", onConfirm: null, confirmText: "Confirm", confirmColor: "cd-btn" });

  const [filters, setFilters] = useState({ device: "All", region: "All", language: "All", location: "All" });
  const [searchQuery, setSearchQuery] = useState(""); // Search state added here

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const getCookieDbPath = (subId = "") => {
    const tenantId = typeof window !== "undefined" ? (localStorage.getItem("currentTenant") || "default") : "default";
    const basePath = tenantId && tenantId !== "default" ? `tenants/${tenantId}/user_cookies` : "user_cookies";
    return subId ? `${basePath}/${subId}` : basePath;
  };

  useEffect(() => {
    const cookiesRef = ref(db, getCookieDbPath());

    const unsubscribe = onValue(
      cookiesRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const currentTime = Date.now();
          const validData = [];
          Object.keys(data).forEach((key) => {
            const item = data[key];
            if (item.isArchived && item.archivedAt) {
              const archiveTime = new Date(item.archivedAt).getTime();
              if (currentTime - archiveTime >= THIRTY_DAYS_MS) {
                remove(ref(db, getCookieDbPath(key))).catch(console.error);
                return;
              }
            }
            validData.push({ id: key, ...item });
          });

          const formattedData = validData.sort((a, b) => {
            const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return timeB - timeA;
          });
          setCookies(formattedData);
        } else {
          setCookies([]);
        }
        setLoading(false);
      },
      (err) => {
        console.warn("RTDB direct cookie read restricted, falling back to server-mediated API:", err);
        const storedTenant = typeof window !== "undefined" ? localStorage.getItem("currentTenant") : null;
        fetch("/api/cookie-consent", {
          headers: storedTenant && storedTenant !== "default" ? { "x-tenant-id": storedTenant } : {},
        })
          .then((r) => r.json())
          .then((res) => {
            if (res && res.cookies) {
              const items = Object.entries(res.cookies).map(([id, val]) => ({ id, ...val }));
              setCookies(items);
            }
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      }
    );

    return () => unsubscribe();
  }, []);

  const activeCookies = cookies.filter((c) => !c.isArchived);
  const archivedCookies = cookies.filter((c) => c.isArchived);
  let displayCookies = viewMode === "active" ? activeCookies : archivedCookies;

  // --- Apply Dropdown Filters ---
  if (filters.device !== "All") displayCookies = displayCookies.filter((c) => c.deviceName === filters.device);
  if (filters.region !== "All") displayCookies = displayCookies.filter((c) => c.timeZone === filters.region);
  if (filters.language !== "All") displayCookies = displayCookies.filter((c) => c.language === filters.language);
  if (filters.location !== "All") {
    displayCookies = displayCookies.filter((c) => {
      if (filters.location === "Captured") return c.location?.status === "allowed" && c.location?.lat;
      if (filters.location === "Denied") return c.location?.status === "rejected";
      if (filters.location === "Unsupported") return !c.location || c.location?.status === "unsupported";
      return true;
    });
  }

  // --- Apply Search Text Filter ---
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    displayCookies = displayCookies.filter((cookie) => {
      const nameMatch = cookie.username?.toLowerCase().includes(query);
      const regionMatch = cookie.timeZone?.toLowerCase().includes(query);
      const ipMatch = cookie.ipAddress?.toLowerCase().includes(query);
      const cityMatch = cookie.ipLocation?.city?.toLowerCase().includes(query);
      const countryMatch = cookie.ipLocation?.country?.toLowerCase().includes(query);
      return nameMatch || regionMatch || ipMatch || cityMatch || countryMatch;
    });
  }

  const mappedCookies = displayCookies.filter(
    (c) =>
      c.location?.status === "allowed" &&
      c.location?.lat != null &&
      c.location?.lng != null &&
      !isNaN(Number(c.location.lat)) &&
      !isNaN(Number(c.location.lng)),
  );

  const showToast = (message, type = "info") => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 4000);
  };

  const uniqueDevices = [...new Set(cookies.map((c) => c.deviceName).filter(Boolean))];
  const uniqueRegions = [...new Set(cookies.map((c) => c.timeZone).filter(Boolean))];
  const uniqueLanguages = [...new Set(cookies.map((c) => c.language).filter(Boolean))];

  useEffect(() => {
    if (viewMode === "archived" && archivedCookies.length === 0 && !loading) {
      setViewMode("active");
      setSelectedCookies([]);
    }
  }, [archivedCookies.length, viewMode, loading]);

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === "active" ? "archived" : "active"));
    setSelectedCookies([]);
    setActiveMapMarker(null);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setSelectedCookies([]);
    setActiveMapMarker(null);
  };

  const clearFilters = () => {
    setFilters({ device: "All", region: "All", language: "All", location: "All" });
    setSearchQuery(""); // Clear search query as well
    setSelectedCookies([]);
    setActiveMapMarker(null);
  };

  const toggleSelection = (id) => {
    setSelectedCookies((prev) => prev.includes(id) ? prev.filter((cookieId) => cookieId !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedCookies.length === displayCookies.length && displayCookies.length > 0) {
      setSelectedCookies([]);
    } else {
      setSelectedCookies(displayCookies.map((c) => c.id));
    }
  };

  const handleArchiveSelected = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Archive Sessions",
      message: `Are you sure you want to archive ${selectedCookies.length} session(s)?\n\nNote: Archived data will be permanently and automatically deleted after 30 days.`,
      confirmText: "Archive",
      confirmColor: "cd-btn",
      onConfirm: async () => {
        try {
          const archivePromises = selectedCookies.map((id) =>
            update(ref(db, getCookieDbPath(id)), { isArchived: true, archivedAt: new Date().toISOString() })
          );
          await Promise.all(archivePromises);
          showToast(`Successfully archived ${selectedCookies.length} sessions.`, "success");
          setSelectedCookies([]);
        } catch (error) {
          console.error("Failed to archive cookies: ", error);
          showToast("Failed to archive selected sessions.", "error");
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      },
    });
  };

  const handleRestoreSelected = async () => {
    try {
      const restorePromises = selectedCookies.map((id) =>
        update(ref(db, getCookieDbPath(id)), { isArchived: false, archivedAt: null })
      );
      await Promise.all(restorePromises);
      showToast(`Restored ${selectedCookies.length} sessions.`, "success");
      setSelectedCookies([]);
    } catch (error) {
      console.error("Failed to restore cookies: ", error);
      showToast("Failed to restore selected sessions.", "error");
    }
  };

  const handleDeleteSelected = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Sessions Permanently",
      message: `Are you sure you want to completely delete ${selectedCookies.length} session(s)?\n\nThis action cannot be undone.`,
      confirmText: "Delete",
      confirmColor: "cd-btn cd-btn--danger",
      onConfirm: async () => {
        try {
          const deletePromises = selectedCookies.map((id) => remove(ref(db, getCookieDbPath(id))));
          await Promise.all(deletePromises);
          showToast(`Deleted ${selectedCookies.length} sessions.`, "success");
          setSelectedCookies([]);
        } catch (error) {
          console.error("Failed to delete cookies: ", error);
          showToast("Failed to delete selected sessions.", "error");
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      },
    });
  };

  const activeCount = displayCookies.filter(
    (c) => now - new Date(c.updatedAt).getTime() < 60000,
  ).length;

  const hasActiveFilters = Object.values(filters).some((val) => val !== "All") || searchQuery.trim() !== "";

  if (loading) {
    return (
      <div className="cd-page" aria-busy="true">
        <div className="cd-page__head">
          <div className="flex flex-col gap-2">
            <span className="cd-skel h-7 w-48" />
            <span className="cd-skel h-4 w-80 max-w-full" />
          </div>
        </div>
        <div className="cd-panel">
          <div className="cd-stats" style={{ "--cols": 3 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="cd-stat">
                <span className="cd-skel h-3 w-24" />
                <span className="cd-skel h-7 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="cd-panel overflow-hidden">
          <span className="cd-skel h-[440px] rounded-none" />
        </div>
        <div className="cd-panel">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex gap-4 border-b border-rule px-6 py-4 last:border-b-0">
              <span className="cd-skel mt-1 h-4 w-4" />
              <div className="flex flex-1 flex-col gap-3">
                <span className="cd-skel h-4 w-40" />
                <div className="grid gap-2 lg:grid-cols-2">
                  <span className="cd-skel h-3 w-full" />
                  <span className="cd-skel h-3 w-4/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const selectedPinCookie = activeMapMarker ? mappedCookies.find(c => c.id === activeMapMarker) : null;

  return (
    <div className="cd-page">
      {/* Header */}
      <div className="cd-page__head">
        <div>
          <h1 className="cd-h1">
            {viewMode === "active" ? "Visitor Data" : "Archived Sessions"}
          </h1>
          <p className="cd-sub">
            {viewMode === "active" ? "Real-time tracking of active user sessions and consent states." : "Previously saved sessions moved out of the active view."}
          </p>
        </div>

        {archivedCookies.length > 0 && (
          <button
            type="button"
            onClick={toggleViewMode}
            aria-pressed={viewMode === "archived"}
            className="cd-btn cd-btn--quiet cd-num"
          >
            {viewMode === "active" ? <Archive aria-hidden="true" /> : null}
            {viewMode === "active" ? `View Archived (${archivedCookies.length})` : "View Active Sessions"}
          </button>
        )}
      </div>

      {/* Figures, or the selected pin's detail in the same row */}
      <div className="cd-panel">
        {selectedPinCookie ? (
          <div className="cd-stats" style={{ "--cols": 3 }} aria-live="polite">
            {/* Selected Pin Data View */}
            <div className="cd-stat">
              <div className="flex items-center justify-between gap-2">
                <span className="cd-stat__label">Selected Visitor</span>
                <button type="button" onClick={() => setActiveMapMarker(null)} className="cd-btn cd-btn--ghost cd-btn--sm -my-1">Close</button>
              </div>
              <span className="cd-stat__value cd-stat__value--sm truncate" title={selectedPinCookie.username}>{selectedPinCookie.username}</span>
              <span className="cd-stat__note inline-flex min-w-0 items-center gap-1.5">
                <Link2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <span className="cd-mono truncate">{selectedPinCookie.ipAddress || "Unknown IP"}</span>
              </span>
              {selectedPinCookie.location?.lat && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedPinCookie.location.lat},${selectedPinCookie.location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cd-link inline-flex w-fit items-center gap-1.5 text-[length:var(--text-xs)]"
                >
                  <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  <span className="cd-num">{selectedPinCookie.location?.source === "gps_exact" || selectedPinCookie.location?.exactLat != null ? "GPS (exact)" : "Location"}: {Number(selectedPinCookie.location.lat).toFixed(4)}, {Number(selectedPinCookie.location.lng).toFixed(4)}</span>
                  <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
                </a>
              )}
            </div>

            <div className="cd-stat">
              <span className="cd-stat__label">Device Details</span>
              <span className="cd-stat__value cd-stat__value--sm truncate" title={selectedPinCookie.deviceName}>{selectedPinCookie.deviceName}</span>
              <span className="cd-stat__note">{selectedPinCookie.language} • {selectedPinCookie.timeZone}</span>
            </div>

            <div className="cd-stat">
              <span className="cd-stat__label">Status & Consent</span>
              <span>
                <span className={`cd-badge capitalize ${selectedPinCookie.consentStatus === 'accepted' ? "cd-badge--success" : "cd-badge--warn"}`}>
                  {selectedPinCookie.consentStatus}
                </span>
              </span>
              <span className="cd-stat__note">Active: <span className="text-ink">{getRelativeTime(selectedPinCookie.updatedAt, now)}</span></span>
            </div>
          </div>
        ) : (
          <div className="cd-stats" style={{ "--cols": 3 }}>
            {/* Global Stats View (Default) */}
            <div className="cd-stat">
              <span className="cd-stat__label">{viewMode === "active" ? "Total Sessions" : "Archived Sessions"}</span>
              <span className="cd-stat__value cd-num">{displayCookies.length}</span>
            </div>
            <div className="cd-stat">
              <span className="cd-stat__label">Active Now (60s)</span>
              <span className="cd-stat__value cd-num">{activeCount}</span>
            </div>
            <div className="cd-stat">
              <span className="cd-stat__label">Locations Tracked</span>
              <span className="cd-stat__value cd-num">{mappedCookies.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <CookieMap
        mappedCookies={mappedCookies}
        viewMode={viewMode}
        now={now}
        activeMapMarker={activeMapMarker}
        setActiveMapMarker={setActiveMapMarker}
      />

      {/* Sessions: filter toolbar, list, bulk actions */}
      <div className="cd-panel">
        {cookies.length > 0 && (
          <div className="cd-panel__head justify-start">
            <div className="flex w-full flex-wrap items-center gap-2" role="group" aria-label="Filters">
              <span className="mr-1 inline-flex shrink-0 items-center gap-1.5 text-[length:var(--text-xs)] font-semibold text-ink-2">
                <Funnel aria-hidden="true" className="h-4 w-4" />
                Filters:
              </span>

              <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
                <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" />
                <input
                  type="text"
                  aria-label="Search sessions"
                  placeholder="Search name, IP, location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="cd-input pl-8 pr-9"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-chip text-ink-2 transition-colors hover:bg-hover hover:text-ink active:bg-selected focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <select aria-label="Device" value={filters.device} onChange={(e) => handleFilterChange("device", e.target.value)} className="cd-select w-auto min-w-[9rem] flex-1 sm:flex-none"><option value="All">All Devices</option>{uniqueDevices.map((d) => (<option key={d} value={d}>{d}</option>))}</select>
              <select aria-label="Region" value={filters.region} onChange={(e) => handleFilterChange("region", e.target.value)} className="cd-select w-auto min-w-[9rem] flex-1 sm:flex-none"><option value="All">All Regions</option>{uniqueRegions.map((r) => (<option key={r} value={r}>{r}</option>))}</select>
              <select aria-label="Language" value={filters.language} onChange={(e) => handleFilterChange("language", e.target.value)} className="cd-select w-auto min-w-[9rem] flex-1 sm:flex-none"><option value="All">All Languages</option>{uniqueLanguages.map((l) => (<option key={l} value={l}>{l}</option>))}</select>
              <select aria-label="Location" value={filters.location} onChange={(e) => handleFilterChange("location", e.target.value)} className="cd-select w-auto min-w-[9rem] flex-1 sm:flex-none"><option value="All">All Locations</option><option value="Captured">Captured</option><option value="Denied">Permission Denied</option><option value="Unsupported">Unsupported</option></select>

              {hasActiveFilters && (<button type="button" onClick={clearFilters} className="cd-btn cd-btn--ghost cd-btn--sm ml-auto shrink-0">Clear Filters</button>)}
            </div>
          </div>
        )}

        {/* Session list */}
        <CookieGrid
          displayCookies={displayCookies}
          now={now}
          viewMode={viewMode}
          selectedCookies={selectedCookies}
          toggleSelection={toggleSelection}
          hasActiveFilters={hasActiveFilters}
          clearFilters={clearFilters}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onFocusMap={(id) => {
            setActiveMapMarker(id);
            const mapEl = document.getElementById("closedesk-radar-map");
            if (mapEl) {
              mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }}
        />

        {/* Action Toolbar: sticks to the bottom of the viewport while the list scrolls */}
        {selectedCookies.length > 0 && (
          <div
            role="region"
            aria-label="Bulk actions"
            className="cd-panel__foot sticky bottom-0 z-[var(--z-sticky)] justify-start rounded-b-panel bg-paper-3"
          >
            <span className="cd-num mr-2 whitespace-nowrap text-[length:var(--text-xs)] font-semibold text-ink">
              {selectedCookies.length} Selected
            </span>
            <button type="button" onClick={handleSelectAll} className="cd-btn cd-btn--ghost cd-btn--sm">
              {selectedCookies.length === displayCookies.length ? "Deselect All" : "Select All"}
            </button>
            {viewMode === "active" ? (
              <button type="button" onClick={handleArchiveSelected} className="cd-btn cd-btn--quiet cd-btn--sm"><Archive aria-hidden="true" />Archive</button>
            ) : (
              <button type="button" onClick={handleRestoreSelected} className="cd-btn cd-btn--quiet cd-btn--sm"><ArchiveRestore aria-hidden="true" />Restore</button>
            )}
            <button type="button" onClick={handleDeleteSelected} className="cd-btn cd-btn--danger cd-btn--sm"><Trash2 aria-hidden="true" />Delete</button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="cd-overlay">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-confirm-title"
            aria-describedby="cookie-confirm-message"
            className="cd-dialog w-[min(100%,26rem)]"
          >
            <div className="px-6 pb-5 pt-6">
              <h2 id="cookie-confirm-title" className="cd-h2">{confirmDialog.title}</h2>
              <p id="cookie-confirm-message" className="mt-2 whitespace-pre-line text-ink-2">{confirmDialog.message}</p>
            </div>
            <div className="cd-panel__foot">
              <button type="button" onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} className="cd-btn cd-btn--quiet">Cancel</button>
              <button type="button" onClick={confirmDialog.onConfirm} className={confirmDialog.confirmColor}>{confirmDialog.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toast.visible && (
        <div className="cd-toast" role={toast.type === "error" ? "alert" : "status"}>
          {toast.type === "error" ? (
            <TriangleAlert aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
          ) : toast.type === "success" ? (
            <CircleCheck aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
          ) : (
            <Info aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
          )}
          <span className="min-w-0">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast({ ...toast, visible: false })}
            aria-label="Dismiss"
            className="-mr-1 ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-chip opacity-70 transition-opacity hover:opacity-100 active:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
