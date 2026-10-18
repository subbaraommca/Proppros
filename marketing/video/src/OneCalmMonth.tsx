// "One calm month": Proppros 9:16 video, Concept 1 (docs/growth/ADS-RESEARCH.md, Creative brief B).
// DRAFT, pending owner approval. Screens come from the fictional showcase database only.
import React from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ---------- Brand tokens (docs/DESIGN_GUIDELINES.md, ADS-RESEARCH.md brief B) ----------
const BG = "#111217";
const COPPER = "#EDAF88";
const TEXT = "#E6DFD8";
const WHITE = "#FFFFFF";
const MUTED = "#9A938C";
const LINE = "#2A2C34";

// ---------- Reels safe area at 1080 x 1920: 14% top, 35% bottom, 6% sides ----------
const W = 1080;
const H = 1920;
export const SAFE_X = Math.round(W * 0.06); // 65
export const SAFE_TOP = Math.round(H * 0.14); // 269
export const SAFE_BOTTOM = Math.round(H * (1 - 0.35)); // 1248
const SAFE_W = W - SAFE_X * 2; // 950

// Layout inside the safe area
const TIMELINE_Y = SAFE_TOP + 24;
const DAY_Y = SAFE_TOP + 100;
const CAPTION_Y = SAFE_TOP + 262;
const CARD_Y = SAFE_TOP + 420;
const CARD_H = SAFE_BOTTOM - 14 - CARD_Y;

const FONT_FACES = `
@font-face { font-family: "Archivo"; src: url("${staticFile("fonts/archivo-latin-wdth-normal.woff2")}") format("woff2-variations"); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: "DM Sans"; src: url("${staticFile("fonts/dm-sans-latin-wght-normal.woff2")}") format("woff2-variations"); font-weight: 100 1000; }
`;
// Wait for both local fonts before any frame is captured.
if (typeof document !== "undefined") {
  const handle = delayRender("Loading brand fonts");
  const faces = [
    new FontFace("Archivo", `url(${staticFile("fonts/archivo-latin-wdth-normal.woff2")})`, { weight: "100 900", stretch: "62% 125%" }),
    new FontFace("DM Sans", `url(${staticFile("fonts/dm-sans-latin-wght-normal.woff2")})`, { weight: "100 1000" }),
  ];
  Promise.all(faces.map((f) => f.load()))
    .then((loaded) => {
      loaded.forEach((f) => document.fonts.add(f));
      continueRender(handle);
    })
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
}
const DISPLAY: React.CSSProperties = { fontFamily: "Archivo", fontWeight: 800, fontStretch: "112%" };
const BODY: React.CSSProperties = { fontFamily: "DM Sans" };

// ---------- Scenes (copy from content.ts MONTH and brief B) ----------
// Coordinates are in the source image's own pixels. s = on-screen pixels per source pixel.
type Rect = { x: number; y: number; w: number; h: number };
type Key = { x: number; y: number; s: number };
type Shot = { src: string; iw: number; ih: number; from: Key; to: Key; highlight?: Rect; highlightAt?: number };
type Scene = { day: string; caption: string; start: number; end: number; shots: Shot[] };

const DESK = { iw: 2160, ih: 1350 };

export const SCENES: Scene[] = [
  {
    day: "1st", caption: "Rent charges post on their own.", start: 0, end: 60,
    shots: [{ src: "screens/lease-dark.webp", ...DESK, from: { x: 905, y: 770, s: 0.97 }, to: { x: 910, y: 750, s: 1.02 }, highlight: { x: 415, y: 648, w: 1108, h: 86 }, highlightAt: 12 }],
  },
  {
    day: "3rd", caption: "Lease signed online.", start: 60, end: 150,
    shots: [{ src: "screens/lease-dark.webp", ...DESK, from: { x: 820, y: 280, s: 1.0 }, to: { x: 900, y: 330, s: 1.15 }, highlight: { x: 838, y: 404, w: 144, h: 64 }, highlightAt: 30 }],
  },
  {
    day: "6th", caption: "See who is behind.", start: 150, end: 240,
    shots: [{ src: "screens/dashboard-dark.webp", ...DESK, from: { x: 1650, y: 420, s: 1.05 }, to: { x: 1830, y: 520, s: 1.2 }, highlight: { x: 1551, y: 369, w: 553, h: 283 }, highlightAt: 40 }],
  },
  {
    day: "12th", caption: "A leak is reported. Vendor assigned.", start: 240, end: 360,
    shots: [{ src: "screens/workorder-dark.webp", ...DESK, from: { x: 870, y: 330, s: 1.0 }, to: { x: 1790, y: 900, s: 1.2 }, highlight: { x: 1551, y: 761, w: 553, h: 322 }, highlightAt: 70 }],
  },
  {
    day: "20th", caption: "Vacancy shared. Applications come in.", start: 360, end: 480,
    shots: [
      { src: "screens/listing-manage-dark.webp", ...DESK, from: { x: 980, y: 340, s: 0.85 }, to: { x: 960, y: 600, s: 0.9 }, highlight: { x: 415, y: 470, w: 1690, h: 333 }, highlightAt: 30 },
      { src: "screens/listing-public-phone-dark.webp", iw: 780, ih: 1688, from: { x: 390, y: 250, s: 1.2 }, to: { x: 390, y: 1420, s: 1.2 } },
    ],
  },
  {
    day: "31st", caption: "Books ready for your accountant.", start: 480, end: 570,
    shots: [{ src: "screens/reports-dark.webp", ...DESK, from: { x: 970, y: 440, s: 0.8 }, to: { x: 970, y: 470, s: 0.84 }, highlight: { x: 1179, y: 266, w: 115, h: 53 }, highlightAt: 35 }],
  },
];
const END_START = 570;
export const TOTAL_FRAMES = 660; // 22 s at 30 fps

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Pan/zoom position of a shot at progress t (0..1).
const placement = (shot: Shot, t: number) => {
  const e = Easing.inOut(Easing.cubic)(t);
  const s = shot.from.s + (shot.to.s - shot.from.s) * e;
  const fx = shot.from.x + (shot.to.x - shot.from.x) * e;
  const fy = shot.from.y + (shot.to.y - shot.from.y) * e;
  // Put the focus point in the card centre, but never show past the image edges.
  const tx = clamp(SAFE_W / 2 - fx * s, SAFE_W - shot.iw * s, 0);
  const ty = clamp(CARD_H / 2 - fy * s, CARD_H - shot.ih * s, 0);
  return { s, tx, ty };
};

