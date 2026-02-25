import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bell, CheckCheck, Loader2, RefreshCcw } from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";

const STATUS_STYLE = {
  UNREAD: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  READ: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
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

const toList = (payload) => {
  if (Array.isArray(payload?.messages)) return payload.messages;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.messages)) return payload.data.messages;
  return [];
};

const buildSystemNotifications = (users) => {
  const now = Date.now();
  const rows = [];

  users.forEach((user) => {
    const createdAt = new Date(user?.createdAt || 0).getTime();
    const days = Number.isNaN(createdAt) ? 0 : Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

    if (!user?.emailVerified && days > 3) {
      rows.push({
        _id: `verify-${user._id}`,
        subject: "Unverified user pending",
        message: `${user?.fullName || "User"} (${user?.email || "N/A"}) remains unverified for ${days} days.`,
        status: "UNREAD",
        createdAt: user?.createdAt,
        source: "User Directory",
      });
    }

    if (user?.isActive === false && user?.emailVerified) {
      rows.push({
        _id: `inactive-${user._id}`,
        subject: "Verified user is inactive",
        message: `${user?.fullName || "User"} (${user?.email || "N/A"}) is verified but currently inactive.`,
        status: "UNREAD",
        createdAt: user?.updatedAt || user?.createdAt,
        source: "User Directory",
      });
    }

    if (user?.createdAt) {
      rows.push({
        _id: `joined-${user._id}`,
        subject: "New account created",
        message: `${user?.fullName || "User"} joined as ${user?.role || "STUDENT"}.`,
        status: "READ",
        createdAt: user?.createdAt,
        source: "User Directory",
      });
    }
  });

  return rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

export default function AdminNotifications() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [mode, setMode] = useState("system_fallback");
  const [warning, setWarning] = useState(null);

  const fetchMessages = async () => {
    setLoading(true);
    setWarning(null);

    try {
      const response = await api({ ...SummaryApi.get_admin_contact_messages });
      const rows = toList(response.data).map((item, index) => ({
        _id: String(item?._id || item?.id || item?.createdAt || index),
        subject: item?.subject || "Message",
        message: item?.message || "-",
        status: String(item?.status || "UNREAD").toUpperCase(),
        createdAt: item?.createdAt,
        readAt: item?.readAt,
        source: item?.source || "Contact Channel",
      }));

      setMessages(rows);
      setMode("contact_api");
    } catch (error) {
      const status = Number(error?.response?.status);
      if (status === 404 || status === 403) {
        try {
          const usersResponse = await api({ ...SummaryApi.get_all_users });
          const users = Array.isArray(usersResponse.data?.users) ? usersResponse.data.users : [];
          setMessages(buildSystemNotifications(users));
          setMode("system_fallback");
          setWarning("Contact-notification APIs are unavailable. Showing backend-derived system alerts from user records.");
        } catch (fallbackError) {
          setMessages([]);
          setMode("system_fallback");
          setWarning(fallbackError.response?.data?.message || "Unable to load notifications.");
        }
      } else {
        setMessages([]);
        setMode("system_fallback");
        setWarning(error.response?.data?.message || "Unable to load notifications.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const unreadCount = useMemo(
    () => messages.filter((item) => String(item.status || "UNREAD") !== "READ").length,
    [messages]
  );

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [messages]
  );

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("eventmate:admin-unread-count", { detail: unreadCount }));
  }, [unreadCount]);

  const markAsRead = async (id) => {
    if (mode === "contact_api") {
      try {
        await api({
          ...SummaryApi.mark_admin_contact_message_read,
          url: SummaryApi.mark_admin_contact_message_read.url.replace(":id", id),
        });
        await fetchMessages();
      } catch {
        // no-op: keep current state
      }
      return;
    }

    setMessages((prev) =>
      prev.map((item) =>
        item._id === id ? { ...item, status: "READ", readAt: new Date().toISOString() } : item
      )
    );
  };

  const markAllAsRead = async () => {
    setMarkingAll(true);

    if (mode === "contact_api") {
      try {
        await api({ ...SummaryApi.mark_all_admin_contact_messages_read });
        await fetchMessages();
      } finally {
        setMarkingAll(false);
      }
      return;
    }

    const now = new Date().toISOString();
    setMessages((prev) => prev.map((item) => ({ ...item, status: "READ", readAt: item.readAt || now })));
    setMarkingAll(false);
  };

  return (
    <div className="eventmate-page min-h-screen bg-slate-50 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Admin Notifications</h1>
              <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
                Backend-backed notification feed for admin monitoring.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={fetchMessages}
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

        {warning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200 inline-flex items-start gap-2 w-full">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {warning}
          </div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-300">Unread</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{unreadCount}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-300">Total</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{messages.length}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-300">Source Mode</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {mode === "contact_api" ? "Contact API" : "System Alerts"}
            </p>
          </article>
        </section>

        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={17} className="text-indigo-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Latest Notifications</h2>
          </div>

          {loading && (
            <p className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
              <Loader2 size={14} className="animate-spin" />
              Loading notifications...
            </p>
          )}

          {!loading && sortedMessages.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-300">No notifications available.</p>
          )}

          {!loading && sortedMessages.length > 0 && (
            <div className="space-y-3">
              {sortedMessages.map((item) => (
                <article
                  key={item._id}
                  className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50/70 dark:bg-white/5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{item.subject}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-300">{item.source || "System"}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          STATUS_STYLE[item.status] || STATUS_STYLE.UNREAD
                        }`}
                      >
                        {item.status === "READ" ? "Read" : "Unread"}
                      </span>
                      {item.status !== "READ" && (
                        <button
                          type="button"
                          onClick={() => markAsRead(item._id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{item.message}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Received: {formatDateTime(item.createdAt)}
                    {item.readAt ? ` | Read: ${formatDateTime(item.readAt)}` : ""}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
