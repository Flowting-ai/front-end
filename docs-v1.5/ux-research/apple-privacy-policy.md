# Apple vs Meta Threads: The Illusion of Privacy

**Source:** https://growth.design/case-studies/apple-privacy-policy

## Overview
This case study opens with a first-person narrative of curiosity about Meta's Threads app, then moves through a discovery process of manipulative onboarding/data-collection UX, before pivoting to a broader critique of Apple's privacy claims and how they contradict Apple's own app-ecosystem practices. It examines both companies together because the piece argues each exploits the *appearance* of privacy/transparency while the underlying mechanics undermine it — Meta through data-collection framing and account-deletion lock-in, and Apple through marketing-driven "privacy washing." It's a useful reference for evaluating how consent screens, data-disclosure UI, and privacy marketing claims can create an illusion of user control that doesn't match the actual mechanics.

## Principles & Tactics

### 1. Framing
Framing is the principle that user decisions are shaped by how information is presented, independent of the underlying facts. Meta's "How Threads works" onboarding screen uses deceptive framing: extensive disclosures about the scope of data collection are placed under innocuous, non-alarming headlines, which leads users to "mindlessly tap Next" without actually registering what data they're agreeing to hand over. A specific implementation detail: Meta "camouflaged tons of links in tiny gray text" within the onboarding flow — technically present and technically disclosed, but visually designed to be overlooked.

### 2. The T.I. Ratio (Transparency-to-Intrusiveness Ratio)
This principle holds that the level of transparency a product provides should be proportional to how intrusive or risky the underlying action is for the user — highly invasive data collection should come with correspondingly prominent, clear disclosure. The case study scores Meta's transparency screen at just "0 or 1" on what is implied to be a 5-point scale, despite the screen requesting extensive personal data categories including Health data, Financial Info, Browsing History, and Sensitive Info. The full list of data categories collected is described as spanning multiple scrollable screens — long enough that the case study's own reaction is "holy cow!" — meaning the sheer volume of data being collected is essentially hidden by being technically scrollable/present but practically illegible at a glance.

### 3. Dark Pattern: Roach Motel
A Roach Motel pattern makes it easy to get into a commitment but deliberately difficult to get out. Meta implements this by preventing users from deleting their Threads account without simultaneously deleting their Instagram account — the two are bound together so that exiting one means losing the other. The case study frames the coercive nature of this bundling with the line: "If you delete me…I'll delete him!" This traps users who might want to leave Threads specifically but don't want to lose their separate Instagram presence, discouraging account deletion altogether.

### 4. Privacy Washing
Privacy washing is defined in the case study as "the act of pretending to protect privacy (while not doing so)." Apple's "Ask App Not To Track" feature is presented as an example: it visibly gives users a control that creates an illusion of meaningful choice over tracking, but advertisers have been documented working around it — using fingerprinting techniques instead of Apple's traditional IDFA identifier to continue mapping user data. The case study cites investigations concluding that "iPhone's tracking protections are not as reliable as Apple's ads might suggest," directly undercutting the confidence Apple's marketing projects about the feature's effectiveness.

### 5. Incentive Structures
The case study frames data privacy as "an unaccounted externality" — meaning companies don't bear a direct cost for weak privacy practices unless something explicitly forces that cost onto them, so incentives don't naturally align toward protecting users. As a proposed (but unimplemented) solution, the case study suggests Apple could display privacy scores prominently within App Store listings and use those scores to rank privacy-respecting apps higher in search/discovery — creating a real incentive for developers to improve privacy practices. The case study notes Apple deliberately does not do this, despite having the platform-level power to.

## Specific Metrics & Data Points
- **European regulatory action:** Threads reportedly used tracking invasive enough that it "couldn't launch in Europe" at the time, because under European data protection law Meta needs a valid legal basis to process that kind of personal data for ad targeting.
- **Apple's marketing investment:** Apple is described as investing "billions in billboards and advertising" to position itself publicly as a "Guardian of Privacy."
- **Ethics score assigned:** The case study concludes with its own assigned grade — an "Ethics and privacy score: E" (a failing grade) — for the overall pattern examined across both companies.

## Concrete UI/Flow Details

**Threads onboarding:**
- The initial steps are designed to be simple and frictionless, encouraging users to progress through screens without pausing to scrutinize them.
- The "How Threads works" screen buries disclosure links in tiny gray text rather than surfacing them prominently.
- The information architecture of the onboarding flow is structured to keep the true scope of data collection out of visual focus.

**Apple App Store privacy section:**
- The privacy disclosure is an extremely long, scrollable list covering multiple sensitive data categories.
- Data types listed include health, financial, browsing history, location, contacts, and a catch-all "Other Data" category.
- There is no visual prominence, summary, or warning surfaced at the top of app listings to flag high-risk data collection before a user scrolls through the full list.

## Key Takeaways
- Disclosure that is technically present but visually de-emphasized (tiny gray text, long scrollable lists) does not constitute meaningful transparency.
- The T.I. Ratio is a useful lens: the more intrusive the data being requested, the more prominent and legible the corresponding disclosure should be — not less.
- Roach Motel patterns that bundle account deletion across products (e.g., Threads/Instagram) trap users under the guise of platform integration.
- A company's public privacy marketing can diverge sharply from the actual technical effectiveness of its privacy features — "privacy washing" exploits the gap between perception and reality.
- Platform holders (like Apple, via the App Store) have levers — such as visible privacy scores and search ranking — that could realign incentives toward genuine privacy protection but may choose not to use them.
- Evaluating a product's privacy practices requires looking past the marketing claims and consent-screen copy to the actual downstream mechanics (data usage, account-deletion policy, ad-targeting workaround techniques).

## Applicability Notes
This case study is most relevant to consent/permission screens, data-disclosure and privacy-policy UI, account deletion/offboarding flows, and any onboarding sequence that requests sensitive personal data. It's also a useful reference for auditing marketing claims about privacy or security against the actual product mechanics, and for designing account-deletion flows that avoid Roach Motel–style bundling.
