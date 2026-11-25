import { useEffect, useRef, useState } from 'react';
import { levelName, rankOf, type Progress } from '../engine/progress';
import { isNative, nativeShareFile } from '../state/native';
import { inviteUrl, SITE_URL } from '../state/referrals';
import { Sheet } from './ui';
import { Flame, RankBadge } from './visuals';

/*
 * Shareable cards sized for Instagram and TikTok Stories (1080 × 1920). Drawn on a canvas so they look the same
 * on every phone, then handed to the phone's share sheet (or saved as an image where sharing files isn't supported).
 * Text and the link stay inside the middle of the card, clear of the Stories header and reply bar.
 */

export type CardKind = 'rank' | 'streak';

export interface CardData {
  kind: CardKind;
  name: string;
  level: number;
  xp: number;
  streak: number;
  workouts: number;
  /** "New rank" / "Level up" when shared straight after a level-up. */
  fresh?: boolean;
  inviteCode?: string | null;
}

export function cardData(kind: CardKind, name: string, progress: Progress, level: number, inviteCode?: string | null, fresh?: boolean): CardData {
  return { kind, name: name.trim().split(/\s+/)[0] ?? '', level, xp: progress.xp, streak: progress.streak.count, workouts: progress.records.length, inviteCode, fresh };
}

const W = 1080, H = 1920;
const ORANGE = '#E2531A', ICE = '#8DB0CB', STEEL = '#3C73A0', WHITE = '#F4F7F9', MUTED = '#9FB0BD';
const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
const BODY = '"Source Sans 3", system-ui, sans-serif';

function svgImage(svg: SVGSVGElement, w: number, h: number, color?: string): Promise<HTMLImageElement> {
  let markup = new XMLSerializer().serializeToString(svg)
    .replace(/var\(--display\)/g, 'Arial Narrow, sans-serif');
  if (color) markup = markup.replace(/currentColor/g, color);
  markup = markup.replace(/<svg([^>]*?)width="[^"]*"([^>]*?)height="[^"]*"/, `<svg$1width="${w}"$2height="${h}"`);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Shrink a font until the text fits the width. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, max: number) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; s -= 4; } while (ctx.measureText(text).width > max && s > 20);
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  // Letter-spaced, centered on x.
  const widths = [...text].map(ch => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let cx = x - total / 2;
  ctx.textAlign = 'left';
  [...text].forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = 'center';
}

export async function drawCard(d: CardData, art: SVGSVGElement): Promise<Blob> {
  await Promise.all([
    document.fonts?.load(`700 200px ${DISPLAY}`), document.fonts?.load(`600 40px ${DISPLAY}`), document.fonts?.load(`600 40px ${BODY}`),
  ].map(p => p?.catch(() => undefined)));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const { rank } = rankOf(d.level);
  const glow = d.kind === 'rank' ? rank.color : '#FF8A3D';

  // Background: deep navy with a glow in the rank's color behind the art.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1A2935'); bg.addColorStop(1, '#0A1117');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 760, 40, W / 2, 760, 620);
  g.addColorStop(0, `${glow}88`); g.addColorStop(.45, `${glow}22`); g.addColorStop(1, `${glow}00`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Light rays.
  ctx.save();
  ctx.translate(W / 2, 760);
  ctx.fillStyle = `${glow}14`;
  for (let i = 0; i < 18; i++) {
    ctx.rotate((Math.PI * 2) / 18);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-38, -900); ctx.lineTo(38, -900); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // Logo: the three rising bars and the wordmark.
  const lx = W / 2 - 150, ly = 200;
  ctx.fillStyle = ICE; roundRect(ctx, lx, ly + 44, 22, 30, 4); ctx.fill();
  ctx.fillStyle = STEEL; roundRect(ctx, lx + 31, ly + 21, 22, 53, 4); ctx.fill();
  ctx.fillStyle = ORANGE; roundRect(ctx, lx + 62, ly - 8, 22, 82, 4); ctx.fill();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `700 84px ${DISPLAY}`;
  ctx.fillStyle = WHITE; ctx.fillText('BUILD', lx + 104, ly + 74);
  ctx.fillStyle = ORANGE; ctx.fillText('UP', lx + 104 + ctx.measureText('BUILD ').width, ly + 74);
  ctx.textAlign = 'center';

  // Kicker.
  const kicker = d.kind === 'streak' ? 'STREAK' : d.fresh ? (d.level % 3 === 0 ? 'NEW RANK' : 'LEVEL UP') : 'MY RANK';
  ctx.font = `600 46px ${DISPLAY}`;
  ctx.fillStyle = glow;
  spaced(ctx, kicker, W / 2, 385, 10);

  // The art.
  if (d.kind === 'rank') {
    const img = await svgImage(art, 460, 506);
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
    ctx.drawImage(img, W / 2 - 230, 480, 460, 506);
    ctx.shadowColor = 'transparent';
  } else {
    const img = await svgImage(art, 420, 420, '#FF7A3D');
    ctx.drawImage(img, W / 2 - 210, 520, 420, 420);
  }

  // Headline.
  ctx.fillStyle = WHITE;
  const headline = d.kind === 'rank' ? levelName(d.level).toUpperCase() : `${d.streak} DAY${d.streak === 1 ? '' : 'S'}`;
  fit(ctx, headline, 700, 210, DISPLAY, W - 140);
  ctx.fillText(headline, W / 2, 1190);
  ctx.font = `600 50px ${BODY}`;
  ctx.fillStyle = MUTED;
  const who = d.name || 'I';
  const sub = d.kind === 'rank'
    ? (d.fresh ? `${who} just ranked up on Build Up` : `${who}'s rank on Build Up`)
    : `${d.name ? `${d.name}'s` : 'My'} training streak and counting`;
  fit(ctx, sub, 600, 50, BODY, W - 160);
  ctx.fillText(sub, W / 2, 1268);

  // Stats.
  const stats: [string, string][] = d.kind === 'rank'
    ? [[d.xp.toLocaleString(), 'XP'], [String(d.streak), 'DAY STREAK'], [String(d.workouts), 'WORKOUTS']]
    : [[String(d.workouts), 'WORKOUTS'], [d.xp.toLocaleString(), 'XP'], [levelName(d.level).toUpperCase(), 'RANK']];
  const sy = 1340, sw = 290, gap = 20, sx0 = W / 2 - (sw * 3 + gap * 2) / 2;
  stats.forEach(([v, l], i) => {
    const x = sx0 + i * (sw + gap);
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    roundRect(ctx, x, sy, sw, 170, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = WHITE;
    fit(ctx, v, 700, 78, DISPLAY, sw - 30);
    ctx.fillText(v, x + sw / 2, sy + 94);
    ctx.font = `600 30px ${DISPLAY}`;
    ctx.fillStyle = MUTED;
    spaced(ctx, l, x + sw / 2, sy + 138, 4);
  });

  // Call to action.
  const site = SITE_URL.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  ctx.fillStyle = ORANGE;
  roundRect(ctx, W / 2 - 330, 1590, 660, 104, 52); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `700 52px ${DISPLAY}`;
  ctx.fillText(site.toUpperCase(), W / 2, 1660);
  if (d.inviteCode) {
    ctx.font = `600 38px ${BODY}`;
    ctx.fillStyle = WHITE;
    ctx.fillText(`Train with me · invite code ${d.inviteCode}`, W / 2, 1555);
  }

  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('Could not make the image'))), 'image/png'));
}

