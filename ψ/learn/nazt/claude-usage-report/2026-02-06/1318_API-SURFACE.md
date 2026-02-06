# Claude Usage Report - API Surface & Integration Guide

## Overview

**Claude Usage Report** is a standalone Node.js script that transforms Claude Code usage statistics into an OLED dark-mode HTML dashboard with data exports. It reads from `~/.claude/stats-cache.json` (maintained by Claude Code) and generates multiple output formats.

**Repository**: [nazt/claude-usage-report](https://github.com/nazt/claude-usage-report)
**Status**: Standalone tool, no external API dependencies (except Tailwind CDN for styling)

---

## CLI Interface

### Invocation

```bash
node generate.mjs [OPTIONS]
```

### Options

| Option | Behavior |
|--------|----------|
| (none) | Generate `index.html`, `prompts.html`, `data.json`, `prompts.json` in current directory |
| `--push` | Generate files + automatically `git add`, `git commit`, and `git push` |

### Environment

- **Node.js**: Requires 18+ (uses ES modules, Promise-based file I/O)
- **Working Directory**: Generated files are written to `process.cwd()` (current working directory)
- **Input Source**: Always reads from `~/.claude/stats-cache.json` (user's home directory)
- **Git Support**: `--push` requires git initialized and configured

### Exit Behavior

- Logs progress to stdout (`console.log` with emoji prefixes)
- Does not define exit codes; process exits with code 0 on success
- Silently skips missing project directories (`try...catch` in session loader)

---

## Input Data Format: `stats-cache.json`

### File Location

```
~/.claude/stats-cache.json
```

### Schema

```json
{
  "version": 2,
  "lastComputedDate": "YYYY-MM-DD",
  "firstSessionDate": "YYYY-MM-DD",
  "totalSessions": number,
  "totalMessages": number,
  "dailyActivity": [
    {
      "date": "YYYY-MM-DD",
      "messageCount": number,
      "sessionCount": number,
      "toolCallCount": number
    }
  ],
  "modelUsage": {
    "model-id": {
      "inputTokens": number,
      "outputTokens": number,
      "cacheReadInputTokens": number,
      "cacheCreationInputTokens": number
    }
  },
  "hourCounts": {
    "0": number,
    "1": number,
    ...
    "23": number
  },
  "dailyModelTokens": [
    {
      "date": "YYYY-MM-DD",
      "modelUsage": { /* model breakdown */ }
    }
  ]
}
```

### Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `version` | number | Schema version (currently 2) |
| `lastComputedDate` | string | ISO date when stats were last computed |
| `firstSessionDate` | string | ISO date of earliest session (optional) |
| `totalSessions` | number | Lifetime total sessions |
| `totalMessages` | number | Lifetime total messages (fallback: sum of daily) |
| `dailyActivity` | array | Per-day activity breakdown |
| `dailyActivity[].date` | string | ISO date (YYYY-MM-DD) |
| `dailyActivity[].messageCount` | number | Messages sent on this day |
| `dailyActivity[].sessionCount` | number | Sessions created on this day |
| `dailyActivity[].toolCallCount` | number | Tool invocations on this day |
| `modelUsage` | object | Token counts keyed by model ID |
| `modelUsage[modelId].inputTokens` | number | New input tokens sent |
| `modelUsage[modelId].outputTokens` | number | Output tokens received |
| `modelUsage[modelId].cacheReadInputTokens` | number | Tokens from cache hits |
| `modelUsage[modelId].cacheCreationInputTokens` | number | Tokens used for cache creation |
| `hourCounts` | object | Distribution of messages by hour (0-23), keyed as strings |
| `dailyModelTokens` | array | Optional per-day model breakdown (not yet used) |

### Data Source

- Created and maintained automatically by Claude Code at `~/.claude/`
- Updated after each session
- Aggregates across all projects in `~/.claude/projects/*/sessions-index.json`

---

## Output Formats

### 1. HTML Dashboard: `index.html`

**Purpose**: Primary visualization, serves as live demo

**Sections**:
- **Hero Stats**: Total tokens, messages, sessions, tool calls, estimated API cost
- **Token Breakdown**: 4-part stacked visualization (input, output, cache read, cache create)
- **Model Distribution**: Top 8 models by token count with percentage bars
- **Daily Activity Chart**: Bar chart of messages per day (hoverable, highlights top 5)
- **Top Days**: Ranked leaderboard of busiest days
- **Activity by Hour**: 24-hour bar chart of message distribution
- **Value Analysis**: Cost vs. $200 Max plan, multiplier badge

**Technology Stack**:
- **Markup**: HTML5 semantic
- **Styling**: Tailwind CSS CDN (v4.x) + custom OLED/glassmorphism CSS
- **Fonts**: Inter (sans), JetBrains Mono (monospace) via Google Fonts
- **Interactivity**: Hover tooltips on bars (CSS-based, no JS framework)
- **Colors**: OLED-optimized dark palette (#000, #0a0a0f, etc.)

**Size**: ~50KB (full HTML with inline styles)

**Accessibility**:
- Semantic HTML structure
- Color contrast WCAG AA compliant (on dark OLED)
- Responsive design (2-5 columns based on screen size)

### 2. Prompts Table: `prompts.html`

**Purpose**: Detailed archive of all session opening prompts

**Content**:
- Searchable table of first prompts from each session
- Columns: Date, Project, Prompt (500 char excerpt), Summary, Message Count
- Client-side search filter (plain JavaScript, no framework)

**Technology Stack**:
- Same as `index.html` (Tailwind, fonts, OLED theme)
- Vanilla JS search with `input` event listener
- Simple table layout optimized for readability

**Size**: ~20-30KB (depends on prompt count)

### 3. Computed Metrics: `data.json`

**Purpose**: Machine-readable dataset for further analysis, dashboards, or imports

**Schema**:

```json
{
  "generated": "ISO-8601 timestamp",
  "totalTokens": number,
  "totalInput": number,
  "totalOutput": number,
  "totalCacheRead": number,
  "totalCacheCreate": number,
  "costEstimate": number,
  "totalMessages": number,
  "totalSessions": number,
  "totalToolCalls": number,
  "dayCount": number,
  "avgMessagesPerDay": number,
  "models": [
    {
      "id": "model-name",
      "total": number,
      "input": number,
      "output": number,
      "cacheRead": number,
      "cacheCreate": number
    }
  ],
  "daily": [ /* from input */ ],
  "hourCounts": { /* from input */ },
  "peakDay": { /* day with most messages */ },
  "topDays": [ /* top 5 days */ ]
}
```

**Key Computations**:
- **totalTokens**: Sum of all token types across all models
- **costEstimate**: `(input * 15 + output * 75 + cacheRead * 1.5 + cacheCreate * 3.75) / 1,000,000` (Opus pricing in USD)
- **peakDay**: Day with highest message count
- **topDays**: Top 5 by message count (used to highlight chart bars)

**Usage**: Import into Jupyter, PowerBI, analytics tools, or consume via API endpoints

### 4. Raw Prompts: `prompts.json`

**Purpose**: Structured archive of all opening prompts for LLM analysis

**Schema**:

```json
[
  {
    "date": "ISO-8601 timestamp",
    "prompt": "First 500 characters of session prompt",
    "summary": "Session summary if available",
    "project": "Project name (e.g., owner/repo)",
    "messages": number
  }
]
```

**Source**: Extracted from `~/.claude/projects/*/sessions-index.json` (first prompt per session)

---

## Session Data Structure (Input)

The generator also reads from `~/.claude/projects/` directory structure:

```
~/.claude/projects/
├── project-name-1/
│   └── sessions-index.json
├── project-name-2/
│   └── sessions-index.json
└── ...
```

**sessions-index.json schema**:

```json
{
  "entries": [
    {
      "created": "ISO-8601 timestamp",
      "firstPrompt": "User's initial prompt text",
      "summary": "Session summary or title",
      "messageCount": number
    }
  ]
}
```

**Project Directory Naming**: Dashes (`-`) are converted to slashes (`/`), so `github-com-owner-repo` → `github.com/owner/repo`

---

## Cost Calculation Model

### Pricing Assumptions

Hardcoded Claude Opus pricing (line 42-43):

```javascript
const costEstimate = (totalInput * 15 + totalOutput * 75 +
  totalCacheRead * 1.5 + totalCacheCreate * 3.75) / 1_000_000;
```

**Rates (per 1M tokens)**:
- Input (new): $15
- Output: $75
- Cache Read: $1.50 (90% discount vs. input)
- Cache Creation: $3.75 (25% of input cost)

### Why Opus Pricing?

All models in stats are mapped to Opus rates, regardless of actual model used. This is intentional—provides consistent benchmark for value analysis.

### Alternative Implementations

To support multiple pricing models:
1. Add `pricing` config object to input
2. Filter models by prefix, apply different rates
3. Export multiple cost scenarios in `data.json`

---

## Extension Points & Customization

### 1. Modifying Cost Calculation

**File**: `/Users/nat/sandbox/claude-usage-report/generate.mjs` (line 42-43)

**Current**:
```javascript
const costEstimate = (totalInput * 15 + totalOutput * 75 + totalCacheRead * 1.5 + totalCacheCreate * 3.75) / 1_000_000;
```

**To add per-model pricing**:
```javascript
const costEstimate = models.reduce((total, m) => {
  const rate = getPricingRate(m.id); // New function
  return total + ((m.inputTokens * rate.input + m.outputTokens * rate.output +
    m.cacheReadInputTokens * rate.cacheRead + m.cacheCreationInputTokens * rate.cacheCreate) / 1_000_000);
}, 0);
```

### 2. Changing Color Scheme

**File**: Lines 161-171 (`modelColor` function)

```javascript
function modelColor(id) {
  if (id.includes('opus-4-6')) return { bg: 'indigo', hex: '#6366f1' };
  // ... add custom rules
}
```

Also update Tailwind config in HTML (lines 256-274) to extend colors if needed.

### 3. Adding New Metrics

**Steps**:
1. Compute metric in data aggregation section (lines 29-63)
2. Add to `data.json` export (lines 89-100)
3. Create visualization in `generateHTML()` (lines 186-465)

**Example**: Add "Best Session" (most tokens per session)
```javascript
const bestSession = sessions.reduce((max, s) => s.messageCount > max.messageCount ? s : max);
```

### 4. Changing HTML Layout

**Files**:
- `generateHTML()` function (lines 186-465) — dashboard layout
- `generatePromptsHTML()` function (lines 470-549) — prompts table

Both use template strings with embedded metrics. Modify Tailwind classes to change layout/styling.

### 5. Alternative Data Sources

**Current Flow**:
```
~/.claude/stats-cache.json
    ↓
parse JSON
    ↓
compute metrics
    ↓
generate outputs
```

**To swap data source**:
1. Create parallel function (e.g., `loadAirtableStats()`)
2. Replace line 21 `JSON.parse(readFileSync(STATS_FILE, 'utf-8'))` with your loader
3. Ensure output matches schema

**Example**: Read from API instead of filesystem
```javascript
const stats = await fetch('https://api.example.com/stats').then(r => r.json());
```

### 6. Custom Output Formats

**Add new output type**:

```javascript
// After line 100 (after data.json write):
const customFormat = generateCustomOutput(stats, models, daily, ...);
writeFileSync(join(OUT_DIR, 'custom.ext'), customFormat);
```

### 7. Programmatic Integration

**Embed generator in Node.js app**:

```javascript
import { readFileSync, writeFileSync } from 'fs';
import { homedir, join } from 'path';

// Export generator as module (requires refactoring)
export function generateReport(statsPath, outputDir) {
  const stats = JSON.parse(readFileSync(statsPath, 'utf-8'));
  // ... run computations
  return { html, data, prompts };
}
```

Currently the script is not modularized; would need refactoring to export functions.

---

## Integration Patterns

### GitHub Pages Hosting

**Setup**:
1. Fork [nazt/claude-usage-report](https://github.com/nazt/claude-usage-report)
2. In local repo: `node generate.mjs --push`
3. Configure branch: Settings → Pages → Source: `main`
4. Live at: `https://yourusername.github.io/claude-usage-report/`

**Automation** (optional CI/CD):
```yaml
# .github/workflows/update-stats.yml
name: Update Stats
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cp ~/.claude/stats-cache.json . || echo "No stats file"
      - run: node generate.mjs --push
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Note**: Won't work as-is on GitHub Actions (no `~/.claude/`); would need to:
1. Export stats from local Claude Code instance
2. Upload as artifact
3. Pull in workflow

### Self-Hosted Dashboard

**Requirements**:
- Static file server (nginx, Apache, S3, Netlify, etc.)
- Local script runner (cron job or systemd timer)

**Workflow**:
```bash
#!/bin/bash
# /usr/local/bin/update-claude-stats.sh

cd /var/www/claude-report
node generate.mjs

# Sync to server if needed
# scp -r *.html *.json user@server:/var/www/html/
```

**Cron entry**:
```
0 */4 * * * /usr/local/bin/update-claude-stats.sh
```

### CI/CD Integration (General)

**In any CI/CD pipeline** (Jenkins, GitLab CI, CircleCI):

```bash
# After checkout
node generate.mjs

# Archive artifacts
tar czf claude-report.tar.gz *.html *.json

# Upload somewhere
aws s3 cp claude-report.tar.gz s3://my-reports/
```

### Analytics & Monitoring

**Feed data into dashboards**:
- **Grafana**: Import `data.json` as HTTP data source
- **Metabase**: Load `data.json` into PostgreSQL
- **Tableau**: Connect to `data.json` via Tableau Web Data Connector
- **Custom dashboards**: Fetch `data.json` via JavaScript

```javascript
// Browser JS
fetch('/data.json').then(r => r.json()).then(data => {
  console.log(`Total tokens: ${data.totalTokens}`);
  // Plot custom charts
});
```

---

## Adapting for Different Data Sources

### Scenario 1: Anthropic API Usage

**Goal**: Replace Claude Code usage with API logs

**Steps**:
1. Parse API logs (CloudWatch, Datadog, custom logs)
2. Aggregate into `stats-cache.json` schema
3. Run `generate.mjs` as-is

**Example aggregator** (pseudo-code):
```javascript
function aggregateApiLogs(logPath) {
  const logs = readLogs(logPath);
  const modelUsage = {};
  const dailyActivity = {};

  for (const call of logs) {
    const model = call.model;
    const date = call.timestamp.slice(0, 10);

    if (!modelUsage[model]) modelUsage[model] = { inputTokens: 0, outputTokens: 0, ... };
    modelUsage[model].inputTokens += call.input_tokens;

    if (!dailyActivity[date]) dailyActivity[date] = { messageCount: 0, ... };
    dailyActivity[date].messageCount += 1;
  }

  return { modelUsage, dailyActivity: Object.values(dailyActivity), ... };
}
```

### Scenario 2: Multi-Model Tracking (Claude + GPT + Gemini)

**Goal**: Track usage across all AI models

**Approach**:
1. Maintain separate `stats-cache.json` for each provider (or unified)
2. Update `modelColor()` and `modelShortName()` to handle all models
3. Adjust pricing function for multi-model rates

**Extended schema**:
```json
{
  "modelUsage": {
    "claude-opus-4-5": { /* Claude tokens */ },
    "gpt-4-turbo": { /* OpenAI tokens */ },
    "gemini-pro": { /* Google tokens */ }
  }
}
```

The generator already detects models and assigns colors (lines 161-171), so this mostly works out-of-box.

### Scenario 3: Team Aggregation

**Goal**: Combine stats from multiple team members

**Approach**:
1. Each team member exports their `data.json`
2. Merge metrics at top level:

```javascript
function mergeTeamStats(statsList) {
  return {
    totalTokens: statsList.reduce((s, d) => s + d.totalTokens, 0),
    totalMessages: statsList.reduce((s, d) => s + d.totalMessages, 0),
    // ... sum all scalar metrics
    models: mergeModelArrays(statsList.map(d => d.models)),
    daily: mergeDailyArrays(statsList.map(d => d.daily))
  };
}
```

Then regenerate HTML from merged data.

### Scenario 4: Historical Tracking (Archive Mode)

**Goal**: Preserve historical snapshots

**Approach**:
1. Version `data.json` with timestamp: `data-2025-12-01.json`
2. Store in `archive/` directory
3. Generate comparison visualizations

```bash
# In cron job
cp data.json archive/data-$(date +%Y-%m-%d).json
node generate.mjs
```

---

## Model Detection & Color Mapping

**Current Rules** (lines 161-171):

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
  return { bg: 'gray', hex: '#6b7280' };  // fallback
}
```

**Model name shortening** (lines 173-178):

Removes version suffixes like `-202501` or `-20250929` for cleaner display.

---

## Error Handling & Robustness

### Current Behavior

| Error | Handling |
|-------|----------|
| Missing `~/.claude/stats-cache.json` | **Crashes** with `ENOENT` (no fallback) |
| Empty `dailyActivity` | Gracefully handles (uses defaults) |
| Missing project directories | Silently skips with `try...catch` (line 129) |
| Invalid JSON in sessions-index.json | Silently skipped (line 129) |
| Invalid Tailwind class names | Works anyway (CDN processes dynamically) |

### For Production Use

**Recommended improvements**:

```javascript
// Wrap initial load in try-catch
let stats;
try {
  stats = JSON.parse(readFileSync(STATS_FILE, 'utf-8'));
} catch (e) {
  console.error('Error: stats-cache.json not found or invalid');
  console.log('Have you run Claude Code yet? File should be at:', STATS_FILE);
  process.exit(1);
}

// Validate schema
if (!stats.modelUsage || !stats.dailyActivity) {
  console.error('Error: stats-cache.json missing required fields');
  process.exit(1);
}
```

---

## Performance Notes

- **Generation time**: <1 second (tested with 420K+ messages)
- **Memory usage**: ~50-100MB (mostly session array)
- **File I/O**: Reads from home directory (not bottleneck)
- **Git push**: Can add 2-5 seconds depending on internet/repo size

---

## Limitations & Design Trade-offs

| Aspect | Current | Implication |
|--------|---------|-------------|
| **Data source** | Only `~/.claude/stats-cache.json` | Can't mix sources without preprocessing |
| **Pricing model** | Hardcoded Opus rates | Incorrect for Sonnet/Haiku; no per-model rates |
| **Module system** | Not modularized | Can't import as library; must spawn subprocess |
| **Real-time updates** | Batch generation only | No streaming/live updates |
| **Authentication** | None (local files only) | Only works for current user |
| **Interactivity** | Client-side search only | No backend API or dynamic queries |
| **Storage** | JSON text only | No database, limited query capabilities |
| **Caching** | No cache layer | Always recomputes from scratch |

---

## Summary Table: Integration Quick Reference

| Use Case | Tool | Setup | Update Frequency |
|----------|------|-------|-------------------|
| **Live demo** | GitHub Pages + git push | Fork repo, configure Pages | Manual (`node generate.mjs --push`) |
| **Self-hosted dashboard** | nginx/Apache + cron | Copy files to webroot | Cron job (hourly/daily) |
| **CI/CD artifact** | Any CI/CD + S3/Artifactory | Add step to workflow | Triggered by schedule or commit |
| **Analytics platform** | Grafana/Metabase | Import `data.json` | Auto-refresh via HTTP source |
| **Mobile view** | GitHub Pages | Responsive by default | Automatic (static files) |
| **Slack reporting** | Webhook integration | Parse `data.json` → post | Scheduled bot task |
| **Team dashboard** | Merge `data.json` files | Custom aggregator | After each individual generation |

---

## Files & Locations

**Main files**:
- `/Users/nat/sandbox/claude-usage-report/generate.mjs` — Generator script (552 lines)
- `/Users/nat/sandbox/claude-usage-report/README.md` — User guide
- `/Users/nat/sandbox/claude-usage-report/data.json` — Latest computed metrics
- `/Users/nat/sandbox/claude-usage-report/index.html` — Dashboard
- `/Users/nat/sandbox/claude-usage-report/prompts.html` — Prompts table
- `/Users/nat/sandbox/claude-usage-report/prompts.json` — Raw prompts

**Input**:
- `~/.claude/stats-cache.json` — Main stats source
- `~/.claude/projects/*/sessions-index.json` — Session prompts

---

## License

MIT (per README)
