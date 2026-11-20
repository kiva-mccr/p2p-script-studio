# OWASP ASVS 5.0, level 1

Every level 1 requirement of the [OWASP Application Security Verification Standard 5.0](https://owasp.org/www-project-application-security-verification-standard/),
and how the app meets it, or why it doesn't apply. The app is a static page with no server, accounts or
database, so most of the chapters about those don't apply; each says why. A short version is on the For IT page
(docs/for-it.md). Checked 2026-11-20 (SE-8); a change that touches one of these updates its line.

In all: 23 met, 1 partly, 46 not applicable, of 70.

## V1 Encoding and Sanitization

| Requirement | Status | How |
| --- | --- | --- |
| **V1.2.1** Output encoding for an HTTP response, HTML document, or XML document is relevant for the context required, such as encoding the relevant characters for HTML elements, HTML attributes, HTML comments, CSS, or HTTP header fields, to avoid changing the message or document structure. | Met | Script text reaches HTML only through `toHtml` (or Svelte's own escaping); `tests/unit/untrusted.test.ts` and `tests/e2e/untrusted.spec.ts` (SE-3). |
| **V1.2.2** When dynamically building URLs, untrusted data is encoded according to its context (e.g., URL encoding or base64url encoding for query or path parameters). Ensure that only safe URL protocols are permitted (e.g., disallow javascript: or data:). | Met | Links from a script are kept only if they are http(s) (SE-3); the Feedback link is built with `URLSearchParams`. |
| **V1.2.3** Output encoding or escaping is used when dynamically building JavaScript content (including JSON), to avoid changing the message or document structure (to avoid JavaScript and JSON injection). | Met | No JavaScript is built from data; JSON is written with `JSON.stringify`. |
| **V1.2.4** Data selection or database queries (e.g., SQL, HQL, NoSQL, Cypher) use parameterized queries, ORMs, entity frameworks, or are otherwise protected from SQL Injection and other database injection attacks. This is also relevant when writing stored procedures. | Not applicable | No database queries: IndexedDB is read by key, with no query language. |
| **V1.2.5** The application protects against OS command injection and that operating system calls use parameterized OS queries or use contextual command line output encoding. | Not applicable | A web page can't run operating system commands. |
| **V1.3.1** All untrusted HTML input from WYSIWYG editors or similar is sanitized using a well-known and secure HTML sanitization library or framework feature. | Met | No HTML is taken in: pasting reads plain text (and pictures as files). |
| **V1.3.2** The application avoids the use of eval() or other dynamic code execution features such as Spring Expression Language (SpEL). Where there is no alternative, any user input being included must be sanitized before being executed. | Met | No `eval` or `new Function`; the policy forbids them (`script-src` has no `'unsafe-eval'`, only `'wasm-unsafe-eval'` for the speech models' WebAssembly). |
| **V1.5.1** The application configures XML parsers to use a restrictive configuration and that unsafe features such as resolving external entities are disabled to prevent XML eXternal Entity (XXE) attacks. | Not applicable | The app writes XML (Final Draft, Resolve / Premiere) but never reads any. |

## V2 Validation and Business Logic

| Requirement | Status | How |
| --- | --- | --- |
| **V2.1.1** The application's documentation defines input validation rules for how to check the validity of data items against an expected structure. This could be common data formats such as credit card numbers, email addresses, telephone numbers, or it could be an internal data format. | Met | The formats are documented: docs/script-format.md and docs/studio-folder.md. |
| **V2.2.1** Input is validated to enforce business or functional expectations for that input. This should either use positive validation against an allow list of values, patterns, and ranges, or be based on comparing the input to an expected structure and logical limits according to predefined rules. For L1, this can focus on input which is used to make specific business or security decisions. For L2 and up, this should apply to all input. | Met | Folder files are read against those formats; anything unexpected is shown as text or left out (SE-3 tests). |
| **V2.2.2** The application is designed to enforce input validation at a trusted service layer. While client-side validation improves usability and should be encouraged, it must not be relied upon as a security control. | Not applicable | No service layer: the folder's own Windows permissions are the only access control, and the app claims none. |
| **V2.3.1** The application will only process business logic flows for the same user in the expected sequential step order and without skipping steps. | Not applicable | Send for review and Approve are steps the team agrees on, not security controls: anyone who can change the folder can change its files. |

## V3 Web Frontend Security

| Requirement | Status | How |
| --- | --- | --- |
| **V3.2.1** Security controls are in place to prevent browsers from rendering content or functionality in HTTP responses in an incorrect context (e.g., when an API, a user-uploaded file or other resource is requested directly). Possible controls could include: not serving the content unless HTTP request header fields (such as Sec-Fetch-*) indicate it is the correct context, using the sandbox directive of the Content-Security-Policy header field or using the attachment disposition type in the Content-Disposition header field. | Met | Folder files open in a tab only as pictures, PDFs, text, video or sound, with a fixed type; anything else downloads (`lib/openfile.ts`, SE-3). |
| **V3.2.2** Content intended to be displayed as text, rather than rendered as HTML, is handled using safe rendering functions (such as createTextNode or textContent) to prevent unintended execution of content such as HTML or JavaScript. | Met | Text is shown with Svelte's text binding (`textContent`); the For IT page builds no HTML from strings. |
| **V3.3.1** Cookies have the 'Secure' attribute set, and if the '__Host-' prefix is not used for the cookie name, the '__Secure-' prefix must be used for the cookie name. | Not applicable | No cookies. |
| **V3.4.1** A Strict-Transport-Security header field is included on all responses to enforce an HTTP Strict Transport Security (HSTS) policy. A maximum age of at least 1 year must be defined, and for L2 and up, the policy must apply to all subdomains as well. | Met | `Strict-Transport-Security: max-age=31536000` (this subdomain only: the rest of the domain is someone else's site), checked daily (`src/lib/headers.ts`). |
| **V3.4.2** The Cross-Origin Resource Sharing (CORS) Access-Control-Allow-Origin header field is a fixed value by the application, or if the Origin HTTP request header field value is used, it is validated against an allowlist of trusted origins. When 'Access-Control-Allow-Origin: *' needs to be used, verify that the response does not include any sensitive information. | Met | No CORS header is sent; the files are public and hold nothing sensitive. |
| **V3.5.1** Verify that, if the application does not rely on the CORS preflight mechanism to prevent disallowed cross-origin requests to use sensitive functionality, these requests are validated to ensure they originate from the application itself. This may be done by using and validating anti-forgery tokens or requiring extra HTTP header fields that are not CORS-safelisted request-header fields. This is to defend against browser-based request forgery attacks, commonly known as cross-site request forgery (CSRF). | Not applicable | No server functionality a forged request could reach. |
| **V3.5.2** Verify that, if the application relies on the CORS preflight mechanism to prevent disallowed cross-origin use of sensitive functionality, it is not possible to call the functionality with a request which does not trigger a CORS-preflight request. This may require checking the values of the 'Origin' and 'Content-Type' request header fields or using an extra header field that is not a CORS-safelisted header-field. | Not applicable | No server functionality a forged request could reach. |
| **V3.5.3** HTTP requests to sensitive functionality use appropriate HTTP methods such as POST, PUT, PATCH, or DELETE, and not methods defined by the HTTP specification as "safe" such as HEAD, OPTIONS, or GET. Alternatively, strict validation of the Sec-Fetch-* request header fields can be used to ensure that the request did not originate from an inappropriate cross-origin call, a navigation request, or a resource load (such as an image source) where this is not expected. | Not applicable | No server functionality a forged request could reach. |

## V4 API and Web Service

| Requirement | Status | How |
| --- | --- | --- |
| **V4.1.1** Every HTTP response with a message body contains a Content-Type header field that matches the actual content of the response, including the charset parameter to specify safe character encoding (e.g., UTF-8, ISO-8859-1) according to IANA Media Types, such as "text/", "/+xml" and "/xml". | Met | Every file is served with its type and `charset=utf-8` (GitHub Pages; seen 2026-11-20), and `nosniff`. |
| **V4.4.1** WebSocket over TLS (WSS) is used for all WebSocket connections. | Not applicable | No WebSockets. |

## V5 File Handling

| Requirement | Status | How |
| --- | --- | --- |
| **V5.2.1** The application will only accept files of a size which it can process without causing a loss of performance or a denial of service attack. | Partly | Files attached to comments are limited to 50 MB. Files already in the folder are opened as they are: a huge one is slow, but only on the computer of the person who opens it. |
| **V5.2.2** When the application accepts a file, either on its own or within an archive such as a zip file, it checks if the file extension matches an expected file extension and validates that the contents correspond to the type represented by the extension. This includes, but is not limited to, checking the initial 'magic bytes', performing image re-writing, and using specialized libraries for file content validation. For L1, this can focus just on files which are used to make specific business or security decisions. For L2 and up, this must apply to all files being accepted. | Met | The one file a security decision rests on, the sealed app's speech models zip, is checked file by file against pinned SHA-256s (`lib/sealedmodels.ts`). |
| **V5.3.1** Files uploaded or generated by untrusted input and stored in a public folder, are not executed as server-side program code when accessed directly with an HTTP request. | Not applicable | Nothing is uploaded to a server. |
| **V5.3.2** When the application creates file paths for file operations, instead of user-submitted filenames, it uses internally generated or trusted data, or if user-submitted filenames or file metadata must be used, strict validation and sanitization must be applied. This is to protect against path traversal, local or remote file inclusion (LFI, RFI), and server-side request forgery (SSRF) attacks. | Met | The app names its own files (dated names in `.studio/`); names people type go through the browser's File System Access API, which refuses `/`, `\\` and `..`, so no path can leave the picked folder. |

## V6 Authentication

| Requirement | Status | How |
| --- | --- | --- |
| **V6.1.1** Application documentation defines how controls such as rate limiting, anti-automation, and adaptive response, are used to defend against attacks such as credential stuffing and password brute force. The documentation must make clear how these controls are configured and prevent malicious account lockout. | Not applicable | No accounts, passwords or sign-in. |
| **V6.2.1** User set passwords are at least 8 characters in length although a minimum of 15 characters is strongly recommended. | Not applicable | No accounts, passwords or sign-in. |
| **V6.2.2** Users can change their password. | Not applicable | No accounts, passwords or sign-in. |
| **V6.2.3** Password change functionality requires the user's current and new password. | Not applicable | No accounts, passwords or sign-in. |
| **V6.2.4** Passwords submitted during account registration or password change are checked against an available set of, at least, the top 3000 passwords which match the application's password policy, e.g. minimum length. | Not applicable | No accounts, passwords or sign-in. |
| **V6.2.5** Passwords of any composition can be used, without rules limiting the type of characters permitted. There must be no requirement for a minimum number of upper or lower case characters, numbers, or special characters. | Not applicable | No accounts, passwords or sign-in. |
| **V6.2.6** Password input fields use type=password to mask the entry. Applications may allow the user to temporarily view the entire masked password, or the last typed character of the password. | Not applicable | No accounts, passwords or sign-in. |
| **V6.2.7** "paste" functionality, browser password helpers, and external password managers are permitted. | Not applicable | No accounts, passwords or sign-in. |
| **V6.2.8** The application verifies the user's password exactly as received from the user, without any modifications such as truncation or case transformation. | Not applicable | No accounts, passwords or sign-in. |
| **V6.3.1** Controls to prevent attacks such as credential stuffing and password brute force are implemented according to the application's security documentation. | Not applicable | No accounts, passwords or sign-in. |
| **V6.3.2** Default user accounts (e.g., "root", "admin", or "sa") are not present in the application or are disabled. | Met | No accounts at all, so no default ones. |
| **V6.4.1** System generated initial passwords or activation codes are securely randomly generated, follow the existing password policy, and expire after a short period of time or after they are initially used. These initial secrets must not be permitted to become the long term password. | Not applicable | No accounts, passwords or sign-in. |
| **V6.4.2** Password hints or knowledge-based authentication (so-called "secret questions") are not present. | Not applicable | No accounts, passwords or sign-in. |

## V7 Session Management

| Requirement | Status | How |
| --- | --- | --- |
| **V7.2.1** The application performs all session token verification using a trusted, backend service. | Not applicable | No sessions or session tokens. |
| **V7.2.2** The application uses either self-contained or reference tokens that are dynamically generated for session management, i.e. not using static API secrets and keys. | Not applicable | No sessions or session tokens. |
| **V7.2.3** If reference tokens are used to represent user sessions, they are unique and generated using a cryptographically secure pseudo-random number generator (CSPRNG) and possess at least 128 bits of entropy. | Not applicable | No sessions or session tokens. |
| **V7.2.4** The application generates a new session token on user authentication, including re-authentication, and terminates the current session token. | Not applicable | No sessions or session tokens. |
| **V7.4.1** When session termination is triggered (such as logout or expiration), the application disallows any further use of the session. For reference tokens or stateful sessions, this means invalidating the session data at the application backend. Applications using self-contained tokens will need a solution such as maintaining a list of terminated tokens, disallowing tokens produced before a per-user date and time or rotating a per-user signing key. | Not applicable | No sessions or session tokens. |
| **V7.4.2** The application terminates all active sessions when a user account is disabled or deleted (such as an employee leaving the company). | Not applicable | No sessions or session tokens. |

## V8 Authorization

| Requirement | Status | How |
| --- | --- | --- |
| **V8.1.1** Authorization documentation defines rules for restricting function-level and data-specific access based on consumer permissions and resource attributes. | Not applicable | No accounts or roles: the folder's own Windows permissions decide who can read and change it. |
| **V8.2.1** The application ensures that function-level access is restricted to consumers with explicit permissions. | Not applicable | No accounts or roles: the folder's own Windows permissions decide who can read and change it. |
| **V8.2.2** The application ensures that data-specific access is restricted to consumers with explicit permissions to specific data items to mitigate insecure direct object reference (IDOR) and broken object level authorization (BOLA). | Not applicable | No accounts or roles: the folder's own Windows permissions decide who can read and change it. |
| **V8.3.1** The application enforces authorization rules at a trusted service layer and doesn't rely on controls that an untrusted consumer could manipulate, such as client-side JavaScript. | Not applicable | No accounts or roles: the folder's own Windows permissions decide who can read and change it. |

## V9 Self-contained Tokens

| Requirement | Status | How |
| --- | --- | --- |
| **V9.1.1** Self-contained tokens are validated using their digital signature or MAC to protect against tampering before accepting the token's contents. | Not applicable | No tokens. |
| **V9.1.2** Only algorithms on an allowlist can be used to create and verify self-contained tokens, for a given context. The allowlist must include the permitted algorithms, ideally only either symmetric or asymmetric algorithms, and must not include the 'None' algorithm. If both symmetric and asymmetric must be supported, additional controls will be needed to prevent key confusion. | Not applicable | No tokens. |
| **V9.1.3** Key material that is used to validate self-contained tokens is from trusted pre-configured sources for the token issuer, preventing attackers from specifying untrusted sources and keys. For JWTs and other JWS structures, headers such as 'jku', 'x5u', and 'jwk' must be validated against an allowlist of trusted sources. | Not applicable | No tokens. |
| **V9.2.1** Verify that, if a validity time span is present in the token data, the token and its content are accepted only if the verification time is within this validity time span. For example, for JWTs, the claims 'nbf' and 'exp' must be verified. | Not applicable | No tokens. |

## V10 OAuth and OIDC

| Requirement | Status | How |
| --- | --- | --- |
| **V10.4.1** The authorization server validates redirect URIs based on a client-specific allowlist of pre-registered URIs using exact string comparison. | Not applicable | No OAuth or OpenID Connect. |
| **V10.4.2** Verify that, if the authorization server returns the authorization code in the authorization response, it can be used only once for a token request. For the second valid request with an authorization code that has already been used to issue an access token, the authorization server must reject a token request and revoke any issued tokens related to the authorization code. | Not applicable | No OAuth or OpenID Connect. |
| **V10.4.3** The authorization code is short-lived. The maximum lifetime can be up to 10 minutes for L1 and L2 applications and up to 1 minute for L3 applications. | Not applicable | No OAuth or OpenID Connect. |
| **V10.4.4** For a given client, the authorization server only allows the usage of grants that this client needs to use. Note that the grants 'token' (Implicit flow) and 'password' (Resource Owner Password Credentials flow) must no longer be used. | Not applicable | No OAuth or OpenID Connect. |
| **V10.4.5** The authorization server mitigates refresh token replay attacks for public clients, preferably using sender-constrained refresh tokens, i.e., Demonstrating Proof of Possession (DPoP) or Certificate-Bound Access Tokens using mutual TLS (mTLS). For L1 and L2 applications, refresh token rotation may be used. If refresh token rotation is used, the authorization server must invalidate the refresh token after usage, and revoke all refresh tokens for that authorization if an already used and invalidated refresh token is provided. | Not applicable | No OAuth or OpenID Connect. |

## V11 Cryptography

| Requirement | Status | How |
| --- | --- | --- |
| **V11.3.1** Insecure block modes (e.g., ECB) and weak padding schemes (e.g., PKCS#1 v1.5) are not used. | Not applicable | Nothing is encrypted by the app. |
| **V11.3.2** Only approved ciphers and modes such as AES with GCM are used. | Not applicable | Nothing is encrypted by the app. |
| **V11.4.1** Only approved hash functions are used for general cryptographic use cases, including digital signatures, HMAC, KDF, and random bit generation. Disallowed hash functions, such as MD5, must not be used for any cryptographic purpose. | Met | Only SHA-256 (and SHA-384 in integrity hashes); no MD5 or SHA-1. |

## V12 Secure Communication

| Requirement | Status | How |
| --- | --- | --- |
| **V12.1.1** Only the latest recommended versions of the TLS protocol are enabled, such as TLS 1.2 and TLS 1.3. The latest version of the TLS protocol must be the preferred option. | Met | Cloudflare's minimum TLS version is 1.2 and TLS 1.3 is on (zone settings, seen 2026-11-20). |
| **V12.2.1** TLS is used for all connectivity between a client and external facing, HTTP-based services, and does not fall back to insecure or unencrypted communications. | Met | Always Use HTTPS and HSTS; the page connects only to its own HTTPS address (`connect-src 'self'`). The sealed file connects to nothing. |
| **V12.2.2** External facing services use publicly trusted TLS certificates. | Met | Publicly trusted certificates (Cloudflare at the edge, GitHub Pages behind it). |

## V13 Configuration

| Requirement | Status | How |
| --- | --- | --- |
| **V13.4.1** The application is deployed either without any source control metadata, including the .git or .svn folders, or in a way that these folders are inaccessible both externally and to the application itself. | Met | Only the built `dist/` folder is published; `/.git/config` is a 404 (seen 2026-11-20). |

## V14 Data Protection

| Requirement | Status | How |
| --- | --- | --- |
| **V14.2.1** Sensitive data is only sent to the server in the HTTP message body or header fields, and that the URL and query string do not contain sensitive information, such as an API key or session token. | Met | Nothing is sent to a server. The address holds the script's name after `#`, which browsers never send. |
| **V14.3.1** Authenticated data is cleared from client storage, such as the browser DOM, after the client or session is terminated. The 'Clear-Site-Data' HTTP response header field may be able to help with this but the client-side should also be able to clear up if the server connection is not available when the session is terminated. | Not applicable | No signed-in data. What the browser keeps is listed on For IT, and clearing the site's data removes it. |

## V15 Secure Coding and Architecture

| Requirement | Status | How |
| --- | --- | --- |
| **V15.1.1** Application documentation defines risk based remediation time frames for 3rd party component versions with vulnerabilities and for updating libraries in general, to minimize the risk from these components. | Met | SECURITY.md: shipped packages with a known vulnerability block every change, fixes aimed live within 7 days, routine updates monthly. |
| **V15.2.1** The application only contains components which have not breached the documented update and remediation time frames. | Met | `npm audit --omit=dev` fails every pull request while a shipped package has an advisory; Dependabot opens fixes (SE-2). |
| **V15.3.1** The application only returns the required subset of fields from a data object. For example, it should not return an entire data object, as some individual fields should not be accessible to users. | Not applicable | No server returns data objects. |
