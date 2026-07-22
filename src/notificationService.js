import { TelegramProvider } from "./telegramProvider.js";

/** Provider-based, failure-isolated notification facade used by the hunter. */
export class NotificationService {
  constructor(config, logger) {
    this.logger = logger;
    this.providers = [new TelegramProvider(config)];
    if (config.telegramEnabled && !this.providers[0].isConfigured) {
      this.logger.warn("Telegram is enabled but TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing; notifications are skipped.");
    }
  }

  async notifyInstanceCreated(details) {
    return this.notify("sendInstanceCreated", details);
  }

  async notifyHeartbeat(details) {
    return this.notify("sendHeartbeat", details);
  }

  async notifyHunterStarted(details) {
    return this.notify("sendHunterStarted", details);
  }

  async notifyTest(details) {
    return this.notify("sendTest", details);
  }

  async notify(method, details) {
    const deliveries = await Promise.all(this.providers.map(async (provider) => {
      try {
        return await provider[method](details);
      } catch (error) {
        this.logger.warn(`Notification delivery failed: ${error?.message || "Unknown provider error"}`);
        return false;
      }
    }));
    return deliveries.some(Boolean);
  }
}
