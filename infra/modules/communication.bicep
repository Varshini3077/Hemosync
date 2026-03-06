@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Name of the Key Vault to store connection string')
param keyVaultName string

// ACS is a global resource; data location is set via dataLocation property
var resourceName = '${projectName}-acs-${environment}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource communicationService 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: resourceName
  // ACS is a global service; location must be 'global'
  location: 'global'
  properties: {
    // Data stored in Asia Pacific datacenters for PDPA/regional compliance
    dataLocation: 'Asia Pacific'
  }
}

// NOTE: WhatsApp Business API channel registration must be completed manually
// in the Azure Communication Services portal after deployment. This requires:
// 1. A verified Facebook Business Manager account
// 2. A WhatsApp Business Account (WABA) linked to ACS
// 3. A dedicated phone number registered for WhatsApp
// The ACS resource created here provides the foundation; the channel itself
// is activated through the ACS portal UI or via the ACS Management SDK.

// ─── Store connection string in Key Vault ────────────────────────────────────
resource acsConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ACSConnectionString'
  properties: {
    value: communicationService.listKeys().primaryConnectionString
    attributes: { enabled: true }
  }
}

@description('Azure Communication Services resource name')
output communicationServiceName string = communicationService.name

@description('ACS resource immutable resource ID')
output communicationServiceImmutableResourceId string = communicationService.properties.immutableResourceId

@description('Key Vault secret URI for ACS connection string')
output acsConnectionStringSecretUri string = acsConnectionStringSecret.properties.secretUri
