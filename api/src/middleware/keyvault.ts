import { SecretClient } from "@azure/keyvault-secrets";
import { DefaultAzureCredential } from "@azure/identity";

const vaultUrl = process.env["KEY_VAULT_URL"] ?? "";

let client: SecretClient | null = null;

function getClient(): SecretClient {
  if (!client) {
    const credential = new DefaultAzureCredential();
    client = new SecretClient(vaultUrl, credential);
  }
  return client;
}

const secretCache = new Map<string, string>();

export async function getSecret(name: string): Promise<string> {
  const cached = secretCache.get(name);
  if (cached !== undefined) {
    return cached;
  }

  const secretClient = getClient();
  const secret = await secretClient.getSecret(name);

  if (!secret.value) {
    throw new Error(`Secret "${name}" not found or has no value in Key Vault`);
  }

  secretCache.set(name, secret.value);
  return secret.value;
}

// Named helpers for well-known secrets
export const getOpenAIKey = () => getSecret("openai-api-key");
export const getCosmosKey = () => getSecret("cosmos-db-key");
export const getMapsKey = () => getSecret("azure-maps-key");
export const getACSKey = () => getSecret("acs-connection-string");
export const getSpeechKey = () => getSecret("azure-speech-key");
export const getMsg91Key = () => getSecret("msg91-auth-key");
