# Claude Usage Report - Architecture Document

**Generated:** 2026-02-06
**Project:** claude-usage-report
**Scope:** Full codebase analysis, data flow, and system design

---

## Executive Summary

Claude Usage Report is a **Node.js-based data visualization pipeline** that transforms Claude Code's internal usage statistics (`~/.claude/stats-cache.json`) into a beautiful OLED dark-mode HTML dashboard. It operates as a **command-line tool** that reads from the user's home directory, computes metrics, and generates multiple output formats (HTML dashboards + JSON data exports).

**Philosophy:** Single-purpose, high-performance reporting with zero external dependencies beyond Node.js standard library + Tailwind CSS CDN.

---

## Directory Structure & Organization

```
/claude-usage-report/
├── generate.mjs                 # Main entry point (Node.js ESM)
├── index.html                   # Generated dashboard (output artifact)
├── data.json                    # Computed metrics export (output artifact)
├── README.md                    # User documentation
├── .gitignore                   # Excludes nothing (all committed)
├── .git/                        # Git repository
└── ψ/
    └── learn/
        └── .origins             # Oracle knowledge system marker
```

**Key Design Principle:** Minimal structure - this is intentionally a **monolithic file** project. All logic lives in `generate.mjs`. No separation of concerns by file; instead, concerns are clearly demarcated by comments (e.g., `// ── Load Data ──`).

---

## Entry Points

### 1. **CLI: `node generate.mjs`** (Primary)
- **Location:** `/Users/nat/sandbox/claude-usage-report/generate.mjs`
- **Purpose:** Generate report, write artifacts
- **Execution Flow:**
  ```
  node generate.mjs [--push]
  ```
- **Exit Code:** 0 on success, non-zero on error
- **Optional Flag:** `--push` triggers git commit + push after generation

### 2. **CLI: `node generate.mjs --push`** (Deployment)
- Same as primary, but additionally:
  - Stages all changes: `git add -A`
  - Creates commit: `git commit -m "update: {lastComputedDate}"`
  - Pushes to remote: `git push`

### 3. **Manual Browser Access**
- `index.html` - Main dashboard (self-contained)
- `prompts.html` - Secondary view (generated on-demand)
- Both are fully self-contained; no server required

---

## Core Abstractions & Relationships

### Layer 1: Data Loading

**Responsibility:** Read source data from filesystem

```javascript
// Input Source: ~/.claude/stats-cache.json
const stats = JSON.parse(readFileSync(STATS_FILE, 'utf-8'));

// Input Source: ~/.claude/projects/*/sessions-index.json
const sessions = loadAllSessions();
```

**Data Model (stats-cache.json):**
```typescript
{
  modelUsage: {
    [modelId: string]: {
      inputTokens: number,
      outputTokens: number,
      cacheReadInputTokens: number,
      cacheCreationInputTokens: number
    }
  },
  dailyActivity: Array<{
    date: string,           // ISO date
    messageCount: number,
    sessionCount: number,
    toolCallCount: number
  }>,
  hourCounts: Record<number, number>,   // 0-23 hours
  dailyModelTokens: Array<...>,
  totalSessions: number,
  totalMessages: number,
  lastComputedDate: string,
  firstSessionDate: string
}
```

**Data Model (sessions-index.json per project):**
```typescript
{
  entries: Array<{
    created: string,           // ISO timestamp
    summary: string,           // Session title
    firstPrompt: string,       // First user message (truncated to 500 chars)
    messageCount: number,
    projectDir: string,        // Injected by loader
    projectName: string        // Normalized from projectDir
  }>
}
```

### Layer 2: Metric Computation

**Responsibility:** Transform raw data into presentation metrics

**Key Computations:**
```javascript
// Model aggregation: sum across model usage
const models = Object.entries(stats.modelUsage).map(([id, u]) => {
  const total = (u.inputTokens || 0) + (u.outputTokens || 0) +
    (u.cacheReadInputTokens || 0) + (u.cacheCreationInputTokens || 0);
  return { id, ...u, total };
}).sort((a, b) => b.total - a.total);

// Cost estimation (Opus pricing model)
const costEstimate =
  (totalInput * 15 +           // $15 per million input tokens
   totalOutput * 75 +          // $75 per million output tokens
   totalCacheRead * 1.5 +      // $1.50 per million cache read tokens
   totalCacheCreate * 3.75) /  // $3.75 per million cache creation tokens
  1_000_000;

// Peak identification
const peakDay = daily.reduce((max, d) =>
  d.messageCount > max.messageCount ? d : max, daily[0]);

// Top N extraction
const topDays = [...daily]
  .sort((a, b) => b.messageCount - a.messageCount)
  .slice(0, 5);
```

