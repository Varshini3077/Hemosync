@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Default hostname of the App Service (web dashboard)')
param appServiceHostname string

@description('APIM gateway URL (hostname only, no trailing slash)')
param apimHostname string

var profileName = '${projectName}-afd-${environment}'
var wafPolicyName = replace('${projectName}waf${environment}', '-', '')
var endpointName = '${projectName}-endpoint-${environment}'
var originGroupName = 'hemosync-origins'

// ─── WAF Policy with OWASP 3.2 ruleset ───────────────────────────────────────
resource wafPolicy 'Microsoft.Network/FrontDoorWebApplicationFirewallPolicies@2022-05-01' = {
  name: wafPolicyName
  location: 'global'
  sku: {
    name: 'Standard_AzureFrontDoor'
  }
  properties: {
    policySettings: {
      enabledState: 'Enabled'
      mode: environment == 'prod' ? 'Prevention' : 'Detection'
      requestBodyCheck: 'Enabled'
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'Microsoft_DefaultRuleSet'
          ruleSetVersion: '2.1'
          ruleSetAction: 'Block'
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.0'
          ruleSetAction: 'Block'
        }
      ]
    }
    customRules: {
      rules: []
    }
  }
}

// ─── Azure Front Door Standard profile ───────────────────────────────────────
resource frontDoorProfile 'Microsoft.Cdn/profiles@2023-05-01' = {
  name: profileName
  location: 'global'
  sku: {
    name: 'Standard_AzureFrontDoor'
  }
  properties: {}
}

// ─── Front Door endpoint ──────────────────────────────────────────────────────
resource frontDoorEndpoint 'Microsoft.Cdn/profiles/afdEndpoints@2023-05-01' = {
  parent: frontDoorProfile
  name: endpointName
  location: 'global'
  properties: {
    enabledState: 'Enabled'
  }
}

// ─── Origin group: App Service + APIM ────────────────────────────────────────
resource originGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = {
  parent: frontDoorProfile
  name: originGroupName
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/health'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      // Health probe every 30s
      probeIntervalInSeconds: 30
    }
    sessionAffinityState: 'Disabled'
  }
}

// ─── Origin: App Service (web dashboard) ─────────────────────────────────────
resource originAppService 'Microsoft.Cdn/profiles/originGroups/origins@2023-05-01' = {
  parent: originGroup
  name: 'app-service-origin'
  properties: {
    hostName: appServiceHostname
    httpPort: 80
    httpsPort: 443
    originHostHeader: appServiceHostname
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

// ─── Origin: APIM (API gateway) ───────────────────────────────────────────────
resource originApim 'Microsoft.Cdn/profiles/originGroups/origins@2023-05-01' = {
  parent: originGroup
  name: 'apim-origin'
  properties: {
    hostName: replace(replace(apimHostname, 'https://', ''), '/', '')
    httpPort: 80
    httpsPort: 443
    originHostHeader: replace(replace(apimHostname, 'https://', ''), '/', '')
    priority: 1
    weight: 500
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

// ─── Route: web dashboard (/) ─────────────────────────────────────────────────
resource routeWeb 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: frontDoorEndpoint
  name: 'web-route'
  dependsOn: [
    originAppService
  ]
  properties: {
    originGroup: {
      id: originGroup.id
    }
    supportedProtocols: [
      'Https'
    ]
    patternsToMatch: [
      '/*'
    ]
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
    // Custom domain support placeholder — add custom domain resource and update here
    // customDomains: []
    cacheConfiguration: {
      queryStringCachingBehavior: 'IgnoreQueryString'
      compressionSettings: {
        isCompressionEnabled: true
        contentTypesToCompress: [
          'text/html'
          'text/css'
          'application/javascript'
          'application/json'
        ]
      }
    }
  }
}

// ─── Security policy: attach WAF to endpoint ─────────────────────────────────
resource securityPolicy 'Microsoft.Cdn/profiles/securityPolicies@2023-05-01' = {
  parent: frontDoorProfile
  name: 'hemosync-waf-policy'
  properties: {
    parameters: {
      type: 'WebApplicationFirewall'
      wafPolicy: {
        id: wafPolicy.id
      }
      associations: [
        {
          domains: [
            {
              id: frontDoorEndpoint.id
            }
          ]
          patternsToMatch: [
            '/*'
          ]
        }
      ]
    }
  }
}

@description('Front Door endpoint hostname')
output frontDoorEndpoint string = frontDoorEndpoint.properties.hostName

@description('Front Door profile name')
output frontDoorProfileName string = frontDoorProfile.name

@description('WAF policy name')
output wafPolicyName string = wafPolicy.name
