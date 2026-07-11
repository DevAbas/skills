# Security

> The layered threat model and defense in depth. Reference material for the fe-architect skill. Load for XSS/CSRF/clickjacking, CSP & Trusted Types, auth/OAuth/JWT/sessions, and supply-chain security.

## XSS, CSRF & Clickjacking

**One-liner:** Three browser-level attacks and the headers that stop them.

**Key tradeoffs:**
- **Pros:** `SameSite=Strict` is the strongest CSRF defense for same-domain apps (cookie never sent cross-site); double-submit cookie validates with no session store needed; `frame-ancestors 'none'` (or `X-Frame-Options: DENY`) blocks clickjacking iframes.
- **Cons:** `SameSite=Lax` (default) still allows cross-site GET, so state-mutating GET endpoints stay vulnerable; `SameSite` only applies when API and front end share the same registrable domain; `X-Frame-Options` only supports DENY/SAMEORIGIN and isn't honored in `<meta>` tags.

**When to use:** Output-encode user data on render and add a `script-src` CSP for XSS; use `SameSite=Strict` (or Lax + CSRF token) for CSRF; set `frame-ancestors 'none'` to block clickjacking.
**When to avoid:** Don't rely on `SameSite=Lax` alone for CSRF. It allows cross-site GET, leaving state-mutating GET endpoints vulnerable; it only applies if API and front end share the same registrable domain.

**Key terms:**
- **XSS (Cross-Site Scripting)**: An injection attack where untrusted script executes in another user's browser under the victim site's origin.
- **CSRF (Cross-Site Request Forgery)**: An attack that forges authenticated requests by exploiting the browser's automatic cookie attachment on cross-origin requests.
- **SameSite cookie**: A cookie attribute (Strict/Lax/None) restricting when the browser includes the cookie on cross-site requests.
- **Content Security Policy (CSP)**: An HTTP response header declaring allowed sources for scripts, styles, and frames; mitigates XSS and clickjacking.
- **Trusted Types**: A browser API enforced via CSP that requires DOM sinks like innerHTML to accept typed wrapper objects, not raw strings.

**Pitfalls:**
- `dangerouslySetInnerHTML` bypasses React's automatic text-node escaping and writes raw HTML. Any attacker-controlled string can inject executable script; sanitize with DOMPurify first.
- `SameSite=Lax` blocks cross-site POST but allows cross-site GET, so state-mutating GET endpoints remain vulnerable; `SameSite` is per-cookie and only applies when API and front end share the same registrable domain.
- `frame-ancestors` supersedes `X-Frame-Options`, which only supports DENY/SAMEORIGIN and is not supported in `<meta>` tags; CSP takes precedence when both are present.

**Interview angle:** "Encode output for XSS, set SameSite cookies for CSRF, and set `frame-ancestors 'none'` for clickjacking. Three attacks, three headers."

**Related:** `csp-trusted-types`, `auth-oauth-jwt-sessions`, `supply-chain-security`

**Deep dive:** https://fearchitect.com/topics/xss-csrf-clickjacking

---

## CSP & Trusted Types

**One-liner:** Block script injection and DOM XSS at the browser's policy layer.

**Key tradeoffs:**
- **Pros:** Blocks injected scripts even when input sanitization has a gap; nonces eliminate fragile URL allowlists and CDN-hosted bypass risk; Trusted Types catches DOM XSS at the sink, the last line of defense; report-only mode enables incremental rollout with zero user impact.
- **Cons:** Nonce generation requires server-side per-request work (static CDN serving needs a reverse proxy); Trusted Types requires migrating every `innerHTML`, `eval`, and `script.src` call, substantial in large codebases; browser support isn't universal; a misconfigured policy that allows too-broad sanitization gives false confidence.

**When to use:** Use a nonce + `strict-dynamic` strict CSP instead of fragile URL allowlists; add `require-trusted-types-for 'script'` to close DOM XSS sinks as defense-in-depth; set `object-src 'none'` and `base-uri 'none'`.
**When to avoid:** Don't rely on Trusted Types as a sole cross-browser backstop. Support isn't universal, so treat it as defense-in-depth layered on CSP; don't trust a misconfigured policy that allows too-broad sanitization.

**Key terms:**
- **CSP nonce**: A per-response random token that allowlists exactly the inline scripts tagged with it.
- **strict-dynamic**: CSP keyword that propagates nonce trust to scripts loaded dynamically by an already-trusted script.
- **Trusted Types**: Browser API that enforces type-safe values on dangerous DOM sinks (innerHTML, eval, script.src).
- **DOM XSS sink**: A DOM API that executes or injects HTML/JS: innerHTML, eval, document.write, script.src.
- **report-only mode**: CSP header variant that reports violations without blocking, safe for gradual rollout.

**Pitfalls:**
- A URL-allowlist CSP fails even without an obvious CDN compromise: any allowlisted host can serve attacker-uploaded files, and wildcard entries (`*.example.com`) enable sub-domain-takeover bypass; nonce + `strict-dynamic` removes URL allowlists entirely.
- `unsafe-inline` negates injection protection entirely, and it's the default fallback.
- Omitting `object-src 'none'` (Flash/plugin injection) and `base-uri 'none'` (a `<base>` tag injection redirecting relative URLs to an attacker origin) leaves two bypass vectors open.

