#!/usr/bin/env node
/**
 * Claude Usage Report Generator
 * Reads ~/.claude/stats-cache.json + session data → generates HTML dashboard + prompts dump
 * Usage: node generate.mjs [--push]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const CLAUDE_DIR = join(homedir(), '.claude');
const STATS_FILE = join(CLAUDE_DIR, 'stats-cache.json');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');
const OUT_DIR = process.cwd();

// ── Load Data ──────────────────────────────────────────────────────────────────

console.log('📊 Loading stats-cache.json...');
const stats = JSON.parse(readFileSync(STATS_FILE, 'utf-8'));

console.log('📂 Loading session indexes...');
const sessions = loadAllSessions();

console.log(`   Found ${sessions.length} sessions across ${stats.totalSessions} total`);

// ── Compute Metrics ────────────────────────────────────────────────────────────

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

// Cost estimate (Opus pricing: $15/M input, $75/M output, $1.50/M cache read, $3.75/M cache create)
const costEstimate = (totalInput * 15 + totalOutput * 75 + totalCacheRead * 1.5 + totalCacheCreate * 3.75) / 1_000_000;

const daily = stats.dailyActivity || [];
const totalMessages = stats.totalMessages || daily.reduce((s, d) => s + d.messageCount, 0);
const totalSessions = stats.totalSessions || daily.reduce((s, d) => s + d.sessionCount, 0);
const totalToolCalls = daily.reduce((s, d) => s + (d.toolCallCount || 0), 0);
const dayCount = daily.length;
const avgMessagesPerDay = dayCount ? Math.round(totalMessages / dayCount) : 0;

// Peak day
const peakDay = daily.reduce((max, d) => d.messageCount > max.messageCount ? d : max, daily[0] || { date: 'N/A', messageCount: 0 });

// Top 5 days by messages
const topDays = [...daily].sort((a, b) => b.messageCount - a.messageCount).slice(0, 5);

// Hour distribution
const hourCounts = stats.hourCounts || {};
const maxHourCount = Math.max(...Object.values(hourCounts), 1);

// Daily model tokens for chart
const dailyModelTokens = stats.dailyModelTokens || [];

// ── Generate Prompts Dump ──────────────────────────────────────────────────────

console.log('💬 Extracting prompts...');
const prompts = extractPrompts(sessions);
console.log(`   Extracted ${prompts.length} prompts`);

// ── Generate HTML ──────────────────────────────────────────────────────────────

const now = new Date();
const generated = now.toISOString();
const generatedDisplay = now.toLocaleDateString('en-US', {
  year: 'numeric', month: 'long', day: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

const html = generateHTML();
writeFileSync(join(OUT_DIR, 'index.html'), html);
console.log('✅ index.html generated');

const promptsHtml = generatePromptsHTML();
writeFileSync(join(OUT_DIR, 'prompts.html'), promptsHtml);
console.log('✅ prompts.html generated');

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
console.log('✅ data.json generated');

// Write prompts as JSON
writeFileSync(join(OUT_DIR, 'prompts.json'), JSON.stringify(prompts, null, 2));
console.log('✅ prompts.json generated');

// ── Push if requested ──────────────────────────────────────────────────────────

if (process.argv.includes('--push')) {
  console.log('🚀 Pushing to GitHub...');
  execSync('git add -A && git commit -m "update: ' + stats.lastComputedDate + '" && git push', { stdio: 'inherit' });
  console.log('✅ Pushed!');
}

// ── Helper Functions ───────────────────────────────────────────────────────────

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

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── HTML Generator ─────────────────────────────────────────────────────────────

function generateHTML() {
  const maxDailyMsg = Math.max(...daily.map(d => d.messageCount), 1);

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

  const topDayRows = topDays.map((d, i) => {
    const dt = new Date(d.date);
    const label = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const isFirst = i === 0;
    const bg = isFirst ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-surface-3/50';
    const badge = isFirst ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-300';
    return `<div class="flex items-center gap-3 p-3 ${bg} rounded-xl">
      <span class="w-7 h-7 flex items-center justify-center ${badge} text-sm font-bold rounded-lg">${i + 1}</span>
      <span class="flex-1 text-sm">${label}</span>
      <span class="font-mono text-sm text-gray-400">${d.messageCount.toLocaleString()} msgs</span>
    </div>`;
  }).join('\n');

  const hourBars = Array.from({ length: 24 }, (_, h) => {
    const count = hourCounts[h] || 0;
    const height = Math.max((count / maxHourCount) * 100, 1);
    return `<div class="flex flex-col items-center gap-1 flex-1">
      <div class="w-full bg-surface-3 rounded-t relative" style="height: 60px;">
        <div class="absolute bottom-0 w-full bg-gradient-to-t from-violet-600 to-violet-400 rounded-t" style="height: ${height.toFixed(1)}%"></div>
      </div>
      <span class="text-[10px] text-gray-600">${h}</span>
    </div>`;
  }).join('\n');

  const firstDate = stats.firstSessionDate ? new Date(stats.firstSessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Usage Report</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
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
  </script>
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
</head>
<body class="oled-bg min-h-screen text-white antialiased">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

    <!-- Header -->
    <header class="text-center mb-12">
      <h1 class="text-3xl sm:text-4xl font-semibold tracking-tight mb-2">Claude Usage Report</h1>
      <p class="text-gray-500 text-sm font-mono">${firstDate} — ${stats.lastComputedDate} &middot; Generated ${generatedDisplay}</p>
      <div class="mt-3">
        <a href="data.json" class="text-sm text-gray-500 hover:text-gray-300 transition-colors">Raw JSON</a>
      </div>
    </header>

    <!-- Hero Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
      <div class="glass stat-card rounded-2xl p-5">
        <div class="text-xs text-gray-500 uppercase tracking-wider mb-2">Total Tokens</div>
        <div class="text-2xl sm:text-3xl font-bold font-mono text-glow-blue text-secondary">${fmt(totalTokens)}</div>
      </div>
      <div class="glass stat-card rounded-2xl p-5">
        <div class="text-xs text-gray-500 uppercase tracking-wider mb-2">Messages</div>
        <div class="text-2xl sm:text-3xl font-bold font-mono text-emerald-400">${totalMessages.toLocaleString()}</div>
        <div class="text-xs text-gray-600 mt-1">~${avgMessagesPerDay}/day</div>
      </div>
      <div class="glass stat-card rounded-2xl p-5">
        <div class="text-xs text-gray-500 uppercase tracking-wider mb-2">Sessions</div>
        <div class="text-2xl sm:text-3xl font-bold font-mono text-violet-400">${totalSessions.toLocaleString()}</div>
      </div>
      <div class="glass stat-card rounded-2xl p-5">
        <div class="text-xs text-gray-500 uppercase tracking-wider mb-2">Tool Calls</div>
        <div class="text-2xl sm:text-3xl font-bold font-mono text-amber-400">${totalToolCalls.toLocaleString()}</div>
      </div>
      <div class="glass stat-card rounded-2xl p-5">
        <div class="text-xs text-gray-500 uppercase tracking-wider mb-2">API Est.</div>
        <div class="text-2xl sm:text-3xl font-bold font-mono text-glow-amber text-accent">${fmtMoney(costEstimate)}</div>
        <div class="text-xs text-gray-600 mt-1">if paid per-token</div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="grid lg:grid-cols-2 gap-6 mb-8">

      <!-- Token Breakdown -->
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
          <div>
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm text-gray-400">Output</span>
              <span class="font-mono text-sm text-emerald-400">${fmt(totalOutput)}</span>
            </div>
            <div class="h-2 bg-surface-3 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full" style="width: ${pct(totalOutput, totalTokens)}%"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm text-gray-400">Cache Read</span>
              <span class="font-mono text-sm text-violet-400">${fmt(totalCacheRead)}</span>
            </div>
            <div class="h-2 bg-surface-3 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full" style="width: ${pct(totalCacheRead, totalTokens)}%"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm text-gray-400">Cache Creation</span>
              <span class="font-mono text-sm text-amber-400">${fmt(totalCacheCreate)}</span>
            </div>
            <div class="h-2 bg-surface-3 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full" style="width: ${pct(totalCacheCreate, totalTokens)}%"></div>
            </div>
          </div>
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

      <!-- Model Distribution -->
      <div class="glass rounded-2xl p-6">
        <h2 class="text-lg font-semibold mb-6">Model Distribution</h2>
        <div class="space-y-4">
          ${modelRows}
        </div>
      </div>
    </div>

    <!-- Daily Usage Chart -->
    <div class="glass rounded-2xl p-6 mb-8">
      <h2 class="text-lg font-semibold mb-6">Daily Activity <span class="ml-2 text-xs text-gray-600 font-normal">(messages per day)</span></h2>
      <div class="flex items-end gap-[3px] h-48 overflow-x-auto pb-4">
        ${dailyBars}
      </div>
      <div class="flex justify-between text-xs text-gray-600 mt-2">
        <span>${daily.length > 0 ? daily[0].date : ''}</span>
        <span>${daily.length > 0 ? daily[daily.length - 1].date : ''}</span>
      </div>
    </div>

    <!-- Bottom Grid -->
    <div class="grid lg:grid-cols-3 gap-6 mb-8">

      <!-- Top Days -->
      <div class="glass rounded-2xl p-6">
        <h2 class="text-lg font-semibold mb-4">Top Days</h2>
        <div class="space-y-2">
          ${topDayRows}
        </div>
      </div>

      <!-- Hour Distribution -->
      <div class="glass rounded-2xl p-6">
        <h2 class="text-lg font-semibold mb-4">Activity by Hour</h2>
        <div class="flex gap-[2px] items-end">
          ${hourBars}
        </div>
      </div>

      <!-- Value Analysis -->
      <div class="glass-highlight glow-green rounded-2xl p-6">
        <h2 class="text-lg font-semibold mb-4">Value Analysis</h2>
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-400">API Cost (est.)</span>
            <span class="text-xl font-bold font-mono text-red-400">${fmtMoney(costEstimate)}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-400">Max Plan</span>
            <span class="text-xl font-bold font-mono text-emerald-400">$200</span>
          </div>
          <div class="h-px bg-white/10"></div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-400">Value Multiplier</span>
            <span class="text-2xl font-bold font-mono text-glow-amber text-accent">${Math.round(costEstimate / 200)}x</span>
          </div>
          <div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <p class="text-xs text-emerald-400 text-center">
              Cache Read = ${pct(totalCacheRead, totalTokens)}% of all tokens — saves most of the cost
            </p>
          </div>
        </div>
      </div>
    </div>

    <footer class="text-center text-gray-600 text-xs py-6 border-t border-white/5">
      <p>Generated by <a href="https://github.com/nazt/claude-usage-report" class="text-gray-500 hover:text-gray-300">claude-usage-report</a></p>
      <p class="mt-1 font-mono">${generated}</p>
    </footer>
  </div>
</body>
</html>`;
}

// ── Prompts HTML ───────────────────────────────────────────────────────────────

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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Prompts</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: { extend: {
        colors: { surface: '#0a0a0f', 'surface-2': '#111118', 'surface-3': '#1a1a24' },
        fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] }
      }}
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    body { font-family: 'Inter', system-ui, sans-serif; background: #000; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
  </style>
</head>
<body class="bg-black min-h-screen text-white antialiased">
  <div class="max-w-7xl mx-auto px-4 py-8">
    <header class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Claude Prompts</h1>
          <p class="text-gray-500 text-sm mt-1">${prompts.length} prompts from ${sessions.length} sessions</p>
        </div>
        <a href="index.html" class="text-sm text-gray-500 hover:text-gray-300">← Dashboard</a>
      </div>
      <div class="mt-4">
        <input type="text" id="search" placeholder="Search prompts..." class="w-full sm:w-96 bg-surface-3 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50">
      </div>
    </header>

    <div class="overflow-x-auto">
      <table class="w-full text-left" id="prompts-table">
        <thead class="text-xs text-gray-500 uppercase tracking-wider border-b border-white/10">
          <tr>
            <th class="py-3 px-4">Date</th>
            <th class="py-3 px-4">Project</th>
            <th class="py-3 px-4">Prompt</th>
            <th class="py-3 px-4">Summary</th>
            <th class="py-3 px-4 text-right">Msgs</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>
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
</body>
</html>`;
}
