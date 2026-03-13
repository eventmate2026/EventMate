import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, CalendarDays, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { extractUsersList } from "../lib/backendAdapters";
import { getStoredUser } from "../lib/auth";
import { resolveUserDepartment } from "../lib/userDepartment";

const initialForm = {
  title: "",
  description: "",
  category: "",
  venueLocation: "",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  registrationLastDate: "",
  maxParticipants: "",
  registrationOpen: true,
  registrationFee: "0",
  eventMode: "INDIVIDUAL",
  minTeamSize: "2",
  maxTeamSize: "4",
  poster: null,
  resourceFile: null,
  visibilityScope: "COLLEGE",
  visibilityDepartment: "",
};

const fieldClass =
  "w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 dark:text-slate-100 dark:placeholder-slate-500 dark:[color-scheme:dark]";
const dateTimeFieldClass = `${fieldClass} dark:[color-scheme:dark]`;
const normalizeId = (value) => String(value || "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export default function OrganizerCreateEvent() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const defaultDepartment =
    user?.professionalProfile?.department || user?.academicProfile?.branch || "";
  const isOrganizer = String(user?.role || "").toUpperCase() === "ORGANIZER";

  const buildInitialForm = () => ({
    ...initialForm,
    visibilityDepartment: defaultDepartment,
  });

  const [form, setForm] = useState(buildInitialForm);
  const [message, setMessage] = useState(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [coordinatorOptions, setCoordinatorOptions] = useState([]);
  const [coordinatorPick, setCoordinatorPick] = useState("");
  const [selectedCoordinatorIds, setSelectedCoordinatorIds] = useState([]);
  const [loadingCoordinatorOptions, setLoadingCoordinatorOptions] = useState(false);
  const [coordinatorOptionsError, setCoordinatorOptionsError] = useState("");
  const [judges, setJudges] = useState([]);
  const [mentors, setMentors] = useState([]);

  useEffect(() => {
    if (!form.poster) {
      setPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(form.poster);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [form.poster]);

  useEffect(() => {
    const loadCoordinatorOptions = async () => {
      setLoadingCoordinatorOptions(true);
      setCoordinatorOptionsError("");
      try {
        const includeStudents = true;
        const response = await api({
          ...SummaryApi.get_event_coordinators,
          cacheTTL: 60000,
          params: { includeStudents: true, scope: form.visibilityScope },
        });

        const rows = extractUsersList(response.data);
        const options = rows
          .map((item) => {
            const role = String(item?.role || "").toUpperCase();
            if (!role) return null;
            if (!includeStudents && role !== "STUDENT_COORDINATOR") return null;
            return {
              id: normalizeId(item?._id || item?.id),
              fullName: String(item?.fullName || "Coordinator").trim() || "Coordinator",
              email: normalizeEmail(item?.email),
              role,
              roleLabel: role === "STUDENT" ? "Student" : "Coordinator",
              department: resolveUserDepartment(item),
            };
          })
          .filter((item) => item && item.id)
          .sort((a, b) => {
            const rankA = a.role === "STUDENT" ? 1 : 0;
            const rankB = b.role === "STUDENT" ? 1 : 0;
            if (rankA !== rankB) return rankA - rankB;
            return a.fullName.localeCompare(b.fullName);
          });

        setCoordinatorOptions(options);
        setSelectedCoordinatorIds((prev) => prev.filter((id) => options.some((item) => item.id === id)));
      } catch (error) {
        setCoordinatorOptions([]);
        setCoordinatorOptionsError(
          error.response?.data?.message || "Unable to load coordinator list right now."
        );
      } finally {
        setLoadingCoordinatorOptions(false);
      }
    };

    loadCoordinatorOptions();
  }, [form.visibilityScope]);

  const handleChange = (event) => {
    const { name, value, type, checked, files } = event.target;
    if (type === "checkbox") {
      setForm((prev) => ({ ...prev, [name]: checked }));
      return;
    }
    if (type === "file") {
      setForm((prev) => ({ ...prev, [name]: files?.[0] || null }));
      return;
    }
    if (name === "visibilityScope") {
      setForm((prev) => ({
        ...prev,
        visibilityScope: value,
        visibilityDepartment:
          value === "DEPARTMENT" && isOrganizer ? defaultDepartment : prev.visibilityDepartment,
      }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleListItemChange = (setter, index, key, value) => {
    setter((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    );
  };

  const handleListAdd = (setter, template) => {
    setter((prev) => [...prev, { ...template }]);
  };

  const handleListRemove = (setter, index) => {
    setter((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const addCoordinator = () => {
    const coordinatorId = normalizeId(coordinatorPick);
    if (!coordinatorId) return;
    setSelectedCoordinatorIds((prev) => {
      if (prev.includes(coordinatorId)) return prev;
      return [...prev, coordinatorId];
    });
    setCoordinatorPick("");
  };

  const removeCoordinator = (coordinatorId) => {
    setSelectedCoordinatorIds((prev) => prev.filter((id) => id !== coordinatorId));
  };

  const validateForm = () => {
    if (!form.title.trim() || !form.description.trim() || !form.category) {
      return "Title, description and category are required.";
    }

    if (!form.poster) {
      return "Event poster is required by backend for event creation.";
    }

    if (!form.venueLocation.trim()) return "Venue location is required.";
    if (!form.startDate || !form.startTime || !form.endDate || !form.endTime) {
      return "Schedule (start/end date and time) is required.";
    }
    if (!form.maxParticipants || Number(form.maxParticipants) < 1) {
      return "Max participants must be at least 1.";
    }

    const registrationCutoff = form.registrationLastDate || form.startDate;
    if (new Date(registrationCutoff) > new Date(form.startDate)) {
      return "Registration last date cannot be after event start date.";
    }

    if (form.eventMode === "TEAM") {
      const minTeam = Number(form.minTeamSize || 2);
      const maxTeam = Number(form.maxTeamSize || 4);
      if (minTeam < 1 || maxTeam <= 1 || maxTeam < minTeam) {
        return "Team size values are invalid.";
      }
    }

    const visibilityDepartment =
      form.visibilityScope === "DEPARTMENT" && isOrganizer ? defaultDepartment : form.visibilityDepartment;
    if (form.visibilityScope === "DEPARTMENT" && !visibilityDepartment.trim()) {
      return "Department is required for department-level events.";
    }

    return null;
  };

  const buildPayload = () => {
    const payload = new FormData();
    payload.append("title", form.title.trim());
    payload.append("description", form.description.trim());
    payload.append("category", form.category);
    payload.append("poster", form.poster);

    payload.append(
      "venue",
      JSON.stringify({
        mode: "OFFLINE",
        location: form.venueLocation.trim(),
      })
    );

    payload.append(
      "schedule",
      JSON.stringify({
        startDate: form.startDate,
        endDate: form.endDate,
        startTime: form.startTime,
        endTime: form.endTime,
      })
    );

    payload.append(
      "registration",
      JSON.stringify({
        isOpen: Boolean(form.registrationOpen),
        lastDate: form.registrationLastDate || form.startDate,
        maxParticipants: Number(form.maxParticipants),
        fee: Number(form.registrationFee || 0),
      })
    );

    payload.append("certificate", JSON.stringify({ isEnabled: false }));
    payload.append("feedback", JSON.stringify({ enabled: true }));
    const visibilityDepartment =
      form.visibilityScope === "DEPARTMENT" && isOrganizer ? defaultDepartment : form.visibilityDepartment;
    payload.append(
      "visibility",
      JSON.stringify({
        scope: form.visibilityScope === "DEPARTMENT" ? "DEPARTMENT" : "COLLEGE",
        department: form.visibilityScope === "DEPARTMENT" ? visibilityDepartment.trim() : "",
      })
    );

    const isTeamEvent = form.eventMode === "TEAM";
    payload.append("isTeamEvent", String(isTeamEvent));
    payload.append("minTeamSize", isTeamEvent ? String(Number(form.minTeamSize || 2)) : "1");
    payload.append("maxTeamSize", isTeamEvent ? String(Number(form.maxTeamSize || 4)) : "1");

    return payload;
  };

  const submitEvent = async ({ publish }) => {
    setMessage(null);
    const validationError = validateForm();
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    if (publish) {
      setIsPublishing(true);
    } else {
      setIsSavingDraft(true);
    }

    try {
      const createResponse = await api({
        ...SummaryApi.create_event,
        data: buildPayload(),
      });

      const createdEvent = createResponse.data?.data;
      const createdEventId = createdEvent?._id;

      if (publish && createdEventId) {
        await api({
          ...SummaryApi.publish_event,
          url: SummaryApi.publish_event.url.replace(":eventId", createdEventId),
        });
      }

      let assignmentNote = "";
      const uniqueCoordinatorIds = Array.from(
        new Set(selectedCoordinatorIds.map(normalizeId).filter(Boolean))
      );

      if (uniqueCoordinatorIds.length && createdEventId) {
        const results = await Promise.allSettled(
          uniqueCoordinatorIds.map((coordinatorId) =>
            (async () => {
              return api({
                ...SummaryApi.assign_coordinator_to_event,
                url: SummaryApi.assign_coordinator_to_event.url.replace(":eventId", createdEventId),
                data: { coordinatorId },
              });
            })()
          )
        );

        const successNames = [];
        const failedNames = [];
        results.forEach((result, index) => {
          const coordinatorId = uniqueCoordinatorIds[index];
          const selectedCoordinator = coordinatorOptions.find((item) => item.id === coordinatorId);
          const label = selectedCoordinator?.fullName || "Coordinator";
          if (result.status === "fulfilled") {
            successNames.push(label);
          } else {
            failedNames.push(label);
          }
        });

        if (successNames.length) {
          assignmentNote += ` Coordinators assigned: ${successNames.join(", ")}.`;
        }
        if (failedNames.length) {
          assignmentNote += ` Failed to assign: ${failedNames.join(", ")}.`;
        }
      }

      setMessage({
        type: "success",
        text: publish
          ? `Event created and published successfully.${assignmentNote}`
          : `${createResponse.data?.message || "Event created as draft."}${assignmentNote}`,
      });

      setForm(buildInitialForm());
      setPreviewUrl("");
      setCoordinatorPick("");
      setSelectedCoordinatorIds([]);
      setJudges([]);
      setMentors([]);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Unable to create event.",
      });
    } finally {
      setIsSavingDraft(false);
      setIsPublishing(false);
    }
  };

  return (
    <div className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <button
          type="button"
          onClick={() => navigate("/organizer-dashboard")}
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <section className="mt-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Create New Event</h1>
              <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
                Form fields are aligned with current backend event schema.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/organizer-dashboard")}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submitEvent({ publish: false })}
                disabled={isSavingDraft || isPublishing}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
              >
                {isSavingDraft ? <Loader2 size={14} className="animate-spin" /> : null}
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => submitEvent({ publish: true })}
                disabled={isSavingDraft || isPublishing}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
              >
                {isPublishing ? <Loader2 size={14} className="animate-spin" /> : null}
                Publish
              </button>
            </div>
          </div>

          {message && (
            <p
              className={`mt-4 text-sm rounded-lg py-2 px-3 ${
                message.type === "success"
                  ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15"
                  : "text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-500/15"
              }`}
            >
              {message.text}
            </p>
          )}

          <div className="mt-6 space-y-4">
            <section className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 p-4">
              <p className="text-sm font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                <AlertCircle size={13} className="text-indigo-500" />
                Basic Information
              </p>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Event Title</span>
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="e.g. Annual Tech Hackathon 2024"
                    className={`mt-1 ${fieldClass}`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">About the Event</span>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Brief description for the event card and detailed view."
                    className={`mt-1 ${fieldClass}`}
                  />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Category</span>
                    <select
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      className={`mt-1 ${fieldClass}`}
                    >
                      <option value="">Select category</option>
                      <option value="Technical">Technical</option>
                      <option value="Cultural">Cultural</option>
                      <option value="Sports">Sports</option>
                      <option value="Workshop">Workshop</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Event Level</span>
                    <select
                      name="visibilityScope"
                      value={form.visibilityScope}
                      onChange={handleChange}
                      className={`mt-1 ${fieldClass}`}
                    >
                      <option value="COLLEGE">College Level</option>
                      <option value="DEPARTMENT">Department Level</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Max Participants</span>
                    <input
                      type="number"
                      min="1"
                      name="maxParticipants"
                      value={form.maxParticipants}
                      onChange={handleChange}
                      placeholder="0"
                      className={`mt-1 ${fieldClass}`}
                    />
                  </label>
                </div>
                {form.visibilityScope === "DEPARTMENT" && (
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Department</span>
                    {isOrganizer ? (
                      <input
                        value={defaultDepartment || "Department not set in profile"}
                        readOnly
                        className={`mt-1 ${fieldClass} bg-slate-100 dark:bg-white/10`}
                      />
                    ) : (
                      <input
                        name="visibilityDepartment"
                        value={form.visibilityDepartment}
                        onChange={handleChange}
                        placeholder="e.g. Computer Engineering"
                        className={`mt-1 ${fieldClass}`}
                      />
                    )}
                  </label>
                )}
              </div>
            </section>

            <section className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                  <CalendarDays size={13} className="text-indigo-500" />
                  Date, Time & Venue
                </p>
                <button
                  type="button"
                  onClick={() => setMessage({ type: "success", text: "Multi-slot support is not available in this backend build; one schedule is used." })}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200"
                >
                  + Add Section
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Start Date</span>
                  <input type="date" name="startDate" value={form.startDate} onChange={handleChange} className={`mt-1 ${dateTimeFieldClass}`} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Start Time</span>
                  <input type="time" name="startTime" value={form.startTime} onChange={handleChange} className={`mt-1 ${dateTimeFieldClass}`} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">End Date</span>
                  <input type="date" name="endDate" value={form.endDate} onChange={handleChange} className={`mt-1 ${dateTimeFieldClass}`} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">End Time</span>
                  <input type="time" name="endTime" value={form.endTime} onChange={handleChange} className={`mt-1 ${dateTimeFieldClass}`} />
                </label>
                <label className="sm:col-span-2 block">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Venue / Location</span>
                  <input
                    name="venueLocation"
                    value={form.venueLocation}
                    onChange={handleChange}
                    placeholder="e.g. Auditorium Hall B, Main Campus"
                    className={`mt-1 ${fieldClass}`}
                  />
                </label>
              </div>
            </section>

            <section className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 p-4">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Registration & Participation</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Previous options restored. `Registration Last Date` is optional and defaults to `Start Date`.
              </p>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Registration Last Date</span>
                  <input
                    type="date"
                    name="registrationLastDate"
                    value={form.registrationLastDate}
                    onChange={handleChange}
                    className={`mt-1 ${dateTimeFieldClass}`}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Registration Fee (INR)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="registrationFee"
                    value={form.registrationFee}
                    onChange={handleChange}
                    placeholder="0"
                    className={`mt-1 ${fieldClass}`}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Participation Format</span>
                  <select
                    name="eventMode"
                    value={form.eventMode}
                    onChange={handleChange}
                    className={`mt-1 ${fieldClass}`}
                  >
                    <option value="INDIVIDUAL">Individual Event</option>
                    <option value="TEAM">Team Event</option>
                  </select>
                </label>

                <label className="mt-5 inline-flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    name="registrationOpen"
                    checked={form.registrationOpen}
                    onChange={handleChange}
                    className="mt-0.5 h-4 w-4 accent-indigo-600 dark:accent-indigo-400"
                  />
                  Open registration immediately after publish
                </label>
              </div>

              {form.eventMode === "TEAM" && (
                <div className="mt-3 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/10 p-3">
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Team Size Rules</p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Minimum Team Size</span>
                      <input
                        type="number"
                        min="1"
                        name="minTeamSize"
                        value={form.minTeamSize}
                        onChange={handleChange}
                        className={`mt-1 ${fieldClass}`}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Maximum Team Size</span>
                      <input
                        type="number"
                        min="2"
                        name="maxTeamSize"
                        value={form.maxTeamSize}
                        onChange={handleChange}
                        className={`mt-1 ${fieldClass}`}
                      />
                    </label>
                  </div>
                </div>
              )}
            </section>

            <section className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Assign Coordinators (Optional)</p>
                <button
                  type="button"
                  onClick={() => navigate("/organizer-dashboard/coordinator-management")}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200"
                >
                  Manage Coordinators
                </button>
              </div>
              <div className="mt-3 space-y-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Select coordinators for this event
                  </span>
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      value={coordinatorPick}
                      onChange={(event) => setCoordinatorPick(event.target.value)}
                      className={`${fieldClass} sm:flex-1`}
                      disabled={loadingCoordinatorOptions}
                    >
                      <option value="">Choose a coordinator</option>
                      {coordinatorOptions
                        .filter((item) => !selectedCoordinatorIds.includes(item.id))
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.fullName} ({item.email || "no-email"}) • {item.roleLabel}
                            {item.department ? ` • ${item.department}` : ""}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={addCoordinator}
                      disabled={!coordinatorPick}
                      className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
                    >
                      Add
                    </button>
                  </div>
                </label>

                {loadingCoordinatorOptions && (
                  <p className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 size={12} className="animate-spin" />
                    Loading coordinator list...
                  </p>
                )}

                {coordinatorOptionsError && (
                  <p className="text-xs rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
                    {coordinatorOptionsError}
                  </p>
                )}

                {!loadingCoordinatorOptions && !coordinatorOptionsError && coordinatorOptions.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {form.visibilityScope === "DEPARTMENT"
                      ? "No coordinators or students found in your department."
                      : "No coordinators or students found right now."}
                  </p>
                )}

                {selectedCoordinatorIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedCoordinatorIds.map((id) => {
                      const selected = coordinatorOptions.find((item) => item.id === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200"
                        >
                          {selected?.fullName || "Coordinator"}
                          {selected?.roleLabel ? ` • ${selected.roleLabel}` : ""}
                          {selected?.department ? ` • ${selected.department}` : ""}
                          <button
                            type="button"
                            onClick={() => removeCoordinator(id)}
                            className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-indigo-700 hover:bg-white"
                          >
                            Remove
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No coordinators selected yet.
                  </p>
                )}

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selected coordinators will be linked right after event creation.
                </p>
              </div>
            </section>

            <section className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Judges & Mentors</p>
                <button
                  type="button"
                  onClick={() => handleListAdd(setJudges, { name: "", organization: "", department: "", occupation: "" })}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300"
                >
                  <Plus size={12} />
                  Add Judge
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {judges.map((row, index) => (
                  <div key={`judge-${index}`} className="rounded-lg border border-slate-200 dark:border-white/10 p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input value={row.name} onChange={(event) => handleListItemChange(setJudges, index, "name", event.target.value)} placeholder="Judge Name" className={fieldClass} />
                      <input value={row.organization} onChange={(event) => handleListItemChange(setJudges, index, "organization", event.target.value)} placeholder="College/Company Name" className={fieldClass} />
                      <input value={row.department} onChange={(event) => handleListItemChange(setJudges, index, "department", event.target.value)} placeholder="Department" className={fieldClass} />
                      <input value={row.occupation} onChange={(event) => handleListItemChange(setJudges, index, "occupation", event.target.value)} placeholder="Occupation" className={`sm:col-span-2 ${fieldClass}`} />
                      <button type="button" onClick={() => handleListRemove(setJudges, index)} className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-3 py-2 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/15">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mentors</span>
                <button
                  type="button"
                  onClick={() => handleListAdd(setMentors, { name: "", organization: "", department: "", occupation: "" })}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300"
                >
                  <Plus size={12} />
                  Add Mentor
                </button>
              </div>
              <div className="mt-2 space-y-3">
                {mentors.map((row, index) => (
                  <div key={`mentor-${index}`} className="rounded-lg border border-slate-200 dark:border-white/10 p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input value={row.name} onChange={(event) => handleListItemChange(setMentors, index, "name", event.target.value)} placeholder="Mentor Name" className={fieldClass} />
                      <input value={row.organization} onChange={(event) => handleListItemChange(setMentors, index, "organization", event.target.value)} placeholder="College/Company Name" className={fieldClass} />
                      <input value={row.department} onChange={(event) => handleListItemChange(setMentors, index, "department", event.target.value)} placeholder="Department" className={fieldClass} />
                      <input value={row.occupation} onChange={(event) => handleListItemChange(setMentors, index, "occupation", event.target.value)} placeholder="Occupation" className={`sm:col-span-2 ${fieldClass}`} />
                      <button type="button" onClick={() => handleListRemove(setMentors, index)} className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-3 py-2 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/15">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                {judges.length === 0 && mentors.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Judges and mentors are optional and kept as event notes in frontend.</p>
                )}
              </div>
            </section>

            <section className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Schedule & Resources</p>
                <button
                  type="button"
                  onClick={() => setMessage({ type: "success", text: "Resources upload is optional and not required for publish." })}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-300"
                >
                  + Add Resource / Schedule
                </button>
              </div>

              <label className="mt-3 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-white/20 p-5 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5">
                <UploadCloud size={18} className="text-indigo-500" />
                <span className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  Upload a file or drag and drop (PNG, JPG, PDF up to 10MB)
                </span>
                <input type="file" name="resourceFile" onChange={handleChange} accept=".pdf,.png,.jpg,.jpeg" className="hidden" />
              </label>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
                Resource upload is optional.
              </p>

              <div className="mt-4 rounded-lg border border-slate-200 dark:border-white/10 p-3">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Event Poster (Required by backend)</p>
                <label className="mt-2 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-white/20 p-4 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5">
                  <UploadCloud size={18} className="text-indigo-500" />
                  <span className="mt-2 text-xs text-slate-600 dark:text-slate-300">Upload .PNG, .JPG</span>
                  <input type="file" name="poster" onChange={handleChange} accept="image/*" className="hidden" />
                </label>
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Event banner preview"
                    className="mt-3 h-36 w-full rounded-lg object-cover border border-slate-200 dark:border-white/10"
                  />
                )}
              </div>

              {!form.poster && (
                <p className="mt-3 text-xs text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/15 rounded-lg px-3 py-2 inline-flex items-center gap-2">
                  <AlertCircle size={13} />
                  Poster is required by current backend for event creation.
                </p>
              )}
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
