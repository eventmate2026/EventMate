import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Loader2, UploadCloud } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";

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
};

export default function OrganizerCreateEvent() {
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!form.poster) {
      setPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(form.poster);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [form.poster]);

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
    setForm((prev) => ({ ...prev, [name]: value }));
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
    if (!form.registrationLastDate) return "Registration last date is required.";
    if (!form.maxParticipants || Number(form.maxParticipants) < 1) {
      return "Max participants must be at least 1.";
    }

    if (new Date(form.registrationLastDate) > new Date(form.startDate)) {
      return "Registration last date cannot be after event start date.";
    }

    if (form.eventMode === "TEAM") {
      const minTeam = Number(form.minTeamSize || 2);
      const maxTeam = Number(form.maxTeamSize || 4);
      if (minTeam < 1 || maxTeam <= 1 || maxTeam < minTeam) {
        return "Team size values are invalid.";
      }
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
        lastDate: form.registrationLastDate,
        maxParticipants: Number(form.maxParticipants),
        fee: Number(form.registrationFee || 0),
      })
    );

    payload.append("certificate", JSON.stringify({ isEnabled: true }));
    payload.append("feedback", JSON.stringify({ enabled: true }));

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
          url: `/api/events/${createdEventId}/publish`,
          method: "patch",
        });
      }

      setMessage({
        type: "success",
        text: publish
          ? "Event created and published successfully."
          : createResponse.data?.message || "Event created as draft.",
      });

      setForm(initialForm);
      setPreviewUrl("");
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

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-4">
            <div className="space-y-4">
              <section className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 p-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Basic Information</h2>
                <div className="mt-3 space-y-3">
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Event title"
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm"
                  />
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Event description"
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm"
                  />
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm"
                  >
                    <option value="">Select category</option>
                    <option value="Technical">Technical</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Sports">Sports</option>
                    <option value="Workshop">Workshop</option>
                  </select>
                </div>
              </section>

              <section className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 p-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Schedule & Venue</h2>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="date" name="startDate" value={form.startDate} onChange={handleChange} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />
                  <input type="time" name="startTime" value={form.startTime} onChange={handleChange} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />
                  <input type="date" name="endDate" value={form.endDate} onChange={handleChange} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />
                  <input type="time" name="endTime" value={form.endTime} onChange={handleChange} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />
                  <input
                    name="venueLocation"
                    value={form.venueLocation}
                    onChange={handleChange}
                    placeholder="Venue location"
                    className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm"
                  />
                </div>
              </section>

              <section className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 p-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Registration</h2>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="date"
                    name="registrationLastDate"
                    value={form.registrationLastDate}
                    onChange={handleChange}
                    className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm"
                  />
                  <input
                    type="number"
                    min="1"
                    name="maxParticipants"
                    value={form.maxParticipants}
                    onChange={handleChange}
                    placeholder="Max participants"
                    className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="registrationFee"
                    value={form.registrationFee}
                    onChange={handleChange}
                    placeholder="Fee"
                    className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm"
                  />
                  <select
                    name="eventMode"
                    value={form.eventMode}
                    onChange={handleChange}
                    className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm"
                  >
                    <option value="INDIVIDUAL">Individual Event</option>
                    <option value="TEAM">Team Event</option>
                  </select>
                </div>

                {form.eventMode === "TEAM" && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="number"
                      min="1"
                      name="minTeamSize"
                      value={form.minTeamSize}
                      onChange={handleChange}
                      placeholder="Min team size"
                      className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm"
                    />
                    <input
                      type="number"
                      min="2"
                      name="maxTeamSize"
                      value={form.maxTeamSize}
                      onChange={handleChange}
                      placeholder="Max team size"
                      className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm"
                    />
                  </div>
                )}

                <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    name="registrationOpen"
                    checked={form.registrationOpen}
                    onChange={handleChange}
                    className="h-4 w-4"
                  />
                  Open registration immediately
                </label>
              </section>
            </div>

            <div className="space-y-4">
              <section className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 p-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Event Banner</h2>
                <label className="mt-3 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-white/20 p-5 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5">
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
              </section>

              {!form.poster && (
                <p className="text-xs text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/15 rounded-lg px-3 py-2 inline-flex items-center gap-2">
                  <AlertCircle size={13} />
                  Poster is required by current backend for event creation.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
