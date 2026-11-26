import { Capacitor } from '@capacitor/core';
import { useSyncExternalStore } from 'react';

/*
 * The iPhone app (Capacitor) runs the same code as the website. Everything that behaves differently inside the app
 * lives here, so the rest of the code only asks `isNative()` or calls a helper that does the right thing on both.
 * Plugins are imported lazily, so the website never downloads them.
 */

/** The public website. Auth emails and invite links always point here, even from inside the app. */
export const WEBSITE = 'https://www.builduptraining.com/';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Runs once at startup inside the app: status bar, hide the splash. No-op on the website. */
export async function initNative() {
  if (!isNative()) return;
  document.documentElement.classList.add('native');
  const { SplashScreen } = await import('@capacitor/splash-screen');
  void SplashScreen.hide().catch(() => {});
  void rescheduleReminder();
}

/** Keeps the clock and battery readable on light and dark backgrounds. */
export async function syncStatusBar(dark: boolean) {
  if (!isNative()) return;
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
}

/** A light tap, for ticking off an exercise. */
export async function tapHaptic() {
  if (!isNative()) return;
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

/** A stronger buzz, for finishing a session. */
export async function successHaptic() {
  if (!isNative()) return;
  const { Haptics, NotificationType } = await import('@capacitor/haptics');
  await Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}

/** Opens the iPhone share sheet with a link. Returns false when it isn't the app, so the caller falls back. */
export async function nativeShareLink(opts: { title?: string; text: string; url: string }): Promise<boolean> {
  if (!isNative()) return false;
  const { Share } = await import('@capacitor/share');
  try { await Share.share({ ...opts, dialogTitle: opts.title }); } catch { /* cancelled */ }
  return true;
}

/**
 * Hands a file (a share card or a data export) to the iPhone share sheet, which also offers Save Image and Save to
 * Files. Returns false when it isn't the app, so the caller can use a normal download.
 */
export async function nativeShareFile(blob: Blob, name: string, text?: string): Promise<boolean> {
  if (!isNative()) return false;
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const data = await blobToBase64(blob);
  const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
  try { await Share.share({ files: [uri], text }); } catch { /* cancelled */ }
  return true;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/* ---------- Daily training reminder (app only) ---------- */

const REMINDER_KEY = 'build-up:reminder';
const REMINDER_ID = 1001;
const reminderListeners = new Set<() => void>();

/** "HH:MM" in the phone's time, or null when off. */
function readReminder(): string | null {
  try { const v = localStorage.getItem(REMINDER_KEY); return v && /^\d{2}:\d{2}$/.test(v) ? v : null; } catch { return null; }
}
let reminder = readReminder();

export function useReminder(): string | null {
  return useSyncExternalStore(l => { reminderListeners.add(l); return () => reminderListeners.delete(l); }, () => reminder);
}

/** Turns the daily reminder on at `time` ("HH:MM"), or off with null. Resolves to an error message, or null. */
export async function setReminder(time: string | null): Promise<string | null> {
  if (!isNative()) return null;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  if (time) {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return 'Notifications are off for Build Up. Turn them on in Settings > Notifications > Build Up.';
  }
  try { if (time) localStorage.setItem(REMINDER_KEY, time); else localStorage.removeItem(REMINDER_KEY); } catch { /* ignore */ }
  reminder = time;
  reminderListeners.forEach(l => l());
  await rescheduleReminder();
  return null;
}

async function rescheduleReminder() {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] }).catch(() => {});
  if (!reminder) return;
  const [hour, minute] = reminder.split(':').map(Number);
  await LocalNotifications.schedule({
    notifications: [{
      id: REMINDER_ID,
      title: 'Time to Build Up',
      body: 'Your session for today is ready. Keep your streak going.',
      schedule: { on: { hour, minute }, allowWhileIdle: true },
    }],
  }).catch(() => {});
}
