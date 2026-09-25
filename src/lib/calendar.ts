type Event = { title: string; details: string; location: string; start: string; end: string };

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl(e: Event) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    details: e.details,
    location: e.location,
    dates: `${stamp(e.start)}/${stamp(e.end)}`,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function icsContent(e: Event) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NDP//Booking//IT",
    "BEGIN:VEVENT",
    `UID:${stamp(e.start)}-ndp@salon`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(e.end)}`,
    `SUMMARY:${e.title}`,
    `DESCRIPTION:${e.details.replace(/\n/g, "\\n")}`,
    `LOCATION:${e.location}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Appuntamento NDP",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(e: Event, filename = "appuntamento-ndp.ics") {
  const blob = new Blob([icsContent(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