**Computed Metrics (exported in data.json):**
- totalTokens, totalInput, totalOutput, totalCacheRead, totalCacheCreate
- costEstimate
- totalMessages, totalSessions, totalToolCalls
- dayCount, avgMessagesPerDay
- models (sorted by total tokens)
- daily (original time-series)
- hourCounts (activity distribution)
- peakDay, topDays

### Layer 3: HTML Generation

**Responsibility:** Template data into interactive HTML dashboards

**Outputs Generated:**
1. **index.html** - Main dashboard
2. **prompts.html** - Searchable session prompts table

**Template Structure:**
```html
<!-- Tailwind CSS CDN (no build step) -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Custom CSS variables + glassmorphism effects -->
<style>
  .oled-bg { /* Radial gradient with pure black */}
  .glass { /* Glassmorphism with backdrop blur */}
  .glow-* { /* Neon glow effects */}
</style>

<!-- Dynamic HTML string templates (no virtual DOM) -->
<!-- Injected into template at generation time -->
```

**HTML Sections:**
1. **Header** - Title + date range + links
2. **Hero Stats** - 5 key metrics in glass cards
3. **Token Breakdown** - 4 progress bars (input/output/cache-read/cache-create)
4. **Model Distribution** - Top 8 models with bars
5. **Daily Activity Chart** - Bar chart with hover tooltips
6. **Top Days** - Ranked list with medals
7. **Activity by Hour** - 24-hour bar chart
8. **Value Analysis** - Cost vs. subscription multiplier
9. **Footer** - Generation timestamp

**CSS Design Patterns:**
- **OLED Dark Mode:** Pure black background with minimal colors
- **Glassmorphism:** Frosted glass cards with backdrop blur
- **Neon Accents:** Glowing text shadows and box shadows
- **Responsive Grid:** 2 cols mobile → 5 cols desktop
- **Smooth Animations:** Transitions on bars, cards, tooltips

### Layer 4: Prompt Extraction & Secondary Visualization

**Responsibility:** Convert session data to searchable table

**Extraction Logic:**
```javascript
function extractPrompts(sessions) {
  return sessions
    .filter(s => s.firstPrompt)
    .map(s => ({
      date: s.created,
      prompt: s.firstPrompt.slice(0, 500),  // Truncate
      summary: s.summary || '',
      project: s.projectName || '',
      messages: s.messageCount || 0,
    }));
}
```

**prompts.html Features:**
- Searchable table (client-side input filtering)
- Date, project, prompt text, summary, message count columns
- Responsive overflow with sticky header
- Same OLED aesthetic as main dashboard

---

## Data Flow: ~/.claude/ → HTML Report

### Source System: Claude Code
**Location:** `~/.claude/`

Claude Code (the CLI) maintains two sources:
1. **stats-cache.json** - Aggregated usage metrics (updated periodically)
2. **projects/{project}/sessions-index.json** - Per-project session metadata (append-only)

### Pipeline: Extract → Compute → Generate

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: LOAD                                                     │
│ • Read ~/.claude/stats-cache.json                               │
│ • Read ~/.claude/projects/*/sessions-index.json                 │
│ • Parse JSON, merge metadata                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ Step 2: COMPUTE                                                  │
│ • Aggregate model usage across all models                       │
│ • Calculate cost estimate (Opus pricing)                        │
│ • Derive peak days, top days, hour distribution                 │
│ • Sort & rank models by total tokens                            │
│ • Extract prompts (truncated to 500 chars)                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ Step 3: GENERATE                                                 │
│ • Render HTML templates (string concatenation)                  │
│ • Inject Tailwind CDN + custom CSS                              │
│ • Generate bar charts via inline SVG/CSS                        │
│ • Create responsive grid layouts                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ Step 4: EXPORT                                                   │
│ • Write index.html (main dashboard)                             │
│ • Write prompts.html (searchable table)                         │
│ • Write data.json (computed metrics)                            │
│ • Write prompts.json (raw prompt data)                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ Step 5: PUSH (optional --push flag)                             │
│ • git add -A                                                     │
│ • git commit -m "update: {lastComputedDate}"                   │
│ • git push                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Data Transformation Example

**Input (stats-cache.json):**
```json
{
  "modelUsage": {
    "claude-opus-4-5-20251101": {
      "inputTokens": 4604493,
      "outputTokens": 10104397,
      "cacheReadInputTokens": 13469407056,
      "cacheCreationInputTokens": 788912720
    }
  },
  "dailyActivity": [
    {"date": "2026-01-01", "messageCount": 23577, "sessionCount": 1294, "toolCallCount": 3846}
  ]
}
```

**Processing:**
```javascript
// Model aggregation
const total = 4604493 + 10104397 + 13469407056 + 788912720
           = 14273028666  // Becomes "14.27B" in display

// Cost calculation
costEstimate = (4604493 * 15 + 10104397 * 75 + 13469407056 * 1.5 + 788912720 * 3.75) / 1_000_000
             ≈ $25,465.22

// Daily peak
peakDay = {date: "2026-01-21", messageCount: 27751, ...}
```

**Output (data.json):**
```json
{
  "totalTokens": 15027925074,
  "costEstimate": 25465.21700625,
  "models": [
    {"id": "claude-opus-4-5-20251101", "total": 14273028666, ...}
  ]
}
```

**Rendered HTML:**
```html
<div class="text-2xl font-bold">15.03B</div>  <!-- fmt(15027925074) -->
<div class="font-mono text-accent">$25,465</div>  <!-- fmtMoney(25465) -->
```

---

## Dependencies

### Direct Runtime Dependencies
**None** - The project uses only Node.js built-in modules:
- `fs` - File I/O
- `path` - Path manipulation
- `os` - Home directory resolution (`homedir()`)
- `child_process` - Git execution (`execSync`)

### External Dependencies
- **Tailwind CSS** - Loaded via CDN in generated HTML (no build step)
- **Fonts** - Google Fonts (Inter, JetBrains Mono) loaded via CDN

### Transitive Patterns (Not Code Dependencies)
The project reads from:
- **~/.claude/stats-cache.json** - Claude Code's internal cache
- **~/.claude/projects/*/sessions-index.json** - Per-project session indexes

