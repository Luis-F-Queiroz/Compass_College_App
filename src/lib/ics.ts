// Minimal iCalendar (.ics) builder for all-day deadline events, plus a browser download helper.
// Used by the Dashboard to export upcoming deadlines into any calendar app.
export type IcsEvent = { uid: string; title: string; date: string; desc?: string };

function pad(n: number) {
  return n < 10 ? "0" + n : String(n);
}
function stamp(d: Date) {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}
// Escape per RFC 5545 text rules.
function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildICS(events: IcsEvent[]): string {
  const now = stamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Compass//College Apps//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const e of events) {
    const ymd = e.date.replace(/-/g, "").slice(0, 8);
    if (ymd.length !== 8) continue; // skip rows without a real YYYY-MM-DD date
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + e.uid,
      "DTSTAMP:" + now,
      "DTSTART;VALUE=DATE:" + ymd,
      "SUMMARY:" + esc(e.title),
    );
    if (e.desc) lines.push("DESCRIPTION:" + esc(e.desc));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
