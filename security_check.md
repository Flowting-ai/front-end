# 🚨 Security Changes - Team Alert

## ⚠️ CRITICAL - Action Required Immediately

### 1. API Keys Exposed in Git History
**Status**: 🔴 URGENT
- All API keys from `.env` file were committed to git
- **Action**: Rotate these keys NOW:
  - OpenAI API key
  - Anthropic API key
  - Hugging Face API key
  - Groq API key
  - OpenRouter API key
  - Jina API key
  - Qdrant API key
  - Django secret key
  - Email password

### 2. Environment Setup Required
**Status**: 🟡 REQUIRED
```bash
# Copy the template
cp .env.example .env

# Add your actual API keys to .env (never commit this file)
# The .env file is now in .gitignore and will never be committed
```

### 3. CSRF Token Storage Changed
**Status**: 🟢 AUTO-MIGRATED
- CSRF tokens moved from `localStorage` → `sessionStorage`
- More secure (cleared when tab closes)
- Auto-migration handles existing users
- No manual action needed

---

## 📦 New Utilities Available

### Security (`src/lib/security.ts`)
```typescript
import { sanitizeHTML, sanitizeURL, isAllowedFileType } from '@/lib/security';

// Use before rendering user content
const safe = sanitizeHTML(userInput);

// Validate file uploads
if (!isAllowedFileType(fileName, ['pdf', 'png', 'jpg'])) {
  throw new Error('Invalid file type');
}
```

### Logging (`src/lib/logger.ts`)
```typescript
import { logger } from '@/lib/logger';

// Replace ALL console.log with:
logger.log('message');    // Hidden in production
logger.error('error');    // Always logged (sanitized)
logger.warn('warning');   // Hidden in production

// Auto-sanitizes passwords, tokens, API keys
```

### API Client (`src/lib/api-client.ts`)
```typescript
import { secureFetch, securePost } from '@/lib/api-client';

// Built-in rate limiting, retries, timeouts
const data = await secureFetch('/api/endpoint');
const result = await securePost('/api/action', payload, csrfToken);
```

### Rate Limiting (`src/lib/throttle.ts`)
```typescript
import { debounce, RateLimiter } from '@/lib/throttle';

// Debounce search inputs
const debouncedSearch = debounce(handleSearch, 300);

// Rate limit actions
const limiter = new RateLimiter(10, 60000); // 10 per minute
if (!limiter.canProceed()) {
  return toast.error('Too many requests');
}
```

### Error Boundaries (`src/components/error-boundary.tsx`)
```typescript
import { ErrorBoundary } from '@/components/error-boundary';

// Wrap your app to prevent crashes
<ErrorBoundary>
  <YourApp />
</ErrorBoundary>
```

### Memory Cleanup (`src/hooks/use-cleanup.ts`)
```typescript
import { useSafeAsync, useAbortController } from '@/hooks/use-cleanup';

// Prevent memory leaks
const { safeAsync } = useSafeAsync();
const { createController } = useAbortController();
```

---

## 🔧 Simple Changes to Make

### 1. Replace console.log Everywhere
```typescript
// ❌ OLD
console.log('data', data);
console.error('error', error);

// ✅ NEW
import { logger } from '@/lib/logger';
logger.log('data', data);
logger.error('error', error);
```

### 2. Add Error Boundary to Layout
```typescript
// src/app/layout.tsx
import { ErrorBoundary } from '@/components/error-boundary';

export default function RootLayout({ children }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
```

### 3. Sanitize User Inputs
```typescript
import { sanitizeHTML } from '@/lib/security';

function handleSubmit(data) {
  const safe = sanitizeHTML(data.message); // Before saving/rendering
  // ... use safe
}
```

### 4. Debounce Search Inputs
```typescript
import { debounce } from '@/lib/throttle';

const debouncedSearch = debounce((query) => {
  // Search logic
}, 300); // 300ms delay
```

---

## 🛡️ What Changed in Existing Files

### `.gitignore`
- Enhanced to prevent `.env` file from ever being committed
- Added warnings about secrets

### `next.config.ts`
- Added Content Security Policy headers
- Added X-Frame-Options, HSTS, X-Content-Type-Options
- Prevents clickjacking and XSS attacks

### `src/context/auth-context.tsx`
- CSRF tokens now in `sessionStorage` (more secure)
- Auto-migration from `localStorage`
- Enhanced cleanup on logout

### `src/components/layout/right-sidebar.tsx`
- Removed insecure `document.write()`
- Now uses secure Blob approach for PDF export

---

## ✅ Quick Checklist

### Before Pushing Code
- [ ] No `console.log` in your changes (use `logger`)
- [ ] User inputs sanitized with `sanitizeHTML()`
- [ ] File uploads validated with `isAllowedFileType()`
- [ ] API calls use `secureFetch()` or have rate limiting
- [ ] No hardcoded API keys or secrets

### Before Deploying
- [ ] All API keys rotated (due to git exposure)
- [ ] `.env` file configured on server
- [ ] Error tracking service configured (optional)
- [ ] Test rate limiting under load
- [ ] Test error boundaries

### Code Review Focus
- [ ] No sensitive data in logs
- [ ] No sensitive data in error messages
- [ ] Input validation present
- [ ] Rate limiting on expensive operations
- [ ] Memory cleanup in components with timers/listeners

---

## 📞 Questions?

See full documentation in `SECURITY.md`

**Key Points to Remember**:
1. 🔴 **NEVER commit `.env` file** - it's now in `.gitignore`
2. 🔴 **Rotate all API keys** - they were exposed in git
3. 🟡 Use `logger` instead of `console.log`
4. 🟡 Sanitize user inputs before rendering
5. 🟢 Error boundaries prevent app crashes
6. 🟢 Rate limiting prevents abuse

---

*Last Updated: February 2, 2026*
