# LLR Mobile Terminal — PWA Implementation Spec

This document is the implementation spec for Claude Code. Build this PWA inside the LLR repository.

## 1. Why PWA

Google will block sideloaded APKs from unregistered developers starting September 2026. A PWA runs in the browser and bypasses this restriction entirely. No APK, no Play Store, no Termux dependency.

## 2. Scope & Role

This PWA is a **memo-only input terminal**. It does NOT handle AI conversations.

```
Input Route         → Tool              → Destination
────────────────────────────────────────────────────────
Memos, notes, OCR   → PWA               → raw/ (via GitHub API)
AI dialogue          → Remote Control    → raw/ (Claude Code writes locally)
Wiki editing         → Claude Code       → Wiki/ (local)
Wiki browsing        → PWA (read-only)   → Wiki/ (via GitHub API)
```

## 3. System Context

```
[Pixel / iPad Browser]
       │
       │  GitHub REST API (Personal Access Token)
       ▼
 🐙 GitHub Private Repo: llr
       ├── raw/          ← PWA writes here (new files only)
       ├── Wiki/         ← PWA reads here (browsing only)
       └── pwa/          ← PWA source lives here (hosted via GitHub Pages)
```

The PWA is a thin client. It does NOT run git commands. All operations go through the GitHub Contents API.

## 4. Hosting

Host via GitHub Pages from the `pwa/` directory on the `main` branch.

Repository Settings → Pages → Source: Deploy from a branch → `main` / `pwa/`.

Resulting URL: `https://<username>.github.io/llr/`

## 5. Tech Stack

- Vanilla HTML + CSS + JavaScript (single `index.html` + `sw.js` + `manifest.json`)
- No build step, no npm, no framework
- GitHub REST API v3 via `fetch()`
- Service Worker for offline caching and PWA install prompt

## 6. Authentication

On first launch, prompt for:
- GitHub username
- Personal Access Token (scope: `repo`)

Store both in `localStorage`. Never transmit except to `api.github.com`. Provide a "Logout" button that clears `localStorage`.

Display a warning that the token is stored locally on this device.

## 7. Core Features

### 7.1 Quick Input (Primary Screen)

The main screen is a single text input form:

```
┌─────────────────────────────┐
│  LLR Quick Input            │
├─────────────────────────────┤
│  Category:  [LifeLog ▼]    │
│                             │
│  ┌───────────────────────┐  │
│  │                       │  │
│  │  (large textarea)     │  │
│  │                       │  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│  [下書き保存]     [送信]    │
│                             │
│  📝 下書き一覧（3件）       │
│  ├ 6/25 買い物メモ          │
│  ├ 6/24 読書ノート途中      │
│  └ 6/23 考えたこと          │
└─────────────────────────────┘
```

**Category dropdown options:**
- LifeLog (daily notes, reflection)
- House (storage, devices)
- Engineering (code, architecture)
- English (vocabulary, study)
- Management
- Politics_and_Law
- Literature
- Philosophy_and_Ethics
- Geography_History_and_Society
- Human_Sciences
- Uncategorized

**On submit:**

1. Generate filename: `raw/{category}_{YYYY-MM-DD}_{HHmmss}.md`
2. PUT to GitHub Contents API:
   ```
   PUT /repos/{owner}/llr/contents/raw/{filename}
   Headers:
     Authorization: Bearer {token}
     Content-Type: application/json
   Body:
     {
       "message": "raw: add {filename}",
       "content": "<base64 encoded markdown>"
     }
   ```
3. Show success toast with link to the created file.
4. Clear the textarea.
5. Delete the corresponding draft (if loaded from drafts).

**Markdown template for the created file:**

```markdown
---
category: {category}
created: {ISO 8601 timestamp}
source: pwa
---

{user input text}
```

### 7.2 Drafts (localStorage)

Drafts are saved locally on the device and never uploaded to GitHub.

**Data structure (localStorage key: `llr_drafts`):**
```json
[
  {
    "id": "uuid",
    "category": "LifeLog",
    "text": "partially written note...",
    "title": "(first 20 chars of text or 'Untitled')",
    "updatedAt": "ISO 8601"
  }
]
```

**Behaviors:**
- **Save draft button:** Saves current category + textarea content to localStorage. If editing an existing draft, update it in place (match by `id`).
- **Draft list:** Displayed below the input area, sorted by `updatedAt` descending.
- **Tap a draft:** Load it into the textarea and category selector for editing/submission.
- **Swipe left on a draft (or delete icon):** Delete the draft with confirmation.
- **On successful submit:** Auto-delete the draft that was loaded.
- **Limit:** Maximum 20 drafts. When exceeding, warn before overwriting the oldest.
- **Auto-save:** Every 30 seconds, if textarea is non-empty and differs from last save, auto-save as draft silently. Show a subtle "auto-saved" indicator.