---

## Key Design Patterns

### 1. **Monolithic Module**
All logic in single file (`generate.mjs`). Organized by phase comments, not modules.

**Rationale:**
- Single report generator doesn't need module boundaries
- Easier to understand full flow in one read
- No circular dependency risks

### 2. **String Template Generation (No Virtual DOM)**
HTML built via string concatenation, not React/Vue/JSX.

**Rationale:**
- No runtime overhead
- HTML is static (computed once per run)
- Tooling-free: no build step, no transpilation
- Self-contained output files

### 3. **Immutable Rendering**
All metrics computed once per run, then templated into HTML.

**Rationale:**
- No dynamic re-computation (no server runtime)
- Dashboard is a static snapshot
- Users can view offline after generation

### 4. **Color Coding by Model Type**
```javascript
function modelColor(id) {
  if (id.includes('opus-4-6')) return { bg: 'indigo', hex: '#6366f1' };
  if (id.includes('opus')) return { bg: 'violet', hex: '#8b5cf6' };
  if (id.includes('sonnet')) return { bg: 'emerald', hex: '#10b981' };
  // ...
}
```

**Rationale:**
- Visual pattern recognition
- Consistent branding per model family
- No lookup table needed (pattern matching)

### 5. **Pricing as Configuration**
```javascript
// Cost estimate (Opus pricing: $15/M input, $75/M output, ...)
const costEstimate = (totalInput * 15 + ...) / 1_000_000;
```

**Rationale:**
- Hardcoded but clearly visible
- Easy to audit and update
- Reflects current Claude API pricing

### 6. **Append-Only Session Indexes**
Projects store sessions in `sessions-index.json`, not individual files.

**Rationale:**
- Single source of truth per project
- No file sprawl
- Compatible with Oracle/shadow philosophy (nothing deleted)

---

## Core Functions & Responsibilities

| Function | Location | Purpose |
|----------|----------|---------|
| `loadAllSessions()` | Lines 117-132 | Scan ~/.claude/projects, parse all session-index.json files, merge with project metadata |
| `extractPrompts()` | Lines 134-144 | Filter sessions with prompts, truncate to 500 chars, reshape for table |
| `fmt()` | Lines 146-151 | Format numbers as B/M/K abbreviations (e.g., 15.03B) |
| `fmtMoney()` | Lines 153-155 | Format currency with locale thousands separator |
| `pct()` | Lines 157-159 | Calculate percentage for progress bars |
| `modelColor()` | Lines 161-171 | Map model ID to color scheme (indigo/violet/emerald/amber/etc) |
| `modelShortName()` | Lines 173-178 | Normalize model IDs for display (remove claude-, dates) |
| `escapeHtml()` | Lines 180-182 | Sanitize strings for HTML (prevent injection) |
| `generateHTML()` | Lines 186-466 | Render main dashboard with all charts/cards |
| `generatePromptsHTML()` | Lines 470-550 | Render searchable prompts table |

---

## Generation Process (Detailed Flow)

**Lines 20-26: Load Phase**
```javascript
const stats = JSON.parse(readFileSync(STATS_FILE, 'utf-8'));
const sessions = loadAllSessions();
```
Reads two sources from user home directory.

