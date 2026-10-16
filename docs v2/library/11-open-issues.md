# 11 Library: open issues from the 2026-10-15 test run

One issue per failed or partial case in [10-test-cases-and-results.md](10-test-cases-and-results.md): 15 FAIL and 11 PARTIAL, 26 issues in all. Status of every issue: **Open** (logged 2026-10-16). Nothing has been fixed yet.

How to read an issue: **Case** is the test case ID in doc 10 (steps and evidence are in its row). **Type** says who changes what: FE = front-end, BE = backend (reported only, this repo does not change the backend), Config = environment/build setting, Product = needs a decision first. Screenshots from the run are not stored in the repo.

## Summary

| ID | Sev | Type | Title | Case |
|---|---|---|---|---|
| LIB-001 | High | Config | CSP blocks the file storage origin (root cause of LIB-002 to LIB-009) | UP-07 |
| LIB-002 | High | Config / FE | Browser upload from the composer never reaches storage | UP-08 |
| LIB-003 | High | Config / FE | Normal chat attachment is lost on Send ("Upload paused") | REG-22 |
| LIB-004 | High | Config | PDF preview does not load | FP-03 |
| LIB-005 | High | Config | Word (.docx) preview does not load | FP-08 |
| LIB-006 | High | Config | Audio cannot load or play | FP-07 |
| LIB-007 | High | Config | "Ask about this" cannot attach the file | FP-18 |
| LIB-008 | High | Config | File page "Ask about this file" box starts a chat without the file | FP-19 |
| LIB-009 | Medium | Config | Citation links cannot render PDF pages or seek audio | FP-20 |
| LIB-010 | High | BE | Identical content is stored once; duplicates are not separate files | UP-01 |
| LIB-011 | Medium | BE | Corrupt PDF is accepted as Ready | UP-04 |
| LIB-012 | Medium | BE / FE | Shared tab appears for the owner of a shared file | SH-03 |
| LIB-013 | Medium | FE | Searching while offline leaves a blank white page | ST-06 |
| LIB-014 | Low | FE | Focus is lost after the Share dialog closes with Escape | A11-02 |
| LIB-015 | Medium | FE (app shell) | No phone layout: Library gets about 45 px at 375 px wide | A11-04 |
| LIB-016 | Low | FE | Sidebar Library link has no `aria-current` | NAV-01 |
| LIB-017 | Low | FE | Created shows minutes only, so duplicates look identical | ALL-05 |
| LIB-018 | Low | FE | Sort menu ticks are visual only | SORT-04 |
| LIB-019 | Low | BE | Search matches words, not the phrase | Q-03 |
| LIB-020 | Low | Product | Storage "used" counts files in Trash | TR-11 |
| LIB-021 | Low | FE | No visible focus ring on file links | A11-01 |
| LIB-022 | Medium | FE | Chat composer has no Uploading / Processing / Ready chip; Send is not held | CH-02 |
| LIB-023 | Low | FE | Hidden Settings > Preferences shows "Something went wrong" instead of not found | REG-06 |
| LIB-024 | Low | FE | Same for Settings > Security | REG-07 |
| LIB-025 | Low | FE | Same for Settings > Notifications | REG-08 |
| LIB-026 | Low | FE | Same for Settings > Files | REG-19 |

## High severity

### LIB-001 CSP blocks the file storage origin
- **Case / Type:** UP-07 / Config
- **Steps:** Open any page and read the `content-security-policy` response header.
- **Expected:** `connect-src` and `media-src` include the storage origin `https://souvenirai-storage.s3.amazonaws.com`.
- **Actual:** `connect-src` lists only `'self'`, `blob:`, `devapi.getsouvenir.com` (https and wss), Auth0, Mixpanel, Formspree, the map tiles host and localhost. `media-src` is `'self' blob:`. `NEXT_PUBLIC_LIBRARY_STORAGE_ORIGIN` is not set in `.env.local` or `.env.development.local`, and `next.config.ts` only adds the origin when it is set.
- **Impact:** every browser call to the storage bucket is blocked. This is the root cause of LIB-002 to LIB-009.
- **Suggested fix:** set the variable to the storage origin in every environment (dev, staging, production build), restart or rebuild, then re-run LIB-002 to LIB-009. After the CSP lets requests out, also confirm the bucket CORS allows PUT, GET, HEAD and exposes ETag (not testable until the CSP is fixed).

