# Chrome vs Brave: How To Use Ethical Design To Win Customers

**Source:** https://growth.design/case-studies/brave-browser-onboarding

## Overview

This case study compares the author's long-standing relationship with Chrome against a switch to Brave, a privacy-focused browser. It opens by noting that although "Google claims it doesn't sell data," Chrome's Real-Time Bidding ad engine effectively monetizes user attention at scale by linking harvested browsing data to individual identities — something the case study says differentiates Chrome from Safari, Edge, and Firefox. The bulk of the analysis walks through Brave's download-and-onboarding funnel (built on Chromium, the same open-source engine that powers roughly 80% of browsers, including Chrome) to show how ethical, privacy-first positioning can still use strong growth/UX psychology to win users away from an entrenched incumbent. It's a valuable reference for onboarding flows that need to overcome strong incumbent habits and switching costs.

## Principles & Tactics

### 1. Familiarity Bias
People prefer familiar experiences. Brave leans on this by being built on Chromium, which lowers the technical/behavioral gap for anyone switching from Chrome, and by personalizing its own onboarding headline when it detects the visitor is currently using Chrome — directly calling out the familiar product to grab attention and reduce the perceived risk of switching.

### 2. Device Auto-Detection
The case study identifies that 20% of Brave's new visitors don't complete all the download steps, despite Brave already adding roughly 2 million new active users every month. The download flow requires users to manually select their device/chip type (e.g., Intel vs. Apple Silicon) rather than auto-detecting it via JavaScript (the way Chrome-detection scripts already do elsewhere on the web). The case study estimates that even a 2% lift at this first step could compound to hundreds of thousands of additional new users per year, making this a high-leverage, low-effort fix.

### 3. Chronoception (Time Perception)
Waiting periods can be reframed as invested time rather than dead time — the guiding rule cited is to "never let users watch the soup come to a boil." During Brave's download, which takes roughly 1 minute 43 seconds, the user is shown only a static chip-selection screen with nothing else happening. The recommendation is to use that wait window productively: highlight what's coming next, reassure the user the setup will be brief, and reinforce the benefits they're about to get — turning dead time into anticipation-building time.

### 4. Reciprocity & Trust
Users are more likely to commit to a product after it has already provided them some value. Brave's onboarding asks users to set it as their default browser *before* they've had a chance to actually try it — described in the case study as being "like arriving at a first coffee date and getting a marriage proposal." This is especially risky given that switching a default browser used for 10+ years is a high-commitment decision. The recommended fix is to move the default-browser ask to after the data-import step, once the user has already experienced some tangible value (e.g., seeing their bookmarks and settings carried over).

### 5. Labor Illusion
People trust and value a process more when they can see the underlying work being done. Brave imports the user's Chrome settings, extensions, and bookmarks in what feels like milliseconds — so fast that the case study notes users "almost missed it." Because migration is intuitively expected to be a non-trivial task, completing it near-instantly can make users skeptical that it actually worked. The suggested fix is to introduce a deliberately paced, well-designed "labor" screen that visibly shows the import happening, increasing perceived thoroughness and trust in the result.

### 6. Priming
Brave emphasizes that it blocks "creepy trackers for a safer browsing experience" immediately before presenting the default search engine choice. This primes the user to be thinking about privacy at the exact moment they're asked to pick a search engine, making them meaningfully more likely to choose DuckDuckGo over Google — a subtle but effective way to reduce a competitor's default footprint within Brave's own onboarding.

### 7. Progressive Disclosure
Advanced or complex features should be deferred until after a user has gotten comfortable with the core product, improving time-to-value. The case study notes that fewer than 16% of Brave's daily active users activate Brave Rewards, despite it being a genuinely compelling system (users get paid in tokens for viewing privacy-respecting ads) that generates the majority of Brave's revenue. Brave defers explaining tokens and Rewards until after onboarding is complete, trading a bit of immediate awareness for a smoother initial setup — though the case study flags the low 16% activation rate as evidence there may still be room to reintroduce Rewards more effectively later in the journey.

### 8. Treating Users Like Humans
Products should respect people's time and attention while reflecting genuine human values like safety and empathy. Brave's home dashboard — shown to more than 8,000,000 people every single day — displays three simple, humanizing stats: privacy protections applied, data saved, and time saved. The case study highlights this dashboard as a clean, consistent summary of Brave's brand promise, reinforcing the same ethical positioning at massive scale, every single day, without needing new copy or campaigns.

## Key Takeaways
- Reducing friction for switchers by leaning on familiarity (e.g., building on the incumbent's own technology) lowers the psychological barrier to trying a new product.
- Small, easily overlooked steps (like manual device selection) can silently cost a product tens of thousands of conversions a year — auto-detection where possible is high-leverage.
- Don't ask for the biggest commitment (e.g., "set as default") before the user has experienced any value — sequence asks to follow demonstrated value, not precede it.
- Instant, invisible processes (like data migration) can undermine trust; deliberately visible "work" can increase perceived quality even if it takes marginally longer.
- Priming users with a relevant value message right before a choice screen can meaningfully shift which option they pick.
- A simple, consistent dashboard that reflects a product's core values (privacy, time saved, etc.) reinforces brand positioning to millions of users daily without extra marketing spend.

## Applicability Notes
This case study is most relevant to onboarding and account-setup flows, download/installation funnels, "switch from a competitor" migration flows, default-setting prompts, and post-onboarding feature-adoption or activation flows (e.g., introducing a rewards or loyalty program). It's also useful for home/dashboard screens that need to reinforce a product's core value proposition on every visit.
