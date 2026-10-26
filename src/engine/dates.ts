/* Local-date helpers. Dates are stored as YYYY-MM-DD strings in the user's local time. */

export function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function today(): string {
  return iso(new Date());
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(s: string): number {
  return (parse(s).getDay() + 6) % 7;
}

export function mondayOf(s: string): string {
  return addDays(s, -weekday(s));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
}

export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function fmtShort(s: string): string {
  return parse(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fmtLong(s: string): string {
  return parse(s).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
