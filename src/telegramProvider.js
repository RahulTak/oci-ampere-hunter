import { NOTIFICATION_REQUEST_TIMEOUT_MS } from "./constants.js";
import { formatDuration } from "./utils.js";

function display(value, fallback = "Unknown") {
  return value ?? fallback;
}

function formatIst(date) {
  if (!date) return "Unknown";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium"
  }).format(new Date(date));
}

/** Telegram implementation of the notification-provider contract. */
export class TelegramProvider {
  constructor(config) {
    this.enabled = config.telegramEnabled;
    this.botToken = config.telegramBotToken;
    this.chatId = config.telegramChatId;
  }

  get isConfigured() {
    return this.enabled && Boolean(this.botToken && this.chatId);
  }

  async sendInstanceCreated(details) {
    return this.send([
      "🎉 OCI Ampere Instance Created", "", `Instance:\n${display(details.instanceName)}`,
      "", `Instance OCID:\n${display(details.instanceOcid)}`,
      "", "Status:\nRUNNING", "", `Public IP:\n${display(details.publicIp, "Not Assigned")}`,
      "", `Private IP:\n${display(details.privateIp)}`, "", `Region:\n${display(details.region)}`,
      "", `Availability Domain:\n${display(details.availabilityDomain)}`, "", `Shape:\n${display(details.shape)}`,
      "", `CPU:\n${display(details.ocpus)}`, "", `RAM:\n${display(details.memoryInGBs)} GB`,
      "", `Boot Volume:\n${display(details.bootVolumeSizeInGBs)} GB`, "", `Time:\n${formatIst(details.timeCreated)}`
    ].join("\n"));
  }

  async sendHunterStarted(details) {
    const heartbeat = details.heartbeatEnabled
      ? `Enabled (${details.heartbeatIntervalMinutes} minute(s))`
      : "Disabled";
    return this.send([
      "🚀 OCI Ampere Hunter Started", "", "Status:\nMonitoring started successfully",
      "", `Region:\n${display(details.region)}`,
      "", `Availability Domain:\n${display(details.availabilityDomain)}`,
      "", `Instance:\n${display(details.instanceName)}`,
      "", `Heartbeat:\n${heartbeat}`, "", `Time:\n${formatIst(details.time)}`
    ].join("\n"));
  }

  async sendTest(details) {
    return this.send([
      "✅ OCI Ampere Hunter Notification Test", "",
      "Telegram configuration is working correctly.", "",
      `Time:\n${formatIst(details.time)}`
    ].join("\n"));
  }

  async sendHeartbeat(details) {
    return this.send([
      "🤖 OCI Ampere Hunter Status", "", "Status:\nSearching for Ampere instance...",
      "", `Attempts:\n${details.attempts}`, "", `Running Since:\n${formatIst(details.startedAt)}`,
      "", `Total Uptime:\n${formatDuration(Date.now() - new Date(details.startedAt).getTime())}`,
      "", `Last Error:\n${display(details.lastError)}`, "", `Retry Interval:\n${Math.round(details.retryDelayMs / 1000)} sec`,
      "", `Next Retry:\n${formatIst(details.nextRetryAt)}`, "", `Consecutive 429:\n${details.consecutive429Count}`,
      "", `Region:\n${details.region}`, "", `Availability Domain:\n${details.availabilityDomain}`,
      "", `Instance:\n${details.instanceName}`, "", `Host:\n${details.hostname}`,
      "", `Memory Usage:\n${details.memoryPercent}%`, "", `CPU Usage:\n${details.cpuPercent}%`,
      "", `Heartbeat:\n${details.heartbeatNumber}`
    ].join("\n"));
  }

  async send(text) {
    if (!this.isConfigured) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NOTIFICATION_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: this.chatId, text }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Telegram API responded with HTTP ${response.status}.`);
      return true;
    } finally {
      clearTimeout(timeout);
    }
  }
}
