import os from "node:os";

const state = {
  attempts: 0,
  consecutive429Count: 0,
  lastError: "None",
  nextRetryAt: null,
  retryDelayMs: null,
  startedAt: null
};

/** Initialize the process-local state read by the independent heartbeat scheduler. */
export function startRuntimeStatus() {
  state.attempts = 0;
  state.consecutive429Count = 0;
  state.lastError = "None";
  state.nextRetryAt = null;
  state.retryDelayMs = null;
  state.startedAt = new Date();
}

/** Record a launch attempt without affecting the poller's control flow. */
export function recordAttempt(attempts) {
  state.attempts = attempts;
}

/** Record retry information used solely for status notifications. */
export function recordRetry({ lastError, nextRetryAt, retryDelayMs, consecutive429Count }) {
  state.lastError = lastError || "Unknown";
  state.nextRetryAt = nextRetryAt || null;
  state.retryDelayMs = retryDelayMs || null;
  state.consecutive429Count = consecutive429Count || 0;
}

/** Return an immutable snapshot suitable for a provider-neutral status notification. */
export function getRuntimeStatus() {
  return Object.freeze({
    ...state,
    hostname: os.hostname(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage()
  });
}
