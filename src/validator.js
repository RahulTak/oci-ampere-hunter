import {
  AVAILABLE_LIFECYCLE_STATE,
  REQUIRED_ARCHITECTURE,
  REQUIRED_IMAGE_VARIANT,
  REQUIRED_IMAGE_VERSION,
  REQUIRED_OPERATING_SYSTEM,
  REQUIRED_SHAPE
} from "./constants.js";

function includesNormalized(value, expected) {
  return String(value || "").toLowerCase().includes(expected.toLowerCase());
}

/** Validate OCI access and every configured launch dependency before launching. */
export async function validateStartup(config, clients, logger) {
  const { computeClient, networkClient, identityClient } = clients;
  logger.info("Validating OCI authentication...");
  await identityClient.getUser({ userId: config.userOcid });
  logger.info("Authentication ✓");

  logger.info("Validating compartment and availability domain...");
  if (config.compartmentOcid !== config.tenancyOcid) {
    const compartmentResponse = await identityClient.getCompartment({ compartmentId: config.compartmentOcid });
    if (compartmentResponse.compartment.lifecycleState !== "ACTIVE") {
      throw new Error(`Invalid compartment: lifecycle state is ${compartmentResponse.compartment.lifecycleState}, not ACTIVE.`);
    }
  }
  const availabilityDomains = await identityClient.listAvailabilityDomains({ compartmentId: config.tenancyOcid });
  const availableAdNames = availabilityDomains.items?.map((ad) => ad?.name).filter(Boolean) ?? [];
  const adFound = availableAdNames.includes(config.availabilityDomain);
  if (!adFound) {
    const formattedAdList = availableAdNames.length
      ? availableAdNames.map((name) => `- ${name}`).join("\n")
      : "- None returned by OCI";
    logger.error(`Configured AD:\n${config.availabilityDomain}\n\nAvailable ADs:\n${formattedAdList}`);
    throw new Error(`Invalid AD.\n\nConfigured AD:\n${config.availabilityDomain}\n\nAvailable ADs:\n${formattedAdList}`);
  }
  logger.info("Compartment ✓");
  logger.info("Availability Domain ✓");

  logger.info("Validating subnet...");
  const subnetResponse = await networkClient.getSubnet({ subnetId: config.subnetOcid });
  const subnet = subnetResponse.subnet;
  if (subnet.compartmentId !== config.compartmentOcid) {
    throw new Error("Invalid subnet: SUBNET_OCID does not belong to COMPARTMENT_OCID.");
  }
  if (subnet.lifecycleState !== AVAILABLE_LIFECYCLE_STATE) {
    throw new Error(`Invalid subnet: subnet lifecycle state is ${subnet.lifecycleState}, not AVAILABLE.`);
  }
  if (subnet.availabilityDomain && subnet.availabilityDomain !== config.availabilityDomain) {
    throw new Error(`Invalid subnet: it belongs to ${subnet.availabilityDomain}, not ${config.availabilityDomain}.`);
  }
  logger.info("Subnet ✓");

  logger.info("Validating Canonical Ubuntu 24.04 Minimal aarch64 image...");
  const imageResponse = await computeClient.getImage({ imageId: config.imageOcid });
  const image = imageResponse.image;
  const imageIdentity = `${image.operatingSystem || ""} ${image.operatingSystemVersion || ""} ${image.displayName || ""}`;
  if (image.lifecycleState !== AVAILABLE_LIFECYCLE_STATE) {
    throw new Error(`Invalid image: lifecycle state is ${image.lifecycleState}, not AVAILABLE.`);
  }
  if (!includesNormalized(image.operatingSystem, REQUIRED_OPERATING_SYSTEM)) {
    throw new Error(`Invalid image: operating system must be ${REQUIRED_OPERATING_SYSTEM}; received ${image.operatingSystem || "unknown"}.`);
  }
  if (!includesNormalized(imageIdentity, REQUIRED_IMAGE_VERSION) || !includesNormalized(imageIdentity, REQUIRED_IMAGE_VARIANT)) {
    throw new Error("Invalid image: it must be Ubuntu 24.04 Minimal.");
  }
  // OCI's Image API does not expose a separate architecture field. Oracle-published image names
  // include aarch64, so require it in the immutable image metadata returned by the API.
  if (!includesNormalized(imageIdentity, REQUIRED_ARCHITECTURE)) {
    throw new Error("Invalid image: it is not identified as aarch64/ARM64 by OCI image metadata.");
  }
  const compatibilityResponse = await computeClient.listImageShapeCompatibilityEntries({
    imageId: config.imageOcid,
    compartmentId: config.compartmentOcid
  });
  if (!compatibilityResponse.items.some((entry) => entry.shape === REQUIRED_SHAPE)) {
    throw new Error(`Invalid image: it is not compatible with ${REQUIRED_SHAPE}.`);
  }
  logger.info("Image ✓");

  logger.info("Validating Ampere A1 Flex shape in the selected AD...");
  if (config.shape !== REQUIRED_SHAPE) throw new Error(`Invalid shape: only ${REQUIRED_SHAPE} is allowed.`);
  const shapesResponse = await computeClient.listShapes({
    compartmentId: config.compartmentOcid,
    availabilityDomain: config.availabilityDomain,
    shape: REQUIRED_SHAPE
  });
  if (!shapesResponse.items.some((shape) => shape.shape === REQUIRED_SHAPE)) {
    throw new Error(`${REQUIRED_SHAPE} is unavailable or unsupported in ${config.availabilityDomain}.`);
  }
  logger.info("Shape ✓");
  logger.info("SSH public key ✓");
  return { image, subnet };
}
