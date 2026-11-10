# Uber Eats: How To Ethically Use Scarcity To Increase Sales

**Source:** https://growth.design/case-studies/uber-eats-scarcity

## Overview
This case study (Growth.Design case study 16/018) walks through the Uber Eats app via a first-person narrative of a hungry, late-night user ordering food, and uses that journey to surface the psychological principles baked into each screen. Its central thesis is that scarcity — one of the most commonly abused persuasion tactics in product design — can be used *ethically* when it is tied to a genuinely limited resource (e.g., real delivery logistics) rather than fabricated urgency. The article is useful as a reference for distinguishing "positive scarcity" from dark-pattern scarcity, and for seeing how small execution details (copy, timing, defaults) can undermine or reinforce an otherwise well-intentioned feature.

## Principles & Tactics

### 1. Personalization = Reduced Churn
The underlying psychology is that reusing a person's own historical data to remove effort from a task builds goodwill and reduces the chance they abandon the flow, especially in a high-motivation, low-patience state (a hungry user at night). Uber Eats implements this by pre-filling the delivery address automatically when the app is launched, rather than asking the user to re-enter or re-select it. The case study frames this as saving cognitive effort at exactly the moment the user has the least patience for friction, which supports retention over time.

### 2. Power in the Defaults
This tactic rests on status-quo bias: people are disproportionately likely to stick with whatever option is pre-selected for them rather than actively opting in or out. Uber Eats applies this through an opt-out utensil system — by default, no plastic utensils are included with the order, and the user must actively request them, framed as a sustainability-oriented default. However, the case study is critical of the execution: the toggle uses small text, over-explains the context (adding unnecessary reading load), appears at a poor point in the flow (near app-open rather than at checkout, where it's more contextually relevant), and has ambiguous call-to-action wording. The narrative explicitly calls this a case of good intent undermined by clunky execution.

### 3. Positive Scarcity
This is the article's central and namesake concept: scarcity is a powerful motivator ("people want more of those things they can have less of"), but it is only ethical when it reflects a real limited resource rather than an invented one. Uber Eats implements this via a 5-minute countdown timer attached to a "free delivery" offer that is unlocked when a user joins an existing order already being delivered from the same restaurant. The scarcity here is real: delivery timing and batching windows are an actual operational constraint, not a manufactured deadline. The mechanism simultaneously benefits the platform (fewer separate deliveries, reduced delivery inefficiency) and the user (free delivery), which the case study holds up as the model for "ethical" scarcity — a shared, real constraint rather than a fabricated countdown designed purely to panic the user into converting.

### 4. Branding vs. Sales
The psychological principle here is that people remain loyal to brands whose values they believe in, beyond any single transactional incentive ("people will stay for what they believe in"). The case study proposes a copy change to the free-delivery/shared-order feature: instead of transaction-focused wording like "Free delivery expires in...", Uber Eats could use community/sharing-economy-oriented messaging that reinforces the platform's broader identity as part of the sharing economy. The argument is that reminding users of the values a service embodies creates durable loyalty that outlasts any single discount-driven conversion.

### 5. Sensory Appeal
This principle draws on multi-sensory design: engaging multiple senses (sight, implied smell/warmth, etc.) simultaneously makes content feel less like advertising and more like a genuine sensory experience, and the senses reinforce each other's persuasive effect. The case study critiques the current Uber Eats menu screen as feeling like a "dry desert" — roughly two-thirds of the screen is consumed by restaurant metadata (ratings, delivery time, fees) rather than the food itself. It proposes an enhanced menu design featuring juicier food photography, video that hints at warmth or scent, and a more optimized use of screen space to let the food itself dominate the visual field and drive appetite-based conversion.

### 6. Serial Position Effect
This is the well-documented memory bias where items placed first or last in a list are recalled and chosen more often than items in the middle. The case study observes this in action when the narrator selects a "spring rolls" upsell item from a scrollable list — noting that the user made the selection "under pressure" and without conscious awareness that positioning may have influenced the choice. The article expresses skepticism about whether this placement is coincidental, stating: "It'd be interesting to see if the placement...is entirely random? I doubt it!" — implying that upsell list ordering is a deliberate, if unconfirmed, application of the serial position effect.

### 7. Custom User Flows
The principle is that different entry points and different user contexts call for different flow paths to help each user type reach their goal efficiently, rather than forcing everyone through the same generic sequence. The case study identifies a flaw in checkout: an upsell popup is triggered even when the user has only 23 seconds left on their countdown-linked free-delivery offer. Because the remaining context (time pressure to lock in the discount) should take priority, the article argues the flow should instead route this user directly to payment rather than interrupting them with a cross-sell modal — an example of the flow not being adequately customized to the user's specific situational state.

## Key Takeaways
- Scarcity is not inherently manipulative — its ethics hinge on whether the constraint driving it is real (e.g., delivery batching windows) or fabricated purely to create pressure.
- Good defaults (opt-out utensils) can be undone by poor execution: wording, timing, and placement all matter as much as the underlying mechanic.
- Personalization that removes low-value cognitive effort (pre-filled fields) compounds into retention over repeated use.
- Messaging can do double duty: the same feature can be framed transactionally or in terms of brand values, and values-based framing tends to build longer-term loyalty.
- Menu/product-browsing screens benefit from sensory-first design; metadata-heavy layouts dilute the appetite/desire trigger that drives conversion.
- Flow logic should be context-aware — a user under time pressure from one mechanic (a countdown) should not be interrupted by an unrelated upsell that ignores that pressure.

## Applicability Notes
This case study is most relevant to marketplace and delivery/e-commerce checkout flows, particularly any flow that uses time-limited offers, opt-in/opt-out defaults (e.g., sustainability or add-on toggles), or upsell/cross-sell placement within a browsing or checkout sequence. It's also a useful reference for any product considering countdown timers or "limited availability" messaging, as a checklist for whether the scarcity being communicated is genuine or fabricated.
