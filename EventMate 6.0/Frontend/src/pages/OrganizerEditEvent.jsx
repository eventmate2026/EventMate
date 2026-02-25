import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { extractEventItem } from "../lib/backendAdapters";

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
  status: "Draft",
};

const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export default function OrganizerEditEvent() {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState(null);

  const loadEvent = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await api({
        ...SummaryApi.get_public_event_details,
        url: SummaryApi.get_public_event_details.url.replace(":eventId", eventId),
      });

      const event = extractEventItem(response.data);
      if (!event) {
        setMessage({ type: "error", text: "Event not found or access denied." });
        setLoading(false);
        return;
      }

      setForm({
        title: event.title || "",
        description: event.description || "",
        category: event.category || "",
        venueLocation: event.venue?.location || "",
        startDate: toDateInput(event.schedule?.startDate),
        startTime: event.schedule?.startTime || "",
        endDate: toDateInput(event.schedule?.endDate),
        endTime: event.schedule?.endTime || "",
        registrationLastDate: toDateInput(event.registration?.lastDate),
        maxParticipants: event.registration?.maxParticipants ? String(event.registration.maxParticipants) : "",
        registrationOpen: Boolean(event.registration?.isOpen),
        registrationFee: typeof event.registration?.fee === "number" ? String(event.registration.fee) : "0",
        eventMode: event.isTeamEvent ? "TEAM" : "INDIVIDUAL",
        minTeamSize: event.minTeamSize ? String(event.minTeamSize) : "2",
        maxTeamSize: event.maxTeamSize ? String(event.maxTeamSize) : "4",
        status: event.status || "Draft",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Unable to load event details.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (type === "checkbox") {
      setForm((prev) => ({ ...prev, [name]: checked }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!form.title.trim() || !form.description.trim() || !form.category) {
      return "Title, description and category are required.";
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
    const isTeamEvent = form.eventMode === "TEAM";
    return {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      venue: {
        mode: "OFFLINE",
        location: form.venueLocation.trim(),
      },
      schedule: {
        startDate: form.startDate,
        endDate: form.endDate,
        startTime: form.startTime,
        endTime: form.endTime,
      },
      registration: {
        isOpen: Boolean(form.registrationOpen),
        lastDate: form.registrationLastDate,
        maxParticipants: Number(form.maxParticipants),
        fee: Number(form.registrationFee || 0),
      },
      certificate: { isEnabled: true },
      feedback: { enabled: true },
      isTeamEvent,
      minTeamSize: isTeamEvent ? Number(form.minTeamSize || 2) : 1,
      maxTeamSize: isTeamEvent ? Number(form.maxTeamSize || 4) : 1,
    };
  };

  const handleSave = async () => {
    setMessage(null);

    if (form.status !== "Draft") {
      setMessage({ type: "error", text: "Only Draft events can be updated by this backend." });
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    setIsSaving(true);
    try {
      const response = await api({
        ...SummaryApi.update_event,
        url: SummaryApi.update_event.url.replace(":eventId", eventId),
        data: buildPayload(),
      });

      setMessage({ type: "success", text: response.data?.message || "Event updated successfully." });
      await loadEvent();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Unable to update event.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (form.status !== "Draft") {
      setMessage({ type: "error", text: "Only draft events can be published." });
      return;
    }

    setIsPublishing(true);
    setMessage(null);
    try {
      const response = await api({
        url: `/api/events/${eventId}/publish`,
        method: "patch",
      });
      setMessage({ type: "success", text: response.data?.message || "Event published successfully." });
      await loadEvent();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Unable to publish event.",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto text-sm text-slate-600 dark:text-slate-300 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Loading event...
        </div>
      </div>
    );
  }

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

        <section className="mt-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Edit Event</h1>
              <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
                Backend allows editing only while status is Draft.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isPublishing || form.status !== "Draft"}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                Save Changes
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={isSaving || isPublishing || form.status !== "Draft"}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
              >
                {isPublishing ? <Loader2 size={14} className="animate-spin" /> : null}
                Publish
              </button>
            </div>
          </div>

          {message && (
            <p
              className={`text-sm rounded-lg py-2 px-3 ${
                message.type === "success"
                  ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15"
                  : "text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-500/15"
              }`}
            >
              {message.text}
            </p>
          )}

          {form.status !== "Draft" && (
            <p className="text-xs text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/15 rounded-lg px-3 py-2 inline-flex items-center gap-2">
              <AlertCircle size={13} />
              This event is {form.status}. Editing is disabled by backend policy.
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <input name="title" value={form.title} onChange={handleChange} placeholder="Event title" className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />
            <input name="venueLocation" value={form.venueLocation} onChange={handleChange} placeholder="Venue location" className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />
            <textarea name="description" value={form.description} onChange={handleChange} rows={4} placeholder="Event description" className="lg:col-span-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />
            <select name="category" value={form.category} onChange={handleChange} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm">
              <option value="">Select category</option>
              <option value="Technical">Technical</option>
              <option value="Cultural">Cultural</option>
              <option value="Sports">Sports</option>
              <option value="Workshop">Workshop</option>
            </select>
            <input value={form.status} readOnly className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2.5 text-sm" />

            <input type="date" name="startDate" value={form.startDate} onChange={handleChange} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />
            <input type="time" name="startTime" value={form.startTime} onChange={handleChange} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />
            <input type="date" name="endDate" value={form.endDate} onChange={handleChange} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />
            <input type="time" name="endTime" value={form.endTime} onChange={handleChange} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />

            <input type="date" name="registrationLastDate" value={form.registrationLastDate} onChange={handleChange} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />
            <input type="number" min="1" name="maxParticipants" value={form.maxParticipants} onChange={handleChange} placeholder="Max participants" className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />
            <input type="number" min="0" step="0.01" name="registrationFee" value={form.registrationFee} onChange={handleChange} placeholder="Fee" className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />

            <select name="eventMode" value={form.eventMode} onChange={handleChange} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm">
              <option value="INDIVIDUAL">Individual Event</option>
              <option value="TEAM">Team Event</option>
            </select>

            {form.eventMode === "TEAM" && (
              <>
                <input type="number" min="1" name="minTeamSize" value={form.minTeamSize} onChange={handleChange} placeholder="Min team size" className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />
                <input type="number" min="2" name="maxTeamSize" value={form.maxTeamSize} onChange={handleChange} placeholder="Max team size" className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm" />
              </>
            )}

            <label className="lg:col-span-2 inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" name="registrationOpen" checked={form.registrationOpen} onChange={handleChange} className="h-4 w-4" />
              Open registration
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
