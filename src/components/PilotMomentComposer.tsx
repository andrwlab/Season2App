import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { prepareMomentMedia, type PreparedMomentMedia } from "../pilot/momentMedia";
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

const publishErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return "Moment could not be published. Check your connection and try again.";
  return error.message || "Moment could not be published. Check your connection and try again.";
};

const uploadToCloudinary = (file: File, onProgress: (value: number) => void) => new Promise<{ url: string; publicId: string }>((resolve, reject) => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "nuxctlvg";
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "scorekeeper_photos";
  const request = new XMLHttpRequest();
  request.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
  request.upload.onprogress = (event) => {
    if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
  };
  request.onerror = () => reject(new Error("Cloudinary upload failed. Check your internet connection."));
  request.onload = () => {
    try {
      const response = JSON.parse(request.responseText) as { secure_url?: string; public_id?: string; error?: { message?: string } };
      if (request.status >= 200 && request.status < 300 && response.secure_url) resolve({ url: response.secure_url, publicId: response.public_id || "" });
      else reject(new Error(response.error?.message || "Cloudinary rejected this upload."));
    } catch { reject(new Error("Cloudinary returned an invalid upload response.")); }
  };
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", uploadPreset);
  request.send(body);
});

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
  const [media, setMedia] = useState<PreparedMomentMedia | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const preparation = useRef<AbortController | null>(null);
  const publishing = useRef(false);
  const [publishStage, setPublishStage] = useState<PublishStage>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const busy = publishStage !== "IDLE";
  const minuteLabel = useMemo(() => formatMomentMinute(matchClockMs), [matchClockMs]);

  useEffect(() => () => {
    preparation.current?.abort();
  }, []);

  const removeMedia = () => {
    preparation.current?.abort();
    preparation.current = null;
    setMedia(null);
    setSelectedName("");
    setPreparing(false);
    setMediaError(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const selectMedia = async (selected: File | null) => {
    removeMedia();
    setError(null);
    setSuccess(null);
    if (!selected) return;
    const controller = new AbortController();
    preparation.current = controller;
    setSelectedName(selected.name);
    setPreparing(true);
    try {
      const result = await prepareMomentMedia(selected, controller.signal);
      if (!controller.signal.aborted) setMedia(result);
    } catch (err) {
      if (!controller.signal.aborted) setMediaError(err instanceof Error ? err.message : "Could not prepare this file.");
    } finally {
      if (!controller.signal.aborted) setPreparing(false);
    }
  };

  const clearForm = () => {
    setTitle("");
    setPlayerName("");
    setCaption("");
    removeMedia();
  };

  const publishMoment = async (event: FormEvent) => {
    event.preventDefault();
    if (publishing.current || preparing || mediaError || (selectedName && !media)) return;

    setError(null);
    setSuccess(null);

    publishing.current = true;
    const file = media?.file;
    try {
      const momentRef = doc(collection(db, PILOT_MOMENTS_COLLECTION));
      let mediaUrl: string | undefined;
      let storagePath: string | undefined;
      let mediaType: PilotMomentMediaType | undefined;

      if (file) {
        setPublishStage("UPLOADING");
        setUploadProgress(0);
        mediaType = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
        const uploaded = await uploadToCloudinary(file, setUploadProgress);
        mediaUrl = uploaded.url;
        storagePath = uploaded.publicId || undefined;
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
      publishing.current = false;
      setPublishStage("IDLE");
    }
  };

  const buttonLabel =
    preparing
      ? "PREPARING MEDIA…"
      : publishStage === "UPLOADING"
        ? `UPLOADING MEDIA… ${uploadProgress}%`
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
        <fieldset disabled={busy} className="min-w-0 space-y-3">
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
              ref={fileInput}
              type="file"
              accept="image/*,video/*"
              aria-describedby="moment-media-help moment-media-status"
              onChange={(event) => void selectMedia(event.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:text-xs file:font-black file:text-slate-950"
            />
            <p id="moment-media-help" className="mt-2 text-xs text-slate-400">Photos are optimized automatically. Videos: up to 30 seconds and 20 MB. Trim larger clips before uploading.</p>
          </label>
          <div id="moment-media-status" role="status" aria-live="polite" className="text-xs text-slate-300">
            {selectedName && <p className="truncate">{selectedName}</p>}
            {preparing && <p className="mt-1 text-cyan-200">Preparing your file… You can keep filling in your Moment.</p>}
            {media && <p className="mt-1 text-emerald-200">
              Ready · {(media.file.size / 1024 / 1024).toFixed(2)} MB
              {media.file.size < media.originalBytes && ` (was ${(media.originalBytes / 1024 / 1024).toFixed(2)} MB)`}
              {media.durationSeconds !== undefined && ` · ${Math.ceil(media.durationSeconds)} sec`}
            </p>}
          </div>
          {mediaError && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">{mediaError}</p>}
          {selectedName && <button type="button" onClick={removeMedia} className="text-xs font-bold text-slate-300 underline">Remove media</button>}
        </fieldset>

        {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">{error}</p>}
        {success && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200">{success}</p>}

        <button
          type="submit"
          disabled={busy || preparing || !!mediaError || (!!selectedName && !media)}
          aria-busy={busy || preparing}
          className="w-full rounded-xl bg-cyan-300 px-4 py-3.5 text-sm font-black text-slate-950 active:scale-[0.99] disabled:opacity-50"
        >
          {(busy || preparing) && <span aria-hidden="true" className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950 align-[-0.15em]" />}
          {buttonLabel}
        </button>
      </form>
    </section>
  );
};

export default PilotMomentComposer;
