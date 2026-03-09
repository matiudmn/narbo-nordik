export function getSeasonRange(): { start: Date; end: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 8) {
    return { start: new Date(year, 8, 1), end: new Date(year + 1, 7, 31, 23, 59, 59) };
  }
  return { start: new Date(year - 1, 8, 1), end: new Date(year, 7, 31, 23, 59, 59) };
}
