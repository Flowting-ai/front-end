# Cookie and Tracking Disclosure Policy

**Effective Date:** April 1, 2026
**Last Updated:** March 31, 2026

---

This Cookie and Tracking Disclosure Policy ("Policy") explains how Souvenir, Inc. ("Souvenir," "we," "us," or "our") uses cookies and similar browser-based storage technologies on [getsouvenir.com](https://getsouvenir.com) and related subdomains (collectively, the "Services"). This Policy should be read together with our [Privacy Policy](/legal/privacy-policy) and [Terms of Service](/legal/terms-of-service). It applies to users accessing the Services from the United States, Canada, and India.

---

## 1. What Are Cookies

Cookies are small text files placed on your device by a web server when you visit a website. They allow the site to recognize your device across requests and sessions. In addition to cookies, we use related browser-based storage mechanisms described in [Section 4](#4-browser-storage-local-and-session-storage) below.

---

## 2. Cookies We Use

We use a minimal set of cookies. All cookies we set are either strictly necessary for the operation of the platform or functional in nature. **We do not set analytics, advertising, behavioral targeting, or third-party tracking cookies.**

### Strictly Necessary Cookies

These cookies are required for the platform to function. They cannot be disabled without breaking core features such as authentication and session management.

| Cookie Name | Set By | Purpose | Duration | Flags |
|---|---|---|---|---|
| `appSession` | Auth0 (Okta) via `@auth0/nextjs-auth0` SDK | Encrypted session token that maintains your authenticated state across page loads. Contains no plaintext credentials. | Controlled by Auth0 session configuration (typically 1–7 days; expires on logout) | `HttpOnly`, `Secure`, `SameSite=Lax` |

### Functional Cookies

These cookies enable features that improve usability. They remember choices you have made and are tied to your account identity rather than used for tracking across third-party sites.

| Cookie Name | Set By | Purpose | Duration | Flags |
|---|---|---|---|---|
| `ob_{user_id}` | Souvenir (set at `POST /api/onboarding/complete`) | Records that your account has completed the onboarding flow. The cookie name is derived from your Auth0 user identifier (`sub` claim), with non-alphanumeric characters replaced by underscores (e.g., `ob_auth0_abc123`). Value is the literal string `"1"`. | 1 year (`maxAge: 31,536,000` seconds) | `SameSite=Lax`, `Path=/` |

**We do not use cookies for analytics, performance monitoring, advertising, or cross-site behavioral profiling.**

---

## 3. Authentication and Token Handling

Souvenir uses [Auth0 by Okta](https://auth0.com) for authentication. Upon login:

1. Auth0 issues an encrypted session cookie (`appSession`) that is `HttpOnly` and `Secure` — it cannot be read by JavaScript and is only transmitted over HTTPS.
2. An access token (JWT) is held **in memory only** on the client side. It is never written to cookies, `localStorage`, or `sessionStorage`. It is cleared automatically on logout or page refresh.
3. All authenticated API requests transmit the access token via the `Authorization: Bearer` HTTP header — not via cookies — providing an additional layer of security against CSRF-style token theft.

---

## 4. Browser Storage (Local and Session Storage)

In addition to cookies, we use your browser's `localStorage` and `sessionStorage` APIs to store non-sensitive UI state locally on your device. This data is never transmitted to our servers as tracking data and contains no personal information.

**`localStorage` (persists until cleared by user or application):**

| Key | Contents |
|---|---|
| `chatModelHistory` | Recently selected AI model identifiers |
| `leftSidebarCollapsed` | Sidebar open/collapsed preference |
| `activeChatId` | Most recently active chat session identifier |
| `settingsScrollTop` | Scroll position within the settings panel |
| `PINS_CACHE_KEY` | Cached list of pinned items for faster rendering |
| `allPersonas`, `allChats`, `allPins`, `allModels` | Client-side caches for workflow dialog selections |
| `workflow` (draft) | In-progress workflow canvas state |

**`sessionStorage` (cleared automatically when the browser tab is closed):**

| Key | Contents |
|---|---|
| `personaAvatar` | Temporary blob URL for avatar preview during persona creation; cleared immediately after the persona is saved |
| `startNewChatOnLogin` | One-time flag to open a new chat after login |
| `pinboardDevState` | Development-only UI state (not present in production builds) |

None of these storage entries contain authentication tokens, personal identifiers, payment data, or behavioral tracking data.

---

## 5. Third-Party Service Providers

We share limited data with the following third parties solely to operate the Services. We do not sell or share personal data for advertising purposes.

| Provider | Role | Data Involved | Privacy Reference |
|---|---|---|---|
| **Auth0 (Okta)** | Authentication and identity management. Manages login flows, session tokens, and the `appSession` cookie. | User credentials (email/password or SSO), session metadata | [Auth0 Privacy Policy](https://www.okta.com/privacy-policy/) |
| **Amazon Web Services (AWS)** | Cloud infrastructure and hosting for all platform services. | All application data as processed in the course of hosting | [AWS Privacy Notice](https://aws.amazon.com/privacy/) |
| **Stripe, Inc.** | Payment processing, subscription billing, and UPI Autopay for Indian users. | Payment method data, billing details, transaction records | [Stripe Privacy Policy](https://stripe.com/privacy) |
| **Google Fonts** | Font delivery via `fonts.googleapis.com` CDN. Loaded at page render. | Your IP address and browser user-agent are transmitted to Google's CDN servers as part of the font request. | [Google Privacy Policy](https://policies.google.com/privacy) |

**We do not integrate Mixpanel, Google Analytics, or any other behavioral analytics platform.** No tracking pixels, advertising SDKs, or third-party session recording tools are present on the Services.

---

## 6. Consent and Cookie Management

Because we use only strictly necessary and functional cookies — and no analytics, advertising, or tracking cookies — the majority of our cookie usage does not require explicit opt-in consent under applicable law. The `appSession` cookie is required to use the platform and cannot be disabled while remaining logged in.

You may manage or delete cookies at any time through your browser settings:

- **Chrome:** Settings > Privacy and Security > Cookies and other site data
- **Firefox:** Settings > Privacy & Security > Cookies and Site Data
- **Safari:** Preferences > Privacy > Manage Website Data
- **Edge:** Settings > Cookies and site permissions

Deleting cookies will log you out of the Services and reset functional preferences. Browser-based localStorage and sessionStorage can be cleared via your browser's Developer Tools (Application > Storage).

---

## 7. Your Rights by Jurisdiction

### United States — California (CCPA/CPRA)

California residents have the right to: (i) know what personal information we collect and how it is used; (ii) request deletion of personal information; (iii) opt out of the sale or sharing of personal information (we do not sell or share personal information for advertising). To exercise these rights, contact us at [info@getsouvenir.com](mailto:info@getsouvenir.com).

### Canada (PIPEDA / Law 25)

Canadian users are entitled to meaningful, informed consent before non-essential data processing. As we do not use non-essential tracking technologies, this is largely inapplicable to our cookie practices. You may withdraw consent for functional cookies at any time by clearing cookies in your browser or contacting [info@getsouvenir.com](mailto:info@getsouvenir.com).

### India (Digital Personal Data Protection Act, 2023)

We recognize the rights of Data Principals under the DPDP Act, including the right to access, correct, and erase personal data. Cookie-related inquiries may be directed to [info@getsouvenir.com](mailto:info@getsouvenir.com). Stripe processes payment data for UPI Autopay in compliance with applicable RBI and DPDP regulations.

---

## 8. Data Retention

| Data Type | Retention Period |
|---|---|
| Auth0 session cookie (`appSession`) | Deleted on logout or session expiry (typically 1–7 days) |
| Onboarding cookie (`ob_{user_id}`) | Up to 1 year from last set date |
| `localStorage` entries | Until cleared by the user or the application logic |
| `sessionStorage` entries | Until the browser tab or window is closed |
| Auth0 identity records | Governed by our Privacy Policy and Auth0 data retention settings |

---

## 9. Security Measures

All cookies set or relied upon by the Services are transmitted exclusively over HTTPS. The `appSession` cookie is `HttpOnly` (inaccessible to JavaScript) and `Secure` (HTTPS-only). Our Content Security Policy (CSP) restricts script execution to first-party sources, preventing unauthorized third-party scripts from loading on the Services. Sensitive values such as tokens and authorization headers are automatically redacted from application logs.

---

## 10. Changes to This Policy

We will provide at least **14 days' notice** before any material changes to this Policy take effect by posting the updated Policy on the Services with a revised "Last Updated" date. Continued use of the Services after the effective date constitutes acceptance of the updated Policy.

---

## 11. Contact

**Souvenir, Inc.**
211 28th Street
Des Moines, IA 50312
United States

Email: [info@getsouvenir.com](mailto:info@getsouvenir.com)
Phone: +1 (515) 450-2093
Website: [getsouvenir.com](https://getsouvenir.com)

---

*© 2026 Souvenir, Inc. All rights reserved.*
