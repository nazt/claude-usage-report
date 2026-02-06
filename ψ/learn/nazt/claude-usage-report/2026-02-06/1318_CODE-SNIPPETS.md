# Claude Usage Report - Code Snippets Analysis

**Project**: claude-usage-report
**Date**: 2026-02-06
**Description**: OLED dark-mode dashboard generator for Claude Code usage statistics
**Main File**: `/Users/nat/sandbox/claude-usage-report/generate.mjs`

---

## Entry Point & Architecture

The project is a Node.js CLI tool (ESM module) that reads Claude usage statistics and generates beautiful HTML dashboards with usage metrics and prompts export.

### Main Entry Point (Lines 1-6)
```javascript
#!/usr/bin/env node
/**
 * Claude Usage Report Generator
 * Reads ~/.claude/stats-cache.json + session data → generates HTML dashboard + prompts dump
 * Usage: node generate.mjs [--push]
 */
```

**Pattern**: Shebang makes the file directly executable, clear JSDoc describes the data flow and CLI usage.

---

## Data Loading Pattern

### Configuration & Paths (Lines 13-16)
```javascript
const CLAUDE_DIR = join(homedir(), '.claude');
const STATS_FILE = join(CLAUDE_DIR, 'stats-cache.json');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');
const OUT_DIR = process.cwd();
```

**Pattern**: Centralized path configuration using `path.join()` for cross-platform compatibility. Separates source and output directories.

### Session Data Aggregation (Lines 117-132)
```javascript
function loadAllSessions() {
  const all = [];
  if (!existsSync(PROJECTS_DIR)) return all;
  for (const dir of readdirSync(PROJECTS_DIR)) {
    const indexFile = join(PROJECTS_DIR, dir, 'sessions-index.json');
    if (!existsSync(indexFile)) continue;
    try {
      const idx = JSON.parse(readFileSync(indexFile, 'utf-8'));
      const projectName = dir.replace(/-/g, '/').replace(/^\//, '');
      for (const entry of (idx.entries || [])) {
        all.push({ ...entry, projectDir: dir, projectName });
      }
    } catch {}
  }
  return all.sort((a, b) => new Date(b.created) - new Date(a.created));
}
```

**Pattern**:
- Safe directory iteration with existence checks
- Graceful error handling with empty catch block
- Project name reconstruction from directory naming convention (replace hyphens with slashes)
- Spreads session metadata with additional enrichment fields
- Returns reverse-chronologically sorted data

---

## Metrics Computation

### Token Aggregation (Lines 30-40)
```javascript
const models = Object.entries(stats.modelUsage).map(([id, u]) => {
  const total = (u.inputTokens || 0) + (u.outputTokens || 0) +
    (u.cacheReadInputTokens || 0) + (u.cacheCreationInputTokens || 0);
  return { id, ...u, total };
}).sort((a, b) => b.total - a.total);

const totalTokens = models.reduce((s, m) => s + m.total, 0);
const totalInput = models.reduce((s, m) => s + (m.inputTokens || 0), 0);
const totalOutput = models.reduce((s, m) => s + (m.outputTokens || 0), 0);
const totalCacheRead = models.reduce((s, m) => s + (m.cacheReadInputTokens || 0), 0);
const totalCacheCreate = models.reduce((s, m) => s + (m.cacheCreationInputTokens || 0), 0);
```

**Pattern**:
- Destructuring to extract model ID and stats
- Optional chaining with defaults (`|| 0`) handles missing fields
- Computed total field added to each model object
- Sorted by total descending (top models first)
- Multiple reduce passes for different aggregation targets

### Cost Estimation Formula (Lines 42-43)
```javascript
// Cost estimate (Opus pricing: $15/M input, $75/M output, $1.50/M cache read, $3.75/M cache create)
const costEstimate = (totalInput * 15 + totalOutput * 75 + totalCacheRead * 1.5 + totalCacheCreate * 3.75) / 1_000_000;
```

