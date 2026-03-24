import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Mail, RefreshCcw, SendHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getStoredUser } from "../lib/auth";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { emitToast } from "../lib/toastBus";

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

const parseContactRows = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.contacts)) return payload.contacts;
  if (Array.isArray(payload?.data?.contacts)) return payload.data.contacts;
  return [];
};

export default function ContactAdminWorkspace({ title, subtitle, dashboardPath }) {
  const navigate = useNavigate();
  const user = getStoredUser();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [canReadHistory, setCanReadHistory] = useState(false);

  const [adminContacts, setAdminContacts] = useState([]);

  const fetchMessages = async () => {
    setLoadingMessages(true);
    try {
      const response = await api({
        ...SummaryApi.get_contacts,
        cacheTTL: 45000,
        skipErrorToast: true,
      });
      const rows = parseContactRows(response.data).sort(
        (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
      );
      setMessages(rows);
      setCanReadHistory(true);
    } catch (fetchError) {
      const status = Number(fetchError?.response?.status);
      if (status === 401 || status === 403) {
        setCanReadHistory(false);
      } else {
        emitToast({
          type: "error",
          text:
            fetchError.response?.data?.message ||
            fetchError.message ||
            "Unable to load message history.",
        });
      }
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchAdminContacts = async () => {
    try {
      const response = await api({
        ...SummaryApi.get_all_users,
        cacheTTL: 90000,
        skipErrorToast: true,
      });
      const users = Array.isArray(response.data?.users) ? response.data.users : [];
      const admins = users.filter((item) => item?.role === "MAIN_ADMIN");
      setAdminContacts(admins);
    } catch (fetchError) {
      setAdminContacts([]);
      emitToast({
        type: "error",
        text:
          fetchError.response?.data?.message ||
          fetchError.message ||
          "Unable to load admin contacts.",
      });
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchAdminContacts();
  }, [user?._id]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (subject.trim().length < 3) {
      emitToast({ type: "error", text: "Subject must be at least 3 characters." });
      return;
    }

    if (message.trim().length < 10) {
      emitToast({ type: "error", text: "Message must be at least 10 characters." });
      return;
    }

    const fullName = String(user?.fullName || "").trim();
    const email = String(user?.email || "").trim();
    if (!fullName || !email) {
      emitToast({
        type: "error",
        text: "Your profile is missing name or email. Update profile and retry.",
      });
      return;
    }

    try {
      const composedMessage = `Subject: ${subject.trim()}\n\n${message.trim()}`;
      const response = await api({
        ...SummaryApi.submit_contact,
        skipSuccessToast: true,
        skipErrorToast: true,
        data: {
          fullName,
          email,
          message: composedMessage,
        },
      });

      emitToast({
        type: "success",
        text: response.data?.message || "Message sent successfully.",
      });
      setSubject("");
      setMessage("");

      if (canReadHistory) {
        await fetchMessages();
      } else {
        setMessages((prev) => [
          {
            _id: `local-${Date.now()}`,
            fullName,
            email,
            message: composedMessage,
            createdAt: new Date().toISOString(),
            submittedBy: { role: user?.role || "USER" },
          },
          ...prev,
        ]);
      }
    } catch (submitError) {
      emitToast({
        type: "error",
        text:
          submitError.response?.data?.message ||
          submitError.message ||
          "Unable to send your message.",
      });
    }
  };

  return (
    <div className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => navigate(dashboardPath)}
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{title}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{subtitle}</p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6">
          <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Mail size={16} className="text-indigo-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Send a Message</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Subject</label>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Approval required for upcoming event"
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Message</label>
                <textarea
                  rows={6}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Share your request, issue, or approval details for the admin team."
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <SendHorizontal size={15} />
                Send Message
              </button>
            </form>
          </section>

          <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Messages</h2>
              <button
                type="button"
                onClick={fetchMessages}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <RefreshCcw size={13} />
                Refresh
              </button>
            </div>

            {loadingMessages ? (
              <p className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
                <Loader2 size={14} className="animate-spin" />
                Loading messages...
              </p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">No messages available.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((item, index) => {
                  const key = String(item?._id || item?.id || item?.createdAt || index);
                  return (
                    <article
                      key={key}
                      className="rounded-xl border border-slate-200 dark:border-white/10 p-3 bg-slate-50/70 dark:bg-white/5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item?.fullName || user?.fullName || "Message"}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatDateTime(item?.createdAt)}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300 break-all">
                        {item?.email || user?.email || "N/A"}
                      </p>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{item?.message || "-"}</p>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-white/10">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Main Admin Contacts</h3>
              {adminContacts.length === 0 && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">No admin contacts available.</p>
              )}
              {adminContacts.length > 0 && (
                <div className="mt-2 space-y-2">
                  {adminContacts.map((contact) => (
                    <article key={contact._id} className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{contact.fullName || "Main Admin"}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-300">{contact.email || "N/A"}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
