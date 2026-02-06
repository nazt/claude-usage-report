# Claude Usage Report

OLED dark-mode dashboard for your Claude Code usage stats.

**Live demo**: [nazt.github.io/claude-usage-report](https://nazt.github.io/claude-usage-report/)

## Generate Your Own

Paste this prompt into Claude Code:

```
Read ~/.claude/stats-cache.json and generate a beautiful OLED dark-mode HTML usage report as index.html. Include:

1. Hero stats: total tokens, messages, sessions, tool calls, estimated API cost
2. Token breakdown: input, output, cache read, cache creation (with progress bars)
3. Model distribution: show each model's total tokens and percentage
4. Daily activity bar chart: messages per day with hover tooltips
5. Top 5 busiest days
6. Activity by hour of day (24h bar chart from hourCounts)
7. Value analysis: estimated API cost vs $200 Max plan, show multiplier

Use Tailwind CDN, glassmorphism cards, gradients. Make it responsive.
Calculate cost with Opus 4.5/4.6 pricing: $5/M input, $25/M output, $0.50/M cache read, $6.25/M cache write (5min), $10/M cache write (1hr).

Also export data.json with the computed metrics.
```

## Bonus: /learn Any Codebase

Explore this project (or any repo) with parallel AI agents using [Oracle Skills CLI](https://github.com/Soul-Brews-Studio/oracle-skills-cli):

```bash
# Install just the /learn skill
bunx --bun oracle-skills@github:Soul-Brews-Studio/oracle-skills-cli install -g -s learn -y

# Then in Claude Code:
/learn https://github.com/nazt/claude-usage-report
/learn --fast https://github.com/nazt/claude-usage-report   # 1 agent, ~2 min
/learn --deep https://github.com/nazt/claude-usage-report   # 5 agents, ~10 min
```

Launches parallel Haiku agents that generate architecture docs, code snippets, quick reference, and more.

## Run the Generator

If you clone this repo:

```bash
node generate.mjs          # generate report
node generate.mjs --push   # generate + git push
```

Requires Node.js 18+ and `~/.claude/stats-cache.json` (created automatically by Claude Code).

## What's in stats-cache.json?

Claude Code maintains `~/.claude/stats-cache.json` with:

- `dailyActivity` — messages, sessions, tool calls per day
- `modelUsage` — token breakdown by model (input, output, cache read, cache creation)
- `hourCounts` — activity distribution by hour
- `totalSessions`, `totalMessages` — lifetime totals
- `dailyModelTokens` — output tokens per model per day

## License

MIT
