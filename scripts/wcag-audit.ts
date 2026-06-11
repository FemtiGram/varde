/**
 * WCAG 2.1 contrast audit for the token set in globals.css.
 * All app text is < 18.66px bold / 24px, so the requirement is 4.5:1 (AA).
 * Run: npx tsx scripts/wcag-audit.ts
 */

function oklchToLinearRgb(L: number, C: number, Hdeg: number) {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
}

function luminance(rgb: number[]) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function ratio(fg: number[], bg: number[]) {
  const l1 = luminance(fg), l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Alpha-blend fg over bg in linear space (approximation for tinted chips) */
function blend(fg: number[], bg: number[], alpha: number) {
  return fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));
}

// Tokens from globals.css
const T: Record<string, number[]> = {
  background: oklchToLinearRgb(0.17, 0.012, 250),
  card: oklchToLinearRgb(0.21, 0.014, 250),
  accent: oklchToLinearRgb(0.28, 0.02, 240),
  foreground: oklchToLinearRgb(0.93, 0.008, 250),
  "muted-foreground": oklchToLinearRgb(0.72, 0.014, 250),
  primary: oklchToLinearRgb(0.85, 0.1, 220),
  "primary-foreground": oklchToLinearRgb(0.18, 0.02, 250),
  "status-critical": oklchToLinearRgb(0.68, 0.19, 25),
  "status-warning": oklchToLinearRgb(0.82, 0.15, 85),
  "status-info": oklchToLinearRgb(0.78, 0.1, 230),
  "status-ok": oklchToLinearRgb(0.76, 0.13, 155),
  selection: oklchToLinearRgb(0.85, 0.12, 195),
  infra: oklchToLinearRgb(0.74, 0.16, 330),
  "contact-unknown": oklchToLinearRgb(0.95, 0.01, 250),
  "contact-ais": oklchToLinearRgb(0.78, 0.1, 155),
};

const checks: [string, string, string, number[]?][] = [
  // [text colour, surface, where it appears]
  ["foreground", "background", "brødtekst / radtittel"],
  ["foreground", "card", "paneler, hendelsesliste"],
  ["foreground", "accent", "valgt hendelsesrad"],
  ["muted-foreground", "background", "sekundærtekst 11-12px"],
  ["muted-foreground", "card", "metadata i paneler"],
  ["muted-foreground", "accent", "metadata i valgt rad"],
  ["status-critical", "background", "kritisk-pille tekst 11px"],
  ["status-critical", "card", "kritisk i paneler"],
  ["status-critical", "chip-critical", "pille på tonet flate", blend(T["status-critical"], T.card, 0.15)],
  ["status-warning", "background", "advarsel-tekst 11px"],
  ["status-warning", "card", "advarsel i paneler"],
  ["status-info", "background", "info-tekst 11px"],
  ["status-ok", "background", "ok-tekst 11px"],
  ["selection", "background", "valgt markør-etikett 10px"],
  ["selection", "accent", "valgt-kant i liste"],
  ["primary-foreground", "primary", "primærknapp"],
  ["infra", "background", "korridoretikett 10px"],
  ["contact-unknown", "background", "ukjent kontakt-markør"],
  ["contact-ais", "background", "normal trafikk-markør (grafikk)"],
];

let failures = 0;
for (const [fgName, bgName, where, customBg] of checks) {
  const fg = T[fgName];
  const bg = customBg ?? T[bgName];
  const r = ratio(fg, bg);
  const pass = r >= 4.5;
  const grafikkOk = r >= 3;
  if (!pass) failures++;
  console.log(
    `${pass ? "✓" : grafikkOk ? "△" : "✗"} ${r.toFixed(2).padStart(5)}:1  ${fgName} på ${bgName}  (${where})`
  );
}
console.log(failures === 0 ? "\nAlle tekstpar ≥ 4.5:1 ✓" : `\n${failures} par under 4.5:1 (△ = ok kun for grafikk/store tekster)`);

// Tuning helper: find a critical L and tint alpha that clears 4.5 on the chip
for (const L of [0.7, 0.72, 0.74]) {
  for (const alpha of [0.1, 0.12, 0.15]) {
    const crit = oklchToLinearRgb(L, 0.18, 25);
    const chip = blend(crit, T.card, alpha);
    console.log(`L=${L} tint=${alpha}: chip ${ratio(crit, chip).toFixed(2)}:1, bg ${ratio(crit, T.background).toFixed(2)}:1`);
  }
}
