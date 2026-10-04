# Coronavirus Dashboard UX: How Design Impacts Your Perception

**Source:** https://growth.design/case-studies/coronavirus-dashboard-ux

## Overview
This case study follows a viewer who, after watching alarming coronavirus news coverage, turns to a real-time dashboard (specifically the Johns Hopkins University map) to check the actual spread of the virus for themselves — only to find that the dashboard's visual design choices distort rather than clarify the underlying data. It's a valuable reference for anyone building data dashboards or crisis-communication interfaces, since it shows concretely how scale, color, cumulative-vs-recovered framing, and missing context can each independently mislead viewers even when the raw numbers are accurate.

## Principles & Tactics

### 1. Availability Heuristic
People tend to misjudge the magnitude or likelihood of events based on how easily they can recall recent information, rather than on the actual base rate. The viewer's recent exposure to alarming news coverage becomes their dominant mental anchor, so that "this last piece of information takes precedence on what I know," even though they already had more measured background knowledge of the virus. This recency bias primes them to interpret the dashboard they view next through an already-alarmed lens.

### 2. Confirmation Bias
People favor and interpret information in ways that confirm beliefs they already hold. Having just been primed by frightening news, the viewer looks at the Johns Hopkins map and finds it validates their fear rather than correcting it: "my thoughts are anchored with the News I just watched. So a quick look at this map confirms my fears while ignoring the facts." The dashboard's visual design does nothing to interrupt this bias — if anything, its scale distortions actively reinforce it (see #3 below).

### 3. Data Representation / Scale Distortion
The core UX failure identified is the use of a symbol/area map to represent infection proportions, which badly distorts the viewer's sense of scale. Concretely: the map visually implies "all of China is infected," while the actual figure was **81,000 people infected out of 1.4 billion total population — barely 0.005%**. Similarly, although **China accounted for roughly 2/3 of all worldwide infections** at the time, the map visually implies "3X more people infected worldwide" than in China, inverting the true proportion. The map also visually renders Europe as "completely infected," which the case study argues wrongly implies the situation there "can't get worse, when in fact, it could" — the visualization conveys a false sense of a ceiling being reached.

### 4. Negativity Bias
People recall and weight unpleasant information more strongly than positive information. The dashboard emphasizes the cumulative case count (81,000) prominently while making the number of recovered patients nearly invisible, even though the viewer eventually realizes "half of the people are cured!" — a fact the dashboard's design obscures rather than highlights. The case study's explicit recommendation: "when data has a negative connotation, you should avoid showing cumulative cases in your dashboard," since a running cumulative total can amplify or distort perceived severity relative to current, active reality.

### 5. Color Psychology / Human-Centered Design
The choice of color for representing case data communicates an emotional message independent of the underlying numbers. The dashboard's use of red prompts the viewer to ask, "Is it just me or the color red...feels a lot like a death sentence?" The case study argues designers must remember that "behind every data point, there's an actual person," and that since most infected people in this dataset survive, using a color as visually severe as death-associated red is disrespectful and inaccurate to the actual outcome distribution. A more neutral color palette is suggested as both more accurate and more respectful to the people represented by the data.

### 6. Missing Information & Transparency
The dashboard omits two categories of context the case study considers essential: (1) **Demographics** — age and health-condition data are left out entirely, even though this information would clarify who is actually at meaningful risk, rather than implying uniform risk across the whole population; and (2) **Error margins** — the dashboard presents case counts as precise, definitive totals with no indication of possible undercounting or measurement uncertainty ("numbers are never 100% accurate. What's the margin here?"). The suggested fix is to use appropriately hedged language, such as "We know of [X] cases" rather than presenting a raw number as an authoritative total, which would give viewers a more honest picture of the data's actual certainty.

## Key Takeaways
- Recent, emotionally charged exposure (like news coverage) primes how people interpret subsequent data (Availability Heuristic), and dashboards that don't actively correct for this will simply reinforce whatever fear or belief the viewer already brought with them (Confirmation Bias).
- Area/symbol-based maps can radically misrepresent true proportions — always check whether a visualization's *visual weight* matches the *actual statistical share* it represents.
- Cumulative totals over-emphasize negative outcomes; pairing or replacing them with active/recovered framing gives a more balanced, less alarmist picture.
- Color choices carry emotional connotations independent of the data itself — a severity-coded color (like red for death) should match the actual severity/outcome distribution, not just category membership ("infection" broadly).
- Omitting demographic context (age, risk factors) can make a uniform-seeming risk visualization mislead viewers about who is actually at risk.
- Presenting numbers without acknowledging measurement uncertainty overstates the dashboard's authority; simple hedging language improves honesty without sacrificing clarity.

## Applicability Notes
This case study is most relevant to any dashboard, data-visualization, or crisis/status-reporting interface where raw numbers must be translated into a visual form for a general (non-expert) audience — public health dashboards, incident/status pages, financial risk displays, or any UI where color, scale, and framing choices could unintentionally amplify fear or distort a viewer's sense of proportion relative to the underlying facts.
