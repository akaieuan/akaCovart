export function rgb(c: number[]): string {
  return "rgb(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ")";
}

export function rgba(c: number[], a: number): string {
  return (
    "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + a + ")"
  );
}

// Ported verbatim from the prototype (index.html). Hue rotation via HSL.
export function huerot(c: number[], deg: number): number[] {
  if (!deg) return c;
  const r = c[0] / 255,
    g = c[1] / 255,
    b = c[2] / 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2;
  let h = 0,
    s = 0;
  const dd = mx - mn;
  if (dd !== 0) {
    s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
    if (mx === r) h = (g - b) / dd + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / dd + 2;
    else h = (r - g) / dd + 4;
    h *= 60;
  }
  h = (((h + deg) % 360) + 360) % 360;
  function h2(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  let rr: number, gg: number, bb: number;
  if (s === 0) {
    rr = gg = bb = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s,
      pp = 2 * l - q,
      hh = h / 360;
    rr = h2(pp, q, hh + 1 / 3);
    gg = h2(pp, q, hh);
    bb = h2(pp, q, hh - 1 / 3);
  }
  return [Math.round(rr * 255), Math.round(gg * 255), Math.round(bb * 255)];
}