### LIB-002 Browser upload from the composer never reaches storage
- **Case / Type:** UP-08 / Config, with a wording issue in FE
- **Steps:** New chat, attach a small .txt through the file input, type a message, Send (chat stream mocked).
- **Expected:** POST `/library/uploads`, PUT to storage succeeds, the file lands in All files with Source Uploaded.
- **Actual:** the PUT is blocked by the CSP four times (initial try plus retries). The chip reads "<name>: Upload paused. It will continue when you are back online." Library file count stays the same.
- **Suggested fix:** LIB-001 fixes the cause. Separately, the message is wrong when the cause is a blocked request rather than being offline; show a real failure after the retries are used up.

### LIB-003 Normal chat attachment is lost on Send
- **Case / Type:** REG-22 / Config (regression of existing chat behaviour), FE
- **Steps:** Same as LIB-002, in the plain chat.
- **Expected:** a message with an attachment keeps working as before.
- **Actual:** `hooks/use-streaming-chat.ts` now uploads every attached file through Library first (`uploadForSend`). With the storage origin blocked the message shows "Upload paused…" and the file is not delivered. Also seen in the console: a React "unique key" warning in `AttachmentManager` and a hydration mismatch warning on the chat page.
- **Impact:** attaching files in chat is broken wherever LIB-001 is not fixed, for users who never open Library.
- **Suggested fix:** fix LIB-001 first. Consider a fallback to the previous attachment path if the Library upload cannot start, and fix the two console warnings.

### LIB-004 PDF preview does not load
- **Case / Type:** FP-03 / Config
- **Steps:** Open `Supplier contract - Acme.pdf`.
- **Expected:** the page is drawn in the preview.
- **Actual:** "This preview isn't available. You can still download the file." with Try again and Download. Console: `Connecting to https://souvenirai-storage.s3.amazonaws.com/... violates the following Content Security Policy directive: "connect-src ..."`. The preview endpoint answers correctly (kind pdf, pageCount 1).
- **Suggested fix:** LIB-001.

### LIB-005 Word (.docx) preview does not load
- **Case / Type:** FP-08 / Config
- **Steps:** Open `Brand guidelines.docx`.
- **Expected:** the document text is shown.
- **Actual:** same "This preview isn't available" state; the preview is a rendered PDF on the storage origin, blocked as in LIB-004.
- **Suggested fix:** LIB-001.

### LIB-006 Audio cannot load or play
- **Case / Type:** FP-07 / Config
- **Steps:** Open `Supplier call - Acme.wav`.
- **Expected:** the audio element loads and can play.
- **Actual:** the element has a source but `readyState` is 0 and `error.code` is 4. Console: `Loading media from 'https://souvenirai-storage.s3.amazonaws.com/...' violates ... "media-src 'self' blob:"`.
- **Suggested fix:** LIB-001 (the same variable also feeds `media-src`).

### LIB-007 "Ask about this" cannot attach the file
- **Case / Type:** FP-18 / Config
- **Steps:** File page, press Ask about this.
- **Expected:** a new chat opens with the file attached.
- **Actual:** a new chat opens with the toast "Couldn't attach this file. Opening a new chat without it." (the app fetches the file from storage to attach it, which the CSP blocks).
- **Suggested fix:** LIB-001.

### LIB-008 File page "Ask about this file" box starts a chat without the file
- **Case / Type:** FP-19 / Config
- **Steps:** Type a question in the box under the preview and press Enter.
- **Expected:** a chat opens with the file attached and the question sent.
- **Actual:** the chat opens at `/chat`, the same "Couldn't attach this file" toast shows and the question is not sent.
- **Suggested fix:** LIB-001. Also consider keeping the typed question in the composer when the attach fails, so it is not lost.

