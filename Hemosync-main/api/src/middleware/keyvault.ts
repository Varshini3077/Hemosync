// Reads secrets from environment variables directly
// Key Vault can be enabled later in production by setting KEY_VAULT_URL

export async function getSecret(name: string): Promise<string> {
  const envMap: Record<string, string> = {
    "openai-api-key": process.env["AZURE_OPENAI_KEY"] ?? "",
    "cosmos-db-key": process.env["COSMOS_CONNECTION_STRING"] ?? "",
    "azure-maps-key": process.env["AZURE_MAPS_SUBSCRIPTION_KEY"] ?? "",
    "acs-connection-string": process.env["ACS_CONNECTION_STRING"] ?? "",
    "azure-speech-key": process.env["AZURE_SPEECH_KEY"] ?? "",
    "msg91-auth-key": process.env["MSG91_AUTH_KEY"] ?? "",
  };

  const value = envMap[name];
  if (!value) {
    throw new Error(`Secret "${name}" not found in environment variables`);
  }
  return value;
}

export const getOpenAIKey = () => getSecret("openai-api-key");
export const getCosmosKey = () => getSecret("cosmos-db-key");
export const getMapsKey = () => getSecret("azure-maps-key");
export const getACSKey = () => getSecret("acs-connection-string");
export const getSpeechKey = () => getSecret("azure-speech-key");
export const getMsg91Key = () => getSecret("msg91-auth-key");