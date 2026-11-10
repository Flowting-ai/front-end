# Letterboxd: How to nail product market fit with clear Jobs-To-Be-Done

**Source:** https://growth.design/case-studies/letterboxd-jobs-to-be-done

## Overview
The case study follows a new user's onboarding experience with Letterboxd, a social app for film enthusiasts that lets people track, rate, and discuss the films they've watched. The product's marketing hook — "a social app for film lovers" — is appealing, but the case study argues that the actual onboarding and core flow reveal a deeper strategic problem: the app never clearly establishes which specific "job" it's helping the user accomplish, and this ambiguity cascades into multiple concrete usability issues (confusing choice sets, unclear labels, no feedback, no stopping cues). This case study is a strong reference for any product that offers multiple overlapping value propositions (tracking + recommendations + social) without clearly sequencing or prioritizing which one the interface is built to serve first.

## Principles & Tactics

### 1. Show > Tell
The principle: don't rely on non-contextual, upfront instructional screens to convey essential information about how a product works — people skip generic tutorials and only really absorb how something works by encountering it in context, ideally while working toward an "aha" moment they actually care about. Letterboxd's implementation problem: the app opens with a lengthy educational carousel explaining its features, which the user in the walkthrough skips immediately without absorbing. The suggested alternative is to demonstrate features contextually as users naturally discover them during real use, gradually building toward the product's core value moment rather than front-loading explanation nobody reads.

### 2. Voice & Tone
The principle: copywriting isn't neutral — it actively shapes user psychology and either encourages or discourages action, and the tone set early in a flow establishes the relational tone for the rest of the experience. Letterboxd's implementation problem: a post-signup popup asking users to share which films they've watched uses passive, low-emphasis button copy ("Okay cool" / "No thanks") that never actually explains *why* sharing this information matters to the user. The case study's improved version calls for stronger, more direct language paired with a visible, concrete value proposition (illustrated via a Barbie/Ken-themed example) so the ask feels worth responding to rather than skippable.

### 3. Hick's Law
The principle: the more choices presented to someone at a decision point, the longer it takes them to decide — and past a certain point, added choice produces decision paralysis rather than better decisions. Letterboxd's implementation problem: during preference collection, users are presented with four distinct, similar-sounding actions for each film (rate / like / want-to-watch / watched), and the case study notes users reported genuine confusion about the practical distinction between these options, leading to decision fatigue during what should be a quick, low-stakes preference-gathering step.

### 4. Stopping Cues
The principle: activities need a clear completion signal, or users experience uncertainty about whether they're done, whether their progress will be saved, and whether to keep going — this ambiguity produces frustration and a form of psychological reactance against the task. Letterboxd's implementation problem: its Tinder-style swiping interface for indicating film preferences has no visible endpoint or counter — users don't know when the activity is supposed to end, or whether their swiping progress persists if they exit early, which the case study identifies as a direct cause of user confusion and abandonment mid-task.

### 5. Feedback Loops
The principle: every action a user takes should produce a visible effect — an interface where actions have no perceptible consequence breaks the user's mental model of whether the system registered what they did. Letterboxd's implementation problem: after a user swipes through a batch of films and closes the swiping interface, there is no confirmation of what happened to that data — the films simply "disappear" from view, leaving the user unsure whether their preferences were actually saved anywhere.

### 6. Familiar Nomenclature
The principle: labels and terminology should lean on words and concepts users already have a mental model for, rather than inventing internal jargon that requires the user to learn a new vocabulary just to navigate the product. Letterboxd's implementation problem: the app uses multiple similar-sounding but not clearly distinguished terms — "Watchlist," "Diary," and "Journal" — without making the semantic difference between them obvious, so users end up searching around trying to find where a film they just logged actually landed, because none of the labels map cleanly to their existing mental model of "the movie I just added."

### 7. Jobs-To-Be-Done (Central Framework)
The principle, as stated in the case study: "A Job-to-be-Done is a useful tool to help you focus your product on outcomes for people rather than features. Knowing what the customer hopes to accomplish in a given circumstance is a superpower when building coherent experiences." Letterboxd's core, overarching issue according to the case study is that the app tries to serve multiple overlapping "jobs" at once (tracking history, generating recommendations, enabling social discussion) without ever clarifying to the user which job the interface in front of them is meant to serve — leaving users to genuinely ask themselves: *is this app for storage? For recommendations? For social connection?* The proposed redesign (referenced at slide 22 of the walkthrough) reorganizes the home screen around exactly two primary jobs, rather than trying to surface everything at once:
- **Job 1 — Tracking (🗓️):** a screen focused on showing the films the user has already watched, integrated with recommendations that build naturally off that tracked history.
- **Job 2 — Discussion (💬):** a screen focused on showing friends' activity and enabling debate/discussion about films, serving the explicitly social use case.
- **Bonus job:** enabling users to publicly share their tracking history, layering a lightweight social/identity function on top of the core tracking job.
By explicitly mapping each interface surface to one clear customer outcome instead of scattering features across ambiguous screens, the redesign gives the product a coherent structure — every element on screen now answers "what job is this serving" rather than existing as one more feature bolted onto a crowded home screen.

## Key Metrics/Data
No specific conversion, retention, or user-percentage metrics were cited in this case study; the analysis is entirely UX/flow-based rather than data-driven.

## Key Takeaways
- Ambiguity about which core "job" a product is solving for the user cascades downward into concrete UX confusion at every level — from label choice to feature prioritization to onboarding structure.
- Long, skippable instructional carousels are a weak substitute for teaching through contextual, in-the-moment demonstration (Show > Tell).
- Every interactive decision point should be evaluated for how many distinct options it forces the user to weigh at once — collapsing near-duplicate choices reduces decision fatigue (Hick's Law).
- Any repeatable or swipe-based activity needs a visible completion signal, or users won't know whether to keep going or whether their input was even saved (Stopping Cues + Feedback Loops).
- Terminology should map to users' existing mental models rather than requiring them to learn which of several similar-sounding labels ("Watchlist" vs. "Diary" vs. "Journal") applies to their situation.
- When a product genuinely serves multiple jobs, organizing the interface explicitly around a small number of named jobs (rather than blending them) creates coherence that a feature-by-feature approach cannot.

## Applicability Notes
This case study is most relevant to products that offer multiple, potentially overlapping value propositions within a single app (tracking + social + recommendations, or similar combinations) and are struggling to define a clear onboarding narrative or home-screen structure. It's especially useful for onboarding-flow design, preference-collection/swipe-based data-entry interfaces, and information-architecture decisions (navigation labels, home-screen sectioning) in any product where "what is this screen actually for" isn't immediately obvious to a new user.