### LIB-010 Identical content is stored once
- **Case / Type:** UP-01 / BE (report to the backend team)
- **Steps:** Upload the same bytes three times: `a.txt`, `a.txt` again, and `b.txt`.
- **Expected:** three separate files, each with its own name (PRD and prototype Flow A check 6: "a duplicate is saved as a separate file with the same name").
- **Actual:** all three return the same file id; only the first name is kept; the list shows one file.
- **Impact:** sending the same file in two chats, or renaming then re-uploading, silently loses the second file and its name.
- **Suggested fix:** backend: de-duplicate storage if wanted, but keep one Library file row per upload. If de-duplication is intended, product has to change the rule first.

## Medium severity

### LIB-009 Citation links cannot render PDF pages or seek audio
- **Case / Type:** FP-20 / Config
- **Steps:** Open `?cite=time:2000` on the audio file, `?cite=row:5` on the CSV, `?cite=page:1` on the PDF.
- **Expected:** audio positioned at 2 s, row 5 highlighted, page 1 shown with a "Cited" label.
- **Actual:** CSV row citation works (a "Cited" label is shown). Audio stays at 0.0 s (it cannot load, LIB-006). The PDF cannot render (LIB-004), so the page citation cannot be shown.
- **Suggested fix:** LIB-001, then re-run FP-20.

### LIB-011 Corrupt PDF is accepted as Ready
- **Case / Type:** UP-04 / BE
- **Steps:** Upload bytes that are not a PDF under a `.pdf` name.
- **Expected:** upload status becomes `failed` with a reason; no file appears (prototype Flow A check 7).
- **Actual:** the upload becomes `ready` and the file is listed in All files. The server refuses unsupported type, empty and over-limit files correctly (UP-03 passes), but does not check content.
- **Suggested fix:** backend content check during processing (and, once LIB-004 is fixed, confirm the preview of such a file fails gracefully).

### LIB-012 Shared tab appears for the owner of a shared file
- **Case / Type:** SH-03 / BE, with an FE guard possible
- **Steps:** Share your own file with the whole workspace, then look at the tabs.
- **Expected:** Shared appears only when something is shared **with you** (prototype Flow H check 2).
- **Actual:** the tab bar shows Suggested, All files and Shared for the owner. `GET /library/files?tab=shared` returns the owner's own file (`access: "owner"`, `accessSummary.everyone: true`).
- **Suggested fix:** backend should leave files the caller owns out of `tab=shared`. As a stop-gap the front-end could hide the tab when every item is owned by the viewer.

