import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AlertCircle, Loader2, Mail, RefreshCcw, SendHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getStoredUser } from "../lib/auth";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";

const STATUS_LABEL = {
  UNREAD: "Pending",
  READ: "Seen by Admin",
};

const STATUS_STYLE = {
  UNREAD: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  READ: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
};

const toList = (payload) => {
  if (Array.isArray(payload?.messages)) return payload.messages;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.messages)) return payload.data.messages;
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

export default function ContactAdminWorkspace({ title, subtitle, dashboardPath }) {
  const navigate = useNavigate();
  const user = getStoredUser();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [apiWarning, setApiWarning] = useState(null);

  const [adminContacts, setAdminContacts] = useState([]);
  const [contactsWarning, setContactsWarning] = useState(null);

  const fetchMessages = async () => {
    setLoadingMessages(true);
    setApiWarning(null);

    try {
      const response = await api({ ...SummaryApi.get_my_contact_messages });
      const rows = toList(response.data);
      setMessages(rows);
    } catch (fetchError) {
      const status = Number(fetchError?.response?.status);
      setMessages([]);
      if (status === 404) {
        setApiWarning("Backend does not expose '/api/user/contact-admin' routes in this build.");
      } else {
        setApiWarning(fetchError.response?.data?.message || "Unable to load contact history.");
      }
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchAdminContacts = async () => {
    setContactsWarning(null);
    try {
      const response = await api({ ...SummaryApi.get_all_users });
      const users = Array.isArray(response.data?.users) ? response.data.users : [];
      const admins = users.filter((item) => item?.role === "MAIN_ADMIN");
      setAdminContacts(admins);

      if (!admins.length) {
        setContactsWarning("No MAIN_ADMIN users found in current records.");
      }
    } catch (fetchError) {
      setAdminContacts([]);
      const status = Number(fetchError?.response?.status);
      if (status === 403) {
        setContactsWarning("Your role cannot access admin user directory in current backend access rules.");
      } else {
        setContactsWarning(fetchError.response?.data?.message || "Unable to load admin contacts.");
      }
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchAdminContacts();
  }, [user?._id]);

  const sendDisabled = useMemo(() => apiWarning?.includes("does not expose") || sending, [apiWarning, sending]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (subject.trim().length < 3) {
      setError("Subject must be at least 3 characters.");
      return;
    }

    if (message.trim().length < 10) {
      setError("Message must be at least 10 characters.");
      return;
    }

    if (sendDisabled) {
      setError("Contact-admin API is unavailable in this backend build.");
      return;
    }

    setSending(true);
    try {
      const response = await api({
        ...SummaryApi.send_contact_admin,
        data: {
          subject: subject.trim(),
          message: message.trim(),
        },
      });

      setSuccess(response.data?.message || "Message sent successfully.");
      setSubject("");
      setMessage("");
      await fetchMessages();
    } catch (sendError) {
      const status = Number(sendError?.response?.status);
      if (status === 404) {
        setApiWarning("Backend does not expose '/api/user/contact-admin' routes in this build.");
      }
      setError(sendError.response?.data?.message || "Unable to send message.");
    } finally {
      setSending(false);
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

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200 inline-flex items-start gap-2 w-full">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          This page now uses backend routes only. If contact APIs are missing in backend, sending/history will remain unavailable.
        </div>

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

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-300">{error}</p>
              )}
              {success && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={sendDisabled}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <SendHorizontal size={15} />}
                {sending ? "Sending..." : "Send Message"}
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

            {apiWarning && (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
                {apiWarning}
              </p>
            )}

            {loadingMessages ? (
              <p className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
                <Loader2 size={14} className="animate-spin" />
                Loading messages...
              </p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">No backend messages available.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((item, index) => {
                  const key = String(item?._id || item?.id || item?.createdAt || index);
                  const status = String(item?.status || "UNREAD").toUpperCase();
                  return (
                    <article
                      key={key}
                      className="rounded-xl border border-slate-200 dark:border-white/10 p-3 bg-slate-50/70 dark:bg-white/5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{item?.subject || "Message"}</p>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            STATUS_STYLE[status] || STATUS_STYLE.UNREAD
                          }`}
                        >
                          {STATUS_LABEL[status] || STATUS_LABEL.UNREAD}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{item?.message || "-"}</p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Saved: {formatDateTime(item?.createdAt)}</p>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-white/10">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Main Admin Contacts</h3>
              {contactsWarning && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">{contactsWarning}</p>
              )}
              {!contactsWarning && adminContacts.length === 0 && (
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
