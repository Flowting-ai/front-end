# Compare Models — Component Spec Sheet

**Product:** Souvenir AI · **Feature:** Compare Models  
**File:** Kaya Design System · **Page:** Compare Models  
**Prepared for:** Front-end Engineering  
**Design system:** Kaya · **Token prefix:** `--neutral`, `--green`, `--blue`, `--brand`

---

## Design Tokens Reference

| Token | Value | Usage |
|---|---|---|
| `--neutral/900` | `#26211E` | Primary text |
| `--neutral/700` | `#524B47` | Secondary text, company name |
| `--neutral/500` | `#827A74` | Description / tertiary text |
| `--neutral/100` | `#EDE1D7` | Card border, surface |
| `--neutral/white` | `#FFFFFF` | Card background |
| `--brand/blue` | `#0D6EB2` | Brand blue, selected state, badges |
| `--green/50` | `#F7FEE6` | Green badge background |
| `--green/800` | `#456211` | Green badge text |
| `--brown/100` | `#E6D5CA` | Brown (Starter) badge background |
| `--brown/700` | `#683D1B` | Brown badge text |
| `--red/100` | `#FFBFB6` | Red badge background |
| `--red/700` | `#7A201C` | Red badge text |

---

## 1. Model Card

**Component set:** `Model Card`  
**Figma node:** `3359:4209`  
**Type:** COMPONENT_SET (2 variants)  
**Variants:** `State=Default`, `State=Selected`

### Anatomy

```
┌─────────────────────────────────────────┐  ← border: 1px solid #EDE1D7
│ ┌──────┐  OpenAI / GPT-5 mini           │     border-radius: 16px
│ │ Icon │  OpenAI              ← company  │     background: #FFFFFF
│ └──────┘                                │     shadow: 0 2px 2.8px rgba(82,75,71,0.12)
│                                         │     padding: 12px 12px 16px
│ GPT-5 Mini is a compact version of...  │  ← 3-line truncated description
│                                         │
│ [Starter] [128k ctx]   [Best reasoning] │  ← badge row: left group + right badge
└─────────────────────────────────────────┘
```

### Component Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `Model Name` | TEXT | `GPT-5 mini` | Full model name displayed in header |
| `Company` | TEXT | `OpenAI` | Provider/company shown below model name |
| `Description` | TEXT | Long description string | 3-line truncated body text |
| `Tier Label` | TEXT | `Starter` | Left badge label (Brown badge) |
| `Context Label` | TEXT | `128k ctx` | Center badge label (Red badge) |
| `Feature Label` | TEXT | `Best reasoning model` | Right badge label (Green badge) |
| `Show Feature Badge` | BOOLEAN | `true` | Toggle visibility of the right Green badge |

### Exposed Nested Instances

| Instance | Exposed Props |
|---|---|
| `Tier Badge` (Brown) | `Chip label`, `Color` |
| `Context Badge` (Red) | `Chip label`, `Color` |
| `Feature Badge` (Green) | `Chip label`, `Color` |

### Layout & Spacing

| Property | Value |
|---|---|
| Width | `381px` (fixed) |
| Height | Hug contents |
| Padding | `12px 12px 16px 12px` |
| Gap (sections) | `8px` |
| Corner radius | `16px` |
| Border | `1px solid #EDE1D7` |
| Drop shadow | `0 2px 2.8px rgba(82,75,71,0.12)` |

#### Header row

| Property | Value |
|---|---|
| Layout | Horizontal, gap `12px`, align center |
| Icon Button | `44×44px`, padding `8px`, border-radius `10px` |
| Model Icon (inside) | `24×24px` |
| Model Name text | `14px / 500 / #26211E`, line-height `22px`, max 1 line, truncate |
| Company text | `11px / 600 / #524B47`, line-height `16px`, max 1 line, truncate |

#### Description

| Property | Value |
|---|---|
| Font | `11px / 400 / #827A74` |
| Line height | `16px` |
| Max lines | `3` |
| Truncation | `ENDING` |

#### Labels row

| Property | Value |
|---|---|
| Layout | Horizontal, `SPACE_BETWEEN`, gap `6px`, padding-top `8px` |
| Left group | Horizontal, gap `6px`, align center |

### Variant States

**State=Default**
- Background: `#FFFFFF`
- Border: `1px solid #EDE1D7`

