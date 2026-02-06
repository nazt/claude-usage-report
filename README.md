# Claude Usage Report

OLED dark-mode dashboard for your [Claude Code](https://docs.anthropic.com/en/docs/claude-code) usage stats.

**Live demo**: [nazt.github.io/claude-usage-report](https://nazt.github.io/claude-usage-report/)

![Dashboard Preview](https://img.shields.io/badge/tokens-15B+-blue) ![Sessions](https://img.shields.io/badge/sessions-5.6K-violet) ![License](https://img.shields.io/badge/license-MIT-green)

## How It Works

Claude Code automatically tracks your usage in `~/.claude/stats-cache.json`. This tool reads that file and generates a beautiful HTML dashboard.

**No API keys needed. No data leaves your machine.** Just your local stats → a static HTML file.

## Generate Your Own

### Option 1: One-shot prompt

Open Claude Code and paste:

```
Read ~/.claude/stats-cache.json and generate a single-file HTML usage dashboard as index.html.

Stats to show:
- Hero: total tokens, messages, sessions, tool calls, estimated API cost
- Token breakdown: input, output, cache read, cache creation with progress bars
- Model distribution: each model's tokens and percentage
- Daily activity: messages per day bar chart with hover tooltips
- Top 5 busiest days
- Hourly activity: 24h bar chart from hourCounts
- Value analysis: API cost vs $200 Max plan, show multiplier

Style: Tailwind CDN, OLED dark mode (#000 background), glassmorphism cards, gradients, responsive.

Pricing (as of Feb 2026, from https://docs.anthropic.com/en/docs/about-claude/pricing):
- Opus 4.5/4.6: $5/MTok input, $25/MTok output, $0.50/MTok cache read, $6.25/MTok cache write
- Sonnet 4.5: $3/MTok input, $15/MTok output, $0.30/MTok cache read, $3.75/MTok cache write
- Haiku 4.5: $1/MTok input, $5/MTok output, $0.10/MTok cache read, $1.25/MTok cache write

Calculate cost per-model using modelUsage, then sum. Also export data.json.
```

### Option 2: Clone and run

```bash
git clone https://github.com/nazt/claude-usage-report
cd claude-usage-report
node generate.mjs          # generate report
node generate.mjs --push   # generate + git push
```

Requires Node.js 18+.

## What's in stats-cache.json?

Claude Code maintains `~/.claude/stats-cache.json` automatically with:

| Field | Description |
|---|---|
| `dailyActivity` | Messages, sessions, tool calls per day |
| `modelUsage` | Token breakdown by model (input, output, cache read, cache creation) |
| `hourCounts` | Activity distribution by hour of day |
| `totalSessions` | Lifetime session count |
| `totalMessages` | Lifetime message count |
| `dailyModelTokens` | Output tokens per model per day |
| `longestSession` | Session with most messages |

## API Pricing Reference

As of February 2026 ([source](https://docs.anthropic.com/en/docs/about-claude/pricing)):

| Model | Input | Output | Cache Read | Cache Write (5min) |
|---|---|---|---|---|
| Opus 4.5 / 4.6 | $5/MTok | $25/MTok | $0.50/MTok | $6.25/MTok |
| Sonnet 4.5 | $3/MTok | $15/MTok | $0.30/MTok | $3.75/MTok |
| Haiku 4.5 | $1/MTok | $5/MTok | $0.10/MTok | $1.25/MTok |

## Bonus: /learn Any Codebase

Explore this project (or any repo) with parallel AI agents using [Oracle Skills CLI](https://github.com/Soul-Brews-Studio/oracle-skills-cli):

```bash
# Install just the /learn skill
bunx --bun oracle-skills@github:Soul-Brews-Studio/oracle-skills-cli install -g -s learn -y

# Then in Claude Code:
/learn https://github.com/nazt/claude-usage-report
/learn --deep https://github.com/nazt/claude-usage-report   # 5 parallel agents
```

## License

MIT
