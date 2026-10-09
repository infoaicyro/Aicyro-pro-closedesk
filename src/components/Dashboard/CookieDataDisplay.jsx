"use client";

import React, { useEffect, useState, useMemo, memo, useRef, useCallback } from "react";
import { ref, onValue, remove, update } from "firebase/database";
import { db } from "../../lib/firebase";

// Google Maps React components
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const getRelativeTime = (timestamp, now) => {
  const diffInSeconds = Math.floor((now - new Date(timestamp).getTime()) / 1000);
  if (diffInSeconds < 30) return "Just now";
  if (diffInSeconds < 60) return `${diffInSeconds} sec ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hr ago`;
  return new Date(timestamp).toLocaleDateString();
};

const getArchiveTimeLeft = (archivedAt, now) => {
  if (!archivedAt) return "Pending 30-day cycle";
  const expiryTime = new Date(archivedAt).getTime() + THIRTY_DAYS_MS;
  const diffInSeconds = Math.floor((expiryTime - now) / 1000);

  if (diffInSeconds <= 0) return "Deleting momentarily...";
  if (diffInSeconds < 60) return `${diffInSeconds} sec left`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min left`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hr left`;
  return `${Math.floor(diffInSeconds / 86400)} days left`;
};

// High-Tech Custom Marker with Sonar Radar Wave Rings
const CustomGoogleMarker = memo(({ cookie, isJustNow, isActive, onMarkerClick }) => {
  const [placeName, setPlaceName] = useState("");

  useEffect(() => {
    if (!isActive || placeName) return;
    const fetchPlaceName = async () => {
      try {
        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${cookie.location.lat}&longitude=${cookie.location.lng}&localityLanguage=en`
        );
        if (res.ok) {
          const data = await res.json();
          const city = data.city || data.locality || data.principalSubdivision || "";
          const country = data.countryName || "";
          if (city || country) setPlaceName([city, country].filter(Boolean).join(", "));
        }
      } catch (error) {
        console.error("Failed to reverse geocode for map:", error);
      }
    };
    fetchPlaceName();
  }, [isActive, cookie.location.lat, cookie.location.lng, placeName]);

  return (
    <AdvancedMarker
      position={{ lat: Number(cookie.location.lat), lng: Number(cookie.location.lng) }}
      onClick={() => onMarkerClick(cookie.id)}
      zIndex={isActive ? 100 : isJustNow ? 50 : 1}
    >
      <div className="relative flex flex-col items-center justify-center cursor-pointer select-none">
        
        {/* Multi-layered Sonar Radar Beacon Effect for Active/New Devices */}
        {isJustNow && (
          <div className="absolute top-[12px] left-[12px] -translate-x-1/2 -translate-y-1/2 pointer-events-none w-0 h-0 flex items-center justify-center">
            {/* Ambient Radial Core Glow */}
            <div className="sonar-beacon-core" />
            {/* 3 Staggered Sonar Radar Rings */}
            <div className="sonar-wave sonar-delay-1" />
            <div className="sonar-wave sonar-delay-2" />
            <div className="sonar-wave sonar-delay-3" />
          </div>
        )}

        {/* Marker Icon Pin */}
        <div className="relative group/pin transition-transform duration-200 hover:scale-125 z-10">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
              fill="var(--primary)"
              stroke="var(--background)"
              strokeWidth="1.5"
            />
          </svg>
          {isJustNow && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white dark:border-black"></span>
            </span>
          )}
        </div>

        {/* Selected Marker Detail Card */}
        {isActive && (
          <div className="absolute bottom-[34px] flex flex-col items-center pointer-events-none bg-[var(--background)]/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-2xl border border-[var(--primary)]/40 min-w-max animate-in fade-in zoom-in-95 duration-200 z-50">
            <span className="text-xs font-bold text-[var(--foreground)] tracking-wide leading-tight">{cookie.username}</span>
            <span className="text-[10px] font-semibold text-[var(--primary)] leading-tight mt-0.5">{placeName || "Fetching location..."}</span>
            <div className="w-2 h-2 bg-[var(--background)] border-r border-b border-[var(--primary)]/40 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
          </div>
        )}
      </div>
    </AdvancedMarker>
  );
});

// Country Heatmap using Google Maps GeoJSON Data Layer
const HeatmapLayer = memo(({ mappedCookies }) => {
  const map = useMap();
  const geoJsonLoaded = useRef(false);

  const { countryCounts, maxDeviceCount } = useMemo(() => {
    const counts = {};
    let max = 0;

    mappedCookies.forEach((cookie) => {
      const matchedCountryName = cookie.ipLocation?.country;
      if (matchedCountryName) {
        counts[matchedCountryName] = (counts[matchedCountryName] || 0) + 1;
        if (counts[matchedCountryName] > max) max = counts[matchedCountryName];
      }
    });

    return { countryCounts: counts, maxDeviceCount: max };
  }, [mappedCookies]);

  useEffect(() => {
    if (!map) return;

    if (!geoJsonLoaded.current) {
      map.data.loadGeoJson("https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json");
      geoJsonLoaded.current = true;

      // When a country is clicked, calculate its bounds and auto-zoom the map
      map.data.addListener("click", (event) => {
        const bounds = new window.google.maps.LatLngBounds();
        event.feature.getGeometry().forEachLatLng((latLng) => {
          bounds.extend(latLng);
        });
        map.fitBounds(bounds);
      });
    }

    map.data.setStyle((feature) => {
      const countryName = feature.getProperty("name");
      const count = countryCounts[countryName] || 0;
      
      let fillOpacity = 0.03;
      if (count > 0) {
        const minOpacity = 0.15;
        const maxOpacity = 0.85;
        if (maxDeviceCount <= 1) {
          fillOpacity = maxOpacity;
        } else {
          fillOpacity = minOpacity + ((count - 1) / (maxDeviceCount - 1)) * (maxOpacity - minOpacity);
        }
      }

      return {
        fillColor: "var(--primary)",
        fillOpacity: fillOpacity,
        strokeColor: "var(--foreground-muted)",
        strokeOpacity: 0.15,
        strokeWeight: 0.5,
        cursor: count > 0 ? "pointer" : "default" 
      };
    });
  }, [map, countryCounts, maxDeviceCount]);

  return null;
});

const LocationRenderer = ({ location }) => {
  const [placeName, setPlaceName] = useState("");

  useEffect(() => {
    if (location?.status !== "allowed" || !location?.lat || !location?.lng) return;
    const fetchPlaceName = async () => {
      try {
        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.lat}&longitude=${location.lng}&localityLanguage=en`
        );
        if (res.ok) {
          const data = await res.json();
          const city = data.city || data.locality || data.principalSubdivision || "";
          const country = data.countryName || "";
          if (city || country) setPlaceName([city, country].filter(Boolean).join(", "));
        }
      } catch (error) {
        console.error("Failed to reverse geocode:", error);
      }
    };
    fetchPlaceName();
  }, [location]);

  if (location?.status === "rejected") return <span>Permission Denied</span>;
  if (location?.status === "unsupported") return <span>Unsupported</span>;
  if (location?.status !== "allowed" || !location?.lat || !location?.lng) return <span>Not Captured</span>;

  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-[var(--primary)] hover:underline flex items-center gap-1.5 transition-all truncate w-full"
      title={placeName ? `${placeName} (${location.lat}, ${location.lng})` : `${location.lat}, ${location.lng}`}
    >
      <span className="truncate">
        {placeName ? <span className="font-medium mr-1">{placeName}</span> : ""}
        <span className="text-[10px] opacity-75">({Number(location.lat).toFixed(4)}, {Number(location.lng).toFixed(4)})</span>
      </span>
      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
};

