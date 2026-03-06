@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Azure region for the Service Bus namespace')
param location string

@description('Name of the Key Vault to store connection string')
param keyVaultName string

var namespaceName = '${projectName}-sb-${environment}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: namespaceName
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

// ─── broadcast-jobs queue ─────────────────────────────────────────────────────
resource queueBroadcastJobs 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'broadcast-jobs'
  properties: {
    maxDeliveryCount: 3
    lockDuration: 'PT5M'
    deadLetteringOnMessageExpiration: true
    enableDeadLetteringOnFilterEvaluationExceptions: true
    defaultMessageTimeToLive: 'P14D'
    maxSizeInMegabytes: 1024
    requiresDuplicateDetection: false
    requiresSession: false
  }
}

// ─── confirmations queue ──────────────────────────────────────────────────────
resource queueConfirmations 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'confirmations'
  properties: {
    maxDeliveryCount: 1
    lockDuration: 'PT1M'
    deadLetteringOnMessageExpiration: true
    enableDeadLetteringOnFilterEvaluationExceptions: true
    defaultMessageTimeToLive: 'P1D'
    maxSizeInMegabytes: 1024
    requiresDuplicateDetection: false
    requiresSession: false
  }
}

// ─── Store connection string in Key Vault ────────────────────────────────────
resource serviceBusConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ServiceBusConnectionString'
  properties: {
    value: listKeys('${serviceBusNamespace.id}/AuthorizationRules/RootManageSharedAccessKey', serviceBusNamespace.apiVersion).primaryConnectionString
    attributes: { enabled: true }
  }
}

@description('Service Bus namespace name')
output namespaceName string = serviceBusNamespace.name

@description('Service Bus namespace fully qualified domain name')
output namespaceFqdn string = '${serviceBusNamespace.name}.servicebus.windows.net'

@description('broadcast-jobs queue name')
output broadcastJobsQueueName string = queueBroadcastJobs.name

@description('confirmations queue name')
output confirmationsQueueName string = queueConfirmations.name

@description('Key Vault secret URI for Service Bus connection string')
output serviceBusConnectionStringSecretUri string = serviceBusConnectionStringSecret.properties.secretUri
