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

function requestShutdown(signal) {
  if (shuttingDown) return;
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
    `Public IP: ${network.publicIp}`,
    `Private IP: ${network.privateIp}`,
    `Availability Domain: ${instance.availabilityDomain}`,
    `Shape: ${instance.shape}`,
    `OCPUs: ${instance.shapeConfig?.ocpus ?? config.ocpus}`,
    `Memory: ${instance.shapeConfig?.memoryInGBs ?? config.memoryInGBs} GB`,
    `Boot Volume Size: ${config.bootVolumeSizeInGBs} GB`,
    `Launch Time: ${new Date(instance.timeCreated).toISOString()}`,
    `Elapsed Time: ${formatDuration(Date.now() - startedAt)}`,
    `Attempts: ${attempts}`,
    "Stopping Hunter..."
  ];
  for (const line of lines) logger.info(line);
}

async function main() {
  logger.info(chalk.bold(`${APP_NAME} v${APP_VERSION}`));
  const config = loadConfig();
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
