@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Azure region for the APIM instance')
param location string

@description('Azure Functions hostname to route API calls to')
param functionsHostname string

@description('Publisher email address for APIM admin notifications')
param publisherEmail string

var apimName = '${projectName}-apim-${environment}'

resource apim 'Microsoft.ApiManagement/service@2023-05-01-preview' = {
  name: apimName
  location: location
  sku: {
    // Consumption tier: no infrastructure cost, scales to zero — ideal for hackathon
    name: 'Consumption'
    capacity: 0
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    publisherEmail: publisherEmail
    publisherName: 'HemoSync Team'
    customProperties: {
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls10': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls11': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Ciphers.TripleDes168': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls10': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls11': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Ssl30': 'False'
    }
  }
}

// ─── HemoSync API definition ──────────────────────────────────────────────────
resource hemosyncApi 'Microsoft.ApiManagement/service/apis@2023-05-01-preview' = {
  parent: apim
  name: 'hemosync-api'
  properties: {
    displayName: 'HemoSync API'
    description: 'Blood request coordination and donor matching API'
    path: 'hemosync'
    protocols: [
      'https'
    ]
    serviceUrl: 'https://${functionsHostname}/api'
    subscriptionRequired: true
    subscriptionKeyParameterNames: {
      header: 'Ocp-Apim-Subscription-Key'
      query: 'subscription-key'
    }
    apiType: 'http'
  }
}

// ─── API-level policy: CORS + auth header check + rate limit ─────────────────
resource apiPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-05-01-preview' = {
  parent: hemosyncApi
  name: 'policy'
  properties: {
    format: 'xml'
    value: '''
<policies>
  <inbound>
    <base />
    <cors allow-credentials="true">
      <allowed-origins>
        <origin>https://hemosync-web-prod.azurewebsites.net</origin>
        <origin>https://teams.microsoft.com</origin>
        <origin>http://localhost:3000</origin>
      </allowed-origins>
      <allowed-methods preflight-result-max-age="300">
        <method>GET</method>
        <method>POST</method>
        <method>PUT</method>
        <method>DELETE</method>
        <method>OPTIONS</method>
      </allowed-methods>
      <allowed-headers>
        <header>Content-Type</header>
        <header>Authorization</header>
        <header>Ocp-Apim-Subscription-Key</header>
        <header>x-api-key</header>
      </allowed-headers>
    </cors>
    <check-header name="x-api-key" failed-check-httpcode="401" failed-check-error-message="Unauthorized" ignore-case="false">
    </check-header>
    <rate-limit-by-key calls="100" renewal-period="60"
      counter-key="@(context.Subscription.Id)"
      increment-condition="@(context.Response.StatusCode >= 200 &amp;&amp; context.Response.StatusCode &lt; 300)" />
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
  </outbound>
  <on-error>
    <base />
  </on-error>
</policies>
'''
  }
}

// ─── 7 HemoSync API operations ────────────────────────────────────────────────
// 1. parse-request
resource opParseRequest 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: hemosyncApi
  name: 'parse-request'
  properties: {
    displayName: 'Parse Blood Request'
    method: 'POST'
    urlTemplate: '/parse-request'
    description: 'Parses natural language blood request using GPT-4o and extracts structured data'
    request: {
      description: 'Blood request payload (text or voice transcript)'
      representations: [
        {
          contentType: 'application/json'
        }
      ]
    }
    responses: [
      {
        statusCode: 200
        description: 'Parsed blood request with blood type, units, urgency, hospital'
      }
    ]
  }
}

// 2. ranked-banks
resource opRankedBanks 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: hemosyncApi
  name: 'ranked-banks'
  properties: {
    displayName: 'Get Ranked Blood Banks'
    method: 'GET'
    urlTemplate: '/ranked-banks'
    description: 'Returns blood banks ranked by proximity, stock availability, and transport time'
    responses: [
      {
        statusCode: 200
        description: 'Ranked list of blood banks with ETA and stock details'
      }
    ]
  }
}

// 3. ranked-banks cache policy (60s response cache)
resource opRankedBanksPolicy 'Microsoft.ApiManagement/service/apis/operations/policies@2023-05-01-preview' = {
  parent: opRankedBanks
  name: 'policy'
  properties: {
    format: 'xml'
    value: '''
<policies>
  <inbound>
    <base />
    <cache-lookup vary-by-developer="false" vary-by-developer-groups="false" downstream-caching-type="none">
      <vary-by-query-parameter>bloodType</vary-by-query-parameter>
      <vary-by-query-parameter>location</vary-by-query-parameter>
    </cache-lookup>
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
    <cache-store duration="60" />
  </outbound>
  <on-error>
    <base />
  </on-error>
</policies>
'''
  }
}

// 4. broadcast
resource opBroadcast 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: hemosyncApi
  name: 'broadcast'
  properties: {
    displayName: 'Broadcast Blood Request'
    method: 'POST'
    urlTemplate: '/broadcast'
    description: 'Broadcasts blood request to matched donors via WhatsApp/SMS/Teams'
  }
}

// 5. fallback-donors
resource opFallbackDonors 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: hemosyncApi
  name: 'fallback-donors'
  properties: {
    displayName: 'Get Fallback Donors'
    method: 'GET'
    urlTemplate: '/fallback-donors'
    description: 'Returns registered volunteer donors matching the blood type when bank stock is insufficient'
  }
}

// 6. speech-to-text
resource opSpeechToText 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: hemosyncApi
  name: 'speech-to-text'
  properties: {
    displayName: 'Speech to Text'
    method: 'POST'
    urlTemplate: '/speech-to-text'
    description: 'Converts audio blob to text transcript using Azure AI Speech'
  }
}

// 7. embed-token
resource opEmbedToken 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: hemosyncApi
  name: 'embed-token'
  properties: {
    displayName: 'Get Power BI Embed Token'
    method: 'GET'
    urlTemplate: '/embed-token'
    description: 'Returns a scoped Power BI embed token for the real-time analytics dashboard'
  }
}

// ─── Default subscription for hackathon testing ───────────────────────────────
resource defaultSubscription 'Microsoft.ApiManagement/service/subscriptions@2023-05-01-preview' = {
  parent: apim
  name: 'hemosync-default'
  properties: {
    displayName: 'HemoSync Default Subscription'
    state: 'active'
    scope: hemosyncApi.id
    allowTracing: false
  }
}

@description('APIM gateway URL')
output apimGatewayUrl string = apim.properties.gatewayUrl

@description('APIM service name')
output apimServiceName string = apim.name

@description('HemoSync API path')
output hemosyncApiPath string = hemosyncApi.properties.path
