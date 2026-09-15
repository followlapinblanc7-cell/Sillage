/** Resize & compress a picked image to a JPEG data URL (localStorage-friendly). */
export async function fileToDataUrl(
  file: File,
  maxEdge = 1280,
  quality = 0.72,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    return canvasFromSize(bitmap.width, bitmap.height, maxEdge, quality, (ctx, w, h) => {
      ctx.drawImage(bitmap, 0, 0, w, h);
    });
  } finally {
    bitmap.close();
  }
}

/** Compress a canvas (or video frame drawn onto one) to a JPEG data URL. */
export function canvasToDataUrl(
  source: HTMLCanvasElement | HTMLVideoElement,
  maxEdge = 1280,
  quality = 0.72,
): string {
  const sw =
    source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const sh =
    source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!sw || !sh) {
    throw new Error('Image indisponible');
  }
  return canvasFromSize(sw, sh, maxEdge, quality, (ctx, w, h) => {
    ctx.drawImage(source, 0, 0, w, h);
  });
}

function canvasFromSize(
  srcW: number,
  srcH: number,
  maxEdge: number,
  quality: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): string {
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas indisponible');
  }
  draw(ctx, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}
