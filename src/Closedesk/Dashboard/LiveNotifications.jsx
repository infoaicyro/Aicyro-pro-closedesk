import React, { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Inbox, X } from "lucide-react";
import { db } from "../../lib/firebase"; // Adjust path to your firebase config
import { ref, onValue, update, remove, get } from "firebase/database"; // Added 'get'

// Helper function to format timestamps into "5m ago", "1h ago", etc.
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return "Just now";
  const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function LiveNotifications({ onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // --- 30-DAY AUTO CLEANUP LOGIC ---
  // This runs silently in the background once when the component loads
  useEffect(() => {
    const cleanupArchivedNotifications = async () => {
      try {
        const archiveRef = ref(db, "archived_notifications");
        const snapshot = await get(archiveRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          const now = Date.now();
          const updates = {};
          let hasDeletions = false;

          // Find any archived notifications where 30 days have passed
          Object.keys(data).forEach((key) => {
            if (data[key].expiresAt && data[key].expiresAt < now) {
              updates[`archived_notifications/${key}`] = null;
              hasDeletions = true;
            }
          });

          // Delete them permanently
          if (hasDeletions) {
            await update(ref(db), updates);
            console.log("Cleaned up expired archived notifications.");
          }
        }
      } catch (error) {
        console.error("Error cleaning up archive:", error);
      }
    };

    cleanupArchivedNotifications();
  }, []);


  // --- FETCH LIVE NOTIFICATIONS FROM FIREBASE ---
  useEffect(() => {
    const notificationsRef = ref(db, "notifications");

    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Convert Firebase object to an array and sort by newest first
        const notifArray = Object.keys(data)
          .map((key) => ({
            id: key,
            ...data[key],
          }))
          .sort((a, b) => b.timestamp - a.timestamp);

        setNotifications(notifArray);
      } else {
        setNotifications([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // --- CLOSE ON OUTSIDE CLICK ---
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- MARK AS READ LOGIC ---
  const handleMarkAsRead = async (id) => {
    try {
      const updates = {};
      updates[`notifications/${id}/unread`] = false;
      await update(ref(db), updates);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const updates = {};
      notifications.forEach((notif) => {
        if (notif.unread) {
          updates[`notifications/${notif.id}/unread`] = false;
        }
      });
      if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  // --- REMOVE SINGLE NOTIFICATION LOGIC ---
  const handleRemoveNotification = async (e, id) => {
    e.stopPropagation(); 
    try {
      await remove(ref(db, `notifications/${id}`));
    } catch (error) {
      console.error("Error removing notification:", error);
    }
  };

  // --- ARCHIVE WITH 30-DAY EXPIRATION LOGIC ---
  const handleRemoveAllNotifications = async () => {
    if (notifications.length === 0) return;

    try {
      const updates = {};
      const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;
      const archiveExpiry = Date.now() + THIRTY_DAYS_IN_MS;

      // Move all current notifications to archive and remove from active
      notifications.forEach((notif) => {
        const notifData = { 
          ...notif, 
          archivedAt: Date.now(),
          expiresAt: archiveExpiry // Stamp it with the exact time 30 days from now
        };
        
        delete notifData.id; // Clean up the injected ID before saving to DB

        updates[`archived_notifications/${notif.id}`] = notifData;
        updates[`notifications/${notif.id}`] = null;
      });

      // Perform the atomic update to move them securely
      await update(ref(db), updates);

    } catch (error) {
      console.error("Error archiving all notifications:", error);
    }
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="cd-icon-btn cd-icon-btn--bordered"
        title="Notifications"
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
        }
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="cd-num absolute -top-1.5 -right-1.5 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-signal px-1 text-[length:var(--text-2xs)] font-semibold leading-none text-signal-ink ring-2 ring-[var(--color-paper)]"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="cd-popover right-0 top-full mt-2 flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden"
        >
          <div className="flex items-center gap-2 border-b border-rule px-4 py-2.5">
            <h3 className="cd-h3">Notifications</h3>
            {notifications.length > 0 && (
              <span className="cd-badge cd-num">{notifications.length}</span>
            )}
          </div>

          <ul className="m-0 flex max-h-[min(360px,60dvh)] list-none flex-col divide-y divide-[var(--color-rule)] overflow-y-auto overscroll-contain p-0">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <li
                  key={notification.id}
                  onClick={() => handleMarkAsRead(notification.id)}
                  className="flex cursor-pointer items-start gap-2 py-2.5 pl-4 pr-2 transition-colors hover:bg-hover"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p
                        className={`m-0 min-w-0 truncate text-[length:var(--text-sm)] ${
                          notification.unread ? "font-semibold text-ink" : "text-ink-2"
                        }`}
                      >
                        {notification.title}
                      </p>
                      <span className="cd-meta cd-num shrink-0 whitespace-nowrap">
                        {formatTimeAgo(notification.timestamp)}
                      </span>
                    </div>
                    <p className="m-0 truncate text-[length:var(--text-xs)] text-ink-2">
                      {notification.message}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) =>
                      handleRemoveNotification(e, notification.id)
                    }
                    className="cd-icon-btn h-[var(--control-h-sm)] w-[var(--control-h-sm)]"
                    title="Remove notification"
                    aria-label="Remove notification"
                  >
                    <X aria-hidden="true" className="!h-4 !w-4" />
                  </button>
                </li>
              ))
            ) : (
              <li className="cd-empty items-center py-8 text-center">
                <Inbox aria-hidden="true" className="h-5 w-5 text-ink-2" />
                <p className="cd-empty__title">All caught up!</p>
                <p className="cd-meta m-0">No new notifications to display.</p>
              </li>
            )}
          </ul>

          {notifications.length > 0 && (
            <div className="flex items-center justify-between gap-2 border-t border-rule px-4 py-2">
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="cd-btn cd-btn--quiet cd-btn--sm"
                >
                  <CheckCheck aria-hidden="true" />
                  Mark all read
                </button>
              ) : (
                <span className="cd-meta">All read</span>
              )}

              <button
                type="button"
                onClick={handleRemoveAllNotifications}
                className="cd-btn cd-btn--ghost cd-btn--sm"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
