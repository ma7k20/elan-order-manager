---
name: Android build storage quota
description: How to interpret JVM SIGBUS crashes during Android builds in this Replit environment.
---

Treat a Gradle JVM `SIGBUS` together with temp-file error `-122` as a storage-quota symptom, even when `df` reports ample filesystem capacity. Remove only regenerable Android SDK and Gradle caches before retrying.

**Why:** Both GraalVM and standard OpenJDK crashed in JVM class parsing while several gigabytes of SDK and Gradle caches were present. Post-merge setup then failed to create `/tmp` files with error `-122`; clearing regenerable caches immediately restored setup and workflow reconciliation.

**How to apply:** Check cache sizes and quota-related temp-file errors before changing app code or swapping Java runtimes. Preserve source files, signing keys, and build outputs; clean only downloadable caches and temporary SDK installations.