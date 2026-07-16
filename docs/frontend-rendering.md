# Frontend rendering contract - structured XML widgets

This doc is the source of truth for how the assistant emits **structured
content** that the frontend is expected to render specially. Anything not
covered here is plain Markdown and should be rendered as Markdown.

The rules below are mirrored in the system prompt
([modules/llm/system_instruction.py](../modules/llm/system_instruction.py))
under the `<formatting>` block. **If the prompt and this doc ever disagree, the
prompt wins** - update this doc, not the other way around.

---

## Where these blocks appear in the SSE stream

Structured widgets arrive **inline inside the regular `content` SSE events** -
the same stream that carries prose text. There is no separate `table` or
`chart` SSE event.

That means the frontend's existing content accumulator already receives them;
it just needs to parse the accumulated buffer for `<table>` and `<chart>`
blocks and swap in real components in place of the raw XML.

```
event: content
data: {"type":"content","content":"Here are the numbers:\n\n<chart type=\"bar\" "}

event: content
data: {"type":"content","content":"title=\"Sales\">\n  <bar label=\"Q1\" value=\"120\"/>\n"}

event: content
data: {"type":"content","content":"  <bar label=\"Q2\" value=\"150\"/>\n</chart>"}
```

**Implication for streaming UIs:** a block can arrive split across many chunks.
Don't attempt to render until the matching closing tag (for example `</map>`) has been
seen. Until then, either show a placeholder or render the partial XML as
plain text (whichever you prefer aesthetically).

---

## Tables

### Tag set

| Tag       | Required | Purpose                            |
|-----------|----------|------------------------------------|
| `<table>` | yes      | Outer wrapper, one per table       |
| `<thead>` | yes\*    | Header row container               |
| `<tbody>` | yes\*    | Body rows container                |
| `<tr>`    | yes      | One per row                        |
| `<th>`    | yes      | Header cell, only inside `<thead>` |
| `<td>`    | yes      | Body cell, only inside `<tbody>`   |

\* `<thead>` and `<tbody>` are emitted by the model in practice; the frontend
should treat a missing one as "no header" / "no body" rather than rejecting.

### Rules

- Every `<tr>` closes. Every cell closes. No self-closing variants.
- One row per `<tr>`. No nesting of tables unless the data is genuinely
  hierarchical (rare).
- Cell text is XML-escaped: literal `<`, `>`, `&` arrive as `&lt;`, `&gt;`,
  `&amp;`. The frontend should decode these when rendering.
- No attributes are used on table tags today. Treat any unknown attribute as
  ignorable rather than failing.
- No Markdown pipe tables (`| col | col |`) and no ASCII tables. If you ever
  see one, that's a prompt regression - file a bug.

### Example

```xml
<table>
  <thead>
    <tr><th>Name</th><th>Role</th></tr>
  </thead>
  <tbody>
    <tr><td>Alice</td><td>Engineer</td></tr>
    <tr><td>Bob</td><td>Designer</td></tr>
  </tbody>
</table>
```

---

## Charts

### Wrapper

Every chart is a `<chart>` element. It carries a `type` attribute that picks
the renderer, plus optional metadata attributes.

| Attribute  | Required | Notes                                                         |
|------------|----------|---------------------------------------------------------------|
| `type`     | yes      | One of `pie`, `bar`, `line`, `histogram`                      |
| `title`    | no       | Human-readable title; render as the chart heading             |
| `x-label`  | no       | (line only) axis label for the x-axis                         |
| `y-label`  | no       | (line only) axis label for the y-axis                         |

Unknown `type` values: render as a fallback (e.g. show the raw XML or a
"unsupported chart type" notice). Do not crash.

### Numeric attribute rules

`value` and `y` arrive as **plain numbers** - no units, no thousand-separators,
no currency symbols. The model is told to put units in the title or label
instead. Parse with `Number(...)` / `parseFloat(...)`; if the parse fails,
skip that data point and log it.

### Label escaping

Labels (`label`, `x`, `title`) are XML-escaped: `<`, `>`, `&` arrive as
`&lt;`, `&gt;`, `&amp;`. Decode before display.

---

### `type="pie"`

Children: one or more `<slice label="…" value="…"/>` elements (self-closing).

```xml
<chart type="pie" title="Revenue by region">
  <slice label="North" value="120"/>
  <slice label="South" value="80"/>
  <slice label="East"  value="45"/>
</chart>
```

| Child child-attr | Required | Type   | Meaning                |
|------------------|----------|--------|------------------------|
| `<slice>` `label`| yes      | string | Slice label (legend)   |
| `<slice>` `value`| yes      | number | Magnitude of the slice |

Frontend computes percentages from the sum of `value`s.

---

### `type="bar"`

Children: one or more `<bar label="…" value="…"/>` elements (self-closing).
Order in the XML is the display order on the x-axis.

```xml
<chart type="bar" title="Sales per quarter">
  <bar label="Q1" value="120"/>
  <bar label="Q2" value="150"/>
  <bar label="Q3" value="90"/>
  <bar label="Q4" value="200"/>
</chart>
```

| Child child-attr | Required | Type   | Meaning                  |
|------------------|----------|--------|--------------------------|
| `<bar>` `label`  | yes      | string | Category label (x-axis)  |
| `<bar>` `value`  | yes      | number | Bar height (y-axis)      |

---

### `type="line"`

