/** Pause execution without blocking the event loop. */
export function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Convert a duration in milliseconds to a concise human-readable duration. */
export function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (days) parts.push(`${days} Day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} Hour${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} Minute${minutes === 1 ? "" : "s"}`);
  if (seconds || parts.length === 0) parts.push(`${seconds} Second${seconds === 1 ? "" : "s"}`);
  return parts.join(" ");
}

/** Return an SDK-safe, useful description without exposing credential material. */
export function errorMessage(error) {
  if (!error) return "Unknown error";
  const status = error.statusCode ? `HTTP ${error.statusCode}: ` : "";
  const code = error.serviceCode || error.code ? `${error.serviceCode || error.code}: ` : "";
  return `${status}${code}${error.message || String(error)}`;
}

/** Identify a positive finite number from a string environment variable. */
export function parsePositiveNumber(value, variableName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${variableName} must be a positive number.`);
  }
  return parsed;
}