### 7.3 Wiki Browser (Read-Only)

A secondary tab/view to browse `Wiki/` contents:

1. `GET /repos/{owner}/llr/contents/Wiki/` → list top-level directories
2. Tap a directory → list files
3. Tap a file → render Markdown content (use a lightweight Markdown renderer, e.g., inline `marked.min.js` from CDN or bundled)

Read-only. No editing from PWA. Editing is Claude Code's job.

### 7.4 Recent Submissions

A third tab showing the last 10 files the user submitted to `raw/`, fetched via:

```
GET /repos/{owner}/llr/commits?path=raw/&per_page=10
```

Each entry shows: filename, timestamp, and a "View" button.

## 8. Navigation

Bottom tab bar with 3 tabs:

```
┌──────────┬──────────┬──────────┐
│  ✏️ Input │  📖 Wiki │  🕐 Recent│
└──────────┴──────────┴──────────┘
```

## 9. PWA Requirements

### manifest.json

```json
{
  "name": "LLR Terminal",
  "short_name": "LLR",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#16213e",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service Worker (sw.js)

Cache `index.html`, CSS, and JS for offline form access. When offline, drafts can still be saved. Submissions are blocked with a clear "offline — save as draft instead" message.

### Install Prompt

Show an "Add to Home Screen" banner on first visit if the browser supports it.

## 10. Design Direction

- Dark theme (comfortable for nighttime journaling)
- Minimal chrome, maximum textarea space
- Mobile-first: optimized for 360-412px viewport width
- Large tap targets (min 48px)
- System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`)
- Success/error states via toast notifications, not alerts

## 11. File Structure

```
pwa/
├── index.html        ← Single-page app (HTML + inline CSS + JS)
├── sw.js             ← Service Worker
├── manifest.json     ← PWA manifest
├── icon-192.png      ← App icon
└── icon-512.png      ← App icon
```

## 12. Security Considerations

- Token stored in `localStorage` — acceptable risk for a personal tool on a personal device
- All API calls over HTTPS
- Token has `repo` scope only (minimum required)
- No server-side component; no token ever leaves the device except to `api.github.com`
- CSP header via meta tag: `default-src 'self' https://api.github.com; script-src 'self' 'unsafe-inline'`

## 13. API Reference (GitHub Contents API)

### Create a file
```
PUT /repos/{owner}/{repo}/contents/{path}
{
  "message": "commit message",
  "content": "base64 encoded content"
}
```

### Get file content
```
GET /repos/{owner}/{repo}/contents/{path}
Response: { content: "base64...", sha: "..." }
```

### List directory
```
GET /repos/{owner}/{repo}/contents/{path}
Response: [ { name, path, type: "file"|"dir", sha } ]
```

### List commits (for recent submissions)
```
GET /repos/{owner}/{repo}/commits?path=raw/&per_page=10
```

## 14. Build Instructions for Claude Code

```bash
cd ~/llr
mkdir -p pwa
# Create index.html, sw.js, manifest.json, generate icons
# ... (implement based on this spec)

# Test locally
cd pwa
python3 -m http.server 8080
# Open http://localhost:8080 in browser

# Deploy
git add pwa/
git commit -m "feat: add LLR PWA mobile terminal"
git push

# Enable GitHub Pages in repo settings:
# Settings → Pages → Source: main / pwa/
```

## 15. Future Enhancements (v2)

Decided priority (2026-06-26):

1. **Voice input** — Web Speech API (`webkitSpeechRecognition`) → text → insert into textarea. iOS Safari support needs verification on a real device.
2. **Image attachment** — resize/compress via Canvas, base64-encode, commit as a separate file in `raw/images/`, reference it from the memo body. Keep encoded size well under the Contents API's practical ~1MB limit.
3. **Wiki search** — switch from per-directory Contents API calls to the Git Trees API (`GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`) to list all Wiki files in one call, cache locally, then do client-side substring search.

Deferred:
- Offline queue: save submissions in `localStorage` (reusing the existing drafts pattern), auto-retry on the `online` event. Not started — lower priority than the above three.
- Diff viewer (pending `git add` changes from MacBook): not feasible as a PWA-only feature — the PWA only talks to `api.github.com` (see [§3](#3-system-context)), so it cannot see local, uncommitted state on a different machine. Would require the MacBook side to push its diff somewhere GitHub-API-readable first. Out of scope until that exists.