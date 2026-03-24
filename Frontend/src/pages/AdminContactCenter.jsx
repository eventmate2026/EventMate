import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Mail,
  Megaphone,
  RefreshCcw,
  Search,
  SendHorizontal,
  Users
} from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import useToastFeedback from "../hooks/useToastFeedback";
import AvatarWithFrame from "../components/AvatarWithFrame";
import { extractEventList, extractUsersList } from "../lib/backendAdapters";
import { resolveUserDepartment } from "../lib/userDepartment";
import { getStoredUser, subscribeAuthUpdates } from "../lib/auth";

const ROLE_LABELS = {
  MAIN_ADMIN: "Main Admin",
  ORGANIZER: "Organizer",
  STUDENT_COORDINATOR: "Coordinator",
  STUDENT: "Student"
};

const normalizeId = (value) => String(value || "").trim();

const getInitials = (value) =>
  String(value || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const matchesSearch = (user, term) => {
  if (!term) return true;
  const department = resolveUserDepartment(user);
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || "";
  const haystack = [
    user?.fullName,
    user?.email,
    roleLabel,
    department
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
};

const sortByName = (a, b) =>
  String(a?.fullName || "").localeCompare(String(b?.fullName || ""), undefined, { sensitivity: "base" });

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

const toEventEndMs = (event) => {
  const endDate = event?.schedule?.endDate;
  if (!endDate) return null;
  const parsed = new Date(endDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const endTime = String(event?.schedule?.endTime || "").trim();
  if (endTime) {
    const [hours, minutes] = endTime.split(":").map((value) => Number.parseInt(value, 10));
    if (Number.isFinite(hours)) {
      parsed.setHours(hours, Number.isFinite(minutes) ? minutes : 0, 0, 0);
    }
  }
  return parsed.getTime();
};

const isEventCurrentlyActive = (event) => {
  const status = String(event?.status || "").trim().toUpperCase();
  if (status === "COMPLETED" || status === "CANCELLED") return false;
  const endMs = toEventEndMs(event);
  if (!Number.isFinite(endMs)) return true;
  return endMs >= Date.now();
};

export default function AdminContactCenter() {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("MESSAGE");
  const [selectedIds, setSelectedIds] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [sentGroups, setSentGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  useToastFeedback(error, {
    defaultType: "error",
    errorFallback: "We couldn't load the contact center right now.",
  });
  const [groupsError, setGroupsError] = useState(null);
  const [activeGroupId, setActiveGroupId] = useState("");
  const [receipts, setReceipts] = useState([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsError, setReceiptsError] = useState(null);

  const loadDirectory = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersResponse, eventsResponse] = await Promise.all([
        api({ ...SummaryApi.get_all_users, cacheTTL: 60000 }),
        api({ ...SummaryApi.get_public_events, params: { page: 1, limit: 200 }, cacheTTL: 45000 })
      ]);
      setUsers(extractUsersList(usersResponse?.data));
      setEvents(extractEventList(eventsResponse?.data));
    } catch (loadError) {
      setUsers([]);
      setEvents([]);
      setError(loadError?.response?.data?.message || "Unable to load user directory.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSentGroups = async () => {
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      const response = await api({
        ...SummaryApi.admin_sent_groups,
        params: { all: true },
        cacheTTL: 5000,
      });
      const rows = Array.isArray(response?.data?.data) ? response.data.data : [];
      setSentGroups(rows);
      setActiveGroupId((prev) => {
        if (!rows.length) return "";
        if (!prev || !rows.some((item) => item.groupId === prev)) {
          return rows[0].groupId;
        }
        return prev;
      });
      if (!rows.length) setReceipts([]);
    } catch (loadError) {
      setGroupsError(loadError?.response?.data?.message || "Unable to load sent messages.");
      setSentGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  };

  const fetchReceipts = async (groupId) => {
    if (!groupId) return;
    setReceiptsLoading(true);
    setReceiptsError(null);
    try {
      const response = await api({
        ...SummaryApi.admin_receipts,
        params: { groupId },
        cacheTTL: 4000,
      });
      const rows = Array.isArray(response?.data?.data) ? response.data.data : [];
      setReceipts(rows);
    } catch (loadError) {
      setReceiptsError(loadError?.response?.data?.message || "Unable to load read receipts.");
      setReceipts([]);
    } finally {
      setReceiptsLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory();
  }, []);

  useEffect(() => {
    fetchSentGroups();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAuthUpdates(() => {
      setCurrentUser(getStoredUser());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (mode === "MESSAGE" && selectedIds.length > 1) {
      setSelectedIds(selectedIds.slice(0, 1));
    }
  }, [mode, selectedIds]);

  useEffect(() => {
    const selfId = normalizeId(currentUser?._id || currentUser?.id);
    if (!selfId) return;
    setSelectedIds((prev) => prev.filter((id) => id !== selfId));
  }, [currentUser]);

  useEffect(() => {
    if (!activeGroupId) return;
    fetchReceipts(activeGroupId);
  }, [activeGroupId]);

  useEffect(() => {
    if (!activeGroupId) return undefined;
    const intervalId = setInterval(() => {
      fetchReceipts(activeGroupId);
    }, 15000);
    return () => clearInterval(intervalId);
  }, [activeGroupId]);

  const directory = useMemo(() => {
    const selfId = normalizeId(currentUser?._id || currentUser?.id);
    const allUsers = Array.isArray(users)
      ? users.filter((user) => normalizeId(user?._id || user?.id) !== selfId)
      : [];
    const term = String(search || "").trim().toLowerCase();

    const byId = new Map();
    const byEmail = new Map();
    allUsers.forEach((user) => {
      const id = normalizeId(user?._id || user?.id);
      if (id) byId.set(id, user);
      const emailKey = String(user?.email || "").toLowerCase();
      if (emailKey) byEmail.set(emailKey, user);
    });

    const tempCoordinatorIds = new Set();
    events.forEach((event) => {
      if (!isEventCurrentlyActive(event)) return;
      const coordinators = Array.isArray(event?.studentCoordinators) ? event.studentCoordinators : [];
      coordinators.forEach((entry) => {
        const entryId = normalizeId(entry?.coordinatorId || entry?._id || entry?.id);
        const entryEmail = String(entry?.email || "").toLowerCase();
        const resolvedUser = (entryId && byId.get(entryId)) || (entryEmail && byEmail.get(entryEmail));
        if (resolvedUser && String(resolvedUser.role || "").toUpperCase() === "STUDENT") {
          const resolvedId = normalizeId(resolvedUser?._id || resolvedUser?.id);
          if (resolvedId) tempCoordinatorIds.add(resolvedId);
        }
      });
    });

    const students = allUsers
      .filter(
        (user) =>
          String(user?.role || "").toUpperCase() === "STUDENT" &&
          !tempCoordinatorIds.has(normalizeId(user?._id || user?.id)) &&
          matchesSearch(user, term)
      )
      .sort(sortByName);

    const temporaryCoordinators = allUsers
      .filter(
        (user) =>
          tempCoordinatorIds.has(normalizeId(user?._id || user?.id)) && matchesSearch(user, term)
      )
      .sort(sortByName);

    const organizers = allUsers
      .filter(
        (user) =>
          String(user?.role || "").toUpperCase() === "ORGANIZER" && matchesSearch(user, term)
      )
      .sort(sortByName);

    const coordinators = allUsers
      .filter(
        (user) =>
          String(user?.role || "").toUpperCase() === "STUDENT_COORDINATOR" && matchesSearch(user, term)
      )
      .sort(sortByName);

    const allUsersFiltered = allUsers.filter((user) => matchesSearch(user, term)).sort(sortByName);

    return {
      allUsers: allUsersFiltered,
      students,
      organizers,
      coordinators,
      temporaryCoordinators,
      userMap: byId
    };
  }, [users, events, search, currentUser]);

  const getUserIds = (list) =>
    list.map((user) => normalizeId(user?._id || user?.id)).filter(Boolean);

  const quickSelectIds = useMemo(
    () => ({
      all: getUserIds(directory.allUsers),
      students: getUserIds(directory.students),
      organizers: getUserIds(directory.organizers),
      temporary: getUserIds(directory.temporaryCoordinators),
      coordinators: getUserIds(directory.coordinators),
    }),
    [
      directory.allUsers,
      directory.students,
      directory.organizers,
      directory.temporaryCoordinators,
      directory.coordinators
    ]
  );

  const activeGroup = useMemo(
    () => sentGroups.find((group) => group.groupId === activeGroupId) || null,
    [sentGroups, activeGroupId]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedUsers = useMemo(
    () => selectedIds.map((id) => directory.userMap.get(id)).filter(Boolean),
    [selectedIds, directory.userMap]
  );

  const toggleSelection = (userId) => {
    const normalized = normalizeId(userId);
    if (!normalized) return;
    setSelectedIds((prev) => {
      const isSelected = prev.includes(normalized);
      if (mode === "MESSAGE") {
        return isSelected ? [] : [normalized];
      }
      if (isSelected) return prev.filter((id) => id !== normalized);
      return [...prev, normalized];
    });
  };

  const toggleGroupSelection = (groupIds) => {
    if (mode !== "NOTICE") return;
    const ids = groupIds.map(normalizeId).filter(Boolean);
    if (!ids.length) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      ids.forEach((id) => {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return Array.from(next);
    });
  };

  const handleSend = async (event) => {
    event.preventDefault();
    setFeedback(null);

    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();
    const recipients = selectedIds;

    if (!recipients.length) {
      setFeedback({ type: "error", text: "Select at least one recipient before sending." });
      return;
    }
    if (mode === "MESSAGE" && recipients.length !== 1) {
      setFeedback({ type: "error", text: "Message mode allows exactly one recipient." });
      return;
    }
    if (trimmedTitle.length < 3) {
      setFeedback({ type: "error", text: "Title must be at least 3 characters long." });
      return;
    }
    if (trimmedMessage.length < 10) {
      setFeedback({ type: "error", text: "Message must be at least 10 characters long." });
      return;
    }

    setSending(true);
    try {
      const response = await api({
        ...SummaryApi.admin_send_notification,
        data: {
          userIds: recipients,
          title: trimmedTitle,
          message: trimmedMessage,
          mode
        }
      });
      const sentCount = Number(response?.data?.count || recipients.length);
      const nextGroupId = String(response?.data?.groupId || "").trim();
      setFeedback({
        type: "success",
        text:
          mode === "NOTICE"
            ? `Notice sent to ${sentCount} recipients.`
            : "Message sent successfully."
      });
      setTitle("");
      setMessage("");
      setSelectedIds([]);
      if (nextGroupId) {
        setActiveGroupId(nextGroupId);
        await fetchReceipts(nextGroupId);
      }
      await fetchSentGroups();
    } catch (sendError) {
      setFeedback({
        type: "error",
        text: sendError?.response?.data?.message || "Unable to send notification."
      });
    } finally {
      setSending(false);
    }
  };

  const renderUserGroup = ({
    title: groupTitle,
    description,
    users: groupUsers,
    emptyLabel
  }) => {
    const groupIds = groupUsers.map((user) => normalizeId(user?._id || user?.id)).filter(Boolean);
    const allSelected = groupIds.length > 0 && groupIds.every((id) => selectedSet.has(id));

    return (
      <article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {groupTitle} <span className="text-xs text-slate-500">({groupUsers.length})</span>
            </h3>
            {description && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{description}</p>
            )}
          </div>
          {mode === "NOTICE" && groupUsers.length > 0 && (
            <button
              type="button"
              onClick={() => toggleGroupSelection(groupIds)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              {allSelected ? "Clear group" : "Select group"}
            </button>
          )}
        </div>

        <div className="mt-3 max-h-64 overflow-y-auto pr-1 space-y-2">
          {groupUsers.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-300">{emptyLabel}</p>
          ) : (
            groupUsers.map((user) => {
              const id = normalizeId(user?._id || user?.id);
              const isSelected = selectedSet.has(id);
              const department = resolveUserDepartment(user);
              return (
                <label
                  key={id}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2 cursor-pointer transition ${
                    isSelected
                      ? "border-indigo-300 bg-indigo-50/70 dark:border-indigo-400/40 dark:bg-indigo-500/15"
                      : "border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/5 hover:bg-slate-100/70 dark:hover:bg-white/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                  />
                  <AvatarWithFrame
                    src={user?.avatar || ""}
                    alt={user?.fullName || "User"}
                    className="h-9 w-9 shrink-0"
                    coreClassName="h-full w-full border border-slate-200 dark:border-white/10 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 flex items-center justify-center text-xs font-semibold"
                    fallback={<span>{getInitials(user?.fullName || "U")}</span>}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {user?.fullName || "Unnamed User"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-300 truncate">
                      {user?.email || "N/A"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {(ROLE_LABELS[user?.role] || user?.role || "User") +
                        (department ? ` | ${department}` : "")}
                    </p>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </article>
    );
  };

  return (
    <section className="eventmate-page relative min-h-screen bg-slate-100/80 dark:bg-slate-950 px-4 sm:px-6 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 -right-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>
      <div className="relative max-w-6xl mx-auto space-y-5">
        <header className="eventmate-panel relative overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 p-6 sm:p-7 shadow-sm">
          <div className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-24 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
          <span className="relative inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-indigo-50/80 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/15 dark:text-indigo-200">
            Admin Messaging Hub
          </span>
          <h1 className="relative mt-3 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Admin Contact Center
          </h1>
          <p className="relative mt-1 text-sm text-slate-600 dark:text-slate-300">
            Review every user segment, send targeted messages, and broadcast important notices.
          </p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <article className="eventmate-kpi rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-300">Students</p>
              <Users size={16} className="text-indigo-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {directory.students.length}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">Active student users</p>
          </article>
          <article className="eventmate-kpi rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-300">Organizers</p>
              <Mail size={16} className="text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {directory.organizers.length}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">Event organizers</p>
          </article>
          <article className="eventmate-kpi rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-300">Temporary Coordinators</p>
              <Megaphone size={16} className="text-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {directory.temporaryCoordinators.length}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
              Students assigned on active events
            </p>
          </article>
          <article className="eventmate-kpi rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-300">Coordinators</p>
              <CheckCircle2 size={16} className="text-violet-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {directory.coordinators.length}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
              Verified coordinators
            </p>
          </article>
        </section>

        {loading && (
          <div className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 p-4 text-sm text-slate-500 dark:text-slate-300 inline-flex items-center gap-2 shadow-sm">
            <Loader2 size={14} className="animate-spin" />
            Loading contact directory...
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="eventmate-panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full sm:max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, email, role, or department..."
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300/70"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadDirectory}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <RefreshCcw size={15} />
                  Refresh
                </button>
              </div>

              {mode === "NOTICE" ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Quick select:</span>
                  <button
                    type="button"
                    onClick={() => toggleGroupSelection(quickSelectIds.all)}
                    disabled={!quickSelectIds.all.length}
                    className="rounded-full border border-slate-200 dark:border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                  >
                    All Users ({directory.allUsers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleGroupSelection(quickSelectIds.students)}
                    disabled={!quickSelectIds.students.length}
                    className="rounded-full border border-slate-200 dark:border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                  >
                    Students
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleGroupSelection(quickSelectIds.organizers)}
                    disabled={!quickSelectIds.organizers.length}
                    className="rounded-full border border-slate-200 dark:border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                  >
                    Organizers
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleGroupSelection(quickSelectIds.temporary)}
                    disabled={!quickSelectIds.temporary.length}
                    className="rounded-full border border-slate-200 dark:border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                  >
                    Temporary Coordinators
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleGroupSelection(quickSelectIds.coordinators)}
                    disabled={!quickSelectIds.coordinators.length}
                    className="rounded-full border border-slate-200 dark:border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                  >
                    Coordinators
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  Tip: Use search and click a user card to send a single message quickly.
                </p>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {renderUserGroup({
                  title: "Students",
                  description: "General student users available for direct messages.",
                  users: directory.students,
                  emptyLabel: "No students match the current filter."
                })}
                {renderUserGroup({
                  title: "Organizers",
                  description: "Event organizers for approvals and updates.",
                  users: directory.organizers,
                  emptyLabel: "No organizers match the current filter."
                })}
                {renderUserGroup({
                  title: "Temporary Coordinators",
                  description: "Students currently listed as coordinators on active events.",
                  users: directory.temporaryCoordinators,
                  emptyLabel: "No temporary coordinators found."
                })}
                {renderUserGroup({
                  title: "Coordinators",
                  description: "Verified student coordinators.",
                  users: directory.coordinators,
                  emptyLabel: "No coordinators match the current filter."
                })}
              </div>
            </section>

            <section className="eventmate-panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 p-5 sm:p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Compose Message</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    Message for a single recipient or notice for multiple users.
                  </p>
                </div>
                <div className="inline-flex rounded-full border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 p-1 text-xs font-semibold shadow-sm">
                  <button
                    type="button"
                    onClick={() => setMode("MESSAGE")}
                    className={`px-3 py-1 rounded-full transition ${
                      mode === "MESSAGE"
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                        : "text-slate-500 dark:text-slate-300"
                    }`}
                  >
                    Message
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("NOTICE")}
                    className={`px-3 py-1 rounded-full transition ${
                      mode === "NOTICE"
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                        : "text-slate-500 dark:text-slate-300"
                    }`}
                  >
                    Notice
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Selected: {selectedIds.length}
                  </span>
                  {mode === "MESSAGE" && (
                    <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200 px-2 py-0.5">
                      Single recipient only
                    </span>
                  )}
                  {selectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="rounded-full border border-slate-200 dark:border-white/10 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                    >
                      Clear selection
                    </button>
                  )}
                </div>

                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.slice(0, 6).map((user) => (
                      <span
                        key={normalizeId(user?._id || user?.id)}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-white/10 px-3 py-1 text-xs text-slate-700 dark:text-slate-200"
                      >
                        {user?.fullName || "User"}
                      </span>
                    ))}
                    {selectedUsers.length > 6 && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-white/10 px-3 py-1 text-xs text-slate-700 dark:text-slate-200">
                        +{selectedUsers.length - 6} more
                      </span>
                    )}
                  </div>
                )}

                <form onSubmit={handleSend} className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Title</label>
                      <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Urgent schedule update"
                        className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300/70"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Message</label>
                      <textarea
                        rows={6}
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder="Write the message or notice you want to deliver."
                        className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300/70"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-4">
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/50 p-4 text-sm text-slate-600 dark:text-slate-300 shadow-sm">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">Delivery Tips</p>
                      <ul className="mt-2 list-disc pl-4 space-y-1 text-xs">
                        <li>Use Message for personal follow-ups.</li>
                        <li>Use Notice for broadcast updates to multiple users.</li>
                        <li>Keep the message concise and actionable.</li>
                      </ul>
                    </div>

                    <div>
                      {feedback && (
                        <p
                          className={`mb-3 rounded-lg px-3 py-2 text-sm ${
                            feedback.type === "success"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                          }`}
                        >
                          {feedback.text}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={sending}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 hover:shadow-md disabled:opacity-60"
                      >
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <SendHorizontal size={14} />}
                        {mode === "NOTICE" ? "Send Notice" : "Send Message"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </section>

            <section className="eventmate-panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 p-5 sm:p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Delivery Status</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    Full history of sent messages with seen/unseen status.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchSentGroups}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <RefreshCcw size={15} />
                  Refresh
                </button>
              </div>

              {groupsError && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
                  {groupsError}
                </p>
              )}

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Sent History</p>
                    <span className="text-xs text-slate-500 dark:text-slate-300">
                      {sentGroups.length} total
                    </span>
                  </div>

                  {groupsLoading ? (
                    <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
                      <Loader2 size={14} className="animate-spin" />
                      Loading messages...
                    </p>
                  ) : sentGroups.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">
                      No messages sent yet.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {sentGroups.map((group) => {
                        const isActive = group.groupId === activeGroupId;
                        const readCount = Number(group.readCount || 0);
                        const total = Number(group.total || 0);
                        return (
                          <button
                            key={group.groupId}
                            type="button"
                            onClick={() => setActiveGroupId(group.groupId)}
                            className={`w-full text-left rounded-xl border px-3 py-2 transition ${
                              isActive
                                ? "border-indigo-300 bg-indigo-50/70 dark:border-indigo-400/40 dark:bg-indigo-500/15"
                                : "border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-slate-100/70 dark:hover:bg-white/10"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                  {group.title || "Message"}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-300">
                                  {String(group.type || "NOTICE")} | {formatDateTime(group.createdAt)}
                                </p>
                              </div>
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-200">
                                {readCount}/{total} seen
                              </span>
                            </div>
                            {group.message && (
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                                {String(group.message).slice(0, 120)}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Read Receipts</p>
                    {activeGroup && (
                      <span className="text-xs text-slate-500 dark:text-slate-300">
                        {activeGroup.readCount}/{activeGroup.total} seen
                      </span>
                    )}
                  </div>

                  {activeGroup && (
                    <div className="mt-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 px-3 py-2 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Selected Message
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {activeGroup.title || "Message"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-300">
                        {String(activeGroup.type || "NOTICE")} | {formatDateTime(activeGroup.createdAt)}
                      </p>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-200 whitespace-pre-wrap">
                        {activeGroup.message || "No message content."}
                      </p>
                    </div>
                  )}

                  {receiptsError && (
                    <p className="mt-3 text-sm text-amber-700 dark:text-amber-200">{receiptsError}</p>
                  )}

                  {!activeGroupId && (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">
                      Select a message to view read status.
                    </p>
                  )}

                  {activeGroupId && receiptsLoading && (
                    <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
                      <Loader2 size={14} className="animate-spin" />
                      Loading receipts...
                    </p>
                  )}

                  {activeGroupId && !receiptsLoading && receipts.length === 0 && (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">
                      No recipients available for this message.
                    </p>
                  )}

                  {activeGroupId && !receiptsLoading && receipts.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {receipts.map((item) => (
                        <div
                          key={String(item.userId || item.email || item.name)}
                          className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {item.name || "User"}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-300 truncate">
                              {item.email || "N/A"}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {ROLE_LABELS[item.role] || item.role || "User"}
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                item.isRead
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                  : "bg-slate-200 text-slate-700 dark:bg-slate-600/40 dark:text-slate-200"
                              }`}
                            >
                              {item.isRead ? "Seen" : "Unseen"}
                            </span>
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              {item.isRead ? formatDateTime(item.readAt) : "Waiting"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </section>
  );
}