Children: one or more `<point x="…" y="…"/>` elements (self-closing).
Order in the XML is the line draw order.

```xml
<chart type="line" title="Daily active users" x-label="Day" y-label="Users">
  <point x="Mon" y="120"/>
  <point x="Tue" y="135"/>
  <point x="Wed" y="128"/>
</chart>
```

| Child child-attr | Required | Type            | Meaning            |
|------------------|----------|-----------------|--------------------|
| `<point>` `x`    | yes      | string OR number| X-axis position    |
| `<point>` `y`    | yes      | number          | Y-axis value       |

`x` may be either a category label (e.g. `"Mon"`) or a numeric position
(e.g. `"3.14"`). Try `Number(x)` first; fall back to treating it as a category.

---

### `type="histogram"`

Children: one or more `<value>n</value>` elements containing **raw
observations** (not pre-binned counts). The frontend bins them.

```xml
<chart type="histogram" title="Response time (ms)">
  <value>12</value>
  <value>17</value>
  <value>34</value>
  <value>41</value>
  <value>22</value>
</chart>
```

Recommended binning behavior:
- Default to ~10 equal-width bins, or use Sturges' / Freedman–Diaconis if you
  already have a helper.
- Skip values that fail to parse as numbers; don't drop the whole chart.
- If the user can rebin (slider, input), keep the raw values around - they're
  the source of truth.

| Child       | Required | Type   | Meaning              |
|-------------|----------|--------|----------------------|
| `<value>`   | yes (≥1) | number | One observation      |

---

## Interactive maps

Every map is a static data snapshot wrapped in `<map>`. The client renders the
snapshot with MapLibre so the user can pan, zoom, expand clusters, inspect
point popups, and filter the ranked region rail without making another backend
request.

| Root attribute | Required | Notes                                      |
|----------------|----------|--------------------------------------------|
| `title`        | no       | Human-readable card heading                |
| `metric`       | no       | Measure shown in popups and the ranked rail|
| `unit`         | no       | Display prefix/suffix such as `$` or `ms`  |

Each `<point/>` requires `lat`, `lng`, and `value` as plain finite numbers.
`label` is the human-readable location, while `group` identifies the state,
country, or market used for ranking. Optional `<group/>` children provide
authoritative totals when the plotted points are only a sample.

```xml
<map title="Orders by market" metric="Orders" unit="$">
  <group code="TX" value="1320000" label="Texas"/>
  <point lat="32.7767" lng="-96.7970" value="4200" label="Dallas" group="TX"/>
  <point lat="39.7392" lng="-104.9903" value="3800" label="Denver" group="CO"/>
</map>
```

The model must only emit coordinates supplied by a source and is capped at 100
points. The frontend validates coordinate ranges, ignores malformed points,
and parks offscreen maps to stay below browser WebGL-context limits.

---

## Parsing recommendations (frontend implementer notes)

These are suggestions; pick what fits your stack.

1. **Wait for closing tag before rendering.** Buffer the `content` stream and
   detect `</table>` / `</chart>`. Render only complete blocks. Show a
   "rendering chart…" placeholder for the in-flight tag if you want feedback.

2. **Use a real XML parser, not regex.** Browsers ship one:
   ```js
   const doc = new DOMParser().parseFromString(snippet, "application/xml");
   if (doc.querySelector("parsererror")) {
     // fall back to showing the raw text - don't crash
   }
   ```
   This handles XML-escaped entities for free.

3. **Be lenient.** Treat unknown attributes, unknown chart types, missing
   `<thead>`, or extra whitespace as recoverable. The model occasionally
   varies output; the user sees the chat fail if you're strict.

4. **Numbers:** always coerce with `Number(attr) ` and check `Number.isFinite`.
   Drop bad points, log to telemetry.

5. **Security:** XML-escaped content is safe for `textContent` but not for
   `innerHTML`. Set cell/label text via `textContent` (or React's default
   string interpolation) - never with `dangerouslySetInnerHTML`.

---

## Things the assistant will **not** send (so don't build for them)

- Markdown pipe tables.
- ASCII / box-drawing tables.
- Chart images (PNG/SVG) inside the assistant text. Charts are XML only.
- Inline base64 image data URIs for charts.
- A separate `chart` or `table` SSE event type. Both arrive inside `content`.

If any of the above shows up, it's a regression in the system prompt - file a
bug rather than building a renderer for it.

---

## Existing SSE event types (reference, unchanged)

These are **not** part of the table/chart contract, but useful background for
the frontend implementer. Defined in
[core/sse_schemas.py](../core/sse_schemas.py).

| Event           | Carries                                              |
|-----------------|------------------------------------------------------|
| `content`       | Streamed assistant text (this is where tables & charts live) |
| `image`         | Generated/attached image URLs (NOT used for charts anymore) |
| `tool_progress` | Progress updates while a tool runs                   |
| `tool_complete` | One-shot result summary when a tool finishes         |
| `message_saved` | Final saved message id                               |
| `done`          | End of stream                                        |
| `error`         | Stream error                                         |

The `image` event still exists and is still used for user-uploaded images and
for generated images that aren't charts - but the assistant no longer emits
charts as PNGs, so a chart should never arrive via `image`.

---

## Versioning

This contract is currently **v1** - the first cut after migrating away from
PNG charts. Additive changes (new chart types, new optional attributes) are
backward compatible. Renaming or repurposing existing tags/attributes
requires bumping to v2 and updating both the prompt and this doc together.
