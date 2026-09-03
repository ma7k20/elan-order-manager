---
name: GitHub Actions artifact delivery
description: Limitation encountered when retrieving completed GitHub Actions artifacts through the GitHub connector.
---

The GitHub connector can reliably inspect workflow runs, jobs, conclusions, and artifact metadata, but downloading an Actions artifact archive may return HTTP 403 even after a successful authenticated metadata request.

**Why:** The artifact endpoint redirects to archive storage, and that redirect is not always retrievable through the connector proxy. A local Android rebuild may also be unavailable when the workspace lacks Android SDK configuration.

**How to apply:** Verify that the workflow concluded successfully and that the named artifact exists, then provide the authenticated GitHub Actions run page as the download path instead of repeatedly retrying the archive endpoint.