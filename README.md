# OCI Ampere Hunter

`oci-ampere-hunter` is a Node.js 18+ service that runs on an Oracle Cloud Always Free AMD instance and repeatedly requests an Always Free Ampere A1 Flex VM. It uses only Oracle's official Node.js SDK—never the OCI CLI. When Oracle accepts the request, it waits for the primary VNIC, prints the created instance's details, and exits cleanly.

## Safety and behavior

Before it makes any launch request, the hunter authenticates with the API signing key and validates the configured compartment, availability domain, subnet, image, shape, and SSH key. It rejects anything except an available `Canonical Ubuntu` 24.04 Minimal `aarch64` image and `VM.Standard.A1.Flex`.

The program makes no changes until the launch request. A successful launch consumes Always Free resources subject to your tenancy limits. Stop it with `Ctrl+C`; it finishes any in-flight SDK request and then exits.

`OutOfHostCapacity`, timeout, and OCI service/transient network failures wait **60 seconds** by default and retry forever. HTTP 429 throttling uses an adaptive delay of 120 seconds, then 180 seconds, then 300 seconds for all subsequent consecutive 429s. Any non-429 response resets that 429 sequence. Authentication, authorization, missing-resource, or invalid-request errors stop immediately so they can be corrected.

## Installation

```bash
git clone <your-repository-url> oci-ampere-hunter
cd oci-ampere-hunter
npm install
cp .env.example .env
```

The project has no OCI CLI dependency. Use Node.js 18 or newer.

## Create an OCI API signing key

1. In the OCI Console, open **Profile** → **User settings** → **API keys** → **Add API Key**.
2. Generate or upload an RSA public key. Download the private PEM file and retain the fingerprint displayed by OCI.
3. Save the private key on the host running the hunter (for example, `/home/ubuntu/.oci/oci_api_key.pem`) and restrict it: `chmod 600 /home/ubuntu/.oci/oci_api_key.pem`.
4. Copy your user OCID and tenancy OCID from the console. Set the key fingerprint, region, and key path in `.env`.

The API key's user must have permission to inspect the configured resources and launch instances in the target compartment. A typical policy for a dedicated compartment is `Allow group <group-name> to manage instance-family in compartment <compartment-name>` plus access to the selected network resources.

## Configuration

All configuration comes from `.env`; do not commit it. The required image must be Oracle's Canonical Ubuntu 24.04 Minimal aarch64 image for the selected region.

```dotenv
OCI_USER_OCID=ocid1.user.oc1..example
OCI_TENANCY_OCID=ocid1.tenancy.oc1..example
OCI_FINGERPRINT=12:34:56:78:90:ab:cd:ef:12:34:56:78:90:ab:cd:ef
OCI_PRIVATE_KEY_PATH=/home/ubuntu/.oci/oci_api_key.pem
OCI_REGION=ap-hyderabad-1
COMPARTMENT_OCID=ocid1.compartment.oc1..example
SUBNET_OCID=ocid1.subnet.oc1.ap-hyderabad-1.example
IMAGE_OCID=ocid1.image.oc1.ap-hyderabad-1.example
AD=ap-hyderabad-1-ad-1
SSH_PUBLIC_KEY=ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExample user@host
INSTANCE_NAME=Rahul-ARM
SHAPE=VM.Standard.A1.Flex
OCPUS=2
MEMORY_IN_GBS=12
BOOT_VOLUME_SIZE_IN_GBS=100
RETRY_INTERVAL=60000
DEFAULT_RETRY_MS=60000
RETRY_429_FIRST_MS=120000
RETRY_429_SECOND_MS=180000
RETRY_429_MAX_MS=300000
```

`SHAPE` must be `VM.Standard.A1.Flex`, and `OCPUS`, `MEMORY_IN_GBS`, and `BOOT_VOLUME_SIZE_IN_GBS` are fixed at `2`, `12`, and `100`. `DEFAULT_RETRY_MS` supersedes the legacy `RETRY_INTERVAL`; the default is 60 seconds. The optional 429 variables default to 120, 180, and 300 seconds when absent.

## Run

```bash
npm start
```

Logs are timestamped, colorized in the terminal, and written as JSON records to `logs/hunter.log`. The log directory is created automatically.

Example output:

```text
2026-07-21T10:00:00.000Z INFO OCI Ampere Hunter v1.0
2026-07-21T10:00:01.000Z INFO Authentication ✓
2026-07-21T10:00:02.000Z INFO Image ✓
2026-07-21T10:00:02.000Z INFO Subnet ✓
2026-07-21T10:00:03.000Z INFO Shape ✓
2026-07-21T10:00:03.000Z INFO Retry Interval: 60 sec
2026-07-21T10:00:03.000Z INFO Attempt: 127 | Elapsed: 2 Hours 6 Minutes
2026-07-21T10:00:03.000Z INFO Launching...
2026-07-21T10:00:04.000Z WARN OutOfHostCapacity
2026-07-21T10:00:04.000Z INFO Retry countdown: 60 seconds. Waiting exactly 60 seconds before retrying...
```

On success it prints the instance name and OCID, public and private IPs, availability domain, shape, OCPUs, memory, requested boot-volume size, OCI launch time, total elapsed time, and total attempts, then stops.

## Troubleshooting

| Message | Meaning and action |
| --- | --- |
| `OutOfHostCapacity` | The selected AD has no A1 host capacity. Leave the hunter running; it retries every 60 seconds. |
| `TooManyRequests` / HTTP 429 | OCI throttled a request. The hunter waits 60 seconds and retries. |
| timeout / HTTP 5xx | A transient network or OCI service error. The hunter waits 60 seconds and retries. |
| HTTP 401 / `NotAuthenticated` | Check user OCID, tenancy OCID, fingerprint, private key path, file permissions, and region. |
| HTTP 403 / `NotAuthorized` | Grant the API-key user/group policies for the compartment and subnet. |
| HTTP 404 | Verify the region and every OCID. OCI OCIDs are region-specific for many resources. |
| `Invalid image` | Select the available Oracle image explicitly identified as Canonical Ubuntu 24.04 Minimal aarch64. |
| `Invalid subnet` | Use a subnet in the configured compartment and, for an AD-specific subnet, the selected AD. |
| `Invalid AD` | Use an availability-domain name returned for this tenancy and region. |
| `VM.Standard.A1.Flex is unavailable` | The shape is not offered in the chosen AD/compartment context; choose a valid AD. |

OCI can return a permanent quota/limit-related launch error even when capacity exists. Those errors are intentionally not retried: resolve the quota, service limit, or configuration error, then start the service again.

## Project structure

```text
src/
  index.js       application entry point and shutdown handling
  config.js      .env loading and local validation
  constants.js   centralized application constants
  logger.js      colored console and file logger
  validator.js   OCI credential/resource/image/shape validation
  ociClient.js   official OCI SDK client creation
  launcher.js    launch request and VNIC/IP discovery
  poller.js      error classification and 60-second launch loop
  utils.js       reusable time, error, and parsing helpers
logs/hunter.log  runtime log file (created automatically)
```
