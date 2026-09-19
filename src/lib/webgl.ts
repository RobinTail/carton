let cached: boolean | undefined;

/**
 * Whether the browser can give us a WebGL context at all — false when hardware
 * acceleration is off, the GPU is blocklisted, or the sandbox refuses it.
 *
 * Deliberately free of any three.js import: checking before mounting the canvas
 * means a machine that cannot render never downloads the 3D chunk. Memoised,
 * because each probe costs a real context and browsers cap how many exist.
 */
export function isWebGLAvailable(): boolean {
  cached ??= probe();
  return cached;
}

function probe(): boolean {
  if (typeof document === "undefined") return false;

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    if (!gl) return false;

    // Hand the context straight back rather than waiting for the GC.
    const lose = (gl as WebGLRenderingContext).getExtension(
      "WEBGL_lose_context",
    );
    lose?.loseContext();
    return true;
  } catch {
    // Some builds throw rather than returning null.
    return false;
  }
}
