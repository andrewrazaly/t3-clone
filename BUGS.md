# Known Bugs

## 🐛 Active Bugs

### 1. Gemini API Model Not Found Error
**Status:** Open
**Priority:** Medium
**Date Reported:** 2025-12-20

**Description:**
Gemini models (gemini-1.5-flash, gemini-1.5-pro) return 404 errors when attempting to generate content.

**Error Message:**
```
[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent: [404 Not Found] models/gemini-1.5-flash is not found for API version v1beta, or is not supported for generateContent.
```

**Temporary Solution:**
Gemini models have been removed from the available model list until the API issue is resolved.

**Potential Fixes to Investigate:**
- Update Google Generative AI SDK to latest version
- Check if model names have changed in Google's API
- Verify API key has access to these models
- Try alternative API version (v1 instead of v1beta)

**Related Files:**
- `src/server/api/routers/chat.ts` (lines 193-204)
- `src/components/model-selector.tsx`

---

## ✅ Fixed Bugs

(None yet)
