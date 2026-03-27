@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Azure region for the Key Vault')
param location string

var keyVaultName = '${projectName}-kv-${environment}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// ─── Secret Placeholders ──────────────────────────────────────────────────────
// Real values are injected via CI/CD pipelines. Placeholders allow ARM template
// deployment without real credentials.

resource secretCosmosConnectionString 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'CosmosDbConnectionString'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretPostgresConnectionString 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'PostgresConnectionString'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretPostgresAdminPassword 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'PostgresAdminPassword'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretRedisConnectionString 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'RedisConnectionString'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretServiceBusConnectionString 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ServiceBusConnectionString'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretOpenAIKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'OpenAIApiKey'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretOpenAIEndpoint 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'OpenAIEndpoint'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretMapsKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AzureMapsSubscriptionKey'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretSpeechKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'SpeechServiceKey'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretSpeechEndpoint 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'SpeechServiceEndpoint'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretCommunicationConnectionString 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ACSConnectionString'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretMicrosoftAppId 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'MicrosoftAppId'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretMicrosoftAppPassword 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'MicrosoftAppPassword'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretApimSubscriptionKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'APIMSubscriptionKey'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretJwtSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'JwtSecret'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretWhatsAppPhoneId 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'WhatsAppPhoneNumberId'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretWhatsAppToken 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'WhatsAppAccessToken'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretFhirClientId 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'FhirClientId'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretFhirClientSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'FhirClientSecret'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretPowerBIClientId 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'PowerBIClientId'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

resource secretPowerBIClientSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'PowerBIClientSecret'
  properties: {
    value: 'PLACEHOLDER'
    attributes: { enabled: true }
  }
}

@description('Name of the Key Vault')
output keyVaultName string = keyVault.name

@description('URI of the Key Vault')
output keyVaultUri string = keyVault.properties.vaultUri

@description('Resource ID of the Key Vault')
output keyVaultId string = keyVault.id
