import "dotenv/config";
import { logger, closeLogger } from "./logger.js";
import { NotificationService } from "./notificationService.js";
import { loadNotificationSettings } from "./notificationSettings.js";

/** Send exactly one provider-based Telegram test notification without starting the hunter. */
async function main() {
  const config = loadNotificationSettings();
  if (!config.telegramEnabled) {
    logger.info("Telegram notifications are disabled; notification test skipped.");
    return;
  }
  const notificationService = new NotificationService(config, logger);
  const delivered = await notificationService.notifyTest({ time: new Date() });
  if (delivered) logger.info("Telegram notification test sent successfully.");
  else logger.warn("Telegram notification test was not delivered. Check Telegram configuration.");
}

main()
  .catch((error) => {
    logger.warn(`Telegram notification test failed: ${error?.message || "Unknown error"}`);
  })
  .finally(async () => {
    await closeLogger();
  });