**Lines 30-63: Compute Phase**
```javascript
const models = Object.entries(stats.modelUsage).map(...).sort(...);
const totalTokens = models.reduce((s, m) => s + m.total, 0);
const costEstimate = (...) / 1_000_000;
const peakDay = daily.reduce((max, d) => ...);
const topDays = [...daily].sort(...).slice(0, 5);
```
Transform raw data into presentation-ready metrics.

**Lines 67-69: Extract Phase**
```javascript
const prompts = extractPrompts(sessions);
```
Convert sessions into searchable prompt list.

**Lines 73-105: Generate & Write Phase**
```javascript
const html = generateHTML();
writeFileSync(join(OUT_DIR, 'index.html'), html);
writeFileSync(join(OUT_DIR, 'data.json'), JSON.stringify({...}));
writeFileSync(join(OUT_DIR, 'prompts.html'), generatePromptsHTML());
writeFileSync(join(OUT_DIR, 'prompts.json'), JSON.stringify(prompts));
```
Create all output artifacts.

**Lines 109-112: Deploy Phase (optional)**
```javascript
if (process.argv.includes('--push')) {
  execSync('git add -A && git commit -m "update: ..." && git push');
}
```
Commit and push if flag provided.

---

## Observations & Patterns

### 1. **Error Handling Strategy**
- No try-catch blocks in main flow
- Assumes all inputs are well-formed
- Silently ignores parse errors in `loadAllSessions()` (line 129: `catch {}`)

**Implication:** Robust for happy path, crashes on missing ~/.claude/stats-cache.json

### 2. **Performance Characteristics**
- Single pass through all data (no re-sorting)
- Top 5 days computed via slice, not min-heap
- String concatenation for HTML (no builder pattern)

**Scale:** Optimized for <10k sessions (observed: 5612 sessions, handles well)

### 3. **Visual Hierarchy**
- Hero stats (5 cards) → Grid sections → Bottom cards
- Focus on top models (showing first 8 only)
- Highlights top 5 days in daily activity chart

### 4. **Time Handling**
- Dates stored as ISO strings (e.g., "2025-12-05")
- Hours stored as 0-23 integers
- Display formatting done at render time (no normalization)

### 5. **Accessibility**
- No aria labels
- Relies on color coding (problematic for colorblind)
- No keyboard navigation (dashboard is static)

---

## Output Artifacts

### 1. **index.html**
- **Size:** ~49KB (observed)
- **Format:** Self-contained HTML + inline CSS + Tailwind CDN
- **Interactivity:** Hover tooltips on bars, static content
- **Browser Compatibility:** Modern browsers (ES6, CSS Grid, backdrop-filter)

### 2. **prompts.html**
- **Size:** Generated based on session count
- **Features:** Client-side search filter (JavaScript in <script> tag)
- **Data:** Embedded directly in HTML (no API calls)

### 3. **data.json**
- **Schema:** Computed metrics + original daily/hourCounts arrays
- **Use Case:** Programmatic access, data export, downstream tools
- **Example Size:** ~8KB (observed)

### 4. **prompts.json**
- **Schema:** Array of {date, prompt, summary, project, messages}
- **Use Case:** Analysis, log analysis, archival

---

## Extension Points

### Future Customization
1. **Pricing Model:** Modify costs in `generateHTML()` (line 43)
2. **Color Scheme:** Update `modelColor()` function
3. **Additional Charts:** Add new sections to `generateHTML()` template
4. **Export Formats:** Add new writers after line 104
5. **Filtering:** Extend `loadAllSessions()` to support date ranges

### Known Limitations
- No caching (always recomputes from scratch)
- No incremental updates
- No filtering/date range selection
- No dark/light mode toggle
- No mobile optimization for very large charts

---

## Integration with Oracle/Shadow Philosophy

**Project Alignment:**
1. **Nothing is Deleted** - Sessions stored in append-only indexes, never modified
2. **Patterns Over Intentions** - Reports generated from observed usage data, not predicted
3. **External Brain** - HTML dashboard serves as external memory of usage patterns

**Implication for Evolution:**
- Adding new metrics doesn't require removing old ones (backward compatible)
- Historical data preserved in data.json exports
- Generation is idempotent (running twice produces identical output)

---

## Summary

Claude Usage Report is a **lean, purposeful data pipeline** that:
- Reads internal Claude Code statistics from ~/.claude/
- Computes high-level metrics and identities (peak days, model distribution, cost)
- Renders beautiful OLED dark-mode HTML dashboards
- Exports both human-readable HTML and machine-readable JSON
- Optionally commits and pushes results to GitHub

**Core Strength:** Single-file, dependency-free, self-contained generation process
**Core Limitation:** Static snapshots (no real-time updates or dynamic queries)
**Design Philosophy:** Simplicity over modularity, CDN over build tools, templates over frameworks
