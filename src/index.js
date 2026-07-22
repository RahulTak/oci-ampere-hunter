import chalk from "chalk";
import { loadConfig } from "./config.js";
import { APP_NAME, APP_VERSION } from "./constants.js";
import { closeLogger, logger } from "./logger.js";
import { createOciClients } from "./ociClient.js";
import { getInstanceNetworkDetails } from "./launcher.js";
import { pollForCapacity } from "./poller.js";
import { formatDuration, errorMessage } from "./utils.js";
import { validateStartup } from "./validator.js";

let shuttingDown = false;
let shutdownSignalCount = 0;

function requestShutdown(signal) {
  shutdownSignalCount += 1;
  if (shutdownSignalCount > 1) {
    logger.warn(`${signal} received again. Force exiting immediately.`);
    process.exit(130);
  }
  shuttingDown = true;
  logger.warn(`${signal} received. Stopping hunter cleanly after the current request completes...`);
}

process.on("SIGINT", () => requestShutdown("SIGINT"));
process.on("SIGTERM", () => requestShutdown("SIGTERM"));

function printSuccess(instance, network, config, attempts, startedAt) {
  const lines = [
    chalk.green.bold("SUCCESS"),
    chalk.green("Instance Created"),
    `Instance Name: ${instance.displayName}`,
    `Instance OCID: ${instance.id}`,
    `Public IP: ${network?.publicIp || "Not Assigned"}`,
    `Private IP: ${network?.privateIp || "Unknown"}`,
    `Availability Domain: ${instance.availabilityDomain}`,
    `Shape: ${instance.shape}`,
    `OCPUs: ${instance.shapeConfig?.ocpus ?? config.ocpus}`,
    `Memory: ${instance.shapeConfig?.memoryInGBs ?? config.memoryInGBs} GB`,
    `Boot Volume Size: ${config.bootVolumeSizeInGBs} GB`,
    `Launch Time: ${formatLaunchTime(instance?.timeCreated)}`,
    `Elapsed Time: ${formatDuration(Date.now() - startedAt)}`,
    `Attempts: ${attempts}`,
    "Stopping Hunter..."
  ];
  for (const line of lines) logger.info(line);
}

/** Format OCI launch time without allowing invalid dates into user output. */
function formatLaunchTime(timeCreated) {
  if (!timeCreated) return "Unknown";
  const launchTime = new Date(timeCreated);
  return Number.isNaN(launchTime.getTime()) ? "Unknown" : launchTime.toISOString();
}

async function main() {
  logger.info(chalk.bold(`${APP_NAME} v${APP_VERSION}`));
  const config = loadConfig();
  logger.info(`Startup configuration | Version: ${APP_VERSION} | Region: ${config.region} | Availability Domain: ${config.availabilityDomain} | Shape: ${config.shape}`);
  logger.info(`Startup target | Image OCID: ${config.imageOcid} | Subnet OCID: ${config.subnetOcid} | Instance name: ${config.instanceName} | Retry interval: ${config.retryIntervalMs} ms`);
  logger.info(`Retry configuration | Default retry: ${config.retryIntervalMs / 1000} sec | 429 first: ${config.retry429FirstMs / 1000} sec | 429 second: ${config.retry429SecondMs / 1000} sec | 429 max: ${config.retry429MaxMs / 1000} sec`);
  const clients = await createOciClients(config);
  await validateStartup(config, clients, logger);
  logger.info(`Retry Interval: ${config.retryIntervalMs / 1000} sec`);

  const result = await pollForCapacity({ ...clients, config, logger, isShuttingDown: () => shuttingDown });
  if (!result) {
    logger.info("Hunter stopped by user.");
    return;
  }
  logger.info(`Instance accepted by OCI: ${result.instance.id}. Waiting for primary VNIC...`);
  const network = await getInstanceNetworkDetails(clients.computeClient, clients.networkClient, config, result.instance.id);
  printSuccess(result.instance, network, config, result.attempts, result.startedAt);
}

main()
  .catch((error) => {
    logger.error(`Hunter stopped: ${errorMessage(error)}`);
    if (error.cause) logger.debug(error.cause.stack || errorMessage(error.cause));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeLogger();
  });
