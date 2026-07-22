import { getRuntimeStatus } from "./runtimeStatus.js";

/** Runs provider-neutral heartbeat delivery independently from the launch retry loop. */
export class HeartbeatScheduler {
  constructor(config, notificationService, logger) {
    this.config = config;
    this.notificationService = notificationService;
    this.logger = logger;
    this.timer = null;
    this.heartbeatNumber = 0;
    this.previousCpuUsage = process.cpuUsage();
    this.previousCpuTime = process.hrtime.bigint();
  }

  start() {
    if (!this.config.telegramStatusEnabled || !this.config.telegramEnabled) return;
    const intervalMs = this.config.telegramStatusIntervalMinutes * 60_000;
    this.timer = setInterval(() => void this.sendHeartbeat(), intervalMs);
    this.logger.info(`Telegram heartbeat enabled: every ${this.config.telegramStatusIntervalMinutes} minute(s).`);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async sendHeartbeat() {
    const status = getRuntimeStatus();
    const now = process.hrtime.bigint();
    const cpuDelta = process.cpuUsage(this.previousCpuUsage);
    const elapsedMicroseconds = Number(now - this.previousCpuTime) / 1_000;
    this.previousCpuUsage = status.cpuUsage;
    this.previousCpuTime = now;
    this.heartbeatNumber += 1;
    const memoryPercent = status.memoryUsage.heapTotal
      ? Math.round((status.memoryUsage.heapUsed / status.memoryUsage.heapTotal) * 100)
      : 0;
    const cpuPercent = elapsedMicroseconds
      ? Math.round(((cpuDelta.user + cpuDelta.system) / elapsedMicroseconds) * 100)
      : 0;
    await this.notificationService.notifyHeartbeat({
      ...status,
      region: this.config.region,
      availabilityDomain: this.config.availabilityDomain,
      instanceName: this.config.instanceName,
      retryDelayMs: status.retryDelayMs || this.config.retryIntervalMs,
      memoryPercent,
      cpuPercent,
      heartbeatNumber: this.heartbeatNumber
    });
  }
}
