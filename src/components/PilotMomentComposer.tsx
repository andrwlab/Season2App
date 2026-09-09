import React, { FormEvent, useMemo, useState } from "react";
import { FirebaseError } from "firebase/app";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase";
import {
  PILOT_MOMENTS_COLLECTION,
  PilotMomentMediaType,
  PilotMomentType,
  formatMomentMinute,
} from "../pilot/moments";

type Props = {
  tournamentId: string;
  matchId: string;
  pilotMatchId: string;
  matchClockMs: number;
  homeName: string;
  awayName: string;
};

type PublishStage = "IDLE" | "UPLOADING" | "SAVING";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const MOMENT_TYPES: PilotMomentType[] = [
  "GOAL",
  "HIGHLIGHT",
  "PHOTO",
  "MATCH_START",
  "HALFTIME",
  "MATCH_END",
  "AWARD",
  "OTHER",
];

const safeExtension = (file: File) => {
  const raw = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (raw) return raw;
  return file.type.startsWith("video/") ? "mp4" : "jpg";
};

const publishErrorMessage = (error: unknown) => {
  if (!(error instanceof FirebaseError)) {
    return "Moment could not be published. Check your connection and try again.";
  }

  switch (error.code) {
    case "storage/quota-exceeded":
      return "Media upload is unavailable for this Firebase Storage plan or quota. Firebase Storage now requires the Blaze plan; publish without media or enable Storage billing before retrying.";
    case "storage/retry-limit-exceeded":
      return "Media upload timed out. If this Firebase project is on Spark, Storage will not accept uploads; otherwise check Storage access and try again.";
    case "storage/unauthorized":
      return "Storage denied this upload. Confirm you are signed in as an admin and that storage.rules are deployed.";
    case "storage/bucket-not-found":
      return "No Firebase Storage bucket is available for this project.";
    case "storage/project-not-found":
      return "Firebase Storage could not find the configured project.";
    case "storage/unknown":
      return `Firebase Storage could not complete the upload${error.message ? `: ${error.message}` : "."}`;
    case "permission-denied":
    case "firestore/permission-denied":
      return "Firestore denied the Moment record. Confirm your admin session and Firestore rules.";
    default:
      return `Moment could not be published (${error.code}). ${error.message || "Please try again."}`;
  }
};

const PilotMomentComposer = ({
  tournamentId,
  matchId,
  pilotMatchId,
  matchClockMs,
  homeName,
  awayName,
}: Props) => {
  const [type, setType] = useState<PilotMomentType>("GOAL");
  const [teamSide, setTeamSide] = useState<"HOME" | "AWAY" | "">("");
  const [title, setTitle] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [publishStage, setPublishStage] = useState<PublishStage>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const busy = publishStage !== "IDLE";
  const minuteLabel = useMemo(() => formatMomentMinute(matchClockMs), [matchClockMs]);

  const clearForm = () => {
    setTitle("");
    setPlayerName("");
    setCaption("");
    setFile(null);
  };

  const publishMoment = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setError(null);
    setSuccess(null);

    if (file && file.size > MAX_FILE_BYTES) {
      setError("Media must be smaller than 50 MB for this MVP.");
      return;
    }

    if (file && !file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("Only image and video files are supported.");
      return;
    }

    try {
      const momentRef = doc(collection(db, PILOT_MOMENTS_COLLECTION));
      let mediaUrl: string | undefined;
      let storagePath: string | undefined;
      let mediaType: PilotMomentMediaType | undefined;

      if (file) {
        setPublishStage("UPLOADING");
        mediaType = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
        storagePath = `pilotMoments/${tournamentId}/${matchId}/${momentRef.id}.${safeExtension(file)}`;
        const mediaRef = ref(storage, storagePath);
        await uploadBytes(mediaRef, file, { contentType: file.type });
        mediaUrl = await getDownloadURL(mediaRef);
      }

      setPublishStage("SAVING");

      const defaultTitle =
        type === "GOAL"
          ? `Goal${teamSide ? ` · ${teamSide === "HOME" ? homeName : awayName}` : ""}`
          : type.replaceAll("_", " ");

      await setDoc(momentRef, {
        version: 1,
        momentId: momentRef.id,
        tournamentId,
        matchId,
        pilotMatchId,
        type,
        title: title.trim() || defaultTitle,
        ...(caption.trim() ? { caption: caption.trim() } : {}),
        ...(playerName.trim() ? { playerName: playerName.trim() } : {}),
        ...(teamSide ? { teamSide } : {}),
        matchClockMs,
        ...(mediaType ? { mediaType } : {}),
        ...(mediaUrl ? { mediaUrl } : {}),
        ...(storagePath ? { storagePath } : {}),
        featured: type === "GOAL" || type === "HIGHLIGHT",
        status: "PUBLISHED",
        clientCreatedAt: Date.now(),
        createdAt: serverTimestamp(),
      });

      setSuccess(`Published ${type.replaceAll("_", " ")}${minuteLabel ? ` at ${minuteLabel}` : ""}.`);
      clearForm();
    } catch (err) {
      console.error("Failed to publish pilot moment", err);
      setError(publishErrorMessage(err));
    } finally {
      setPublishStage("IDLE");
    }
  };

  const buttonLabel =
    publishStage === "UPLOADING"
      ? "UPLOADING MEDIA…"
      : publishStage === "SAVING"
        ? "SAVING MOMENT…"
        : "PUBLISH MOMENT";

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-cyan-300">Spectator content</p>
          <h2 className="mt-1 text-lg font-black">Add Moment</h2>
          <p className="mt-1 text-xs text-slate-400">Publish a photo, video or match moment without leaving the scorer.</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-800 px-2.5 py-1 font-mono text-xs font-black text-cyan-200">
          {minuteLabel || "—"}
        </span>
      </div>

      <form onSubmit={publishMoment} className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Type</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as PilotMomentType)}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300"
            >
              {MOMENT_TYPES.map((item) => (
                <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Team</span>
            <select
              value={teamSide}
              onChange={(event) => setTeamSide(event.target.value as "HOME" | "AWAY" | "")}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300"
            >
              <option value="">None</option>
              <option value="HOME">{homeName}</option>
              <option value="AWAY">{awayName}</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Player / subject</span>
          <input
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="Optional"
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Optional — a default title is generated"
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Caption</span>
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={2}
            placeholder="Optional context for spectators"
            className="w-full resize-none rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300"
          />
        </label>

        <label className="block rounded-xl border border-dashed border-white/15 bg-black/20 px-3 py-3">
          <span className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Photo / video</span>
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:text-xs file:font-black file:text-slate-950"
          />
          {file && <p className="mt-2 truncate text-xs text-slate-400">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
        </label>

        {error && <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">{error}</p>}
        {success && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200">{success}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-cyan-300 px-4 py-3.5 text-sm font-black text-slate-950 active:scale-[0.99] disabled:opacity-50"
        >
          {buttonLabel}
        </button>
      </form>
    </section>
  );
};

export default PilotMomentComposer;
