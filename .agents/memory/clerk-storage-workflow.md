---
name: Clerk and storage workflow setup
description: Durable setup constraints for Clerk-authenticated artifact apps using App Storage.
---

Managed artifact workflows inject PORT and BASE_PATH; one-off local builds must provide both explicitly. Clerk development keys are expected in preview, while production still requires the app's publishable/secret key configuration.

**Why:** The workspace's Vite and API entrypoints intentionally fail fast when these workflow variables are absent, and Clerk's preview warning is informational rather than an application failure.

**How to apply:** Restart the exact managed artifact workflows after server or environment changes, and use same-origin cookies for web API calls instead of browser bearer-token plumbing.