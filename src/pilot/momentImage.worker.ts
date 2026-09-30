import { compressMomentImage } from "./momentImage";

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    self.postMessage({ blob: await compressMomentImage(event.data) });
  } catch {
    self.postMessage({ error: "This photo could not be optimized. Try a smaller JPG or PNG." });
  }
};
