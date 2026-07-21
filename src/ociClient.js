import fs from "node:fs/promises";
import { constants as fileSystemConstants } from "node:fs";
import * as common from "oci-common";
import * as core from "oci-core";
import * as identity from "oci-identity";

/** Read and validate an OCI API signing key without exposing raw filesystem errors. */
async function readPrivateKey(privateKeyPath) {
  try {
    await fs.access(privateKeyPath, fileSystemConstants.R_OK);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`OCI private key file not found: ${privateKeyPath}. Check OCI_PRIVATE_KEY_PATH.`);
    }
    if (error?.code === "EACCES" || error?.code === "EPERM") {
      throw new Error(`Permission denied reading OCI private key: ${privateKeyPath}. Grant the application read access.`);
    }
    throw new Error(`Unable to read OCI private key: ${privateKeyPath}. Check that it is a readable file.`);
  }

  let privateKey;
  try {
    privateKey = await fs.readFile(privateKeyPath, "utf8");
  } catch (error) {
    if (error?.code === "EACCES" || error?.code === "EPERM") {
      throw new Error(`Permission denied reading OCI private key: ${privateKeyPath}. Grant the application read access.`);
    }
    throw new Error(`Unable to read OCI private key: ${privateKeyPath}. Check that it is a readable file.`);
  }

  if (!/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(privateKey)) {
    throw new Error(`Invalid OCI private key format: ${privateKeyPath} does not contain a supported PEM private-key header.`);
  }
  return privateKey;
}

/** Create OCI SDK clients using the API signing key configured in .env. */
export async function createOciClients(config) {
  const privateKey = await readPrivateKey(config.privateKeyPath);
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
    identityClient: new identity.IdentityClient(clientConfig)
  };
}
