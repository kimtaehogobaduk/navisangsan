---
name: Dead files removed
description: Files that were deleted during cleanup because they were never imported or used.
---

# Dead files removed

These 4 files were deleted. Do not recreate without good reason:

1. `src/lib/api/example.functions.ts` — boilerplate `getGreeting` server function, never used in the app
2. `src/lib/error-page.ts` — `renderErrorPage()` HTML template, never imported anywhere
3. `src/lib/ai-gateway.server.ts` — `createLovableAiGatewayProvider()`, Lovable-specific, never imported
4. `src/lib/config.server.ts` — `getServerConfig()`, only used by the deleted example.functions.ts

**Why:** They added noise and could confuse future agents into thinking they were part of active features.
