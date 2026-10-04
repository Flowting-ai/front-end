# 5 Deadly Onboarding Mistakes You Should Avoid

**Source:** https://growth.design/case-studies/5-product-onboarding-mistakes-to-avoid

## Overview
This case study uses a first-person narrative of a user downloading a fictional/illustrative alarm-clock app that claims to wake users at the optimal point in their sleep cycle. The user starts with high enthusiasm (described as an 80% "Psych Level") but the article traces a sequence of onboarding missteps that progressively erode that motivation, ending with the user deleting the app — illustrating the article's opening statistic that roughly 21% of users churn after just their first use ("almost 1 out of 4 people will delete your app after the first use"). The case study is structured as a countdown of five specific, nameable onboarding mistakes, each tied to a psychological principle, making it a useful negative-example checklist (an "anti-patterns" reference) rather than a single product's success story.

## Principles & Tactics

### 1. Early Notifications (Asking Before Earning Trust)
The underlying principle is "earn trust first": a product should never ask users for reciprocity (like granting a notification permission) before it has given them any value. The article states this explicitly: "Never ask for reciprocity if you haven't given anything. Ask for notifications after users have their first Aha-moment." The illustrative app violates this by presenting the notification-permission screen immediately upon app launch, before the user has experienced any benefit from the product (e.g., before they've seen the sleep-cycle-based wake feature actually work). A secondary issue compounding this mistake is vague copy — the permission prompt describes only "relevant notifications" without specifying what kinds of notifications will actually be sent, which increases user suspicion rather than easing it.

### 2. Vague Copy (Being Unspecific in Permission/Consent Language)
This mistake is closely tied to #1 but treated as its own distinct issue: ambiguous language in permission requests or consent screens erodes trust because users don't know exactly what they're agreeing to. The concrete example cited is the same "relevant notifications" wording — because it doesn't specify notification categories, frequency, or purpose, it causes the user concern rather than confidence, even though notifications themselves aren't inherently the problem.

### 3. Missing the Promised Land
This principle holds that users arrive at an app with a specific intent or promise in mind (established by the marketing/download decision), and the onboarding flow must actively reinforce and deliver on that specific promise rather than assuming the user will infer it. In the case study, the app's core promise is waking users at the biologically optimal point via sleep-cycle tracking, but the onboarding fails to explain or emphasize the mechanism behind this — the user is left without a clear picture of how the "optimal wake-up time" feature actually works, so the core differentiator that drove the download in the first place goes unreinforced during the critical first-use window.

### 4. Faking Scarcity For Profits
This mistake is the article's clearest example of a "dark pattern": scarcity is a genuinely powerful psychological lever ("we value things more when they're in limited supply," in forms such as Time, Quantity, or Access limitation), but it becomes manipulative and trust-destroying when the scarcity is fabricated rather than real. The illustrative app implements this via a fullscreen pop-up appearing within just 10 seconds of app use, showing a "Big discount," a "Limited time offer," a live countdown timer, and a "GET IT NOW!" call-to-action. The article notes the manipulation is compounded by emotionally exploitative imagery — an "image of an innocent sleeping child with a small cat" used to soften the user into accepting the scarcity framing. The article's explicit warning: "Never use this pattern if you fake the scarce! Unfortunately, nothing here justifies the sudden urgency" — since there is no real underlying constraint (e.g., no actual limited inventory or time-bound resource) driving the countdown.

### 5. Nudging Users Too Hard
This principle invokes reactance psychology: when people feel their freedom of choice has been taken away or restricted, it can trigger an angry, motivated response to reassert control — often by disengaging entirely rather than complying. In the case study, after the user rejects the app's initial premium upsell, the app responds with a second sales push reframed as a "gift" offer — effectively not taking no for an answer. This is compounded by the free tier being presented as including ads, which the user experiences as a punitive consequence of declining rather than a neutral default, further intensifying the feeling of being pressured.

## Key Takeaways
- Permission and notification requests should always come after the user has experienced a genuine "Aha-moment," never before any value has been delivered.
- Consent and permission copy needs to be specific about what's being requested (type, frequency, purpose) — vague language reads as evasive and increases user suspicion.
- Onboarding must actively reinforce the specific promise that drove the user to download the app in the first place, not assume the value proposition is self-evident.
- Scarcity tactics (countdowns, "limited time" banners) are only legitimate when tied to a real constraint; fabricated urgency is a dark pattern that damages trust once users sense there's no real deadline or limited resource behind it.
- Repeated or reframed sales pushes after a user has already declined (e.g., turning a rejected upsell into a "gift" offer) can trigger reactance and accelerate churn rather than prevent it.
- Roughly 21% of users may abandon an app after just one use, meaning first-run onboarding mistakes carry outsized weight relative to their frequency.

## Applicability Notes
This case study is most relevant as a negative-pattern checklist for first-run onboarding flows — specifically permission/notification request timing, consent copy clarity, promise/value reinforcement in the first session, and any use of countdowns, discounts, or "limited time" messaging during onboarding. It's also directly applicable to upsell/paywall flows that need to gracefully handle a user's initial "no" without escalating pressure.
