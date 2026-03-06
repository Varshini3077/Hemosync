@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Azure region for the Bot Service registration')
param location string

@description('Microsoft App ID for the Teams Bot (Azure AD app registration)')
param microsoftAppId string

@description('HTTPS endpoint of the Teams bot App Service (without trailing slash)')
param teamsBotEndpoint string

var botServiceName = '${projectName}-bot-${environment}'

resource botService 'Microsoft.BotService/botServices@2022-09-15' = {
  name: botServiceName
  location: location
  sku: {
    name: 'F0'
  }
  kind: 'azurebot'
  properties: {
    displayName: 'HemoSync Bot (${environment})'
    description: 'HemoSync blood request coordination bot for Microsoft Teams'
    endpoint: 'https://${teamsBotEndpoint}/api/messages'
    msaAppId: microsoftAppId
    msaAppType: 'MultiTenant'
    // Disable public network access for additional security in prod
    publicNetworkAccess: 'Enabled'
    isStreamingSupported: false
    schemaTransformationVersion: '1.3'
  }
}

// ─── Microsoft Teams channel ──────────────────────────────────────────────────
resource teamsChannel 'Microsoft.BotService/botServices/channels@2022-09-15' = {
  parent: botService
  name: 'MsTeamsChannel'
  location: location
  properties: {
    channelName: 'MsTeamsChannel'
    properties: {
      isEnabled: true
      enableCalling: false
    }
  }
}

// ─── Direct Line channel (for local testing and emulator) ────────────────────
resource directLineChannel 'Microsoft.BotService/botServices/channels@2022-09-15' = {
  parent: botService
  name: 'DirectLineChannel'
  location: location
  properties: {
    channelName: 'DirectLineChannel'
    properties: {
      sites: [
        {
          siteName: 'Default Site'
          isEnabled: true
          isV1Enabled: false
          isV3Enabled: true
          isSecureSiteEnabled: false
        }
      ]
    }
  }
}

@description('Bot Service resource name')
output botServiceName string = botService.name

@description('Bot Service endpoint URL')
output botEndpoint string = botService.properties.endpoint

@description('Bot Service messaging endpoint')
output botMessagingEndpoint string = 'https://${teamsBotEndpoint}/api/messages'
