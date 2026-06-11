---
name: YouTube utilities
description: Shared YouTube URL parsing functions — location and why they were consolidated.
---

# YouTube utilities

`src/lib/utils/youtube.ts` exports:
- `extractYoutubeId(url)` — extracts the 11-char video ID from any YouTube URL format
- `extractYoutubeUrls(text)` — finds all YouTube URLs in a block of text

**Why:** Both `src/routes/api/public/process-training.ts` and `src/lib/training-jobs.functions.ts` had identical copy-pasted `extractYoutubeId` functions. Consolidated into a shared util.

**How to apply:** Any new file that needs to parse YouTube URLs should import from `@/lib/utils/youtube`.
