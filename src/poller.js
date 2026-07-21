import { FATAL_HTTP_STATUS_CODES, RETRYABLE_HTTP_STATUS_CODES } from "./constants.js";
import { buildLaunchRequest } from "./launcher.js";
import { errorMessage, formatDuration, sleep } from "./utils.js";

/** Classify OCI and network errors without retrying credentials or bad launch configuration. */
export function classifyLaunchError(error) {
  const code = String(error?.serviceCode || error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  const status = Number(error?.statusCode);
  if (code === "outofhostcapacity" || message.includes("outofhostcapacity")) return "capacity";
  if (FATAL_HTTP_STATUS_CODES.has(status) || ["notauthenticated", "notauthorized", "invalidparameter", "invalidparametervalue"].includes(code)) return "fatal";
  if (RETRYABLE_HTTP_STATUS_CODES.has(status) || !status || code.includes("timeout") || code.includes("serviceunavailable")) return "transient";
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
      if (kind === "fatal") throw new Error(`Launch failed permanently: ${lastError}`, { cause: error });
      logger.warn(kind === "capacity" ? "OutOfHostCapacity" : `Transient OCI/network error: ${lastError}`);
      logger.warn(`Last error: ${lastError}`);
      logger.info(`Retry countdown: ${config.retryIntervalMs / 1000} seconds. Waiting exactly ${config.retryIntervalMs / 1000} seconds before retrying...`);
      await sleep(config.retryIntervalMs);
      // Re-use the token after ambiguous transient failures to prevent duplicate instance creation.
      // Capacity responses are definitive failures, so the next attempt is a new launch request.
      if (kind === "capacity") retryToken = crypto.randomUUID();
    }
  }
  return null;
}
import crypto from "node:crypto";
