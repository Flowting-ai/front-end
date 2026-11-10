# How to Craft Onboarding Surveys Users Love: 5 Do's and Don'ts

**Source:** https://growth.design/case-studies/grammarly-onboarding-survey

## Overview
This case study follows a new user setting up a Grammarly team/business account for brand voice consistency, walking through Grammarly's onboarding survey flow. It highlights both effective techniques (framing, early goal-setting, personalized paywalls) and friction points (unclear personalization, redundant questions caused by organizational silos, and a failure to visibly follow through on data collected earlier in the flow). The case study is a useful reference for onboarding surveys, personalization-driven flows, and personalized paywall/upgrade experiences.

## Principles & Tactics

### 1. Framing Effect (skip option reframed)
The underlying principle: "The way you present information affects how people make decisions." When a user reaches a point where they could skip further onboarding questions, Grammarly doesn't present the skip option as simply "Skip" — instead it frames it as "skipping personalization." This reframing shifts the decision from a low-stakes "skip a question" action to a higher-stakes "give up a benefit" action, making users more inclined to keep answering questions because completing them now feels tied to a tangible personalization payoff rather than being just one more form field.

### 2. Spark Effect (question sequencing)
Related to framing, Grammarly starts its survey with short, simple questions before moving to more involved ones. This "Spark Effect" is intended to build engagement momentum — an easy first question lowers the barrier to starting, and once a user has answered one question, they're more likely to continue through subsequent (and potentially more effortful) questions.

### 3. Personalization Clarity (or the lack thereof)
Grammarly customizes the goals it suggests to a user based on that user's previous survey answers — but the case study identifies that this personalization is poorly communicated. The stated principle: "personalization that's poorly communicated can be worse than no personalization at all." In the observed flow, the suggested goals appear essentially random to the user, since nothing on screen explicitly says "these goals are based on what you told us." This leaves the user confused, wondering "are these goals supposed to be personalized?" — the missing signal (an explicit callout tying suggestions back to the user's own answers) undermines the value of the personalization work Grammarly is actually doing behind the scenes.

### 4. Personalized Paywall
Grammarly's paywall/upgrade screen is shown to be personalized based on the goals a user selected earlier — for example, surfacing the Business plan specifically to users who selected goals aligned with business/team use cases. The case study cites a concrete metric here: this kind of personalized paywall approach was found to increase upgrade rates by more than 10% ("Upgrade rates increased by 10%+"). It distills the approach into a three-step formula: (1) show the user that the product understands their goals, (2) demonstrate the features that are relevant to those specific goals, and (3) present a personalized upgrade path built on that understood context, rather than a generic one-size-fits-all pricing page. The case study notes an improvement opportunity: the paywall should add explicit messaging (e.g., "based on your answers") to make the plan-matching logic clear to the user, since right now the alignment between selected goals and suggested plan is implicit rather than stated.

### 5. Salience & Pseudo-Set Framing (paywall presentation)
Building on the personalized paywall, the case study recommends three specific UI changes to increase how salient and trustworthy the personalized recommendation feels: (1) make the plan-selection screen feel like an integrated continuation of the onboarding survey rather than a separate, disconnected "sales" screen — a technique referred to as pseudo-set framing (grouping the paywall into the same perceived "set" as the onboarding steps the user already invested in); (2) explicitly indicate that the suggested plan/features are derived from the user's own survey answers; and (3) visually highlight the matching/recommended plan first, so it isn't overlooked among other options.

### 6. Conway's Law (organizational structure leaking into UX)
The case study invokes Conway's Law: "The structure of an organization is reflected in the products it creates." It identifies a specific symptom of this in Grammarly's flow — early survey steps appear to have been built by one internal team, while later steps were built by a different team, and as a result users are asked redundant questions across the two halves of the survey. The user's reaction captured in the case study: "didn't I already answer most of these earlier?" This creates a visibly inconsistent, disjointed experience at the handoff point between the two halves of onboarding, a direct symptom of internal team boundaries leaking into the product experience.

### 7. Reciprocity Principle
The concept: "When users give, they expect to get." Grammarly's onboarding collects detailed preference and goal data from the user, but the case study identifies a gap — after the user has given this information (and even completed payment), subsequent parts of the product don't visibly make use of it. The user has to "dig through these menus" to find personalized features rather than being handed them proactively. The recommended fix is to replace redundant post-payment onboarding steps with visible, personalized shortcuts built directly from the user's previous answers, so the product demonstrably "listens" and reciprocates the effort the user put into the survey. The expected outcome of doing this earlier and more visibly is increased satisfaction and a stronger sense that the value exchange (data given for personalization received) was honored.

## Key Takeaways
- Reframing a "skip" action around what the user loses (e.g., "skip personalization") rather than what they avoid (e.g., "skip this question") can reduce drop-off in onboarding surveys.
- Start onboarding surveys with short, easy questions to build momentum before asking more involved ones (Spark Effect).
- Personalization must be explicitly communicated to the user — silent personalization that isn't called out can read as randomness and erode trust rather than build it.
- Personalized paywalls that visibly tie the recommended plan to the user's stated goals can meaningfully lift upgrade rates (10%+ cited in this case study).
- Pseudo-set framing — making a paywall/upgrade screen feel like a continuation of onboarding rather than a separate sales pitch — increases how naturally users engage with the recommendation.
- Organizational silos (different teams owning different parts of a flow) can produce redundant or inconsistent user-facing experiences (Conway's Law) — cross-team review of end-to-end flows helps catch this.
- Reciprocity matters: once a product asks users for information, it should visibly act on that information soon afterward, or the perceived value exchange breaks down.

## Applicability Notes
This case study is most relevant to onboarding surveys, goal-setting flows, and any personalization-driven experience — particularly ones that feed into a personalized paywall or upgrade screen. It's also a useful reference for auditing multi-team-owned flows for redundancy and inconsistency, and for any product that collects user data early on and needs to ensure that data is visibly, promptly put to use downstream.