### LIB-013 Searching while offline leaves a blank white page
- **Case / Type:** ST-06 / FE
- **Steps:** Open All files, go offline, type in the search box.
- **Expected:** an in-page message or the "Search is unavailable" state, and recovery when back online.
- **Actual:** the page turns completely blank (the browser's own error page, `chrome-error://chromewebdata/`). Console: `Failed to fetch RSC payload for /library?tab=all&q=return`. The search changes the URL, which makes the Next router request the server, and the failed request falls back to a full page load. Server errors (HTTP 500) are handled correctly (Q-11, ST-03 pass).
- **Suggested fix:** update the search in the URL without a server round trip (shallow routing) or add an offline-safe error boundary for the route.

### LIB-015 No phone layout
- **Case / Type:** A11-04 / FE (app shell, not Library only)
- **Steps:** Set the viewport to 375x800 and open /library?tab=all.
- **Expected:** a usable page with no horizontal scroll (prototype Flow H check 25).
- **Actual:** the sidebar stays open and Library content gets about 45 px (content starts at x=307).
- **Suggested fix:** collapse or overlay the sidebar on small screens in the app shell; Library cannot fix this alone.

### LIB-022 Chat composer has no Uploading / Processing / Ready chip
- **Case / Type:** CH-02 / FE
- **Steps:** Attach a file in a chat and watch the composer.
- **Expected:** a chip that shows Uploading, then Processing, then Ready; Send stays off until every file is Ready (prototype Flow A checks 2 and 3).
- **Actual:** a plain attachment card (name, type, size). The upload only starts when Send is pressed, so there is no state to show and Send is never held. Components for this exist in `components/Library/upload` but are not used by the composer.
- **Suggested fix:** wire the existing attachment strip and upload store into the composer; this is the work behind the "Add from Library" and auto-save items listed as not built in doc 10.

## Low severity

### LIB-014 Focus is lost after the Share dialog closes with Escape
- **Case / Type:** A11-02 / FE
- **Steps:** Focus the Share button, press Enter, press Escape.
- **Expected:** focus returns to the Share button.
- **Actual:** focus falls to the page container (the active element is the large wrapper holding the sidebar text). Tabbing inside the dialog is correctly trapped.
- **Suggested fix:** return focus to the trigger on close (the Share button is probably re-mounted while the dialog closes).

### LIB-016 Sidebar Library link has no `aria-current`
- **Case / Type:** NAV-01 / FE
- **Expected / Actual:** the Library link opens /library and looks selected, but exposes no current-page marker to assistive technology.

### LIB-017 Created shows minutes only
- **Case / Type:** ALL-05 / FE
- **Steps:** Look at the two `Price list Q4.xlsx` rows (uploaded a few seconds apart).
- **Expected:** the prototype tells duplicates apart by Created.
- **Actual:** two separate rows with different ids, both showing "Today, 4:16 PM".
- **Suggested fix:** show seconds, or a tooltip with the full timestamp.

### LIB-018 Sort menu ticks are visual only
- **Case / Type:** SORT-04 / FE
- **Actual:** the menu works and lists Name, Created, Newest first, Oldest first (A to Z, Z to A for Name), but no menu item reports a checked state to screen readers. Use `menuitemradio` with `aria-checked`.

### LIB-019 Search matches words, not the phrase
- **Case / Type:** Q-03 / BE
- **Steps:** Search "net 30".
- **Expected:** the Acme contract (prototype Flow H check 18).
- **Actual:** Acme is returned, plus Catalog export.csv, Supplier contract - Nova.pdf, Return policy 2026.pdf and a text file, because any of the words match.
- **Suggested fix:** backend: rank phrase matches first or require all words.

### LIB-020 Storage "used" counts files in Trash
- **Case / Type:** TR-11 / Product
- **Steps:** Delete a file, read `/library/storage`, restore.
- **Actual:** used bytes do not change while the file is in Trash and are the same after restore. Needs a product decision (count Trash or not); the prototype figures are samples.

### LIB-021 No visible focus ring on file links
- **Case / Type:** A11-01 / FE
- **Actual:** a file link is reachable with Tab in 8 presses and Enter opens it, but the focused link has no outline or box-shadow, so keyboard users cannot see where they are.

### LIB-023 to LIB-026 Hidden Settings preview pages show a generic error
- **Cases / Type:** REG-06 Preferences, REG-07 Security, REG-08 Notifications, REG-19 Files / FE (polish, not a regression)
- **Steps:** Open `/settings/preferences`, `/settings/security`, `/settings/notifications`, `/settings/files`.
- **Expected:** a not-found message.
- **Actual:** HTTP 404 as intended (the layouts call `notFound()` while `SETTINGS_PREVIEW_ENABLED` is off, and the pages are not in the nav), but inside the Settings shell it reads "Something went wrong. This page ran into an unexpected error. Reloading usually fixes it." The console also shows React's "script tag while rendering a React component" warning.
- **Suggested fix:** show the standard not-found page for these routes. Logged as four issues, one per page, as requested.

## Not logged as issues

Features that are not built yet (picker, auto-save, citations, routines, Slack, Library Settings and Admin) are listed in section 4.3 of doc 10 as scope, not defects. Cases that could not be run (second user) are in section 4.4.
