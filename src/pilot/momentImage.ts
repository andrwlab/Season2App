export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1920;

// Shared by the worker and the native canvas fallback. No video encoder is loaded.
export async function compressMomentImage(file: File): Promise<Blob> {
  let source: ImageBitmap | HTMLImageElement;
  let objectUrl: string | undefined;
  if (typeof createImageBitmap === "function") {
    source = await createImageBitmap(file);
  } else {
    objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.src = objectUrl;
    try {
      await image.decode();
      source = image;
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  }

  try {
    const width = "naturalWidth" in source ? source.naturalWidth : source.width;
    const height = "naturalHeight" in source ? source.naturalHeight : source.height;
    if (!width || !height) throw new Error("Invalid photo dimensions.");
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = typeof OffscreenCanvas === "function"
      ? new OffscreenCanvas(targetWidth, targetHeight)
      : Object.assign(document.createElement("canvas"), { width: targetWidth, height: targetHeight });
    try {
      const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      if (!context) throw new Error("Photo processing is unavailable.");
      // WebP preserves transparency for PNG/WebP input; JPEG suits camera photos.
      const mime = /image\/(png|webp)/.test(file.type) ? "image/webp" : "image/jpeg";
      context.drawImage(source, 0, 0, targetWidth, targetHeight);
      for (const quality of [0.86, 0.78, 0.7]) {
        const blob = "convertToBlob" in canvas
          ? await canvas.convertToBlob({ type: mime, quality })
          : await new Promise<Blob>((resolve, reject) => canvas.toBlob(
              (value) => value ? resolve(value) : reject(new Error("Photo processing failed.")),
              mime, quality
            ));
        if (blob.size <= MAX_PHOTO_BYTES) {
          // Avoid inflating or re-encoding a small, already web-compatible photo.
          return scale === 1 && /image\/(jpeg|png|webp)/.test(file.type) && file.size <= blob.size
            ? file : blob;
        }
      }
      throw new Error("This photo is too detailed to optimize quickly. Choose a smaller JPG or PNG.");
    } finally {
      canvas.width = canvas.height = 1;
    }
  } finally {
    if ("close" in source) source.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