**Interview angle:** "Nonce + strict-dynamic kills injection; Trusted Types kills DOM XSS sinks."

**Related:** `xss-csrf-clickjacking`, `auth-oauth-jwt-sessions`, `supply-chain-security`

**Deep dive:** https://fearchitect.com/topics/csp-trusted-types

---

## Auth: OAuth, JWT & Sessions

**One-liner:** Delegate identity with OAuth, carry claims in JWTs, store state in sessions.

**Key tradeoffs:**
- **Pros:** JWTs are stateless: no server lookup, scale horizontally, claims carried inline; server sessions allow immediate revocation by deleting the session record (instant logout).
- **Cons:** JWTs cannot be revoked before expiry without a blocklist and carry a larger payload; server sessions make the session store a shared dependency.

**When to use:** JWTs for stateless APIs and short-lived machine tokens; server sessions for user sessions needing instant logout; the BFF token-handler pattern to keep OAuth tokens off the browser for SPAs; authorization-code + PKCE flow for SPAs and mobile apps.
**When to avoid:** Don't store tokens in localStorage. It's readable by any JS, so a single XSS drains every user token.

**Key terms:**
- **PKCE**: Proof Key for Code Exchange, a one-time code verifier that binds an auth request to its token exchange, blocking interception.
- **OIDC**: OpenID Connect, an identity layer on OAuth 2.0 that issues a signed ID token containing user claims.
- **JWT**: JSON Web Token, a base64url-encoded header + payload + signature; stateless, self-contained, cannot be revoked before expiry.
- **HttpOnly cookie**: Browser cookie inaccessible to JavaScript; protects tokens from XSS exfiltration.
- **BFF (Backend for Frontend)**: Server layer that holds OAuth tokens and exposes a session cookie to the SPA, keeping tokens off the client.

**Pitfalls:**
- Storing tokens in localStorage: it's readable by any JavaScript on the page, so one XSS payload exfiltrates every token. Use HttpOnly Secure `SameSite=Strict` cookies instead (HttpOnly is invisible to JS; SameSite=Strict blocks CSRF).
- The standard pattern is short-lived access tokens (5-15 min) plus a refresh token in an HttpOnly cookie; short lifetimes limit the exposure window since tokens can't be revoked before expiry.
- JWT revocation gap: stateless tokens can't be invalidated before expiry without a blocklist or token-introspection endpoint.

**Interview angle:** "JWTs are stateless and unrevocable; sessions are stateful and instantly revocable."

**Related:** `xss-csrf-clickjacking`, `csp-trusted-types`, `backend-for-frontend`, `api-gateway`

**Deep dive:** https://fearchitect.com/topics/auth-oauth-jwt-sessions

---

## Supply Chain Security

**One-liner:** Stop malicious npm packages and third-party scripts from owning your app.

**Key tradeoffs:**
- **Pros:** `npm ci` installs exact locked versions and blocks version drift; SRI hash-locks CDN scripts and rejects tampered files; DOMPurify strips XSS vectors from untrusted HTML; `npm audit` + Dependabot surface and fix CVEs over time.
- **Cons:** `postinstall` hooks in any direct or transitive dep run arbitrary code with your OS credentials at install; SRI needs `crossOrigin="anonymous"` or the check is silently skipped, plus a new hash on every script update; the average Node project pulls hundreds of transitive deps, expanding the audit surface.

**When to use:** Commit `package-lock.json` and run `npm ci` in CI; run `npm audit --audit-level=high` and block merges on high/critical CVEs; enable Dependabot/Renovate; add `integrity` + `crossorigin` SRI to every third-party `<script>`/`<link>`; run DOMPurify before injecting external HTML; publish an SBOM.
**When to avoid:** Don't let untrusted packages run install scripts. Use `--ignore-scripts` for CI installs of packages you don't trust to run code, and audit new dependencies before adding them.

**Key terms:**
- **SRI (Subresource Integrity)**: Browser check that blocks a `<script>` or `<link>` whose content hash doesn't match the `integrity` attribute.
- **DOMPurify**: JavaScript library that strips XSS vectors from an HTML string before it is inserted into the DOM.
- **npm ci**: Installs exact versions from `package-lock.json`, errors if lock is out of sync; safer than `npm install` in CI.
- **SBOM (Software Bill of Materials)**: Machine-readable inventory of all packages in an application and their versions, used for vulnerability auditing.
- **Typosquatting**: Publishing a malicious npm package whose name resembles a popular package to catch installation typos.

**Pitfalls:**
- `crossOrigin="anonymous"` must accompany `integrity`, or the browser uses CORS no-cors mode and silently skips the SRI check entirely.
- `postinstall` hooks in any package, direct or transitive, execute with your OS credentials at every `npm install` and can read `.env`, SSH keys, or AWS credentials; use `--ignore-scripts` for untrusted installs.
- Transitive drift: a direct dependency can add a new transitive dep with a `postinstall` hook you never audited.

**Interview angle:** "Lock every dependency, verify every external script hash, and sanitize every HTML string you didn't write."

**Related:** `xss-csrf-clickjacking`, `csp-trusted-types`, `ci-cd-frontend`

**Deep dive:** https://fearchitect.com/topics/supply-chain-security
