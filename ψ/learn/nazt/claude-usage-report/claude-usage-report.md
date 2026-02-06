# claude-usage-report Learning Index

## Source
- **Origin**: ./origin/
- **GitHub**: https://github.com/nazt/claude-usage-report

## Explorations

### 2026-02-06 1318 (deep)
- [Architecture](2026-02-06/1318_ARCHITECTURE.md)
- [Code Snippets](2026-02-06/1318_CODE-SNIPPETS.md)
- [Quick Reference](2026-02-06/1318_QUICK-REFERENCE.md)
- [Testing](2026-02-06/1318_TESTING.md)
- [API Surface](2026-02-06/1318_API-SURFACE.md)

**Key insights**:
- Single-file zero-dependency Node.js tool that reads ~/.claude/stats-cache.json
- Generates OLED dark-mode HTML dashboard with Tailwind CDN + glassmorphism
- Cost estimation uses Opus pricing: $15/M input, $75/M output, $1.50/M cache read, $3.75/M cache create