export function shareText(d: CardData): string {
  const what = d.kind === 'rank' ? `I just hit ${levelName(d.level)} on Build Up` : `${d.streak}-day training streak on Build Up`;
  return d.inviteCode ? `${what}. Train with me: ${inviteUrl(d.inviteCode)}` : `${what}. ${SITE_URL}`;
}

/** Shows the card, then shares it as an image (or saves it). */
export function ShareSheet({ data, onClose }: { data: CardData; onClose: () => void }) {
  const art = useRef<HTMLDivElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const file = blob ? new File([blob], `build-up-${data.kind}.png`, { type: 'image/png' }) : null;
  const native = isNative();
  const canShareFile = native || (!!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }));

  useEffect(() => {
    let live = true;
    let made: string | null = null;
    const svg = art.current?.querySelector('svg');
    if (!svg) return;
    drawCard(data, svg).then(b => {
      if (!live) return;
      made = URL.createObjectURL(b);
      setBlob(b); setUrl(made);
    }).catch(() => setMsg('Couldn\'t make the image on this device.'));
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [data]);

  const save = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = `build-up-${data.kind}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setMsg('Saved. Add it to your Story from your photos.');
  };
  const share = async () => {
    if (!file) return;
    // In the iPhone app the share sheet also has Save Image, so one button does both.
    if (blob && await nativeShareFile(blob, file.name, shareText(data))) return;
    try {
      await navigator.share({ files: [file], text: shareText(data) });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') save();
    }
  };

  return (
    <Sheet title={data.kind === 'rank' ? 'Share your rank' : 'Share your streak'} onClose={onClose}>
      <div ref={art} className="sr" aria-hidden="true">
        {data.kind === 'rank' ? <RankBadge level={data.level} size={460} /> : <Flame lit size={420} />}
      </div>
      <div className="share-preview">
        {url ? <img src={url} alt={shareText(data)} /> : <div className="share-loading">Making your card…</div>}
      </div>
      <div className="row">
        {canShareFile && <button className="btn" style={{ flex: 1 }} onClick={share} disabled={!blob}>{native ? 'Share or save' : 'Share'}</button>}
        {!native && <button className={`btn${canShareFile ? ' ghost' : ''}`} style={{ flex: 1 }} onClick={save} disabled={!url}>Save image</button>}
      </div>
      <p className="fine">{msg ?? 'Sized for Instagram and TikTok Stories.'}{data.inviteCode ? ' Your invite code is on the card, so friends who join get you bonus XP.' : ''}</p>
    </Sheet>
  );
}
