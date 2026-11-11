# The Ugly Truth About Net Promoter Score Surveys

**Source:** https://growth.design/case-studies/nps-surveys

## Overview
This case study uses a storytelling frame — a customer named Dan receives excellent in-person service from a bank employee named James, then gets a confusing, poorly-designed NPS (Net Promoter Score) survey email afterward — to walk through five concrete design flaws common to standard NPS surveys. It then presents a redesigned survey addressing each flaw, and closes with a broader critique of NPS as a metric: how it gets gamed, misused, and over-relied upon by companies. This is a useful reference for anyone designing post-interaction feedback surveys, in-product feedback prompts, or any measurement instrument where response quality and completion rate matter.

## Principles & Tactics

### 1. Relevance (Low Open/Completion Rates)
The underlying psychology: people use fast, instinctive "System 1" filtering to decide whether to engage with incoming information, and generic, cold subject lines and overused boilerplate survey questions get filtered out and archived almost automatically — the case study calls this the "Law of Shitty Clickthrough," where audiences rapidly pattern-match and dismiss anything that looks like a template they've seen before.

Implementation/example: the bank's NPS email uses a cold, generic subject line disconnected from Dan's actual visit, causing it to blend into the pile of "yet another survey" emails. The result cited is a disappointing average completion rate of just 3% for typical NPS survey emails. The fix demonstrated in the redesign is a subject line made relevant/contextual to the specific customer's recent situation, so the email doesn't read as mass-blasted boilerplate.

### 2. Tone (Corporate vs. Human Language)
The underlying psychology: robotic, corporate-sounding copy signals to the recipient that they're interacting with a faceless process rather than a person, reducing motivation to engage; human, direct language increases the sense of a genuine, personal exchange.

Implementation/example: the original survey uses stiff, impersonal corporate phrasing. The redesigned version replaces this with a direct, conversational tone — e.g., "How's your experience with us, Dan? ...anything we could do to improve?" — addressing the customer by name and asking in plain, human language rather than survey-speak.

### 3. Clarity (Double-Barreled Questions)
The underlying psychology: when a single question actually asks about two different things at once, respondents cannot cleanly express an opinion about either one, producing noisy, uninterpretable data and unfairly conflating unrelated targets of evaluation.

Implementation/example: the bank's survey conflates "how was the staff member" and "how do you feel about the bank overall" into one combined question. Dan had a great experience with James (the employee) but is ambivalent about the bank as an institution, leaving him unable to answer honestly — illustrated in the case study as "💚 + 💔 = 5/10... I guess?" This double-barreled design also unfairly penalizes the employee's individual score when the customer's issue is really with the institution (or vice versa). The redesign fixes this by giving the survey a single, unambiguous scope/focus rather than merging two evaluation targets.

### 4. Accuracy (Temporal Mismatch)
The underlying psychology: asking someone to predict a hypothetical future behavior ("how likely are you to recommend us") based on a single recent interaction is a validity problem — a one-time experience is a weak basis for extrapolating long-term advocacy behavior.

Implementation/example: the classic NPS question asks about the hypothetical likelihood of recommending the bank to others in the future, but this is being inferred from a single visit, creating a mismatch between what's being measured (momentary satisfaction) and what's being reported (a long-term behavioral prediction). The redesign's fix is to keep the survey's scope closer to the customer's actual, current experience.

### 5. Complexity (Too Many Response Options)
The underlying psychology: cited via Hick's Law — the time/effort required to make a decision increases with the number of available options — and Fitts's Law, where smaller UI targets (like tightly packed rating buttons on an 11-point scale) create physical/interaction friction. Critically, the case study notes that this added complexity does not make results more accurate or reliable; it just adds friction.

Implementation/example: the standard NPS scale uses 11 discrete points (0 through 10), each typically rendered as small tap/click targets. This forces users through unnecessary decision effort for a marginal, non-existent accuracy gain. The redesign reduces this friction as part of its "low-commitment ask" approach.

## Redesigned Survey (Five Concrete Fixes)
The rebuilt survey applies the above principles concretely as:
1. A relevant, contextual subject line tied to the customer's specific situation (not a generic template).
2. A short, human-toned intro instead of corporate boilerplate.
3. A low-commitment ask that reduces perceived effort/burden to respond.
4. A clear, single scope so the respondent isn't asked to conflate multiple targets in one question.
5. Transparent communication of the survey's benefits and conditions — i.e., telling the customer why their feedback matters and what will be done with it.

## Critique of NPS as a Metric
Beyond survey design, the case study argues NPS itself is over-relied upon: companies treat it as a one-size-fits-all metric despite it being "frequently misused... and easy to game." It cites the NPS methodology's own designer acknowledging, "I had no idea how people would mess with the score," and invokes Goodhart's Law ("when a measure becomes a target, it ceases to be a good measure") to explain why chasing the NPS number specifically often distorts genuine feedback collection. The article's closing framing is that NPS surveys as typically deployed create "an illusion of accuracy to companies while shifting its pervasive burden to customers."

## Key Takeaways
- Generic, templated survey emails get filtered out almost instinctively; contextual relevance to the specific customer/interaction dramatically affects open and completion rates (cited baseline: ~3% completion for standard NPS emails).
- Write survey copy in a direct, human tone and address the respondent by name rather than using corporate boilerplate.
- Never combine two distinct evaluation targets (e.g., an individual employee and the overall company) into a single question — it produces unusable, conflated data and can unfairly penalize individuals.
- Match what you're measuring to what you're asking: don't infer long-term behavioral predictions from a single recent interaction.
- More response granularity (e.g., an 11-point scale) adds decision friction without improving accuracy — simpler scales can perform just as well.
- Be transparent with respondents about why you're asking and what will happen with their feedback.
- Be wary of over-indexing on NPS as a company-wide target metric; per Goodhart's Law, a heavily targeted metric becomes easy to game and loses its diagnostic value.

## Applicability Notes
This case study is most directly relevant to post-interaction feedback surveys and NPS/CSAT-style measurement instruments (email or in-app), but its clarity and question-design principles — avoiding double-barreled questions, matching question scope to what's actually being measured, minimizing response friction, and using human tone — generalize to any feedback form, in-app survey, or rating prompt.
