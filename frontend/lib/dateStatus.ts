export function isPastDue(commitmentDate: string | undefined, status: string): boolean {
  if (!commitmentDate || status === 'approved' || status === 'delivered' || status === 'not_applicable') return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(commitmentDate + 'T00:00:00') < today;
}

export function isApproaching(commitmentDate: string | undefined, status: string, days = 5): boolean {
  if (isPastDue(commitmentDate, status) || !commitmentDate || status === 'approved' || status === 'delivered' || status === 'not_applicable') return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const limit = new Date(today); limit.setDate(limit.getDate() + days);
  const d = new Date(commitmentDate + 'T00:00:00');
  return d >= today && d <= limit;
}
