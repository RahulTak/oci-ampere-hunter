import "dotenv/config";
import path from "node:path";
import {
  DEFAULT_BOOT_VOLUME_SIZE_IN_GBS,
  DEFAULT_MEMORY_IN_GBS,
  DEFAULT_OCPUS,
  DEFAULT_RETRY_INTERVAL_MS,
  REQUIRED_SHAPE
} from "./constants.js";
import { parsePositiveNumber } from "./utils.js";

const REQUIRED_ENVIRONMENT_VARIABLES = [
  "OCI_USER_OCID", "OCI_TENANCY_OCID", "OCI_FINGERPRINT", "OCI_PRIVATE_KEY_PATH",
  "OCI_REGION", "COMPARTMENT_OCID", "SUBNET_OCID", "IMAGE_OCID", "AD", "SSH_PUBLIC_KEY"
];

/** Read, normalize, and validate local configuration before contacting OCI. */
export function loadConfig(environment = process.env) {
  const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter((name) => !environment[name]?.trim());
  if (missing.length) throw new Error(`Missing required .env value(s): ${missing.join(", ")}`);

  const privateKeyPath = path.resolve(environment.OCI_PRIVATE_KEY_PATH.trim());

  const config = {
    userOcid: environment.OCI_USER_OCID.trim(), tenancyOcid: environment.OCI_TENANCY_OCID.trim(),
    fingerprint: environment.OCI_FINGERPRINT.trim(), privateKeyPath, region: environment.OCI_REGION.trim(),
    compartmentOcid: environment.COMPARTMENT_OCID.trim(), subnetOcid: environment.SUBNET_OCID.trim(),
    imageOcid: environment.IMAGE_OCID.trim(), availabilityDomain: environment.AD.trim(),
    sshPublicKey: environment.SSH_PUBLIC_KEY.trim(), instanceName: environment.INSTANCE_NAME?.trim() || "Ampere-A1",
    shape: environment.SHAPE?.trim() || REQUIRED_SHAPE,
    ocpus: parsePositiveNumber(environment.OCPUS || DEFAULT_OCPUS, "OCPUS"),
    memoryInGBs: parsePositiveNumber(environment.MEMORY_IN_GBS || DEFAULT_MEMORY_IN_GBS, "MEMORY_IN_GBS"),
    bootVolumeSizeInGBs: parsePositiveNumber(environment.BOOT_VOLUME_SIZE_IN_GBS || DEFAULT_BOOT_VOLUME_SIZE_IN_GBS, "BOOT_VOLUME_SIZE_IN_GBS"),
    retryIntervalMs: parsePositiveNumber(environment.RETRY_INTERVAL || DEFAULT_RETRY_INTERVAL_MS, "RETRY_INTERVAL")
  };
  if (!config.sshPublicKey.startsWith("ssh-")) throw new Error("SSH_PUBLIC_KEY must be a valid OpenSSH public key beginning with ssh-.");
  if (config.shape !== REQUIRED_SHAPE) throw new Error(`SHAPE must be exactly ${REQUIRED_SHAPE}.`);
  if (config.ocpus !== DEFAULT_OCPUS || config.memoryInGBs !== DEFAULT_MEMORY_IN_GBS || config.bootVolumeSizeInGBs !== DEFAULT_BOOT_VOLUME_SIZE_IN_GBS) {
    throw new Error(`Always Free launch sizing is fixed: OCPUS=${DEFAULT_OCPUS}, MEMORY_IN_GBS=${DEFAULT_MEMORY_IN_GBS}, BOOT_VOLUME_SIZE_IN_GBS=${DEFAULT_BOOT_VOLUME_SIZE_IN_GBS}.`);
  }
  if (config.retryIntervalMs !== DEFAULT_RETRY_INTERVAL_MS) throw new Error(`RETRY_INTERVAL must be exactly ${DEFAULT_RETRY_INTERVAL_MS} milliseconds (60 seconds).`);
  return Object.freeze(config);
}
