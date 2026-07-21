import crypto from "node:crypto";
import { FATAL_HTTP_STATUS_CODES, RETRYABLE_HTTP_STATUS_CODES } from "./constants.js";
import { buildLaunchRequest } from "./launcher.js";
import { errorMessage, formatDuration, sleep } from "./utils.js";

/** Classify OCI and network errors without retrying credentials or bad launch configuration. */
export function classifyLaunchError(error) {
  const code = String(error?.serviceCode || error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  const status = Number(error?.statusCode);
  const capacityMessages = ["outofhostcapacity", "out of host capacity", "out of capacity"];
  if (code === "outofhostcapacity" || capacityMessages.some((capacityMessage) => message.includes(capacityMessage))) return "capacity";
  if (FATAL_HTTP_STATUS_CODES.has(status) || ["notauthenticated", "notauthorized", "invalidparameter", "invalidparametervalue"].includes(code)) return "fatal";
  const transientMessages = [
    "econnreset", "econnrefused", "etimedout", "econnaborted", "socket hang up",
    "network timeout", "connection reset", "service unavailable", "gateway timeout"
  ];
  if (
    RETRYABLE_HTTP_STATUS_CODES.has(status)
    || !status
    || code.includes("timeout")
    || code.includes("serviceunavailable")
    || transientMessages.some((transientMessage) => code.includes(transientMessage) || message.includes(transientMessage))
  ) return "transient";
  return "fatal";
}

/** Repeatedly attempt launches until OCI accepts one, or a fatal configuration error occurs. */
export async function pollForCapacity({ computeClient, config, logger, isShuttingDown }) {
  const startedAt = Date.now();
  let attempts = 0;
  let lastError = "None";
  let retryToken = crypto.randomUUID();
  while (!isShuttingDown()) {
    attempts += 1;
    logger.info(`Attempt: ${attempts} | Elapsed: ${formatDuration(Date.now() - startedAt)}`);
    logger.info("Launching...");
    try {
      const instance = await computeClient.launchInstance(buildLaunchRequest(config, retryToken));
      return { instance: instance.instance, attempts, startedAt };
    } catch (error) {
      const kind = classifyLaunchError(error);
      lastError = errorMessage(error);
      if (isShuttingDown()) return null;
      if (kind === "fatal") throw new Error(`Launch failed permanently: ${lastError}`, { cause: error });
      logger.warn(kind === "capacity" ? "OutOfHostCapacity" : `Transient OCI/network error: ${lastError}`);
      logger.warn(`Last error: ${lastError}`);
      const nextRetryAt = new Date(Date.now() + config.retryIntervalMs).toISOString();
      logger.info(`Retry scheduled | Attempt: ${attempts} | Elapsed: ${formatDuration(Date.now() - startedAt)} | Next retry: ${nextRetryAt} | Retry interval: ${config.retryIntervalMs} ms`);
      logger.info(`Retry countdown: ${config.retryIntervalMs / 1000} seconds. Waiting exactly ${config.retryIntervalMs / 1000} seconds before retrying...`);
      await sleep(config.retryIntervalMs);
      // Capacity failures definitively create no instance, so their next attempt uses a new token.
      // Transient failures can occur after OCI accepts a request; reusing the token makes OCI
      // return the original operation instead of risking a duplicate instance creation.
      if (kind === "capacity") retryToken = crypto.randomUUID();
    }
  }
  return null;
}
