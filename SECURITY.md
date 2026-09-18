# Security Policy & Vulnerability Disclosure

## Overview

Security is a primary pillar of **Stratum**. As a Backend-as-a-Service powering database access, realtime communication, and serverless edge functions, we take security, cryptographic isolation, and data protection with utmost seriousness.

## Supported Versions

Only the latest release branch of Stratum receives active security updates and vulnerability patches.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Stratum, please report it directly and privately to the project creator:

- **Lead Security Researcher & Author**: Jojin John
- **Email**: [security@stratum.sh](mailto:security@stratum.sh) / [jojinjohn1709@gmail.com](mailto:jojinjohn1709@gmail.com)
- **LinkedIn**: [linkedin.com/in/jojin-john](https://www.linkedin.com/in/jojin-john/)
- **GitHub**: [@jojin1709](https://github.com/jojin1709)
- **Private Advisory**: You can also use GitHub's [Private Vulnerability Reporting](https://github.com/jojin1709/Stratum/security/advisories/new) on the repository.

### What to Include

Please provide the following details to help us triage and resolve the issue quickly:
1. Description of the vulnerability and its potential security impact.
2. Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
3. Impacted components (e.g., `@stratum/api`, `@stratum/database`, `@stratum/storage`, etc.).
4. Any proposed remediations or patches.

### Response Timeline

- **Initial Acknowledgment**: Within 24 hours.
- **Triage & Severity Assessment**: Within 48 hours.
- **Fix & Advisory Release**: Coordinated with the reporter before public disclosure.

## Security Architecture & Best Practices

- **Row-Level Security (RLS)**: Public client requests using `strat_public_...` keys are strictly bound to PostgreSQL RLS policies.
- **Secret Keys**: Service role keys (`strat_secret_...`) have full administrative access and must never be exposed to frontend applications or browser environments.
- **Path Sanitization**: All file paths and storage object keys are sanitized to prevent directory traversal (`../`).
- **HMAC Signatures**: All outgoing database webhooks include cryptographic SHA-256 signatures in the `X-Stratum-Signature` header.
- **Rate Limiting**: Public endpoints enforce token-bucket rate limiting to mitigate denial-of-service and brute force attempts.
