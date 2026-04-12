export function getSydneyDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value || "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

export function getSydneyTodayDate() {
  const { year, month, day } = getSydneyDateParts();
  return `${year}-${month}-${day}`;
}

export function getSydneyNowTime() {
  const { hour, minute } = getSydneyDateParts();
  return `${hour}:${minute}`;
}

export function roundSydneyTimeToNextFive(timeString) {
  const [rawHours, rawMinutes] = String(timeString || "09:00")
    .split(":")
    .map(Number);

  let hours = Number.isFinite(rawHours) ? rawHours : 9;
  let minutes = Number.isFinite(rawMinutes) ? rawMinutes : 0;

  const rounded = Math.ceil(minutes / 5) * 5;

  if (rounded === 60) {
    hours += 1;
    minutes = 0;
  } else {
    minutes = rounded;
  }

  if (hours >= 24) {
    hours = 23;
    minutes = 55;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function getSydneyRoundedNowTime() {
  return roundSydneyTimeToNextFive(getSydneyNowTime());
}

export function addDaysToDateString(dateString, days) {
  const [year, month, day] = String(dateString).split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}