export default function CookieDataDisplay() {
  const [cookies, setCookies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [viewMode, setViewMode] = useState("active");

  const [selectedCookies, setSelectedCookies] = useState([]);

  const [toast, setToast] = useState({ visible: false, message: "", type: "info" });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: "", message: "", onConfirm: null, confirmText: "Confirm", confirmColor: "bg-[var(--primary)]" });

  const [filters, setFilters] = useState({ device: "All", region: "All", language: "All", location: "All" });
  
  // Camera State
  const [mapCenter, setMapCenter] = useState({ lat: 20, lng: 0 });
  const [mapZoom, setMapZoom] = useState(3);
  const [activeMapMarker, setActiveMapMarker] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const cookiesRef = ref(db, "user_cookies");

    const unsubscribe = onValue(cookiesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const currentTime = Date.now();
        const validData = [];

        Object.keys(data).forEach((key) => {
          const item = data[key];
          if (item.isArchived && item.archivedAt) {
            const archiveTime = new Date(item.archivedAt).getTime();
            if (currentTime - archiveTime >= THIRTY_DAYS_MS) {
              remove(ref(db, `user_cookies/${key}`)).catch(console.error);
              return;
            }
          }
          validData.push({ id: key, ...item });
        });

        const formattedData = validData.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setCookies(formattedData);
      } else {
        setCookies([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const activeCookies = cookies.filter((c) => !c.isArchived);
  const archivedCookies = cookies.filter((c) => c.isArchived);
  let displayCookies = viewMode === "active" ? activeCookies : archivedCookies;

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

  const mappedCookies = displayCookies.filter(
    (c) => c.location?.status === "allowed" && c.location?.lat && c.location?.lng,
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
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setSelectedCookies([]);
  };

  const clearFilters = () => {
    setFilters({ device: "All", region: "All", language: "All", location: "All" });
    setSelectedCookies([]);
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
      confirmColor: "bg-indigo-500 hover:bg-indigo-600",
      onConfirm: async () => {
        try {
          const archivePromises = selectedCookies.map((id) =>
            update(ref(db, `user_cookies/${id}`), { isArchived: true, archivedAt: new Date().toISOString() })
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
        update(ref(db, `user_cookies/${id}`), { isArchived: false, archivedAt: null })
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
      confirmColor: "bg-red-500 hover:bg-red-600",
      onConfirm: async () => {
        try {
          const deletePromises = selectedCookies.map((id) => remove(ref(db, `user_cookies/${id}`)));
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

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setMapZoom((prev) => Math.min(prev + 1, 15));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setMapZoom((prev) => Math.max(prev - 1, 2));
  };

  const handleResetMap = (e) => {
    if (e) e.stopPropagation();
    setMapZoom(3);
    setMapCenter({ lat: 20, lng: 0 });
    setActiveMapMarker(null);
  };

  const handleMarkerClick = useCallback((id) => {
    setActiveMapMarker((prev) => (prev === id ? null : id));
  }, []);

  const activeCount = displayCookies.filter(
    (c) => now - new Date(c.updatedAt).getTime() < 60000,
  ).length;

  const hasActiveFilters = Object.values(filters).some((val) => val !== "All");

  if (loading) {
    return (
      <section className="w-full max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-4 h-4 rounded-full bg-[var(--border-color)] animate-pulse" />
          <div className="h-8 w-48 bg-[var(--border-color)] animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="theme-glass-card p-6 h-[280px] animate-pulse flex flex-col gap-4">
              <div className="flex justify-between">
                <div className="h-5 w-24 bg-[var(--border-color)] rounded" />
                <div className="h-5 w-16 bg-[var(--border-color)] rounded-full" />
              </div>
              <div className="h-4 w-32 bg-[var(--border-color)] rounded mt-2" />
              <div className="space-y-3 mt-4">
                <div className="h-3 w-full bg-[var(--border-color)] rounded" />
                <div className="h-3 w-4/5 bg-[var(--border-color)] rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-7xl mx-auto p-6 fade-in">
      {/* High-Tech Sonar Ripple Animations */}
      <style>{`
        @keyframes sonarWave {
          0% {
            width: 14px;
            height: 14px;
            opacity: 0.95;
            box-shadow: 0 0 10px 2px var(--primary);
          }
          50% {
            opacity: 0.45;
          }
          100% {
            width: 110px;
            height: 110px;
            opacity: 0;
            box-shadow: 0 0 25px 6px var(--primary);
          }
        }

        @keyframes beaconCoreBreath {
          0%, 100% {
            transform: scale(0.9);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.4);
            opacity: 1;
            box-shadow: 0 0 18px 4px var(--primary);
          }
        }

        .sonar-beacon-core {
          position: absolute;
          width: 12px;
          height: 12px;
          border-radius: 9999px;
          background: var(--primary);
          box-shadow: 0 0 10px 2px var(--primary);
          animation: beaconCoreBreath 2s ease-in-out infinite;
        }

        .sonar-wave {
          position: absolute;
          border-radius: 9999px;
          border: 1.5px solid var(--primary);
          background: radial-gradient(circle, var(--primary) 0%, transparent 60%);
          animation: sonarWave 2.8s cubic-bezier(0.1, 0.7, 0.3, 1) infinite;
          pointer-events: none;
        }

        .sonar-delay-1 { animation-delay: 0s; }
        .sonar-delay-2 { animation-delay: 0.9s; }
        .sonar-delay-3 { animation-delay: 1.8s; }

        .gmnoprint, .gm-style-cc { display: none !important; }
      `}</style>

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="relative flex h-3.5 w-3.5">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${viewMode === "active" ? "animate-ping bg-[var(--primary)]" : "bg-[var(--foreground-muted)]"}`}></span>
              <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${viewMode === "active" ? "bg-[var(--primary)] shadow-[0_0_10px_var(--primary)]" : "bg-[var(--foreground-muted)]"}`}></span>
            </div>
            <h2 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">
              {viewMode === "active" ? "Visitor Data" : "Archived Sessions"}
            </h2>

            {archivedCookies.length > 0 && (
              <button onClick={toggleViewMode} className="ml-3 px-3 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase border transition-all bg-[var(--background)] border-[var(--border-color)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground-muted)]">
                {viewMode === "active" ? `View Archived (${archivedCookies.length})` : "View Active Sessions"}
              </button>
            )}
          </div>
          <p className="text-[var(--foreground-muted)] text-sm ml-6">
            {viewMode === "active" ? "Real-time tracking of active user sessions and consent states." : "Previously saved sessions moved out of the active view."}
          </p>
        </div>
      </div>

      {/* Action Toolbar */}
      {selectedCookies.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 sm:gap-3 animate-in slide-in-from-bottom-8 fade-in zoom-in-95 duration-300 bg-[var(--background)]/80 backdrop-blur-xl border border-[var(--border-color)] px-5 py-3 rounded-full shadow-2xl w-max max-w-[95vw] overflow-x-auto">
          <span className="text-sm font-medium text-[var(--foreground-muted)] mr-2 whitespace-nowrap">
            {selectedCookies.length} Selected
          </span>
          <button onClick={handleSelectAll} className="px-4 py-2 text-sm font-semibold rounded-full bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] hover:bg-[var(--primary)] hover:text-white hover:border-[var(--primary)] transition-colors shadow-sm whitespace-nowrap">
            {selectedCookies.length === displayCookies.length ? "Deselect All" : "Select All"}
          </button>
          {viewMode === "active" ? (
            <button onClick={handleArchiveSelected} className="px-4 py-2 text-sm font-semibold rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-colors shadow-sm whitespace-nowrap">Archive</button>
          ) : (
            <button onClick={handleRestoreSelected} className="px-4 py-2 text-sm font-semibold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-colors shadow-sm whitespace-nowrap">Restore</button>
          )}
          <button onClick={handleDeleteSelected} className="px-4 py-2 text-sm font-semibold rounded-full bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors shadow-sm whitespace-nowrap">Delete</button>
        </div>
      )}

      {/* Map Card */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-3 theme-glass-card border border-[var(--border-color)] rounded-3xl relative overflow-hidden flex items-center justify-center min-h-[420px] shadow-sm group bg-[var(--card-bg)]">
          
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)] opacity-[0.04] pointer-events-none z-[5]"></div>

          <div className="absolute top-6 left-6 z-30 pointer-events-none bg-[var(--background)]/75 backdrop-blur-md border border-[var(--border-color)] px-4 py-3 rounded-2xl shadow-sm">
            <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {viewMode === "active" ? "Live Global Tracker" : "Archived Global Tracker"}
            </h3>
            <p className="text-[10px] text-[var(--foreground-muted)] mt-1 font-mono uppercase tracking-wider">
              {mappedCookies.length} nodes active
            </p>
          </div>

          <div className="absolute inset-0 z-[10]">
            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
              <Map
                mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID}
                zoom={mapZoom}
                center={mapCenter}
                onCameraChanged={(ev) => {
                  setMapZoom(ev.detail.zoom);
                  setMapCenter(ev.detail.center);
                }}
                onClick={() => setActiveMapMarker(null)}
                disableDefaultUI={true}
                gestureHandling="greedy"
              >
                <HeatmapLayer mappedCookies={mappedCookies} />

                {mappedCookies.map((c) => {
                  const isJustNow = now - new Date(c.updatedAt).getTime() < 60000;
                  return (
                    <CustomGoogleMarker
                      key={c.id}
                      cookie={c}
                      isJustNow={isJustNow}
                      isActive={activeMapMarker === c.id}
                      onMarkerClick={handleMarkerClick}
                    />
                  );
                })}
              </Map>
            </APIProvider>
          </div>

          {/* Map Controls */}
          <div className="absolute bottom-6 right-6 flex items-center bg-[var(--background)]/80 backdrop-blur-md border border-[var(--border-color)] rounded-full z-30 shadow-lg p-1">
            <button onClick={handleZoomIn} title="Zoom In" className="w-8 h-8 flex items-center justify-center text-[var(--foreground)] rounded-full hover:bg-[var(--card-bg)] hover:text-[var(--primary)] transition-colors cursor-pointer">
              <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </button>
            <div className="w-[1px] h-4 bg-[var(--border-color)] mx-1"></div>
            <button onClick={handleZoomOut} title="Zoom Out" className="w-8 h-8 flex items-center justify-center text-[var(--foreground)] rounded-full hover:bg-[var(--card-bg)] hover:text-[var(--primary)] transition-colors cursor-pointer">
              <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
            </button>
            <div className="w-[1px] h-4 bg-[var(--border-color)] mx-1"></div>
            <button onClick={handleResetMap} title="Reset View" className="w-8 h-8 flex items-center justify-center text-[var(--foreground)] rounded-full hover:bg-[var(--card-bg)] hover:text-[var(--primary)] transition-colors cursor-pointer">
              <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
        </div>

        {/* Stats Column */}
        <div className="flex flex-col gap-4">
          <div className="theme-glass-card p-6 flex flex-col justify-center flex-1 border-l-4 border-l-[var(--foreground-muted)] hover:shadow-lg transition-all shadow-sm">
            <span className="text-[var(--foreground-muted)] text-xs uppercase tracking-wider mb-1 font-mono">{viewMode === "active" ? "Total Sessions" : "Archived Sessions"}</span>
            <span className="text-4xl font-bold text-[var(--foreground)]">{displayCookies.length}</span>
          </div>
          <div className="theme-glass-card p-6 flex flex-col justify-center flex-1 border-l-4 border-l-emerald-500 relative overflow-hidden hover:shadow-lg transition-all shadow-sm">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl"></div>
            <span className="text-[var(--foreground-muted)] text-xs uppercase tracking-wider mb-1 font-mono">Active Now (60s)</span>
            <span className="text-4xl font-bold text-emerald-500">{activeCount}</span>
          </div>
          <div className="theme-glass-card p-6 flex flex-col justify-center flex-1 border-l-4 border-l-[var(--primary)] relative overflow-hidden hover:shadow-lg transition-all shadow-sm">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-[var(--primary)]/10 rounded-full blur-xl"></div>
            <span className="text-[var(--foreground-muted)] text-xs uppercase tracking-wider mb-1 font-mono">Locations Tracked</span>
            <span className="text-4xl font-bold text-[var(--primary)]">{mappedCookies.length}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      {cookies.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-4 bg-[var(--card-bg)]/80 backdrop-blur-sm border border-[var(--border-color)] p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mr-2">
            <svg className="w-5 h-5 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            <span className="text-sm font-semibold text-[var(--foreground)]">Filters:</span>
          </div>

          <select value={filters.device} onChange={(e) => handleFilterChange("device", e.target.value)} className="bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 outline-none focus:border-[var(--primary)] transition-colors cursor-pointer"><option value="All">All Devices</option>{uniqueDevices.map((d) => (<option key={d} value={d}>{d}</option>))}</select>
          <select value={filters.region} onChange={(e) => handleFilterChange("region", e.target.value)} className="bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 outline-none focus:border-[var(--primary)] transition-colors cursor-pointer"><option value="All">All Regions</option>{uniqueRegions.map((r) => (<option key={r} value={r}>{r}</option>))}</select>
          <select value={filters.language} onChange={(e) => handleFilterChange("language", e.target.value)} className="bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 outline-none focus:border-[var(--primary)] transition-colors cursor-pointer"><option value="All">All Languages</option>{uniqueLanguages.map((l) => (<option key={l} value={l} className="uppercase">{l}</option>))}</select>
          <select value={filters.location} onChange={(e) => handleFilterChange("location", e.target.value)} className="bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 outline-none focus:border-[var(--primary)] transition-colors cursor-pointer"><option value="All">All Locations</option><option value="Captured">Captured</option><option value="Denied">Permission Denied</option><option value="Unsupported">Unsupported</option></select>

          {hasActiveFilters && (<button onClick={clearFilters} className="text-sm font-medium text-red-500 hover:text-red-600 hover:underline transition-all ml-auto">Clear Filters</button>)}
        </div>
      )}

      {/* Grid of Session Cards */}
      {displayCookies.length === 0 ? (
        <div className="text-center py-20 theme-glass-card border-dashed">
          <p className="text-[var(--foreground-muted)] font-medium">{hasActiveFilters ? "No sessions match your current filters." : viewMode === "active" ? "No active sessions found." : "No archived sessions found."}</p>
          {hasActiveFilters && (<button onClick={clearFilters} className="mt-4 text-sm text-[var(--primary)] hover:underline">Clear filters</button>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayCookies.map((cookie) => {
            const isJustNow = now - new Date(cookie.updatedAt).getTime() < 60000;
            const consentAccepted = cookie.consentStatus === "accepted";
            const isSelected = selectedCookies.includes(cookie.id);

            return (
              <div
                key={cookie.id}
                onClick={() => toggleSelection(cookie.id)}
                className={`theme-glass-card p-6 group relative overflow-hidden flex flex-col justify-between transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl
                  ${isSelected ? "border-[var(--primary)] bg-[var(--primary)]/5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--background)]" : "hover:border-[var(--primary)]/50"} 
                  ${isJustNow && !isSelected && viewMode === "active" ? "ring-1 ring-[var(--primary)]/30 ring-offset-1 ring-offset-[var(--background)]" : ""}
                  ${viewMode === "archived" ? "opacity-80 hover:opacity-100 grayscale-[0.3]" : ""}
                `}
              >
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--primary)] opacity-0 blur-[40px] group-hover:opacity-20 transition-opacity duration-700 pointer-events-none"></div>

                <div className="flex justify-between items-start mb-5 pb-4 border-b border-[var(--border-color)] relative z-10">
                  <div className="flex flex-col gap-1">
                    <span className="text-[var(--foreground)] font-bold text-base tracking-wide flex items-center gap-2">
                      {isSelected && (
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--primary)] text-white shadow-[0_0_8px_var(--primary)] animate-in zoom-in-75 duration-200">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        </span>
                      )}
                      {cookie.username}
                      {isJustNow && !isSelected && viewMode === "active" && (
                        <span className="text-[8px] uppercase tracking-wider bg-[var(--primary)] text-white px-1.5 py-0.5 rounded shadow-[0_0_8px_var(--primary)] animate-pulse">Active</span>
                      )}
                    </span>
                    <span className="text-xs font-medium text-[var(--foreground-muted)] flex items-center gap-1.5 mt-0.5">
                      <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {getRelativeTime(cookie.updatedAt, now)}
                    </span>
                    {viewMode === "archived" && (
                      <span className="text-[10px] font-bold text-red-400 mt-1.5 flex items-center gap-1.5 animate-in fade-in duration-500 bg-red-500/10 w-fit px-2 py-0.5 rounded border border-red-500/20">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        {getArchiveTimeLeft(cookie.archivedAt, now)}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest border flex items-center gap-1.5 shadow-sm transition-colors ${consentAccepted ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${consentAccepted ? "bg-emerald-500" : "bg-amber-500"}`} />
                    {cookie.consentStatus}
                  </span>
                </div>

                <div className="space-y-3 text-sm relative z-10">
                  <p className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-lg bg-[var(--background)] border border-[var(--border-color)] text-[var(--primary)]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </span>
                    <strong className="text-[var(--foreground)] w-20 shrink-0">Device</strong>
                    <span className="text-[var(--foreground-muted)] truncate flex-1">{cookie.deviceName}</span>
                  </p>
                  <p className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-lg bg-[var(--background)] border border-[var(--border-color)] text-[var(--primary)]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </span>
                    <strong className="text-[var(--foreground)] w-20 shrink-0">Region</strong>
                    <span className="text-[var(--foreground-muted)] truncate flex-1">{cookie.timeZone}</span>
                  </p>
                  <p className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-lg bg-[var(--background)] border border-[var(--border-color)] text-[var(--primary)]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                    </span>
                    <strong className="text-[var(--foreground)] w-20 shrink-0">Language</strong>
                    <span className="text-[var(--foreground-muted)] truncate flex-1 uppercase">{cookie.language}</span>
                  </p>
                  <p className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-lg bg-[var(--background)] border border-[var(--border-color)] text-[var(--primary)]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </span>
                    <strong className="text-[var(--foreground)] w-20 shrink-0">GPS Location</strong>
                    <span className="text-[var(--foreground-muted)] truncate flex-1 flex items-center">
                      <LocationRenderer location={cookie.location} />
                    </span>
                  </p>
                  <p className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-lg bg-[var(--background)] border border-[var(--border-color)] text-[var(--primary)]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </span>
                    <strong className="text-[var(--foreground)] w-20 shrink-0">IP Address</strong>
                    <span className="text-[var(--foreground-muted)] truncate flex-1">{cookie.ipAddress || "Unknown"}</span>
                  </p>
                  <p className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-lg bg-[var(--background)] border border-[var(--border-color)] text-[var(--primary)]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </span>
                    <strong className="text-[var(--foreground)] w-20 shrink-0">IP Location</strong>
                    <span className="text-[var(--foreground-muted)] truncate flex-1">
                      {cookie.ipLocation?.lat ? (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${cookie.ipLocation.lat},${cookie.ipLocation.lng}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[var(--primary)] hover:underline flex items-center gap-1.5 transition-all truncate w-full" title={`${cookie.ipLocation.city}, ${cookie.ipLocation.country}`}>
                          <span className="truncate">
                            <span className="font-medium mr-1">{cookie.ipLocation.city}, {cookie.ipLocation.country}</span>
                          </span>
                        </a>
                      ) : (cookie.ipLocation?.city || "Unknown")}
                    </span>
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-[var(--border-color)] relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <strong className="text-xs text-[var(--foreground)] flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                      Raw Agent
                    </strong>
                  </div>
                  <div className="bg-[var(--background)] border border-[var(--border-color)] rounded-lg p-2.5 group-hover:border-[var(--primary)]/30 transition-colors">
                    <p className="text-[10px] leading-relaxed text-[var(--foreground-muted)] font-mono line-clamp-2 hover:line-clamp-none transition-all cursor-help break-all" title={cookie.rawUserAgent}>
                      {cookie.rawUserAgent}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[9px] text-[var(--foreground-muted)] font-mono relative z-10">
                  <span className="opacity-50">ID</span>
                  <span className="opacity-60 truncate pl-4">{cookie.anonId}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-[var(--foreground)] mb-2">{confirmDialog.title}</h3>
            <p className="text-[var(--foreground-muted)] text-sm mb-6 whitespace-pre-line">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} className="px-4 py-2 text-sm font-semibold rounded-full bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] hover:bg-[var(--border-color)] transition-colors">Cancel</button>
              <button onClick={confirmDialog.onConfirm} className={`px-4 py-2 text-sm font-semibold rounded-full text-white shadow-sm transition-colors ${confirmDialog.confirmColor}`}>{confirmDialog.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toast.visible && (
        <div className="fixed top-6 right-6 z-[250] animate-in slide-in-from-top-5 fade-in duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md ${toast.type === "error" ? "bg-red-500/10 border-red-500/20 text-red-500" : toast.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-[var(--primary)]/10 border-[var(--primary)]/20 text-[var(--primary)]"}`}>
            {toast.type === "error" ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            ) : toast.type === "success" ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
            <span className="text-sm font-medium pr-2">{toast.message}</span>
            <button onClick={() => setToast({ ...toast, visible: false })} className="ml-2 opacity-50 hover:opacity-100 transition-opacity">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}