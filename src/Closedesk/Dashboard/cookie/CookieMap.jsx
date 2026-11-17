"use client";

import React, { useState, memo, useEffect, useCallback, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { Minus, Plus, RotateCcw } from "lucide-react";

// Cached reverse geocodes to prevent duplicate network calls
const geocodeCache = {};

async function reverseGeocodeCoords(lat, lng) {
  const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
  if (geocodeCache[key]) return geocodeCache[key];

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&accept-language=en`,
      { headers: { "User-Agent": "CloseDesk-Pulse/2.1" } }
    );
    if (res.ok) {
      const data = await res.json();
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
      const result = [locality, country].filter(Boolean).join(", ");
      if (result) {
        geocodeCache[key] = result;
        return result;
      }
    }
  } catch (_) {}

  const fallback = `Lat: ${Number(lat).toFixed(4)}, Lng: ${Number(lng).toFixed(4)}`;
  geocodeCache[key] = fallback;
  return fallback;
}

// Controller component to reliably control Google Maps camera using useMap()
function MapCameraController({ markers, activeMarkerId, mapCenter, mapZoom }) {
  const map = useMap();
  const hasAutoCentered = useRef(false);

  // 1. Pan & Zoom directly to active marker when selected
  useEffect(() => {
    if (!map || !activeMarkerId) return;
    const target = markers.find((m) => m.id === activeMarkerId);
    if (target && target.location?.lat && target.location?.lng) {
      map.panTo({
        lat: Number(target.location.lat),
        lng: Number(target.location.lng),
      });
      map.setZoom(15);
    }
  }, [map, activeMarkerId, markers]);

  // 2. Automatically center on initial load or when markers arrive
  useEffect(() => {
    if (!map || !markers || markers.length === 0) return;

    if (markers.length === 1) {
      const single = markers[0];
      if (single.location?.lat && single.location?.lng && !hasAutoCentered.current) {
        hasAutoCentered.current = true;
        map.setCenter({
          lat: Number(single.location.lat),
          lng: Number(single.location.lng),
        });
        map.setZoom(14);
      }
    } else if (!hasAutoCentered.current) {
      const bounds = new google.maps.LatLngBounds();
      let hasValidCoords = false;
      markers.forEach((m) => {
        if (m.location?.lat && m.location?.lng) {
          bounds.extend({
            lat: Number(m.location.lat),
            lng: Number(m.location.lng),
          });
          hasValidCoords = true;
        }
      });
      if (hasValidCoords) {
        hasAutoCentered.current = true;
        map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
      }
    }
  }, [map, markers]);

  return null;
}

// Custom marker: an accent pin, a still ring for recent visitors, and a detail card when selected
const CustomGoogleMarker = memo(({ cookie, isJustNow, isActive, onMarkerClick }) => {
  const lat = Number(cookie.location?.lat);
  const lng = Number(cookie.location?.lng);

  const [placeName, setPlaceName] = useState(
    cookie.ipLocation?.city
      ? `${cookie.ipLocation.city}, ${cookie.ipLocation.country || ""}`.replace(/,\s*$/, "")
      : ""
  );

  useEffect(() => {
    if (isNaN(lat) || isNaN(lng)) return;
    let isMounted = true;

    reverseGeocodeCoords(lat, lng).then((resolvedName) => {
      if (isMounted && resolvedName) {
        setPlaceName(resolvedName);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [lat, lng]);

  if (isNaN(lat) || isNaN(lng)) return null;

  return (
    <AdvancedMarker
      position={{ lat, lng }}
      onClick={() => onMarkerClick(cookie.id, cookie.location)}
      zIndex={isActive ? 100 : isJustNow ? 50 : 1}
    >
      <div className="relative flex cursor-pointer select-none flex-col items-center justify-center">
        {/* Recent visitor: a still ring on the ground under the pin */}
        {isJustNow && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[26px] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-signal bg-signal-wash"
          />
        )}

        {/* Marker Icon Pin */}
        <div className="relative z-10">
          <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
              fill={isActive ? "var(--color-ink)" : "var(--color-accent)"}
              stroke="var(--color-paper-3)"
              strokeWidth="1.5"
            />
          </svg>
          {isJustNow && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-paper-3 bg-success"
            />
          )}
        </div>

        {/* Selected Marker Detail Card */}
        {isActive && (
          <div className="pointer-events-none absolute bottom-[36px] z-50 flex min-w-max flex-col items-start rounded-control bg-paper-3 px-3 py-2 text-ink shadow-[var(--shadow-lift)]">
            <span className="flex items-center gap-1.5">
              <span className="text-[length:var(--text-xs)] font-semibold leading-tight text-ink">{cookie.username}</span>
              {cookie.location?.source === "gps_exact" || cookie.location?.exactLat != null ? (
                <span className="cd-badge cd-badge--success">GPS exact</span>
              ) : (
                <span className="cd-badge">IP / network</span>
              )}
            </span>
            <span className="mt-1 text-[length:var(--text-xs)] leading-tight text-ink-2">
              {placeName || `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`}
            </span>
            <span className="cd-num mt-0.5 font-mono text-[length:var(--text-2xs)] text-ink-2">
              ({lat.toFixed(4)}, {lng.toFixed(4)})
              {cookie.location?.accuracy ? ` • ±${Math.round(cookie.location.accuracy)}m` : ""}
            </span>
            <span aria-hidden="true" className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-paper-3" />
          </div>
        )}
      </div>
    </AdvancedMarker>
  );
});
CustomGoogleMarker.displayName = "CustomGoogleMarker";

export default function CookieMap({
  mappedCookies,
  viewMode,
  now,
  activeMapMarker,
  setActiveMapMarker,
}) {
  // Derive default initial center from latest visitor if available
  const initialCenter =
    mappedCookies.length > 0 &&
    mappedCookies[0].location?.lat &&
    mappedCookies[0].location?.lng
      ? {
          lat: Number(mappedCookies[0].location.lat),
          lng: Number(mappedCookies[0].location.lng),
        }
      : { lat: 33.6378, lng: 73.067 }; // Default region

  const [mapCenter, setMapCenter] = useState(initialCenter);
  const [mapZoom, setMapZoom] = useState(mappedCookies.length > 0 ? 12 : 4);

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setMapZoom((prev) => Math.min(prev + 1, 18));
  };
  const handleZoomOut = (e) => {
    e.stopPropagation();
    setMapZoom((prev) => Math.max(prev - 1, 2));
  };

  const handleResetMap = (e) => {
    if (e) e.stopPropagation();
    setActiveMapMarker(null);
    if (mappedCookies.length > 0 && mappedCookies[0].location?.lat) {
      setMapCenter({
        lat: Number(mappedCookies[0].location.lat),
        lng: Number(mappedCookies[0].location.lng),
      });
      setMapZoom(13);
    } else {
      setMapZoom(4);
      setMapCenter(initialCenter);
    }
  };

  const handleMarkerClick = useCallback(
    (id, location) => {
      setActiveMapMarker((prev) => (prev === id ? null : id));
      if (location && location.lat && location.lng) {
        setMapCenter({
          lat: Number(location.lat),
          lng: Number(location.lng),
        });
        setMapZoom(15);
      }
    },
    [setActiveMapMarker]
  );

  return (
    <div id="closedesk-radar-map" className="cd-panel overflow-hidden">
      {/* Hide Google's own map chrome; our controls live in the panel head */}
      <style>{`
        .gmnoprint, .gm-style-cc { display: none !important; }
      `}</style>

      <div className="cd-panel__head">
        <div className="min-w-0">
          <h2 className="cd-h2">
            {viewMode === "active" ? "Live Global Tracker" : "Archived Global Tracker"}
          </h2>
          <p className="cd-meta cd-num mt-0.5">
            {mappedCookies.length} nodes active
          </p>
        </div>

        {/* Map Controls */}
        <div className="flex items-center gap-1" role="group" aria-label="Map controls">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom In"
            className="cd-icon-btn cd-icon-btn--bordered"
          >
            <Plus aria-hidden="true" className="pointer-events-none" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
            className="cd-icon-btn cd-icon-btn--bordered"
          >
            <Minus aria-hidden="true" className="pointer-events-none" />
          </button>
          <button
            type="button"
            onClick={handleResetMap}
            title="Reset to Active Nodes"
            aria-label="Reset to Active Nodes"
            className="cd-icon-btn cd-icon-btn--bordered"
          >
            <RotateCcw aria-hidden="true" className="pointer-events-none" />
          </button>
        </div>
      </div>

      <div className="relative min-h-[440px] bg-paper-2">
        <div className="absolute inset-0">
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
              style={{ width: "100%", height: "100%", background: "var(--color-paper-2)" }}
            >
              <MapCameraController
                markers={mappedCookies}
                activeMarkerId={activeMapMarker}
                mapCenter={mapCenter}
                mapZoom={mapZoom}
              />

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
      </div>
    </div>
  );
}
