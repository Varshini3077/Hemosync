@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Name of the Key Vault to store API key and endpoint')
param keyVaultName string

// GPT-4o is only available in specific regions; eastus has the broadest availability
var openAILocation = 'eastus'
var accountName = '${projectName}-oai-${environment}'
var deploymentName = 'gpt-4o'
// 30K TPM for prod/staging, 10K for dev
var capacityK = environment == 'dev' ? 10 : 30

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource openAIAccount 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: accountName
  location: openAILocation
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    customSubDomainName: accountName
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

// ─── GPT-4o model deployment ─────────────────────────────────────────────────
resource gpt4oDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-10-01-preview' = {
  parent: openAIAccount
  name: deploymentName
  sku: {
    name: 'Standard'
    capacity: capacityK
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o'
      version: '2024-11-20'
    }
    versionUpgradeOption: 'OnceCurrentVersionExpired'
    raiPolicyName: 'Microsoft.Default'
  }
}

// ─── Store key and endpoint in Key Vault ─────────────────────────────────────
resource openAIKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'OpenAIApiKey'
  properties: {
    value: openAIAccount.listKeys().key1
    attributes: { enabled: true }
  }
}

resource openAIEndpointSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'OpenAIEndpoint'
  properties: {
    value: openAIAccount.properties.endpoint
    attributes: { enabled: true }
  }
}

@description('Azure OpenAI account endpoint')
output openAIEndpoint string = openAIAccount.properties.endpoint

@description('Azure OpenAI account name')
output openAIAccountName string = openAIAccount.name

@description('GPT-4o deployment name')
output gpt4oDeploymentName string = gpt4oDeployment.name

@description('Key Vault secret URI for OpenAI API key')
output openAIKeySecretUri string = openAIKeySecret.properties.secretUri
