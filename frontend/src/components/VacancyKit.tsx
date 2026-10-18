/**
 * "Market this listing": share link and buttons, ready-to-post ad text (generated server-side from the
 * listing's fields), a printable PDF flyer and a 1080×1350 share image drawn on a canvas.
 * Share buttons only open the platform's own share page in a new tab; nothing is posted by Proppros.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Copy, FileDown, ImageDown, Mail, MessageCircle, Share2 } from "lucide-react";
import { api, fileUrl } from "../services/api";
import { Card, ErrorBox, Spinner, Tabs } from "./ui";
import "./vacancy-kit.css";

export interface KitListing {
  id: string;
  slug: string;
  title: string;
  rent_cents: number;
  beds: number | null;
  baths: number | null;
  photos?: { id: string }[];
  /** Server-built link (configured site URL), so the copied link, ad text and flyer all match. */
  share_url?: string;
}

interface Marketing {
  share_url: string;
  texts: { listing_site: { title: string; body: string }; social: string; message: string };
  fair_housing_flags: string[];
}

type TextTab = "listing_site" | "social" | "message";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the text is selectable */
    }
  };
  return (
    <button className="btn btn-sm" type="button" onClick={copy} aria-label={label}>
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t("common.copied") : t("common.copy")}
    </button>
  );
}

function wholeMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}

