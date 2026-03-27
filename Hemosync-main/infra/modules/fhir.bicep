@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Azure region for Health Data Services — must support AHDS')
param location string

@description('Allowed origin for web dashboard CORS (e.g. https://hemosync-web-prod.azurewebsites.net)')
param webDashboardOrigin string

// IMPORTANT: Azure Health Data Services requires a separate registration process:
// 1. Register the "Microsoft.HealthDataAIServices" and "Microsoft.HealthcareApis"
//    resource providers in your Azure subscription before deploying.
// 2. The FHIR service uses synthetic patient data for the hackathon demo.
//    Real patient data requires HIPAA/PDPA BAA agreements.
// 3. SMART on FHIR OAuth2 app registration must be configured post-deployment
//    in the Azure portal under the FHIR service authentication settings.

var workspaceName = '${projectName}-hdws-${environment}'
var fhirServiceName = 'fhir'

// ─── Azure Health Data Services workspace ────────────────────────────────────
resource healthWorkspace 'Microsoft.HealthcareApis/workspaces@2023-09-06' = {
  name: workspaceName
  location: location
  properties: {
    publicNetworkAccess: 'Enabled'
  }
}

// ─── FHIR R4 service ─────────────────────────────────────────────────────────
resource fhirService 'Microsoft.HealthcareApis/workspaces/fhirservices@2023-09-06' = {
  parent: healthWorkspace
  name: fhirServiceName
  location: location
  kind: 'fhir-R4'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    authenticationConfiguration: {
      authority: '${environment().authentication.loginEndpoint}${subscription().tenantId}'
      audience: 'https://${workspaceName}-${fhirServiceName}.fhir.azurehealthcareapis.com'
      // SMART on FHIR enables OAuth2 authorization for granular scope-based access
      smartProxyEnabled: true
    }
    corsConfiguration: {
      // Allow the web dashboard origin for browser-based FHIR queries
      origins: [
        webDashboardOrigin
        'http://localhost:3000'
      ]
      headers: [
        'Content-Type'
        'Authorization'
        'x-ms-useragent'
      ]
      methods: [
        'GET'
        'POST'
        'PUT'
        'DELETE'
        'OPTIONS'
      ]
      maxAge: 600
      allowCredentials: false
    }
    exportConfiguration: {
      storageAccountName: ''
    }
    resourceVersionPolicyConfiguration: {
      default: 'versioned'
    }
    implementationGuidesConfiguration: {
      usCoreMissingData: false
    }
  }
}

@description('FHIR service URL')
output fhirServiceUrl string = 'https://${workspaceName}-${fhirServiceName}.fhir.azurehealthcareapis.com'

@description('Health Data Services workspace name')
output healthWorkspaceName string = healthWorkspace.name

@description('FHIR service resource name')
output fhirServiceName string = fhirService.name

@description('FHIR service managed identity principal ID')
output fhirPrincipalId string = fhirService.identity.principalId
