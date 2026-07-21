import fs from "node:fs/promises";
import * as common from "oci-common";
import * as core from "oci-core";

/** Create OCI SDK clients using the API signing key configured in .env. */
export async function createOciClients(config) {
  const privateKey = await fs.readFile(config.privateKeyPath, "utf8");
  const authenticationDetailsProvider = new common.SimpleAuthenticationDetailsProvider(
    config.tenancyOcid,
    config.userOcid,
    config.fingerprint,
    privateKey,
    null,
    common.Region.fromRegionId(config.region)
  );
  const clientConfig = { authenticationDetailsProvider };
  return {
    computeClient: new core.ComputeClient(clientConfig),
    networkClient: new core.VirtualNetworkClient(clientConfig),
    identityClient: new common.IdentityClient(clientConfig)
  };
}
