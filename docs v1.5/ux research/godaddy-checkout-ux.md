# GoDaddy: How to improve checkout flows ethically

**Source:** https://growth.design/case-studies/godaddy-checkout-ux

## Overview
This case study follows a first-person narrative of a user trying to buy a domain from GoDaddy, tracing their psychological journey from initial interest through mounting frustration as they encounter a series of manipulative upsell tactics during checkout. Rather than only cataloguing the dark patterns, the case study pairs each manipulative tactic with a proposed ethical alternative that could achieve similar business goals (upsell conversion, protection-plan adoption) without exploiting the user. It's a useful reference for checkout and pricing-page design, especially around add-on upsells, anchoring, and default selections.

## Principles & Tactics

### 1. Priming
Priming is the use of subtle visuals or verbal suggestions that influence how people behave shortly afterward, without them consciously registering the influence. GoDaddy implements this via a loading-screen pause after domain search that frames the moment as "achieving something great" (owning a domain) — building emotional motivation and a sense of accomplishment before the user even sees pricing. This primes the user to feel invested before cost becomes a factor in their decision-making.

### 2. Price Anchoring
GoDaddy prominently advertises ".com domains for £1/year" as the headline price. This extremely low anchor is then used as the reference point against which subsequent optional add-ons (protection plans, etc.) are compared — making the add-ons look proportionally more reasonable than they would if evaluated on their own. The £1 headline price is technically honored, but it's the entry point into a flow where additional protection services are priced and framed against that artificially low anchor, shaping the user's sense of what's "expensive" relative to the deal they think they're getting.

### 3. Default Selection (Friction Manipulation)
The optional domain protection plan is pre-selected by default in the checkout UI, and the design is structured to make it harder to notice or change this default. The case study describes the interaction cost as being deliberately increased — the user has to "work harder" to opt out — rather than the protection plan being a genuine opt-in choice presented neutrally.

### 4. Salience
Labels like "Recommended" are attached to upsell options regardless of whether they're actually relevant to that specific user's context or need. Because "Recommended" is a highly salient, attention-grabbing label, it draws the eye and lends implied authority/endorsement to the option — even when the user has no way to know what that recommendation is actually based on.

### 5. Fear-Based Tactics
GoDaddy's protection-plan messaging invokes the threat of "hackers stealing domains" to justify the upsell. Compounding this, the checkout labels the no-add-on option as "No Domain Protection" — despite the user already having some basic protection included by default — implying total vulnerability if they decline the paid add-on. The case study concludes this combination of fear-based framing around hackers and lack of transparency about what protection is already included "leverages fear and confusion to scare people into paying more."

### 6. Reactance
Reactance is the intense emotional pushback people feel when they sense they're being manipulated — a perceived encroachment on their intelligence and autonomy triggers resistance rather than compliance. As the user in the narrative accumulates exposure to the stacked deceptive patterns (pre-selected defaults, fear framing, misleading anchoring), they experience mounting exhaustion and irritation, illustrating how manipulative checkout design can backfire into distrust rather than simply extracting extra revenue.

### 7. FOMO (Fear of Missing Out)
Related to the fear-based tactic above, language referencing "criminals" targeting domains is used to manufacture urgency around domain security specifically, pushing the user to act (i.e., buy protection) now rather than risk missing the window to protect themselves.

## Ethical Alternatives Proposed by the Case Study

### A. Endowment Effect
Instead of framing the protection screen as "selling you an additional service," GoDaddy could reframe the same option as helping the user secure "your domain" — something they already feel ownership over. This taps into the endowment effect (people value things more once they feel they own them) to motivate protection uptake without resorting to fear.

### B. Goal-Gradient Effect
The case study recommends showing users a clear visual of completed checkout steps versus remaining steps. Seeing tangible progress toward a goal increases motivation to complete the remaining steps (the goal-gradient effect), which could be used to keep users moving through checkout smoothly instead of relying on manipulative urgency.

### C. Fitts's Law
Fitts's Law states that the time required to acquire a target is a function of the distance to and size of that target. The proposed ethical fix is to display all available options above the fold at once, so users can evaluate their choices side-by-side without needing to scroll and hunt — reducing friction and making comparison genuinely easy rather than deliberately obscured.

## Concrete UI/Flow Details
- The domain search returns an exact match for the user's intended domain name.
- The protection options screen presents three tiers: included basic protection, an optional premium tier marked "Recommended," and an option effectively framed as "No Protection."
- The advertised £1 price jumps to £18.96 once the user proceeds, revealing a hidden multi-year (2-year) commitment baked into the total.
- Checkout includes navigation with explicit progress indicators for completed versus remaining steps (used as the basis for the goal-gradient recommendation).

## Metrics & Data
No specific conversion rates, revenue figures, or statistical data are cited in the case study — the analysis is entirely qualitative, built around the narrated user journey and named psychological principles.

## Key Takeaways
- Manipulative checkout patterns (fear framing, misleading defaults, deceptive anchoring) may lift short-term upsell conversion but generate reactance that damages trust.
- Every manipulative tactic identified had a proposed ethical counterpart capable of achieving a similar business goal — the two are not mutually exclusive.
- Pre-selected defaults and vague "Recommended" labels should be scrutinized for whether they're genuinely contextual or just generically applied to drive selection.
- Progress indicators (goal-gradient effect) are a legitimate, non-manipulative way to keep users moving through a multi-step checkout.
- Presenting all options above the fold (Fitts's Law) supports honest comparison rather than obscuring less profitable choices via scroll-hiding.
- Reframing an upsell around protecting something the user already values (endowment effect) can motivate the same purchase without invoking fear.

## Applicability Notes
This case study is most directly relevant to checkout flows, pricing/add-on upsell screens, and any multi-step purchase funnel involving optional protection plans, insurance, or warranties. It's also a useful reference for teams designing default-selection behavior and progress indicators in any transactional flow where trust and repeat-purchase intent matter as much as single-transaction conversion.