**State=Selected**
- Background: `rgba(13, 110, 178, 0.05)`
- Border: `1.5px solid #0D6EB2`
- Checkmark circle: `18×18px`, `#0D6EB2` fill, `✓` white bold

### Icon Swap

The model icon (24×24) inside the Icon Button is a swappable instance. Select the `Model Icon` layer in the layers panel → click the component name in the right panel Design tab to swap to any brand icon from the `Brand/LLM Icons` set.

---

## 2. Selected Model Slot

**Component set:** `Selected Model Slot`  
**Figma node:** `3362:3045`  
**Type:** COMPONENT_SET (2 variants)  
**Variants:** `State=Filled`, `State=Empty`

### Anatomy

```
State=Filled:
┌──────────────────────────────────────┐
│ [Icon] OpenAI/GPT-5 mini         [×] │
└──────────────────────────────────────┘

State=Empty:
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│ [  ] Empty Slot 2                [×] │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

### Component Properties

| Property | Type | Default | Applies to |
|---|---|---|---|
| `State` | VARIANT | `Filled` | Switches between Filled ↔ Empty |
| `Model Name` | TEXT | `OpenAI/GPT-5 mini` | Filled — name text node |
| `Slot Label` | TEXT | `Empty Slot 2` | Empty — placeholder label text |
| `Visible` | BOOLEAN | `true` | Both — show/hide the slot entirely |

### Exposed Nested Instances

| Instance | Exposed Props |
|---|---|
| `Badge` (in Filled) | `Chip label`, `Color` |

### Layout & Spacing

| Property | Value |
|---|---|
| Width | `381px` (fixed) |
| Height | `40px` (fixed) |
| Padding | `12px` horizontal, `10px` vertical |
| Corner radius | `8px` |
| Gap | `12px` |

**State=Filled styles:**
- Background: `#FFFFFF`
- Border: `1px solid #EDE1D7`
- Shadow: `0 2px 2.8px rgba(82,75,71,0.12)`
- Model name: `12px / 500 / #26211E`, bold provider prefix

**State=Empty styles:**
- Background: transparent
- Border: `1px dashed rgba(156,147,139,1)` (`--neutral/400`)
- Icon placeholder: `44×44px`, dashed border `1px solid #B6ACA4`, border-radius `4px`

---

## 3. Model Output

**Component:** `Model Output`  
**Figma node:** `3376:1857`  
**Type:** COMPONENT (single, no variants)

### Anatomy

```
┌─────────────────────────────────────┐
│ [Icon] OpenAI/GPT-5 mini      [↗]  │  ← header
├─────────────────────────────────────┤
│ [✓ Use this model]                  │  ← CTA button
├─────────────────────────────────────┤
│                                     │
│ Response body text...               │  ← scrollable response area
│ (markdown rendered)                 │
│                                     │
├─────────────────────────────────────┤
│ [1.2s latency] [0.04 Credits]       │  ← stats badges row
└─────────────────────────────────────┘
```

### Component Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `Model Name` | TEXT | `OpenAI/GPT-5 mini` | Header model identifier — bold provider + model name |
| `Response Body` | TEXT | `Model response appears here...` | Full response content area |

### Exposed Nested Instances

| Instance | Exposed Props | Default value |
|---|---|---|
| `Latency Badge` (Neutral) | `Chip label`, `Color` | `1.2s latency` |
| `Credits Badge` (Neutral) | `Chip label`, `Color` | `0.04 Credits` |

### Layout & Spacing

| Property | Value |
|---|---|
| Width | Fixed (fills container) |
| Height | Fixed `664px` |
| Padding | `12px` |
| Gap | `10px` |
| Corner radius | `8px` |
| Background | `#FFFFFF` |
| Border | `1px solid #EDE1D7` |
| Shadow | `0 2px 2.8px rgba(82,75,71,0.12)` |

#### Header

| Property | Value |
|---|---|
| Layout | Horizontal, `SPACE_BETWEEN`, align center |
| Icon Button | `44×44px` |
| Model Name | `14px`, bold provider prefix + regular model name, 1-line truncate |
| Expand icon button | `28×28px`, border-radius `10px` |

#### Response Area

| Property | Value |
|---|---|
| Overflow | Clip / scroll |
| Text style | `11px / 400`, line-height `16px` |
| Max height | `504px` |
| Border radius | `20px` (inner container) |
| Border | top + bottom `1px solid #E5DAD0` |
| Padding | `10px` |

