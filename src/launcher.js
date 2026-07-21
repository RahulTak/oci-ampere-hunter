import { METADATA_KEYS, NETWORK_DISCOVERY_INTERVAL_MS, NETWORK_DISCOVERY_TIMEOUT_MS } from "./constants.js";
import { sleep } from "./utils.js";

/** Construct the OCI SDK request needed for this specific Always Free A1 instance. */
export function buildLaunchRequest(config, opcRetryToken) {
  return {
    opcRetryToken,
    launchInstanceDetails: {
      availabilityDomain: config.availabilityDomain,
      compartmentId: config.compartmentOcid,
      displayName: config.instanceName,
      shape: config.shape,
      shapeConfig: { ocpus: config.ocpus, memoryInGBs: config.memoryInGBs },
      sourceDetails: {
        sourceType: "image",
        imageId: config.imageOcid,
        bootVolumeSizeInGBs: config.bootVolumeSizeInGBs
      },
      createVnicDetails: { subnetId: config.subnetOcid, assignPublicIp: true },
      metadata: { [METADATA_KEYS.SSH_AUTHORIZED_KEYS]: config.sshPublicKey }
    }
  };
}

/** Request instance creation. A successful response means OCI allocated host capacity. */
export async function launchInstance(computeClient, config) {
  const response = await computeClient.launchInstance(buildLaunchRequest(config));
  return response.instance;
}

/** Wait for the primary VNIC then retrieve its public and private addresses. */
export async function getInstanceNetworkDetails(computeClient, networkClient, config, instanceId) {
  const deadline = Date.now() + NETWORK_DISCOVERY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const attachments = await computeClient.listVnicAttachments({
      compartmentId: config.compartmentOcid,
      instanceId
    });
    const primaryAttachment = attachments.items.find((attachment) => attachment.isPrimary && attachment.lifecycleState === "ATTACHED");
    if (primaryAttachment?.vnicId) {
      const response = await networkClient.getVnic({ vnicId: primaryAttachment.vnicId });
      return { publicIp: response.vnic.publicIp || "Not assigned", privateIp: response.vnic.privateIp };
    }
    await sleep(NETWORK_DISCOVERY_INTERVAL_MS);
  }
  throw new Error("Instance was created, but its primary VNIC was not attached within 10 minutes.");
}
