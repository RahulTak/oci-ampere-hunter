/** Shared immutable application constants. */
export const APP_NAME = "OCI Ampere Hunter";
export const APP_VERSION = "1.0";
export const REQUIRED_SHAPE = "VM.Standard.A1.Flex";
export const REQUIRED_OPERATING_SYSTEM = "Canonical Ubuntu";
export const REQUIRED_IMAGE_VERSION = "24.04";
export const REQUIRED_IMAGE_VARIANT = "minimal";
export const REQUIRED_ARCHITECTURE = "aarch64";
export const AVAILABLE_LIFECYCLE_STATE = "AVAILABLE";
export const DEFAULT_RETRY_INTERVAL_MS = 60_000;
export const DEFAULT_RETRY_429_FIRST_MS = 120_000;
export const DEFAULT_RETRY_429_SECOND_MS = 180_000;
export const DEFAULT_RETRY_429_MAX_MS = 300_000;
export const DEFAULT_OCPUS = 2;
export const DEFAULT_MEMORY_IN_GBS = 12;
export const DEFAULT_BOOT_VOLUME_SIZE_IN_GBS = 100;
export const NETWORK_DISCOVERY_INTERVAL_MS = 3_000;
export const NETWORK_DISCOVERY_TIMEOUT_MS = 10 * 60_000;
export const NOTIFICATION_REQUEST_TIMEOUT_MS = 10_000;
export const DEFAULT_TELEGRAM_STATUS_INTERVAL_MINUTES = 60;

export const METADATA_KEYS = Object.freeze({
  SSH_AUTHORIZED_KEYS: "ssh_authorized_keys"
});

export const RETRYABLE_HTTP_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);
export const FATAL_HTTP_STATUS_CODES = new Set([400, 401, 403, 404, 405, 422]);
