# One Simple Psychology Framework To Improve Your Onboarding

**Source:** https://growth.design/case-studies/blinkist-user-onboarding

## Overview
This case study follows the author's real onboarding experience on Blinkist (a book-summary app) while trying to find a specific summary ("Thinking, Fast and Slow"), documenting the friction points encountered along the way and evaluating them against a central framework the article calls "Psych" — the idea that every interaction in an onboarding flow either adds or subtracts from a user's cumulative psychological motivation to continue. The narrative moves through trust violations (premature tracking permission requests), misaligned personalization, unclear value framing, and mounting friction before the user finally reaches the app's core value. It closes with a practical checklist for designing onboarding flows that preserve rather than drain user motivation. This is a useful reference for any product's first-run/onboarding sequence.

## Principles & Tactics

### 1. Respect > Data
The underlying psychology: trust must be established before a product asks for something valuable (like extensive behavioral tracking); requesting sensitive data without first demonstrating value or explaining the reason feels invasive and creates suspicion rather than goodwill.

Blinkist's implementation: early in onboarding — before the user has even seen the specific book summary they came for — Blinkist asks for permission to track everything the user does on their phone, justified only by the generic promise of "personalization." The author describes this as feeling "creepy" precisely because it's requested too early, with no context or trust built up beforehand, and notes the broader industry problem that "many apps still track you even if you explicitly ask them not to," compounding the trust issue.

### 2. Progressive Disclosure
The underlying psychology: introducing complexity or secondary features gradually, only once relevant, reduces user overwhelm; onboarding should align with what the user actually stated they want, rather than force-feeding the product's own priorities regardless of user intent.

Blinkist's implementation: instead of first asking the user what they actually want to accomplish (the case study cites research identifying three common motivations for book-summary users: refreshing memory, applying knowledge, or saving time), Blinkist immediately introduces a "daily habit" feature with no context for why it matters or how it relates to the user's actual goal. The author's proposed fix is to open onboarding by directly asking "what do you want to accomplish?" and using that answer to sequence which features get introduced and when.

### 3. Framing & Anchoring
The underlying psychology: the way a number or comparison is framed strongly shapes how it is interpreted, and effective framing should anchor to the product's genuine, resonant value for that specific user rather than an abstract, generically impressive-sounding statistic.

Blinkist's implementation: onboarding tells the user they could save "48 hours per week" by reading Blinkist summaries instead of full books. The author flags this claim as unrealistic and unrelatable — pointing out essentially nobody reads 48 hours of books per week — making the framing feel like an exaggerated, generic marketing number rather than a believable personal benefit. The suggested fix is to anchor time-savings messaging to the user's own previously stated goal instead of a blanket claim.

### 4. Personalization Expectations
The underlying psychology: the act of asking a user a personalization question (e.g., "pick your interests") creates an implicit expectation that subsequent content will actually reflect that answer; failing to deliver on this expectation is worse for trust than not asking the personalization question at all, because it exposes the gap between promise and delivery.

Blinkist's implementation: after the author selected "psychology" as an interest, the resulting recommendations included tangentially related picks like Oprah's trauma book and a "Sex & Relationships" title, while an extremely well-known, clearly on-topic psychology classic — "Thinking, Fast and Slow" (the very book the author came looking for) — was buried deep in the list rather than surfaced as an obvious top match.

### 5. Endowment Effect
The underlying psychology: once something feels like it belongs to the user (saved, added to a personal collection), they value it more and are more motivated to see the process through to actually being able to use/access it.

Blinkist's implementation: after the author selected and saved "Thinking, Fast and Slow" to a personal library during onboarding, the knowledge that the summary was now sitting in "their" library — waiting for them — provided enough motivation to push through the remaining onboarding friction, despite growing frustration with the flow.

### 6. The "Psych" Framework (Central Framework)
The underlying psychology: every micro-interaction in an onboarding flow either adds to or subtracts from a running total of user psychological motivation ("Psych"); the cumulative total at any point determines how likely the user is to continue versus abandon. Positive moments (personal relevance, delivered-on promises, visible progress) add Psych; negative moments (premature asks, irrelevant content, unexplained friction) subtract it.

Blinkist's implementation (as narrated): the case study frames the entire session as a sequence of Psych-draining events — the premature tracking permission request, the unexplained daily-habit prompt, the unrelatable "48 hours" framing, the mismatched interest-based recommendations, and multiple additional optional screens before the user ever reaches the actual book summary they wanted. Each of these subtracts from the user's motivation reserve, and the case study argues the cumulative effect is what determines whether users complete onboarding or abandon partway through.

### 7. Transparency Impact
The underlying psychology: clear, upfront terms and conditions (particularly around billing/trials) reduce the anxiety and suspicion that otherwise accompanies a "free trial" offer, increasing willingness to proceed.

Blinkist's implementation: during a later trial paywall step, Blinkist clearly displayed terms such as "no charge until after trial," which the author explicitly called out as "very nice," even amid overall onboarding fatigue — showing that transparency can still generate goodwill even when the surrounding flow has drained a lot of Psych.

## Specific Friction Points Documented in the Flow
1. Tracking permission request shown with no trust built and no explanation of purpose.
2. An unexplained "daily habit" prompt that contradicts the app's stated "quick 15-minute summary" value proposition.
3. A vague, unrelatable value proposition ("48 hours saved weekly") that doesn't map to the user's real reading habits.
4. Interest category selection ("psychology") followed by recommendations that are poorly aligned with that selection.
5. Inability to access saved/selected content until the entire onboarding flow is completed.
6. Feature education screens using undefined jargon ("Blink," "Shortcast") without context.
7. Paywall fatigue setting in after multiple additional optional screens.
8. A final expectation mismatch — the user expects to land directly on the book summary they saved, but instead hits another recommendation wall.

## Final Checklist for Onboarding Design
- Avoid unnecessary friction in order to preserve the user's Psych.
- Build up Psych before making a "big ask" (e.g., sensitive permissions, payment commitment).
- Delay optional or effortful tasks until later in the flow, after core value has been delivered.
- Start the flow from the user's initial stated needs/goals rather than the app's internal feature priorities.
- Use psychological principles ethically — in service of the user's actual goals, not just to extract data or commitment.

## Key Takeaways
- Requesting sensitive permissions (like broad activity tracking) before establishing any trust or delivering value tends to feel invasive rather than helpful.
- Asking users what they want up front, then sequencing the rest of onboarding around that answer, avoids irrelevant feature pushes and preserves motivation.
- Big, generic value-proposition numbers ("save 48 hours") are less persuasive than benefit framing anchored to what the specific user already told you they want.
- Personalization is a promise: if you ask users for preferences, the subsequent experience must visibly reflect those preferences, or the mismatch damages trust more than not asking at all.
- Letting users save/collect something early creates an endowment effect that can carry them through subsequent friction.
- Every onboarding interaction should be evaluated for whether it adds or subtracts from cumulative user motivation ("Psych") — sequence the flow so the big/sensitive asks come after trust and momentum have been built, not before.

## Applicability Notes
This case study is most directly relevant to first-run/onboarding flows for subscription and content apps, especially flows that combine personalization questions, permission requests, and delayed access to the user's actual goal, but the "Psych" framework and its sequencing principles (respect before data, deliver on personalization promises, delay big asks) generalize to any multi-step signup or setup wizard.
