# Adobe: The Psychology of User Offboarding

**Source:** https://growth.design/case-studies/adobe-cancel-subscription

## Overview

This case study follows a subscriber who receives an Adobe Creative Cloud renewal notification and decides to cancel after not using Photoshop for six months. What should be a simple cancellation turns into a long, friction-filled journey that reveals a set of systematic dark patterns designed to retain customers through psychological manipulation rather than genuine value. The case study is a useful reference because it documents, step by step, how a well-known company's offboarding flow deliberately contradicts good UX practice, and it contrasts this against Adobe's otherwise streamlined onboarding — showing that friction in a product is a deliberate design choice, not an accident.

## Principles & Tactics

### 1. Status Quo Bias
People tend not to change how things currently are because doing so preserves mental resources and avoids a stressful decision. Adobe exploits this at the very first touchpoint: the renewal notification email. The word "renewal" is buried at the end of the subject line, the preview text is rendered in ALL CAPS (which reads as spammy and gets ignored/dismissed rather than read carefully), and the actual monthly cost ($9.99/month on the annual plan) and the renewal deadline are hidden inside body paragraphs rather than being stated up front. The call-to-action to manage or cancel the subscription is buried within paragraphs instead of being prominently displayed as a button. All of this nudges the subscriber toward inaction (i.e., toward staying on the status quo path of auto-renewal).

### 2. Revenue Hacks: "Annual Paid Monthly" Pricing
Adobe structures its annual plan to be billed in monthly installments (e.g., "$9.99 per month" shown on the billing screen). This creates confusion about the real commitment: the subscriber is actually locked into a full annual contract, and cancelling mid-year triggers an early-cancellation penalty fee. This pricing structure boosts short-term revenue by making the subscription look cheaper and more flexible than it is, but the case study argues this damages long-term brand trust once customers discover the penalty.

### 3. Friction Dark Pattern
Deliberately adding unreasonable friction to a cancellation journey to make it hard for customers to leave is called out as unethical. Adobe's flow stacks several friction points in sequence:
- **Duplicated login:** the renewal email automatically logs the subscriber in, but the cancellation portal then demands re-authentication anyway.
- **Forced feedback survey:** the "continue" / confirm button is disabled until the subscriber fills in a mandatory reason-for-leaving text field.
- **Irrelevant loss-aversion/FOMO screen:** immediately after stating they haven't used Photoshop in 6 months, the subscriber is shown a warning about "losing their favorite apps" — a message that ignores what they just said.
- **Multi-step discount gauntlet:** a barrage of sequential "last-minute offers" is presented, most of which are priced *higher* than the subscriber's original plan.
- **Confusing final confirmation:** the last screen emphasizes staying part of the Adobe "community" and cross-sells other products, rather than clearly confirming the cancellation went through.
This is explicitly contrasted with Adobe's smooth, low-friction onboarding flow, used as evidence that the offboarding friction is intentional rather than an engineering oversight.

### 4. Discount Devaluation ("Sleazy Salesmen Effect")
Offering discounts that are unjustified or poorly targeted lowers brand perception over time and trains customers to distrust the company's pricing integrity. Adobe's retention offers are not personalized despite the churn survey having just collected the subscriber's stated reason for leaving. Most of the discounted plans still cost more than the subscriber's original $9.99/month plan, and the sequence of offers has no clear internal logic — it reads as a scattershot "throw options at the wall" approach, compared in the case study to "overwhelming TV infomercials," which comes across as desperate rather than helpful.

### 5. Offboarding Empathy Gap
Forcing a customer to give feedback in a churn survey and then failing to visibly act on that feedback is worse than not asking for feedback at all. Adobe requires the subscriber to type out that they "haven't used Photoshop in 6 months" — information the product almost certainly already tracks via usage analytics — and then presents zero personalization in the retention offers that follow. The net effect feels like an interrogation rather than a company that listened and cared about the subscriber's actual situation.

### 6. Noble Edge Effect
When companies visibly demonstrate care and social responsibility, they earn increased brand loyalty and, over time, greater profits. The case study frames this against the backdrop of the pandemic: roughly 225 million jobs were lost globally to COVID-19 during the period being discussed, while Adobe reported $5.3 billion USD in profit for 2020. Given this context, the case study argues Adobe had a real opportunity to offer contextual, genuinely helpful alternatives (e.g., a pause, a downgrade, or a hardship accommodation) rather than aggressive upselling — which would have aligned the company's actions with its stated values.

### 7. Peak-End Rule & Exit-Points
People's brains disproportionately weigh the peak moments and, especially, the ending of an experience when judging it overall. Products should let users disengage with a sense of completion. Adobe's final confirmation screen buries the actual cancellation acknowledgment underneath community messaging and prominent cross-sell promotions, leaving the subscriber uncertain whether the cancellation was fully processed. The case study's guiding line here: "how you say goodbye is as important as how you say hello." The recommended fix is a clear, reassuring confirmation state, potentially paired with a simple non-manipulative safety net like an "undo cancellation" button.

## Key Takeaways
- Offboarding flows reveal a company's true priorities — Adobe's slick onboarding vs. its friction-laden cancellation flow shows friction is a deliberate lever, not an accident.
- Hiding key facts (cost, renewal date, deadline) behind vague copy exploits status quo bias and erodes trust once discovered.
- Forcing customers to give feedback without demonstrably acting on it (personalizing offers, adjusting messaging) is worse than not asking at all.
- Retention discounts that are irrelevant, unpersonalized, or actually more expensive than the original plan devalue the brand ("sleazy salesman effect").
- Endings matter as much as beginnings (peak-end rule) — a confusing or promotion-heavy cancellation confirmation leaves a lasting negative impression.
- A survey cited in the case study found 97% of respondents (n=328) considered Adobe's cancellation approach "not ethical," and the case study assigns Adobe an overall offboarding grade of "E."

## Applicability Notes
This case study is most relevant to subscription cancellation and downgrade flows, account-closure/offboarding journeys, churn-survey design, and any retention-offer or win-back screen shown at the point a user tries to leave. It's a strong reference for auditing whether a cancellation flow respects the user's stated intent versus quietly working to trap or guilt them into staying.
