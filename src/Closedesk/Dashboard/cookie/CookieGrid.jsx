"use client";

import React, { useEffect, useState } from "react";
import { Clock, ExternalLink, MapPin, Trash2 } from "lucide-react";

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

// Global cache for geocodes
const gridGeocodeCache = {};

const LocationRenderer = ({ location }) => {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  const [placeName, setPlaceName] = useState("");

  useEffect(() => {
    if (location?.status !== "allowed" || isNaN(lat) || isNaN(lng)) return;

    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (gridGeocodeCache[cacheKey]) {
      setPlaceName(gridGeocodeCache[cacheKey]);
      return;
    }

    let isMounted = true;
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&accept-language=en`,
      { headers: { "User-Agent": "CloseDesk-Pulse/2.1" } }
    )
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!isMounted) return;
        const addr = data.address || {};
        const locality =
          addr.suburb ||
          addr.neighbourhood ||
          addr.city ||
          addr.town ||
          addr.village ||
          addr.county ||
          "";
        const country = addr.country || "";
        const formatted = [locality, country].filter(Boolean).join(", ");
        if (formatted) {
          gridGeocodeCache[cacheKey] = formatted;
          setPlaceName(formatted);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [location?.status, lat, lng]);

  if (location?.status === "rejected") return <span>Permission Denied</span>;
  if (location?.status === "unsupported") return <span>Unsupported</span>;
  if (location?.status !== "allowed" || isNaN(lat) || isNaN(lng)) return <span>Not Captured</span>;

  const isExactGps = location?.source === "gps_exact" || location?.exactLat != null;

  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="cd-link inline-flex max-w-full items-center gap-1.5"
      title={placeName ? `${placeName} (${lat.toFixed(4)}, ${lng.toFixed(4)})` : `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
    >
      {isExactGps && <span className="cd-badge cd-badge--success shrink-0">GPS</span>}
      <span className="min-w-0 truncate">
        {placeName ? <span className="mr-1">{placeName}</span> : ""}
        <span className="cd-num text-[length:var(--text-2xs)] font-normal text-ink-2">({lat.toFixed(4)}, {lng.toFixed(4)})</span>
      </span>
      <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
    </a>
  );
};

export default function CookieGrid({
  displayCookies,
  now,
  viewMode,
  selectedCookies,
  toggleSelection,
  hasActiveFilters,
  clearFilters,
  onFocusMap,
}) {
  if (displayCookies.length === 0) {
    return (
      <div className="cd-empty">
        <p className="cd-empty__title">
          {hasActiveFilters
            ? "No sessions match your current filters."
            : viewMode === "active"
            ? "No active sessions found."
            : "No archived sessions found."}
        </p>
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className="cd-btn cd-btn--quiet cd-btn--sm">
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <ul className="m-0 list-none divide-y divide-rule p-0">
      {displayCookies.map((cookie) => {
        const isJustNow = now - new Date(cookie.updatedAt).getTime() < 60000;
        const consentAccepted = cookie.consentStatus === "accepted";
        const isSelected = selectedCookies.includes(cookie.id);
        const hasCoords = cookie.location?.lat && cookie.location?.lng;

        return (
          <li
            key={cookie.id}
            onClick={() => toggleSelection(cookie.id)}
            className={`flex cursor-pointer gap-4 px-6 py-4 transition-colors max-[40rem]:px-4 ${
              isSelected ? "bg-selected" : "hover:bg-hover active:bg-selected"
            }`}
          >
            <input
              type="checkbox"
              className="cd-check mt-0.5 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              checked={isSelected}
              onChange={() => toggleSelection(cookie.id)}
              onClick={(e) => e.stopPropagation()}
              aria-label={cookie.username ? `Select ${cookie.username}` : "Select session"}
            />

            <div className="min-w-0 flex-1">
              {/* Who, consent, when */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="cd-h3 min-w-0 truncate">{cookie.username}</span>
                {isJustNow && !isSelected && viewMode === "active" && (
                  <span className="cd-badge cd-badge--signal">Active</span>
                )}
                <span className={`cd-badge capitalize ${consentAccepted ? "cd-badge--success" : "cd-badge--warn"}`}>
                  {cookie.consentStatus}
                </span>
                <span className="cd-meta cd-num inline-flex items-center gap-1.5">
                  <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                  {getRelativeTime(cookie.updatedAt, now)}
                </span>
                {viewMode === "archived" && (
                  <span className="cd-badge cd-badge--danger cd-num">
                    <Trash2 aria-hidden="true" />
                    {getArchiveTimeLeft(cookie.archivedAt, now)}
                  </span>
                )}

                {hasCoords && onFocusMap && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFocusMap(cookie.id);
                    }}
                    title="Focus on Radar Map"
                    className="cd-btn cd-btn--quiet cd-btn--sm ml-auto"
                  >
                    <MapPin aria-hidden="true" /> Map
                  </button>
                )}
              </div>

              {/* Fields */}
              <div className="mt-3 grid gap-x-8 gap-y-2 text-[length:var(--text-sm)] lg:grid-cols-2 2xl:grid-cols-3">
                <dl className="cd-dl">
                  <dt>Device</dt>
                  <dd className="truncate">{cookie.deviceName}</dd>
                  <dt>Region</dt>
                  <dd className="truncate">{cookie.timeZone}</dd>
                  <dt>Language</dt>
                  <dd className="truncate">{cookie.language}</dd>
                </dl>

                <dl className="cd-dl">
                  <dt>GPS Location</dt>
                  <dd className="text-ink-2">
                    <LocationRenderer location={cookie.location} />
                  </dd>
                  <dt>IP Address</dt>
                  <dd className="cd-mono truncate">{cookie.ipAddress || "Unknown"}</dd>
                  <dt>IP Location</dt>
                  <dd className="truncate">
                    {cookie.ipLocation?.city
                      ? `${cookie.ipLocation.city}, ${cookie.ipLocation.country || ""}`
                      : "Unknown"}
                  </dd>
                </dl>

                <dl className="cd-dl">
                  <dt>Host Origin</dt>
                  <dd className="cd-mono truncate">{cookie.hostUrl || "Direct"}</dd>
                  <dt>ID</dt>
                  <dd className="cd-mono truncate text-ink-2">{cookie.anonId}</dd>
                </dl>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
