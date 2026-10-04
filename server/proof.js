import sharp from "sharp";
import { fail, text } from "./domain.js";

export function validateSignature(input) {
  const signer = text(input.signer, "Recipient name", 100);
  if (input.consent !== true)
    fail(400, "The recipient must confirm receipt before signing.");
  const strokes = input.strokes;
  if (!Array.isArray(strokes) || strokes.length < 1 || strokes.length > 60)
    fail(400, "Draw the recipient signature.");
  let points = 0,
    length = 0;
  for (const stroke of strokes) {
    if (!Array.isArray(stroke) || stroke.length > 1500)
      fail(400, "Invalid signature.");
    for (let i = 0; i < stroke.length; i++) {
      const p = stroke[i];
      if (
        !Array.isArray(p) ||
        p.length !== 2 ||
        p.some(
          (v) => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1,
        )
      )
        fail(400, "Invalid signature coordinates.");
      points++;
      if (i)
        length += Math.hypot(p[0] - stroke[i - 1][0], p[1] - stroke[i - 1][1]);
    }
  }
  if (points < 4 || points > 10000 || length < 0.08)
    fail(400, "Draw a complete signature, not just a dot.");
  return { signer, strokes, consent: true };
}
export async function normalizePhoto(value) {
  if (typeof value !== "string") fail(400, "A delivery photo is required.");
  const match =
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) fail(400, "Upload a JPEG, PNG, or WebP photo.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 4 * 1024 * 1024)
    fail(413, "Photo must be 4 MB or smaller.");
  try {
    const image = sharp(bytes, {
      limitInputPixels: 24_000_000,
      failOn: "error",
    });
    const meta = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format) ||
      meta.pages > 1 ||
      meta.width < 32 ||
      meta.height < 32
    )
      fail(400, "Use a clear, single-frame delivery photo.");
    // Re-encode verified pixels; strip EXIF/GPS and never serve uploaded file names or active content.
    return await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (e) {
    if (e.status) throw e;
    fail(400, "The image could not be read. Choose another photo.");
  }
}