**Pattern**:
- Pricing constants inline with explanatory comment
- Uses numeric separator (`1_000_000`) for readability
- Multiplies token counts by per-million rates then divides to get dollar amount

---

## Data Processing & Utilities

### Prompt Extraction (Lines 134-144)
```javascript
function extractPrompts(sessions) {
  return sessions
    .filter(s => s.firstPrompt)
    .map(s => ({
      date: s.created,
      prompt: s.firstPrompt.slice(0, 500),
      summary: s.summary || '',
      project: s.projectName || '',
      messages: s.messageCount || 0,
    }));
}
```

**Pattern**:
- Chainable filter + map for data transformation
- Truncates prompt to 500 chars for UI display
- Optional fields default to empty string or 0
- Structural transformation (renames and selects fields)

### Number Formatting Utilities (Lines 146-159)
```javascript
function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

function fmtMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function pct(part, whole) {
  return whole ? ((part / whole) * 100).toFixed(1) : '0';
}
```

**Pattern**:
- Magnitude-based formatting with exponential notation thresholds (1e9, 1e6, 1e3)
- Different decimal precision for different scales
- `toLocaleString()` for locale-aware number formatting (adds commas)
- Defensive percentage calculation (returns '0' if denominator is zero)

### Model Styling & Identification (Lines 161-178)
```javascript
function modelColor(id) {
  if (id.includes('opus-4-6')) return { bg: 'indigo', hex: '#6366f1' };
  if (id.includes('opus')) return { bg: 'violet', hex: '#8b5cf6' };
  if (id.includes('sonnet')) return { bg: 'emerald', hex: '#10b981' };
  if (id.includes('haiku')) return { bg: 'amber', hex: '#f59e0b' };
  if (id.includes('gemini')) return { bg: 'blue', hex: '#3b82f6' };
  if (id.includes('glm')) return { bg: 'rose', hex: '#f43f5e' };
  if (id.includes('gpt')) return { bg: 'teal', hex: '#14b8a6' };
  if (id.includes('grok')) return { bg: 'orange', hex: '#f97316' };
  return { bg: 'gray', hex: '#6b7280' };
}

function modelShortName(id) {
  return id
    .replace('claude-', '')
    .replace(/-202\d{5}$/, '')
    .replace(/-\d{8}$/, '');
}
```

**Pattern**:
- Guard clauses for model detection (prioritizes newer models first)
- Returns both Tailwind class name and hex color for flexibility
- Regex-based model name normalization (removes claude prefix and version dates)
- Fallback to gray for unknown models