#### Stats Row

| Property | Value |
|---|---|
| Layout | Horizontal, align center, `SPACE_BETWEEN` |
| Badge style | Neutral (`#EDE1D7` bg, `#524B47` text) |
| Padding | `2px` vertical |

### "Use this model" Button

| Property | Value |
|---|---|
| Style | Dark gradient button (neutral 700 → 900) |
| Width | Fill container |
| Height | Hug |
| Border radius | `8px` |
| Text | `14px / 500 / #F7F2ED` |
| Text shadow | `0 0.364px 0.364px rgba(255,255,255,0.25), 0 -0.727px 0.364px rgba(0,0,0,0.25)` |

---

## 4. Model Output Expanded

**Component set:** `Model Output Expanded`  
**Figma node:** `3397:3167`  
**Type:** COMPONENT_SET (3 variants)  
**Variants:** `Selected Tab=1`, `Selected Tab=2`, `Selected Tab=3`

### Anatomy

```
┌──────────────────────────────────────────────────────────────────┐
│ [←]  [Icon] Tab 1 Name ╗  [Icon] Tab 2 Name  [Icon] Tab 3 Name  │  ← tab bar
│                         ╚═════════════════════════════════════════╡
│                                                                    │
│  Response body text for the active tab...                         │
│  (markdown rendered, scrollable)                                  │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│  [312 tokens] [0.04 Credits]      [Save Pin] [✓ Use this model]   │
└────────────────────────────────────────────────────────────────────┘
```

The active tab has a white elevated background with rounded top corners and bracket vectors on either side. Inactive tabs have the neutral background (`#EDE1D7`).

### Component Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `Selected Tab` | VARIANT | `1` | Controls which tab is active (1, 2, or 3) |
| `Tab 1 Model Name` | TEXT | `Anthropic/Claude Sonnet 4.6` | Text in the first tab header — bound across all 3 variants |
| `Tab 2 Model Name` | TEXT | `Anthropic/Claude Sonnet 4.6` | Text in the second tab header |
| `Tab 3 Model Name` | TEXT | `Anthropic/Claude Sonnet 4.6` | Text in the third tab header |
| `Response Body` | TEXT | Long response string | Active content area — bound across all 3 variants |

### Exposed Nested Instances (per variant)

| Instance | Exposed Props | Default |
|---|---|---|
| `Tokens Badge` (Neutral) | `Chip label`, `Color` | `312 tokens` |
| `Credits Badge` (Neutral) | `Chip label`, `Color` | `0.04 Credits` |

### Layout & Spacing

| Property | Value |
|---|---|
| Width | Full width of container |
| Corner radius | `8px` |
| Background | `#EDE1D7` (outer) / `#FFFFFF` (content panel) |

#### Tab Bar

| Property | Value |
|---|---|
| Height | ~`66px` |
| Background | `#EDE1D7` |
| Active tab bg | `#FFFFFF` |
| Tab corner radius | `8px` top-left, `8px` top-right |
| Tab gap | `6px` |
| Tab padding | `12px 12px 6px 12px` |
| Model icon | `44×44px` icon button |
| Tab name text | `14px`, bold provider prefix + regular model name |
| Bracket vectors | `8×8px` curve vector on each side of active tab |

#### Content Panel

| Property | Value |
|---|---|
| Background | `#FFFFFF` |
| Padding | `12px` |
| Gap | `12px` |
| Corner radius | `8px` top-left, `8px` top-right |
| Response area max-height | Fills available space |
| Response font | `11px / 400`, line-height `16px` |

#### Footer Bar

| Property | Value |
|---|---|
| Layout | Horizontal, `SPACE_BETWEEN`, gap `12px` |
| Left: badge group | Horizontal, gap `12px` |
| Save Pin button | Secondary style, `14px`, border-radius `8px` |
| Use this model button | Dark gradient style, `14px`, border-radius `8px` |

### Variant Behavior

The `Selected Tab` property controls which tab header renders with the white active state and which bracket vectors are shown. The response body and all three tab names update from the same component-level properties, meaning a single instance of this component can have all three model names and one shared response body at once.

---

## 5. Compare Model Chat Input

**Component set:** `Compare Model Chat Input`  
**Figma node:** `3407:3038`  
**Type:** COMPONENT_SET (2 variants)  
**Variants:** `Has Text=false`, `Has Text=true`

### Anatomy