const ShotView: React.FC<{ shot: Shot; t: number; local: number }> = ({ shot, t, local }) => {
  const { s, tx, ty } = placement(shot, t);
  const r = shot.highlight;
  const o = r && shot.highlightAt !== undefined
    ? interpolate(local, [shot.highlightAt, shot.highlightAt + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  const pad = 6;
  return (
    <AbsoluteFill>
      <Img src={staticFile(shot.src)} style={{ position: "absolute", left: tx, top: ty, width: shot.iw * s, height: shot.ih * s, maxWidth: "none" }} />
      {r && o > 0 && (
        <div style={{ position: "absolute", left: tx + r.x * s - pad, top: ty + r.y * s - pad, width: r.w * s + pad * 2, height: r.h * s + pad * 2, border: `4px solid ${COPPER}`, borderRadius: 14, opacity: o, boxShadow: `0 0 0 9999px rgba(17,18,23,${0.4 * o})` }} />
      )}
    </AbsoluteFill>
  );
};

const ScreenCard: React.FC<{ scene: Scene; local: number }> = ({ scene, local }) => {
  const { fps } = useVideoConfig();
  const len = scene.end - scene.start;
  const enter = spring({ frame: local + 5, fps, config: { damping: 200 }, durationInFrames: 14 });
  const out = interpolate(local, [len - 4, len], [1, 0.15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shots = scene.shots;
  const seg = len / shots.length;
  return (
    <div style={{ position: "absolute", left: SAFE_X, top: CARD_Y, width: SAFE_W, height: CARD_H, borderRadius: 22, overflow: "hidden", border: `2px solid ${LINE}`, background: "#16171d", transform: `translateY(${(1 - enter) * 40}px) scale(${0.97 + enter * 0.03})`, opacity: Math.min(enter, out), boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
      {shots.map((shot, i) => {
        const a = i * seg;
        const b = a + seg;
        const t = clamp((local - a) / seg, 0, 1);
        const fadeIn = i === 0 ? 1 : interpolate(local, [a, a + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const fadeOut = i === shots.length - 1 ? 1 : interpolate(local, [b - 8, b], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const op = Math.min(fadeIn, fadeOut);
        if (op <= 0) return null;
        return (
          <AbsoluteFill key={shot.src} style={{ opacity: op }}>
            <ShotView shot={shot} t={t} local={local - a} />
          </AbsoluteFill>
        );
      })}
      <div style={{ ...BODY, position: "absolute", right: 16, bottom: 16, padding: "6px 14px", borderRadius: 999, background: "rgba(17,18,23,0.88)", border: `1px solid ${LINE}`, color: TEXT, fontSize: 22, fontWeight: 500, letterSpacing: 0.3 }}>
        Example data
      </div>
    </div>
  );
};

// ---------- Timeline progress line through the six days ----------
const Timeline: React.FC<{ frame: number }> = ({ frame }) => {
  const n = SCENES.length;
  const inset = 34;
  const span = SAFE_W - inset * 2;
  const xs = SCENES.map((_, i) => inset + (span * i) / (n - 1));
  const active = SCENES.findIndex((s) => frame >= s.start && frame < s.end);
  let progress = 1;
  if (active >= 0) {
    const sc = SCENES[active];
    const step = interpolate(frame, [sc.start, sc.start + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
    progress = active === 0 ? 0 : (active - 1 + step) / (n - 1);
  }
  return (
    <div style={{ position: "absolute", left: SAFE_X, top: TIMELINE_Y, width: SAFE_W, height: 80 }}>
      <div style={{ position: "absolute", left: inset, top: 13, width: span, height: 4, background: LINE, borderRadius: 2 }} />
      <div style={{ position: "absolute", left: inset, top: 13, width: span * progress, height: 4, background: COPPER, borderRadius: 2 }} />
      {SCENES.map((s, i) => {
        const done = active === -1 || i <= active;
        const isActive = i === active;
        const d = isActive ? 30 : 22;
        return (
          <React.Fragment key={s.day}>
            <div style={{ position: "absolute", left: xs[i] - d / 2, top: 15 - d / 2, width: d, height: d, borderRadius: 999, boxSizing: "border-box", background: done ? COPPER : BG, border: `3px solid ${done ? COPPER : "#4A4C55"}` }} />
            <div style={{ ...BODY, position: "absolute", left: xs[i] - 60, width: 120, top: 42, textAlign: "center", fontSize: 28, fontWeight: isActive ? 700 : 500, color: isActive ? WHITE : MUTED }}>{s.day}</div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ---------- Day counter (the "calendar flip") and caption ----------
const DayAndCaption: React.FC<{ scene: Scene; local: number }> = ({ scene, local }) => {
  const { fps } = useVideoConfig();
  const flip = spring({ frame: local + 3, fps, config: { damping: 16, stiffness: 160 }, durationInFrames: 18 });
  const cap = spring({ frame: local, fps, config: { damping: 200 }, durationInFrames: 14 });
  const len = scene.end - scene.start;
  const out = interpolate(local, [len - 4, len], [1, 0.15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <div style={{ position: "absolute", left: SAFE_X, top: DAY_Y, width: SAFE_W, height: 150, overflow: "hidden" }}>
        <div style={{ ...DISPLAY, color: COPPER, fontSize: 136, lineHeight: "150px", transform: `translateY(${(1 - flip) * 120}px)`, opacity: Math.min(flip, out) }}>
          {scene.day}
        </div>
      </div>
      <div style={{ ...BODY, position: "absolute", left: SAFE_X, top: CAPTION_Y, width: SAFE_W, fontSize: 56, lineHeight: 1.15, fontWeight: 700, color: WHITE, opacity: Math.min(cap, out), transform: `translateY(${(1 - cap) * 16}px)` }}>
        {scene.caption}
      </div>
    </>
  );
};

// ---------- End card ----------
const Logo: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.3 }}>
    <div style={{ width: size, height: size, borderRadius: size * 0.18, background: COPPER, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke={BG} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h14V9.5" />
        <path d="M10 20v-6h4v6" />
      </svg>
    </div>
    <div style={{ ...DISPLAY, color: WHITE, fontSize: size * 0.62 }}>Proppros</div>
  </div>
);

const EndCard: React.FC<{ local: number }> = ({ local }) => {
  const { fps } = useVideoConfig();
  const a = spring({ frame: local, fps, config: { damping: 200 }, durationInFrames: 16 });
  const b = spring({ frame: local - 8, fps, config: { damping: 200 }, durationInFrames: 16 });
  const c = spring({ frame: local - 16, fps, config: { damping: 200 }, durationInFrames: 16 });
  const up = (v: number): React.CSSProperties => ({ opacity: v, transform: `translateY(${(1 - v) * 24}px)` });
  return (
    <div style={{ position: "absolute", left: SAFE_X, top: SAFE_TOP + 90, width: SAFE_W, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 44 }}>
      <div style={up(a)}><Logo size={84} /></div>
      <div style={{ ...DISPLAY, ...up(a), color: WHITE, fontSize: 104, lineHeight: 1.04 }}>
        One calm<br />month.
      </div>
      <div style={{ ...up(b), ...BODY, background: COPPER, color: BG, fontSize: 54, fontWeight: 700, padding: "24px 56px", borderRadius: 16 }}>Start free</div>
      <div style={up(c)}>
        <div style={{ ...BODY, color: COPPER, fontSize: 48, fontWeight: 600 }}>proppros.vercel.app</div>
        <div style={{ ...BODY, color: TEXT, fontSize: 34, fontWeight: 500, marginTop: 14 }}>No card needed. Built by a landlord.</div>
      </div>
    </div>
  );
};

// ---------- Main composition ----------
export const OneCalmMonth: React.FC = () => {
  const frame = useCurrentFrame();
  const scene = SCENES.find((s) => frame >= s.start && frame < s.end);
  const timelineOut = interpolate(frame, [END_START - 6, END_START + 6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: BG }}>
      <style>{FONT_FACES}</style>
      {/* Soft copper glow, decorative only */}
      <AbsoluteFill style={{ background: "radial-gradient(circle at 85% 8%, rgba(237,175,136,0.10), transparent 45%)" }} />
      {timelineOut > 0 && <div style={{ opacity: timelineOut }}><Timeline frame={Math.min(frame, END_START - 1)} /></div>}
      {scene && (
        <React.Fragment key={scene.day}>
          <DayAndCaption scene={scene} local={frame - scene.start} />
          <ScreenCard scene={scene} local={frame - scene.start} />
        </React.Fragment>
      )}
      {frame >= END_START && <EndCard local={frame - END_START} />}
    </AbsoluteFill>
  );
};