### HTML Escaping (Lines 180-182)
```javascript
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

**Pattern**: Essential security function chaining for XSS prevention. Replaces all HTML special characters.

---

## HTML Generation - Template Approach

The codebase uses a **template-as-function pattern**: the `generateHTML()` function builds an entire HTML document as a JavaScript string with embedded CSS and Tailwind configuration.

### Dynamic Bar Chart Generation (Lines 189-204)
```javascript
const dailyBars = daily.map(d => {
  const h = Math.max((d.messageCount / maxDailyMsg) * 100, 1);
  const dt = new Date(d.date);
  const label = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const isTop5 = topDays.some(t => t.date === d.date);
  const gradient = isTop5 ? 'from-amber-600 to-amber-400' : 'from-violet-600 to-violet-400';
  const border = isTop5 ? 'border-amber-500/30' : 'border-white/10';
  return `<div class="bar-container flex flex-col items-center justify-end min-w-[14px] h-full relative group cursor-pointer">
    <div class="tooltip absolute bottom-full mb-2 bg-surface-2 border ${border} px-3 py-2 rounded-lg text-xs whitespace-nowrap z-20 shadow-xl">
      <div class="font-medium text-white">${label}</div>
      <div class="text-gray-400 font-mono">${d.messageCount.toLocaleString()} msgs</div>
      <div class="text-gray-500">${d.sessionCount} sessions</div>
    </div>
    <div class="bar w-3 rounded-t bg-gradient-to-t ${gradient}" style="height: ${h.toFixed(1)}%; min-height: 2px;"></div>
  </div>`;
}).join('\n');
```

**Pattern**:
- Pre-calculation of derived values before template string generation
- Normalized height scaling (percentage with 1px minimum to prevent invisible bars)
- Conditional styling based on data (highlighting top 5 days)
- Template literals with embedded calculations
- Chained `.join('\n')` for readable multi-line HTML output

### Model Distribution Bars (Lines 206-221)
```javascript
const modelRows = models.slice(0, 8).map(m => {
  const c = modelColor(m.id);
  const p = pct(m.total, totalTokens);
  return `<div>
    <div class="flex justify-between items-center mb-2">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-${c.bg}-500"></span>
        <span class="text-sm text-gray-300">${modelShortName(m.id)}</span>
      </div>
      <span class="font-mono text-sm text-${c.bg}-400">${fmt(m.total)} <span class="text-gray-600">(${p}%)</span></span>
    </div>
    <div class="h-1.5 bg-surface-3 rounded-full overflow-hidden">
      <div class="h-full bg-${c.bg}-500 rounded-full" style="width: ${p}%"></div>
    </div>
  </div>`;
}).join('\n');
```

**Pattern**:
- Slices top 8 models for display (performance and UI clarity)
- Reuses color utility function for consistent styling
- Dynamic Tailwind classes (e.g., `bg-${c.bg}-500`) - relies on Tailwind's class generation
- Nested percentage bars with background and fill layers

### Tailwind Configuration in HTML (Lines 257-274)
```javascript
tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF',
        secondary: '#3B82F6',
        accent: '#F59E0B',
        surface: '#0a0a0f',
        'surface-2': '#111118',
        'surface-3': '#1a1a24',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    }
  }
}
```

**Pattern**: Embedded Tailwind configuration via CDN script tag. Custom theme colors and fonts defined inline.

### Custom CSS Glassomorphism & Glows (Lines 276-295)
```javascript
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
  body { font-family: 'Inter', system-ui, sans-serif; background: #000; }
  .font-mono { font-family: 'JetBrains Mono', monospace; }
  .oled-bg { background: radial-gradient(ellipse at top, #0d1117 0%, #000 50%); }
  .glass { background: rgba(17, 17, 24, 0.8); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.06); }
  .glass-highlight { background: linear-gradient(135deg, rgba(30, 64, 175, 0.15) 0%, rgba(59, 130, 246, 0.08) 100%); border: 1px solid rgba(59, 130, 246, 0.2); }
  .glow-blue { box-shadow: 0 0 60px rgba(59, 130, 246, 0.15); }
  .glow-green { box-shadow: 0 0 60px rgba(16, 185, 129, 0.15); }
  .text-glow-blue { text-shadow: 0 0 20px rgba(59, 130, 246, 0.5); }
  .text-glow-amber { text-shadow: 0 0 20px rgba(245, 158, 11, 0.5); }
  .stat-card { transition: all 0.2s ease; }
  .stat-card:hover { transform: translateY(-2px); border-color: rgba(59, 130, 246, 0.3); }
  .bar { transition: height 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
  .tooltip { opacity: 0; transition: opacity 0.15s ease; pointer-events: none; }
  .bar-container:hover .tooltip { opacity: 1; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
</style>
```

**Pattern**:
- Glassomorphism effect using `backdrop-filter: blur()` with semi-transparent backgrounds
- OLED-optimized radial gradient background (darker at edges)
- Text glows using `text-shadow` with blur effect
- Tooltip appearance/disappearance via group hover states
- Custom scrollbar styling for design consistency
- Smooth transitions using cubic-bezier timing functions

---

## Hero Stats Section (Lines 310-332)

```javascript
<div class="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
  <div class="glass stat-card rounded-2xl p-5">
    <div class="text-xs text-gray-500 uppercase tracking-wider mb-2">Total Tokens</div>
    <div class="text-2xl sm:text-3xl font-bold font-mono text-glow-blue text-secondary">${fmt(totalTokens)}</div>
  </div>
  <!-- ... more cards ... -->
  <div class="glass stat-card rounded-2xl p-5">
    <div class="text-xs text-gray-500 uppercase tracking-wider mb-2">API Est.</div>
    <div class="text-2xl sm:text-3xl font-bold font-mono text-glow-amber text-accent">${fmtMoney(costEstimate)}</div>
    <div class="text-xs text-gray-600 mt-1">if paid per-token</div>
  </div>
</div>
```

**Pattern**:
- Responsive grid (2 cols on mobile, 5 cols on desktop)
- Consistent card styling with glass effect
- Hierarchy through text sizing and colors
- Helper function calls for formatting display values
- Secondary text for context

---

## Token Breakdown Visualization (Lines 339-390)

```javascript
<div class="glass rounded-2xl p-6">
  <h2 class="text-lg font-semibold mb-6">Token Breakdown</h2>
  <div class="space-y-5">
    <div>
      <div class="flex justify-between items-center mb-2">
        <span class="text-sm text-gray-400">Input (new)</span>
        <span class="font-mono text-sm text-blue-400">${fmt(totalInput)}</span>
      </div>
      <div class="h-2 bg-surface-3 rounded-full overflow-hidden">
        <div class="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full" style="width: ${pct(totalInput, totalTokens)}%"></div>
      </div>
    </div>
    <!-- ... cache read and cache creation bars ... -->
  </div>
  <div class="mt-6 p-4 bg-surface-3/50 rounded-xl border border-white/5">
    <div class="flex items-center justify-between">
      <div>
        <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">New tokens (input + output)</div>
        <div class="text-2xl font-bold font-mono text-white">${fmt(totalInput + totalOutput)}</div>
      </div>
      <div class="text-right text-xs text-gray-600">
        <div>Input ${fmt(totalInput)}</div>
        <div>+ Output ${fmt(totalOutput)}</div>
      </div>
    </div>
  </div>
</div>
```

**Pattern**:
- Stacked labeled bars with color-coded gradients
- Label/value pairs with vertical centering
- Dynamic width calculated from percentage function
- Summary box showing combined calculation with breakdown explanation

---

## Prompts Dump HTML Generation (Lines 470-550)

```javascript
function generatePromptsHTML() {
  const rows = prompts.map(p => {
    const dt = new Date(p.date);
    const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const project = p.project.split('/').slice(-2).join('/');
    return `<tr class="border-b border-white/5 hover:bg-white/[0.02]">
      <td class="py-3 px-4 text-xs text-gray-500 font-mono whitespace-nowrap">${dateStr}</td>
      <td class="py-3 px-4 text-xs text-violet-400 font-mono whitespace-nowrap max-w-[150px] truncate">${escapeHtml(project)}</td>
      <td class="py-3 px-4 text-sm text-gray-300">${escapeHtml(p.prompt)}</td>
      <td class="py-3 px-4 text-xs text-gray-500 max-w-[200px] truncate">${escapeHtml(p.summary)}</td>
      <td class="py-3 px-4 text-xs text-gray-600 font-mono text-right">${p.messages}</td>
    </tr>`;
  }).join('\n');

  // ... HTML template with embedded JavaScript search filter ...
  <script>
    const search = document.getElementById('search');
    const rows = document.querySelectorAll('#prompts-table tbody tr');
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      rows.forEach(r => {
        r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  </script>
```

**Pattern**:
- Table row generation from data mapping
- Project name extraction (takes last 2 path segments)
- Security: all user content escaped with `escapeHtml()`
- Embedded client-side search using event listeners
- Text-based filtering via `.textContent.toLowerCase()`

---

## Data Export (Lines 89-105)

```javascript
// Write raw data as JSON for programmatic access
writeFileSync(join(OUT_DIR, 'data.json'), JSON.stringify({
  generated,
  totalTokens, totalInput, totalOutput, totalCacheRead, totalCacheCreate,
  costEstimate,
  totalMessages, totalSessions, totalToolCalls,
  dayCount, avgMessagesPerDay,
  models: models.map(m => ({ id: m.id, total: m.total, input: m.inputTokens, output: m.outputTokens, cacheRead: m.cacheReadInputTokens, cacheCreate: m.cacheCreationInputTokens })),
  daily,
  hourCounts,
  peakDay,
  topDays,
}, null, 2));

writeFileSync(join(OUT_DIR, 'prompts.json'), JSON.stringify(prompts, null, 2));
```

**Pattern**:
- Data export with computed metrics
- Models array with fields renamed for clarity (e.g., `cacheRead` instead of `cacheReadInputTokens`)
- Pretty-printed JSON with 2-space indentation
- Separates raw data export from HTML

---

## Git Integration (Lines 109-113)

```javascript
if (process.argv.includes('--push')) {
  console.log('🚀 Pushing to GitHub...');
  execSync('git add -A && git commit -m "update: ' + stats.lastComputedDate + '" && git push', { stdio: 'inherit' });
  console.log('✅ Pushed!');
}
```

**Pattern**:
- Conditional CLI flag checking via `process.argv`
- `execSync` for shell command execution
- `stdio: 'inherit'` streams output directly to terminal
- Auto-generated commit message from data timestamp

---

## Key Architectural Patterns

### 1. **Separation of Concerns**
- Data loading (sessions, stats)
- Metrics computation (aggregation, cost calculation)
- Formatting (numbers, dates, HTML escaping)
- Presentation (HTML templates)
- Export (JSON files)

### 2. **Composition Over Complexity**
- Small, focused utility functions (fmt, pct, modelColor)
- Reusable across both main dashboard and prompts page
- Template generation is single-responsibility

### 3. **Defensive Programming**
- Optional chaining with `|| 0` defaults
- Existence checks before file operations
- Empty catch blocks for graceful degradation
- HTML escaping for security

### 4. **Template-as-Function Pattern**
- Entire HTML generated in single function
- Pre-computed values injected into template strings
- Combines JavaScript logic with HTML generation seamlessly

### 5. **Data Transformation Pipeline**
```
Load → Normalize → Aggregate → Format → Export & Render
```

### 6. **Dynamic Styling with Tailwind**
- Leverages Tailwind CDN for quick deployment
- Custom design tokens in config
- Dynamic class generation for model-specific colors
- Fallback styling for unknown models

---

## Example Data Structure (data.json excerpt)

```json
{
  "generated": "2026-02-06T05:58:20.201Z",
  "totalTokens": 15027925074,
  "models": [
    {
      "id": "claude-opus-4-5-20251101",
      "total": 14273028666,
      "input": 4604493,
      "output": 10104397,
      "cacheRead": 13469407056,
      "cacheCreate": 788912720
    }
  ],
  "daily": [
    {
      "date": "2026-01-21",
      "messageCount": 27751,
      "sessionCount": 50,
      "toolCallCount": 2248
    }
  ]
}
```

---

## Summary

The **claude-usage-report** is a well-structured CLI tool that demonstrates:

1. **Idiomatic JavaScript**: Effective use of map/filter/reduce, destructuring, optional chaining
2. **Template-driven Design**: HTML generation as first-class concern with pre-computed values
3. **Security**: XSS prevention through HTML escaping
4. **UX Focus**: Glassomorphism, responsive design, dynamic visualizations
5. **Data Pipeline**: Clean transformation from raw stats to rich visualizations
6. **Extensibility**: Easy to add new metrics, models, or visualizations through modular functions
