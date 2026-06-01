# Security Policy

## Reporting A Vulnerability

Please report vulnerabilities privately to `dineshdas1016@gmail.com`. Include reproduction steps,
affected versions, and impact where possible. Do not publish sensitive details before a fix is
available.

## Supported Versions

Security fixes are applied to the latest maintained release in this repository.

## Secrets And OAuth

- Do not commit secrets, OAuth client secrets, access tokens, or refresh tokens.
- The Google OAuth client ID is public configuration and must be supplied at build time.
- Production packages must not contain `__REPLACE_WITH_CLIENT_ID__`.
- Keep OAuth scopes limited to `drive.appdata` and `userinfo.email`.

## Secure Handling Expectations

- Keep extension scripts local. Do not add remotely hosted code.
- Keep browser history optional and off by default.
- Validate imported URLs before opening them.
- Treat exported files, encoded share links, and AI prompts as potentially sensitive user data.
- Run `npm run verify` before release.
