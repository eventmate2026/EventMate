import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2, RefreshCcw } from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { getStoredUser } from "../lib/auth";
import useToastFeedback from "../hooks/useToastFeedback";
import PageBackButton from "./PageBackButton";
import { createAuthenticatedSocket } from "../lib/socketClient";

const parseNotifications = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.notifications)) return payload.notifications;
  if (Array.isArray(payload?.data?.notifications)) return payload.data.notifications;
  return [];
};

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const typeBadgeClass = (type) => {
  switch (String(type || "").toUpperCase()) {
    case "CERTIFICATE":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
    case "FEEDBACK":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
    case "ATTENDANCE":
      return "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300";
    case "CONTACT":
      return "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300";
    case "NOTICE":
      return "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300";
    case "MESSAGE":
      return "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300";
    case "REGISTRATION":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300";
  }
};

const getUserId = () => {
  const user = getStoredUser();
  return String(user?._id || user?.id || "").trim();
};

export default function NotificationInbox({ title, subtitle, unreadEventName, dashboardPath = "" }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [warning, setWarning] = useState("");
  const socketRef = useRef(null);
  const pollRef = useRef(null);

  useToastFeedback(warning, {
    defaultType: "info",
    infoFallback: "Notification update available.",
  });

  const unreadCount = useMemo(
    () => items.filter((item) => !item?.isRead).length,
    [items]
  );

  const emitUnreadCount = useCallback(
    (nextUnread) => {
      if (!unreadEventName) return;
      window.dispatchEvent(new CustomEvent(unreadEventName, { detail: Number(nextUnread || 0) }));
    },
    [unreadEventName]
  );

  const fetchNotifications = useCallback(async () => {
    setWarning("");
    try {
      const response = await api({
        ...SummaryApi.get_my_notifications,
        params: { all: true },
        cacheTTL: 6000,
        skipDedupe: true
      });
      const rows = parseNotifications(response?.data).sort(
        (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
      );
      setItems(rows);
      emitUnreadCount(Number(response?.data?.unreadCount ?? rows.filter((item) => !item?.isRead).length));
    } catch (error) {
      setItems([]);
      emitUnreadCount(0);
      setWarning(error?.response?.data?.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [emitUnreadCount]);

  useEffect(() => {
    setLoading(true);
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const userId = getUserId();
    if (!userId) return undefined;

    const socket = createAuthenticatedSocket();
    if (socket) {
      socketRef.current = socket;

      socket.on("notification", (payload) => {
        if (!payload?._id) return;
        setItems((prev) => {
          const exists = prev.some((item) => String(item?._id || "") === String(payload._id));
          if (exists) return prev;
          return [payload, ...prev];
        });
      });
    }

    pollRef.current = setInterval(fetchNotifications, 30000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [fetchNotifications]);

  useEffect(() => {
    emitUnreadCount(unreadCount);
  }, [emitUnreadCount, unreadCount]);

  const markOneAsRead = async (notificationId) => {
    const normalizedId = String(notificationId || "").trim();
    if (!normalizedId) return;

    try {
      await api({
        ...SummaryApi.mark_notification_read,
        url: SummaryApi.mark_notification_read.url.replace(":notificationId", normalizedId),
      });
      setItems((prev) =>
        prev.map((item) => (String(item?._id || "") === normalizedId ? { ...item, isRead: true } : item))
      );
    } catch (error) {
      setWarning(error?.response?.data?.message || "Unable to mark notification as read.");
    }
  };

  const markAllAsRead = async () => {
    setMarkingAll(true);
    setWarning("");
    try {
      await api({ ...SummaryApi.mark_all_notifications_read });
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (error) {
      setWarning(error?.response?.data?.message || "Unable to mark all notifications as read.");
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="eventmate-page min-h-screen bg-slate-50 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {dashboardPath && <PageBackButton to={dashboardPath} label="Back to Dashboard" />}

        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{title}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">{subtitle}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={fetchNotifications}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <RefreshCcw size={15} />
                Refresh
              </button>
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={!unreadCount || markingAll}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                {markingAll ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />}
                Mark All Read
              </button>
            </div>
          </div>
        </section>

        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="inline-flex items-center gap-2">
              <Bell size={17} className="text-indigo-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Inbox</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Unread: <span className="font-semibold text-slate-800 dark:text-slate-100">{unreadCount}</span>
            </p>
          </div>

          {loading && (
            <p className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
              <Loader2 size={14} className="animate-spin" />
              Loading notifications...
            </p>
          )}

          {!loading && items.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-300">No notifications found.</p>
          )}

          {!loading && items.length > 0 && (
            <div className="space-y-3">
              {items.map((item) => {
                const notificationId = String(item?._id || item?.id || "");
                const isRead = Boolean(item?.isRead);
                return (
                  <article
                    key={notificationId}
                    className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50/70 dark:bg-white/5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="inline-flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {item?.title || "Notification"}
                          </p>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeBadgeClass(item?.type)}`}>
                            {String(item?.type || "GENERAL")}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                          {String(item?.message || "No message.")}
                        </p>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Received: {formatDateTime(item?.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isRead
                              ? "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300"
                              : "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                          }`}
                        >
                          {isRead ? "Read" : "Unread"}
                        </span>
                        {!isRead && (
                          <button
                            type="button"
                            onClick={() => markOneAsRead(notificationId)}
                            className="inline-flex items-center rounded-lg border border-slate-200 dark:border-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
