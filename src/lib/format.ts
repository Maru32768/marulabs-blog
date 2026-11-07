const parts = (date: Date) => {
  const fmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const get = (type: Intl.DateTimeFormatPartTypes) => fmt.formatToParts(date).find((p) => p.type === type)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute") };
};

/** 2026/11/05 */
export function formatDate(date: Date): string {
  const { y, m, d } = parts(date);
  return `${y}/${m}/${d}`;
}

/** 2026/11/05 23:14 */
export function formatDateTime(date: Date): string {
  const { y, m, d, h, min } = parts(date);
  return `${y}/${m}/${d} ${h}:${min}`;
}

/** 11/05 */
export function formatShort(date: Date): string {
  const { m, d } = parts(date);
  return `${m}/${d}`;
}