export function VacancyKit({ listing }: { listing: KitListing }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TextTab>("listing_site");
  const [imgBusy, setImgBusy] = useState(false);
  const [imgError, setImgError] = useState<Error | null>(null);
  const { data, error, isLoading } = useQuery({
    queryKey: ["listing", listing.id, "marketing"],
    queryFn: () => api.get<Marketing>(`/listings/${listing.id}/marketing`),
  });

  const shareUrl = listing.share_url ?? `${window.location.origin}/l/${listing.slug}`;
  const u = encodeURIComponent(shareUrl);
  const headline = `${listing.title} - ${wholeMoney(listing.rent_cents)}/mo`;
  const shares = [
    { key: "facebook", icon: <Share2 size={14} />, href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { key: "x", icon: <Share2 size={14} />, href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(headline)}&url=${u}` },
    { key: "whatsapp", icon: <MessageCircle size={14} />, href: `https://wa.me/?text=${encodeURIComponent(`${headline} ${shareUrl}`)}` },
    { key: "email", icon: <Mail size={14} />, href: `mailto:?subject=${encodeURIComponent(headline)}&body=${encodeURIComponent(`${headline}\n${shareUrl}`)}` },
  ];

  const downloadImage = async () => {
    setImgBusy(true);
    setImgError(null);
    try {
      const blob = await renderShareImage(listing, shareUrl.replace(/^https?:\/\//, ""), {
        forRent: t("vacancy_kit.image_for_rent"),
        apply: t("vacancy_kit.image_apply"),
        studio: t("vacancy_kit.image_studio"),
        beds: t("vacancy_kit.image_beds", { count: listing.beds ?? 0 }),
        baths: t("vacancy_kit.image_baths", { count: listing.baths ?? 0 }),
        perMonth: t("vacancy_kit.image_per_month"),
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${listing.slug}-share.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      setImgError(new Error(t("vacancy_kit.image_failed")));
    } finally {
      setImgBusy(false);
    }
  };

  const texts = data?.texts;
  const current = texts ? (tab === "listing_site" ? texts.listing_site.body : texts[tab]) : "";

  return (
    <Card title={t("vacancy_kit.title")}>
      <div className="vkit">
        <p className="small muted">{t("vacancy_kit.intro")}</p>

        <section className="vkit-section" aria-labelledby="vkit-share">
          <h3 id="vkit-share" className="vkit-heading">{t("vacancy_kit.share_heading")}</h3>
          <div className="vkit-row">
            <input className="input mono" readOnly value={shareUrl} onFocus={(e) => e.target.select()} aria-label={t("vacancy_kit.share_link")} />
            <CopyButton text={shareUrl} label={t("vacancy_kit.copy_link")} />
          </div>
          <div className="vkit-buttons">
            {shares.map((s) => (
              <a key={s.key} className="btn btn-sm" href={s.href} target="_blank" rel="noopener noreferrer">
                {s.icon} {t(`vacancy_kit.share_${s.key}`)}
              </a>
            ))}
          </div>
          <p className="small muted">{t("vacancy_kit.share_note")}</p>
        </section>

        <section className="vkit-section" aria-labelledby="vkit-text">
          <h3 id="vkit-text" className="vkit-heading">{t("vacancy_kit.text_heading")}</h3>
          <div className="info-box small">{t("vacancy_kit.fair_housing_note")}</div>
          {!!data?.fair_housing_flags.length && (
            <div className="vkit-warn small" role="note">
              <AlertTriangle size={15} aria-hidden />
              <span>{t("vacancy_kit.flags", { phrases: data.fair_housing_flags.map((p) => `“${p}”`).join(", ") })}</span>
            </div>
          )}
          <Tabs<TextTab>
            tabs={[
              { id: "listing_site", label: t("vacancy_kit.tab_listing_site") },
              { id: "social", label: t("vacancy_kit.tab_social") },
              { id: "message", label: t("vacancy_kit.tab_message") },
            ]}
            value={tab}
            onChange={setTab}
          />
          {isLoading && <Spinner />}
          <ErrorBox error={error} />
          {texts && (
            <div className="vkit-text">
              {tab === "listing_site" && (
                <>
                  <div className="vkit-label">
                    <span className="small muted">{t("vacancy_kit.ad_title", { count: texts.listing_site.title.length })}</span>
                    <CopyButton text={texts.listing_site.title} label={t("vacancy_kit.copy_title")} />
                  </div>
                  <input className="input" readOnly value={texts.listing_site.title} onFocus={(e) => e.target.select()} aria-label={t("vacancy_kit.ad_title_label")} />
                </>
              )}
              <div className="vkit-label">
                <span className="small muted">{t(`vacancy_kit.hint_${tab}`)}</span>
                <CopyButton text={current} label={t("vacancy_kit.copy_text")} />
              </div>
              <textarea className="input vkit-textarea" readOnly value={current} rows={tab === "listing_site" ? 12 : 6} aria-label={t(`vacancy_kit.tab_${tab}`)} />
            </div>
          )}
        </section>

        <section className="vkit-section" aria-labelledby="vkit-print">
          <h3 id="vkit-print" className="vkit-heading">{t("vacancy_kit.print_heading")}</h3>
          <div className="vkit-buttons">
            <a className="btn" href={fileUrl(`/listings/${listing.id}/flyer.pdf`)} target="_blank" rel="noreferrer">
              <FileDown size={15} /> {t("vacancy_kit.download_flyer")}
            </a>
            <button className="btn" type="button" onClick={downloadImage} disabled={imgBusy}>
              <ImageDown size={15} /> {t("vacancy_kit.download_image")}
            </button>
          </div>
          <ErrorBox error={imgError} />
          <p className="small muted">{t("vacancy_kit.print_hint")}</p>
        </section>
      </div>
    </Card>
  );
}

// ── Share image (1080×1350, 4:5) ─────────────────────────────────────────────

function token(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // same-origin API photo; a cross-origin redirect without CORS falls back to the gradient
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
  }
  return lines;
}

/** One line that fits maxWidth, cut with an ellipsis (URLs have no spaces to wrap at). */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}

interface ImageLabels {
  forRent: string;
  apply: string;
  studio: string;
  beds: string;
  baths: string;
  perMonth: string;
}

async function renderShareImage(l: KitListing, link: string, labels: ImageLabels): Promise<Blob> {
  const { forRent, apply } = labels;
  const W = 1080, H = 1350, PAD = 72;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const ink = token("--pp-bg-sidebar", "#0d0e12");
  const accent = "#edaf88"; // Strata carnelian (dark theme value): reads well on the dark overlay
  const display = token("--pp-font-display", "system-ui, sans-serif");
  await document.fonts?.ready;

  const photo = l.photos?.[0] ? await loadImage(`/api/public/listings/${l.slug}/photos/${l.photos[0].id}`) : null;
  if (photo) {
    const s = Math.max(W / photo.width, H / photo.height);
    ctx.drawImage(photo, (W - photo.width * s) / 2, (H - photo.height * s) / 2, photo.width * s, photo.height * s);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#342c2c"); // --pp-carnelian-soft
    g.addColorStop(0.55, "#16171d"); // --pp-surface
    g.addColorStop(1, ink);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const shade = ctx.createLinearGradient(0, H * 0.35, 0, H);
  shade.addColorStop(0, "rgba(13,14,18,0)");
  shade.addColorStop(0.45, "rgba(13,14,18,0.78)");
  shade.addColorStop(1, "rgba(13,14,18,0.95)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  // Bottom-up layout: apply pill, link, title, facts, rent, eyebrow.
  let y = H - PAD;
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 38px ${display}`;
  const pillW = ctx.measureText(apply).width + 64;
  ctx.fillStyle = accent;
  ctx.fillRect(PAD, y - 76, pillW, 76);
  ctx.fillStyle = ink;
  ctx.fillText(apply, PAD + 32, y - 25);
  ctx.font = `500 28px ${display}`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  const linkText = fit(ctx, link, W - PAD * 2 - pillW - 32);
  ctx.fillText(linkText, PAD + pillW + 32, y - 27);
  y -= 76 + 56;

  ctx.font = `600 50px ${display}`;
  ctx.fillStyle = "#ffffff";
  const titleLines = wrap(ctx, l.title, W - PAD * 2, 3);
  for (let i = titleLines.length - 1; i >= 0; i--) {
    ctx.fillText(titleLines[i], PAD, y);
    y -= 62;
  }
  const facts = [l.beds === 0 ? labels.studio : l.beds != null ? labels.beds : "", l.baths != null ? labels.baths : ""].filter(Boolean).join("  ·  ");
  if (facts) {
    ctx.font = `500 40px ${display}`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(facts, PAD, y - 8);
    y -= 72;
  }
  ctx.font = `800 120px ${display}`;
  ctx.fillStyle = "#ffffff";
  const rent = wholeMoney(l.rent_cents);
  ctx.fillText(rent, PAD, y - 10);
  const rentW = ctx.measureText(rent).width;
  ctx.font = `600 44px ${display}`;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText(labels.perMonth, PAD + rentW + 12, y - 12);
  y -= 150;
  ctx.font = `700 30px ${display}`;
  ctx.fillStyle = accent;
  ctx.fillText(forRent.toUpperCase(), PAD, y);

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png");
    } catch (e) {
      reject(e); // tainted canvas (photo served from another origin)
    }
  });
}