```
Has Text=false (placeholder):
┌──────────────────────────────────────────────────────────┐
│  How can I help you today?                         [  ↑] │
└──────────────────────────────────────────────────────────┘

Has Text=true (active):
┌──────────────────────────────────────────────────────────┐
│  How do I make a landing page that converts?       [  ↑] │
└──────────────────────────────────────────────────────────┘
```

### Component Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `Has Text` | VARIANT | `false` | Switches between placeholder ↔ active state |
| `Placeholder Text` | TEXT | `How can I help you today?` | Shown when `Has Text=false` — muted grey |
| `Input Text` | TEXT | `How do I make a landing page that converts?` | Shown when `Has Text=true` — primary text color |

### Exposed Nested Instances

| Instance | Exposed Props | Purpose |
|---|---|---|
| `Icon Button` (both variants) | `Type`, `State`, `Size`, `Left Icon` | Override send button state (e.g. loading, disabled) without detaching |

### Layout & Spacing

| Property | Value |
|---|---|
| Width | Fill container |
| Height | Hug (max `336px` for text area) |
| Padding | `20px` |
| Gap | `24px` |
| Corner radius | `24px` |
| Background | `#FFFFFF` |
| Border | `1px solid rgba(59,54,50,0.1)` |
| Shadow | `0 2px 2.8px rgba(82,75,71,0.12)` |

#### Text Area

| Property | Value |
|---|---|
| Font (placeholder) | `16px / 400 / #6A625D` (`--neutral/600`) |
| Font (active) | `16px / 400 / #26211E` (`--neutral/900`) |
| Line height | `22px` (140%) |
| Font family | Geist Regular |
| Max height | `336px` |
| Overflow | Hidden / ellipsis |

#### Send Button (`Icon Button`)

| Property | Value |
|---|---|
| Size | `36px` |
| Type | Primary (dark gradient) |
| Border radius | `10px` |
| Padding | `7px 8px 9px` |
| Icon | `arrow-up`, `20×20px` |
| Background | Gradient: `#524B47` → `#26211E` |
| Border | `1px solid #000000` |

---

## Usage Notes

### When to use which component

| Component | Use when |
|---|---|
| **Model Card** | Displaying a model in the selection grid of the Compare modal |
| **Selected Model Slot** | Showing a chosen model (or empty slot) in the top tray of the Compare modal |
| **Model Output** | Rendering a single model's response in column-view Compare results |
| **Model Output Expanded** | Full-width expanded response view with tab-per-model navigation |
| **Compare Chat Input** | The shared prompt input at the bottom of any Compare results screen |

### State flow

```
Compare modal opens
  → Model Card grid (select up to 3)
    → Selected Model Slot (top tray updates)
      → "Test models" → Compare Results
        → Model Output × N (column layout) or
          Model Output Expanded (tab layout)
            → Compare Chat Input (shared prompt)
```

### Exposed Badge instances

All stats badges (`Latency`, `Tokens`, `Credits`) use the **Kaya Badge** component. When creating an instance of any output component, override the badge via the "nested instances" section in the right panel — no detach needed.

Available `Color` variants for badges:
- `Neutral` — `#EDE1D7` bg / `#524B47` text (default for stats)
- `Green` — `#F7FEE6` bg / `#456211` text (positive/highlight)
- `Brown` — `#E6D5CA` bg / `#683D1B` text (tier/plan)
- `Red` — `#FFBFB6` bg / `#7A201C` text (context/limit)
- `Blue` — `#CADCF1` bg / `#135487` text (info)

### Icon swap pattern

All model icon slots use instances from `Brand/LLM Icons` (293 standalone components). To swap:
1. Select the component instance on canvas
2. Expand layers → select `Model Icon`
3. In right panel Design tab → click the component name → swap to desired brand icon

This works on all 5 components. The icon is not exposed as a named property due to a Figma API constraint (icons are not in a COMPONENT_SET, so INSTANCE_SWAP property cannot reference them).

---

## Figma Links

| Component | Figma node |
|---|---|
| Model Card | [`3359:4209`](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=3359-4209) |
| Selected Model Slot | [`3362:3045`](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=3362-3045) |
| Model Output | [`3376:1857`](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=3376-1857) |
| Model Output Expanded | [`3397:3167`](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=3397-3167) |
| Compare Chat Input | [`3407:3038`](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=3407-3038) |
| Reference spec format | [`1036:1682`](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=1036-1682) |
