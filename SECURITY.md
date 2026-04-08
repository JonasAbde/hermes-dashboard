# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| < 1.1   | :x:               |

## Reporting a Vulnerability

If you discover a security vulnerability within Hermes Dashboard, please report it responsibly.

**DO NOT create a public GitHub issue for security vulnerabilities.**

Instead, please email the maintainer directly or contact them via the security channels listed below.

When reporting, please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

## Security Best Practices (Deploy)

- Never commit `.env` files — use `.env.example` as template
- Change `AUTH_SECRET` from the default empty value in production
- Use HTTPS in production — the API server does not enforce TLS
- JWT tokens are stored in localStorage — acceptable for local development
- Run containers as non-root (USER directive is set in Dockerfile)
- Resource limits are enforced in docker-compose.yml

## Dependencies

Run `npm audit` regularly to check for known vulnerabilities:
```bash
npm audit
```

Run `pip-audit` for Python dependencies:
```bash
pip-audit
```

Dependencies are monitored via Dependabot (weekly schedule).
