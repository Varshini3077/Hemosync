# ADR 004 — MSG91 over ACS SMS for India

**Date:** 2024-11-22
**Status:** Accepted

---

## Context

HemoSync sends emergency SMS messages to blood bank coordinators in Delhi NCR. All recipients have Indian mobile numbers (+91). We evaluated two SMS delivery paths:

**Azure Communication Services (ACS) SMS:**
- Native Azure integration; no additional vendor
- Single SDK and billing account
- ACS SMS in India is constrained: as of 2024, ACS cannot provision Indian long codes or short codes natively
- Requires a third-party Indian SMS gateway (MSG91, Exotel, etc.) even when using ACS as the abstraction layer
- Indian DLT (Distributed Ledger Technology) registration — mandated by TRAI for transactional SMS — is not handled by ACS

**MSG91:**
- India-native SMS gateway; founded 2011; used by Swiggy, Paytm, Nykaa
- TRAI DLT-registered; sender ID `HMSYNC` and templates pre-registered
- Supports OTP, transactional, and promotional routes
- Reliable delivery on Airtel, Jio, BSNL, Vi networks
- REST API; Node.js SDK available
- Pricing: ₹0.18 per SMS (transactional route)

---

## Decision

Use **MSG91** as the primary SMS gateway. ACS remains as the interface abstraction for WhatsApp (where ACS has full India support). MSG91 is called directly from the `broadcast` function for SMS delivery.

The broadcast function uses the `MSG91_ROUTE=4` (transactional) route and the pre-registered DLT template IDs (`MSG91_TEMPLATE_ID_REQUEST`, `MSG91_TEMPLATE_ID_CONFIRM`). Sender ID is `HMSYNC`.

The integration is encapsulated in `packages/types/src/sms.ts` so the gateway can be swapped if needed.

---

## Consequences

**Positive:**
- Reliable SMS delivery on all major Indian carrier networks
- DLT compliance handled by MSG91; no TRAI registration burden on the HemoSync team
- Competitive per-SMS pricing for Indian numbers
- India-local support and SLA agreements

**Negative:**
- One additional vendor dependency outside the Azure ecosystem
- MSG91 API key is a separate secret in Key Vault (`Msg91AuthKey`)
- If MSG91 has an outage, there is no automated SMS fallback (a future ADR may address this with ACS as secondary)
- Developer accounts require Indian phone number verification for trial
