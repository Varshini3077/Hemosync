@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Azure region for the Speech service')
param location string

@description('Name of the Key Vault to store key and endpoint')
param keyVaultName string

var accountName = '${projectName}-speech-${environment}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource speechAccount 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: accountName
  location: location
  kind: 'SpeechServices'
  sku: {
    // S0 standard tier supports real-time speech-to-text and neural TTS
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

// ─── Store key and endpoint in Key Vault ─────────────────────────────────────
resource speechKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'SpeechServiceKey'
  properties: {
    value: speechAccount.listKeys().key1
    attributes: { enabled: true }
  }
}

resource speechEndpointSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'SpeechServiceEndpoint'
  properties: {
    value: speechAccount.properties.endpoint
    attributes: { enabled: true }
  }
}

@description('Speech service endpoint URL')
output speechEndpoint string = speechAccount.properties.endpoint

@description('Speech service account name')
output speechAccountName string = speechAccount.name

@description('Key Vault secret URI for Speech service key')
output speechKeySecretUri string = speechKeySecret.properties.secretUri
