# Quiz: Find 4 psychology principles used in Shortform's offboarding

**Source:** https://growth.design/case-studies/shortform-offboarding-quiz

## Overview
This case study walks through Shortform's subscription-cancellation ("offboarding") flow as a first-person narrative: a user decides to cancel and is confronted with a screen that quietly uses several behavioral-psychology principles to try to change their mind. The article frames the flow as a "quiz" — inviting the reader to spot four distinct psychology principles at work in the cancellation screen — and then calls out one outright dark pattern before showing an "ethical" redesign that keeps the persuasive structure but drops the manipulation. It's a useful reference for anyone building cancellation/offboarding or downgrade flows, because it shows both the legitimate persuasive techniques and the line where persuasion tips into manipulation.

## Principles & Tactics

### 1. Anchoring
Anchoring is the tendency for people to rely heavily on the first piece of information offered (the "anchor") when making a judgment — here, judgments about whether a price is expensive or cheap. Shortform's cancellation screen reframes the subscription's cost away from the salient "yearly" billing figure (which feels large and looms over the decision) and instead expresses the same cost in terms of hours of value or a tiny per-unit figure. By anchoring the user's perception of price to a small, granular number instead of the lump annual charge, the screen makes the subscription feel cheap and makes canceling feel like giving up something inexpensive to keep — i.e., "remind us that the subscription is cheap when reframed in hours (vs. yearly)."

### 2. Authority Bias
Authority bias is the tendency to attribute greater accuracy or value to the opinions/imagery of an authority figure or to associate a brand with success and credibility. On the cancellation screen, Shortform pairs its retention messaging with imagery/language associated with success and achievement, which primes the brain to unconsciously link "Shortform" with "being a successful, self-improving person" — "to help our brain associate Shortform with success." The case study explicitly flags this tactic as ethically debatable, since it borrows credibility/aspiration rather than making an argument about the product's actual value.

### 3. Pattern Break
Pattern break (sometimes called a "pattern interrupt") is a UI/attention technique where breaking the expected visual rhythm of a page — via an unexpected image, unusual layout, or spacing — captures attention and forces the user to slow down and actually process the message rather than skimming past it on autopilot. Shortform's cancellation screen places a central image in the middle of the page with text visually separated around/below it, disrupting the normal flow of a settings/account page. This forces a moment of conscious reflection right at the point where the user was about to click through and cancel — "with the image in the middle to capture our attention, separate the text."

### 4. Reframing
Reframing shifts the entire frame of reference for a decision so the user is no longer evaluating the thing they came to evaluate. Instead of talking about the subscription itself (price, book selection, features), Shortform's copy reframes the decision entirely around an abstract, emotionally loaded concept — "personal growth" — so canceling stops being "I'm canceling a book-summary subscription" and becomes "I'm ending my personal growth." The case study notes: "nothing here is about the subscription (or books!) It's all about personal growth," and flags this reframing, like authority bias, as ethically debatable because it substitutes an emotional narrative for the actual product trade-off the user is trying to weigh.

### 5. User Shaming (Dark Pattern — called out, not endorsed)
Beyond the four "quiz" principles, the article calls out an explicit dark pattern layered on top of the reframing: the cancellation button itself is labeled "End my personal growth" rather than neutral copy like "Cancel subscription." This is a form of user shaming/guilt-tripping — using emotionally manipulative copy that makes the user "feel bad about themselves to influence their decision," rather than presenting the choice neutrally. The case study treats this as a step too far, distinct from the other four (more defensible) principles, and uses it as the pivot point into proposing a redesign.

## Key Takeaways
- Cancellation/offboarding screens are a legitimate place to remind users of value (anchoring, reframing, authority/aspiration cues, pattern breaks) — but there's a line between persuasion and manipulation.
- Reframing price in smaller, more relatable units (e.g., cost per hour instead of per year) is a lightweight, ethically defensible way to make value tangible at the moment of loss-aversion.
- A visual pattern break (central image, whitespace, layout disruption) is an effective way to make users pause and actually read retention messaging instead of clicking through it.
- Associating a brand with success/aspiration (authority bias) and reframing the decision around an emotional narrative (e.g., "personal growth") can work, but should be flagged and scrutinized for manipulativeness.
- Labeling the actual cancel action with guilt-inducing copy ("End my personal growth" instead of "Cancel subscription") crosses into user shaming and is called out as a dark pattern to avoid.
- The same four legitimate principles (anchoring, framing, pattern break) can be reused in an ethical redesign by reorienting the message positively (e.g., emphasizing time/value the user already got) rather than guilting the user about what they're losing.

## Applicability Notes
Most relevant to cancellation, downgrade, and offboarding flows (subscription cancel screens, plan-downgrade confirmations, account-deletion flows) where a product legitimately wants one last chance to remind users of value — and, by contrast, as a checklist of dark-pattern copy (guilt-based button labels, forced emotional reframing) to explicitly avoid in those same flows.
