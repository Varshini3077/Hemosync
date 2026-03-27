targetScope = 'resourceGroup'

@description('Environment name: dev, staging, or prod')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Azure region for primary deployment')
param location string = 'eastasia'

@description('Project name used as prefix for all resources')
param projectName string = 'hemosync'

@description('Email address for alert notifications')
param alertEmail string = 'hemosync-alerts@outlook.com'

@description('Azure AD tenant ID for Bot Service')
param tenantId string = subscription().tenantId

@description('Microsoft App ID for Teams Bot (provided post-registration)')
param microsoftAppId string = 'PLACEHOLDER'

// ─── Log Analytics (first — others depend on workspace ID) ───────────────────
module logAnalytics 'modules/loganalytics.bicep' = {
  name: 'logAnalytics'
  params: {
    projectName: projectName
    environment: environment
    location: location
  }
}

// ─── Key Vault ────────────────────────────────────────────────────────────────
module keyVault 'modules/keyvault.bicep' = {
  name: 'keyVault'
  params: {
    projectName: projectName
    environment: environment
    location: location
  }
}

// ─── Cosmos DB ────────────────────────────────────────────────────────────────
module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos'
  params: {
    projectName: projectName
    environment: environment
    location: location
    keyVaultName: keyVault.outputs.keyVaultName
    enableGeoReplication: environment == 'prod'
  }
}

// ─── PostgreSQL ───────────────────────────────────────────────────────────────
module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    projectName: projectName
    environment: environment
    location: location
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

// ─── Redis ────────────────────────────────────────────────────────────────────
module redis 'modules/redis.bicep' = {
  name: 'redis'
  params: {
    projectName: projectName
    environment: environment
    location: location
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

// ─── Service Bus ──────────────────────────────────────────────────────────────
module serviceBus 'modules/servicebus.bicep' = {
  name: 'serviceBus'
  params: {
    projectName: projectName
    environment: environment
    location: location
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

// ─── Azure OpenAI ─────────────────────────────────────────────────────────────
module openAI 'modules/openai.bicep' = {
  name: 'openAI'
  params: {
    projectName: projectName
    environment: environment
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

// ─── Azure Maps ───────────────────────────────────────────────────────────────
module maps 'modules/maps.bicep' = {
  name: 'maps'
  params: {
    projectName: projectName
    environment: environment
    location: location
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

// ─── Azure AI Speech ─────────────────────────────────────────────────────────
module speech 'modules/speech.bicep' = {
  name: 'speech'
  params: {
    projectName: projectName
    environment: environment
    location: location
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

// ─── Azure Communication Services ────────────────────────────────────────────
module communication 'modules/communication.bicep' = {
  name: 'communication'
  params: {
    projectName: projectName
    environment: environment
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

// ─── App Service (Web + Teams Bot + WhatsApp) ─────────────────────────────────
module appService 'modules/appservice.bicep' = {
  name: 'appService'
  params: {
    projectName: projectName
    environment: environment
    location: location
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

// ─── Azure Functions ──────────────────────────────────────────────────────────
module functions 'modules/functions.bicep' = {
  name: 'functions'
  params: {
    projectName: projectName
    environment: environment
    location: location
    keyVaultName: keyVault.outputs.keyVaultName
    cosmosAccountName: cosmos.outputs.cosmosAccountName
    serviceBusNamespaceName: serviceBus.outputs.namespaceName
    redisHostName: redis.outputs.redisHostName
  }
}

// ─── Bot Service ──────────────────────────────────────────────────────────────
module botService 'modules/botservice.bicep' = {
  name: 'botService'
  params: {
    projectName: projectName
    environment: environment
    location: location
    microsoftAppId: microsoftAppId
    teamsBotEndpoint: appService.outputs.teamsBotHostname
  }
}

// ─── API Management ───────────────────────────────────────────────────────────
module apim 'modules/apim.bicep' = {
  name: 'apim'
  params: {
    projectName: projectName
    environment: environment
    location: location
    functionsHostname: functions.outputs.functionsHostname
    publisherEmail: alertEmail
  }
}

// ─── Azure Front Door ────────────────────────────────────────────────────────
module frontDoor 'modules/frontdoor.bicep' = {
  name: 'frontDoor'
  params: {
    projectName: projectName
    environment: environment
    appServiceHostname: appService.outputs.webHostname
    apimHostname: apim.outputs.apimGatewayUrl
  }
}

// ─── Monitor (App Insights + Alert Rules) ────────────────────────────────────
module monitor 'modules/monitor.bicep' = {
  name: 'monitor'
  params: {
    projectName: projectName
    environment: environment
    location: location
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    alertEmail: alertEmail
    functionsAppName: functions.outputs.functionsAppName
  }
}

// ─── Microsoft Sentinel ──────────────────────────────────────────────────────
module sentinel 'modules/sentinel.bicep' = {
  name: 'sentinel'
  params: {
    logAnalyticsWorkspaceName: logAnalytics.outputs.workspaceName
  }
}

// ─── Azure Health Data Services (FHIR) ───────────────────────────────────────
module fhir 'modules/fhir.bicep' = {
  name: 'fhir'
  params: {
    projectName: projectName
    environment: environment
    location: location
    webDashboardOrigin: 'https://${appService.outputs.webHostname}'
  }
}

// ─── Outputs ──────────────────────────────────────────────────────────────────
@description('Azure Front Door endpoint URL')
output frontDoorEndpoint string = frontDoor.outputs.frontDoorEndpoint

@description('APIM Gateway URL')
output apimGatewayUrl string = apim.outputs.apimGatewayUrl

@description('Azure Functions hostname')
output functionsHostname string = functions.outputs.functionsHostname

@description('Web dashboard hostname')
output webHostname string = appService.outputs.webHostname

@description('Teams bot hostname')
output teamsBotHostname string = appService.outputs.teamsBotHostname

@description('WhatsApp webhook hostname')
output whatsAppHostname string = appService.outputs.whatsAppHostname

@description('Azure OpenAI endpoint')
output openAIEndpoint string = openAI.outputs.openAIEndpoint

@description('Cosmos DB account name')
output cosmosAccountName string = cosmos.outputs.cosmosAccountName

@description('Key Vault URI')
output keyVaultUri string = keyVault.outputs.keyVaultUri

@description('Application Insights connection string')
output appInsightsConnectionString string = monitor.outputs.appInsightsConnectionString

@description('FHIR service URL')
output fhirServiceUrl string = fhir.outputs.fhirServiceUrl

@description('Azure Maps account name')
output mapsAccountName string = maps.outputs.mapsAccountName

@description('Speech service endpoint')
output speechEndpoint string = speech.outputs.speechEndpoint

@description('Communication Services resource name')
output communicationServiceName string = communication.outputs.communicationServiceName

@description('Service Bus namespace FQDN')
output serviceBusNamespaceFqdn string = serviceBus.outputs.namespaceFqdn

@description('Redis hostname')
output redisHostName string = redis.outputs.redisHostName

@description('Log Analytics workspace ID')
output logAnalyticsWorkspaceId string = logAnalytics.outputs.workspaceId
