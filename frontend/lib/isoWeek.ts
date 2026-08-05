export interface IsoWeekRange {
  year: number;
  week: number;
  start: Date;
  end: Date;
}

function startOfIsoWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function isoThursday(date: Date): Date {
  const t = startOfIsoWeek(date);
  t.setDate(t.getDate() + 3);
  return t;
}

export function isoWeekYear(date: Date): number {
  return isoThursday(date).getFullYear();
}

export function isoWeekNumber(date: Date): number {
  const thursday = isoThursday(date);
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  return Math.ceil((((thursday.getTime() - jan1.getTime()) / 86400000) + 1) / 7);
}

export function getCurrentIsoWeek(): { year: number; week: number } {
  const now = new Date();
  return { year: isoWeekYear(now), week: isoWeekNumber(now) };
}

export function isoWeeksInYear(year: number): number {
  return isoWeekNumber(new Date(year, 11, 28));
}

export function isoWeekRange(year: number, week: number): { start: Date; end: Date } {
  const week1Monday = startOfIsoWeek(new Date(year, 0, 4));
  const start = new Date(week1Monday);
  start.setDate(start.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

export function listIsoWeeksOfYear(year: number): IsoWeekRange[] {
  const total = isoWeeksInYear(year);
  return Array.from({ length: total }, (_, i) => {
    const { start, end } = isoWeekRange(year, i + 1);
    return { year, week: i + 1, start, end };
  });
}

export function getIsoWeekOfDateString(dateStr: string): { year: number; week: number } {
  const d = new Date(dateStr + 'T00:00:00');
  return { year: isoWeekYear(d), week: isoWeekNumber(d) };
}

export function formatIsoWeekLabel(w: IsoWeekRange): string {
  const fmt = (d: Date) => d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  return `Semana ${w.week} (${fmt(w.start)} – ${fmt(w.end)})`;
}
