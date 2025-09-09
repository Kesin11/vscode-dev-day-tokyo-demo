# ReadingListAutoSummary AI Coding Guide

## Project Overview
This is a Chrome extension (Manifest V3) that automatically manages Chrome's Reading List by marking old entries as read and generating AI-powered summaries before archiving. The extension uses `chrome.readingList` API for Reading List integration and posts summaries to Slack.

## Core Architecture

### Entry Points & Build System
- **Background Script**: `src/backend/background.ts` - Main service worker (currently empty, needs implementation)
- **Options Page**: `src/frontend/options/options.html` - Settings UI (currently minimal HTML shell)
- **Build System**: Custom Vite config with specialized Chrome extension bundling

The build process uses a unique dual-bundling approach:
1. Main Vite build for frontend components
2. Secondary `generateStandaloneBundle()` for background script (ES modules format)

### Key Build Commands
```bash
pnpm dev              # Development build
pnpm build            # Production build  
pnpm build:release    # Build + zip for Chrome Web Store
pnpm check:ai         # Full validation pipeline (type-check + lint + test + build)
```

## Critical Implementation Details

### Chrome Extension Specifics
- **Permissions**: `["storage", "readingList"]` in `manifest.json`
- **Storage**: Uses `chrome.storage.local` for settings persistence
- **Background**: Service worker runs periodically to process Reading List entries
- **No dependencies**: The project has zero runtime dependencies (only devDependencies)

### Data Flow Pattern
1. Background script queries `chrome.readingList` API
2. Check entry ages against user-configured thresholds (default: 30 days → read, 60 days → delete)
3. On marking as read: Extract content with Firecrawl → Summarize with OpenAI → Post to Slack
4. Retry logic: Exponential backoff (3 attempts max) for external API failures

### Slack Integration Format
```
{title}
{url}

{model_name}による要約

{本文section1}

{本文section2}

{本文section3}
```

## Development Patterns

### Testing Structure
- **Frontend tests**: `tests/frontend/**/*.test.ts` (jsdom environment)  
- **Backend tests**: `tests/backend/**/*.test.ts` (node environment)
- **No watch mode**: Vitest watch disabled (`watch: false`) for AI compatibility

### Code Quality Tools
- **Biome**: Comprehensive linting/formatting with strict rules
  - No explicit `any` types
  - Unused imports/variables as errors
  - Double quotes for strings
- **TypeScript**: Strict mode with `noEmit` for type checking

### AI-Specific Considerations
- Use `pnpm check:ai` before commits (validates everything)
- All external API integrations need retry logic with exponential backoff
- Settings stored in `chrome.storage.local` with these keys:
  - Days until read (default: 30)
  - Days until delete (default: 60)  
  - OpenAI API endpoint/key/model
  - Slack webhook URL

## File Patterns
- Backend code: `src/backend/` (Service worker)
- Frontend code: `src/frontend/` (Options page)
- Tests mirror source structure: `tests/{backend|frontend}/`
- Build output: `dist/` with specialized structure for Chrome extension

## External Dependencies (Not Yet Installed)
Based on README.md, the following will be needed:
- Firecrawl JS SDK for content extraction
- OpenAI SDK for summarization
- Both support retry mechanisms for reliability

## Common Gotchas
- Vite builds background script separately using custom `generateStandaloneBundle()`
- Chrome extension requires specific output structure - don't modify the build config lightly
- All Chrome APIs are available in background script context, not in options page
- Extension runs with limited permissions - stick to declared manifest permissions
