import { compressMomentImage, MAX_PHOTO_BYTES } from "./momentImage";

export const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 30;
const PREPARATION_TIMEOUT_MS = 15_000;

export type PreparedMomentMedia = { file: File; originalBytes: number; durationSeconds?: number };

// Every preparation can be replaced, removed or abandoned without stale UI updates.
function boundedPreparation<T>(
  signal: AbortSignal,
  start: (resolve: (value: T) => void, reject: (error: Error) => void) => () => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Canceled", "AbortError")); return; }
    let cleanup = () => {};
    let settled = false;
    const finish = (error?: Error, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      cleanup();
      if (error) reject(error); else resolve(value as T);
    };
    const abort = () => finish(new DOMException("Canceled", "AbortError"));
    const timer = setTimeout(() => finish(new Error("Preparing this file took too long. Try a smaller photo or a shorter MP4 video.")), PREPARATION_TIMEOUT_MS);
    signal.addEventListener("abort", abort, { once: true });
    try {
      cleanup = start((value) => finish(undefined, value), (error) => finish(error));
      if (settled) cleanup();
    } catch (error) {
      finish(error instanceof Error ? error : new Error("Could not read this file."));
    }
  });
}

async function preparePhoto(file: File, signal: AbortSignal): Promise<File> {
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    throw new Error("Choose a JPG, PNG or WebP photo. Animated GIFs and SVGs are not supported for Moments.");
  }
  const blob = await boundedPreparation<Blob>(signal, (resolve, reject) => {
    if (typeof Worker === "function" && typeof OffscreenCanvas === "function" && typeof createImageBitmap === "function") {
      const worker = new Worker(new URL("./momentImage.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<{ blob?: Blob; error?: string }>) => {
        if (event.data.blob) resolve(event.data.blob);
        else reject(new Error(event.data.error || "Could not optimize this photo. Try a JPG or PNG."));
      };
      worker.onerror = () => reject(new Error("Photo processing is unavailable. Try another browser or a smaller photo."));
      worker.postMessage(file);
      return () => worker.terminate();
    }
    // Older browsers use a bounded, small canvas and native async encoding.
    // Yield first so the preparing indicator can paint before native decoding.
    const timer = setTimeout(() => {
      void compressMomentImage(file).then(resolve, () => reject(new Error("This photo could not be optimized. Try a smaller JPG or PNG.")));
    }, 0);
    return () => clearTimeout(timer);
  });
  if (!blob.size || blob.size > MAX_PHOTO_BYTES) throw new Error("Choose a smaller photo (optimized photos must be under 2 MB).");
  if (blob === file) return file;
  const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${extension}`, { type: blob.type });
}

function readVideoDuration(file: File, signal: AbortSignal): Promise<number> {
  return boundedPreparation<number>(signal, (resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth || !video.videoHeight) {
        reject(new Error("Could not read this video's duration. Export it as MP4 and try again."));
      } else if (video.duration > MAX_VIDEO_SECONDS) {
        reject(new Error(`This video is ${Math.ceil(video.duration)} seconds long. Trim it to ${MAX_VIDEO_SECONDS} seconds or less before uploading.`));
      } else resolve(video.duration);
    };
    video.onerror = () => reject(new Error("This browser cannot read this video. Export it as MP4 (H.264) and try again."));
    video.src = url;
    return () => {
      video.onloadedmetadata = video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
  });
}

export async function prepareMomentMedia(file: File, signal: AbortSignal): Promise<PreparedMomentMedia> {
  if (signal.aborted) throw new DOMException("Canceled", "AbortError");
  if (!file.size) throw new Error("This file is empty. Choose another photo or video.");
  if (file.type.startsWith("video/")) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error("This video exceeds 20 MB. Trim it or export a smaller copy (720p or 1080p) before uploading.");
    const durationSeconds = await readVideoDuration(file, signal);
    return { file, originalBytes: file.size, durationSeconds };
  }
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo or video file.");
  if (file.size >= MAX_SOURCE_BYTES) throw new Error("This photo is too large to prepare on your phone. Choose a photo smaller than 50 MB.");
  return { file: await preparePhoto(file, signal), originalBytes: file.size };
}
