import { DEFAULT_TELEGRAM_STATUS_INTERVAL_MINUTES } from "./constants.js";
import { parsePositiveNumber } from "./utils.js";

/** Load optional notification settings without requiring OCI configuration. */
export function loadNotificationSettings(environment = process.env) {
  return Object.freeze({
    telegramEnabled: environment.TELEGRAM_ENABLED?.trim().toLowerCase() === "true",
    telegramBotToken: environment.TELEGRAM_BOT_TOKEN?.trim() || "",
    telegramChatId: environment.TELEGRAM_CHAT_ID?.trim() || "",
    telegramStatusEnabled: environment.TELEGRAM_STATUS_ENABLED?.trim().toLowerCase() === "true",
    telegramStatusIntervalMinutes: parsePositiveNumber(
      environment.TELEGRAM_STATUS_INTERVAL_MINUTES || DEFAULT_TELEGRAM_STATUS_INTERVAL_MINUTES,
      "TELEGRAM_STATUS_INTERVAL_MINUTES"
    )
  });
}
