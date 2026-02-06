# Claude Usage Report - Testing & Quality Analysis

**Date**: 2026-02-06
**Project**: claude-usage-report
**Scope**: Complete testing and quality assurance analysis

## Executive Summary

The Claude Usage Report project is a **Node.js CLI tool** (generate.mjs) that reads Claude Code usage statistics and generates beautiful HTML dashboards. The project **lacks formal test coverage** with no test files, testing frameworks, or automated quality checks. Quality relies entirely on manual verification and the simplicity of the data transformation pipeline.

## Project Structure Overview

```
/Users/nat/sandbox/claude-usage-report/
├── generate.mjs          # Main generator script (~550 lines)
├── index.html            # Generated dashboard (static output)
├── prompts.html          # Generated prompts page (static output)
├── data.json             # Generated metrics (JSON output)
├── prompts.json          # Generated prompts list (JSON output)
├── README.md             # Project documentation
└── .gitignore            # Ignores generated files (prompts.html, prompts.json)
```

## Testing Structure & Conventions

### Current State: **NONE**

- **No test files**: Zero test suites, no .test.js, .spec.js files
- **No test framework**: No Jest, Vitest, Mocha, or testing dependencies
- **No package.json**: No dependency management or scripts defined
- **No CI/CD**: No GitHub Actions or automated testing pipelines
- **No test configuration**: No jest.config.js, .mocharc, or test setup files

### Implications

All validation is **implicit**:
- Code runs successfully without errors
- Output files are generated correctly
- Manual spot-checking of HTML/JSON output
- Relies on developer observation during `node generate.mjs` execution

## Data Validation Approach

### Input Validation

The script reads from two sources with **minimal validation**:

1. **`~/.claude/stats-cache.json`** (required)
   - Hard-coded file path: `join(homedir(), '.claude', 'stats-cache.json')`
   - **No validation**: File existence checked via `readFileSync()` but will crash if missing
   - **No schema validation**: Expects these fields but doesn't verify them:
     - `modelUsage` (object)
     - `dailyActivity` (array)
     - `hourCounts` (object)
     - `totalSessions`, `totalMessages` (numbers)
     - `dailyModelTokens` (array, optional)

2. **`~/.claude/projects/*/sessions-index.json`** (optional)
   - **Graceful failure**: `try-catch` block wraps JSON parsing (line 123-129)
   - **No validation**: Expects `entries` array in each index file
   - **No schema validation**: Each entry should have:
     - `created` (date string)
     - `firstPrompt` (string)
     - `summary` (optional string)
     - `projectDir`, `projectName` (added by script)
     - `messageCount` (number, optional)

### Data Transformation Validation

```javascript
// Example: Model totals calculation (lines 30-34)
const models = Object.entries(stats.modelUsage).map(([id, u]) => {
  const total = (u.inputTokens || 0) + (u.outputTokens || 0) +
    (u.cacheReadInputTokens || 0) + (u.cacheCreationInputTokens || 0);
  return { id, ...u, total };
}).sort((a, b) => b.total - a.total);
```

**Validation approach**:
- Uses **default values** (`|| 0`) for missing fields
- **No bounds checking**: Accepts any numeric value, including negative or zero
- **No null/undefined checks**: Relies on JSON parse to provide valid objects

### Cost Calculation

```javascript
// Line 43: Fixed pricing formula
const costEstimate = (totalInput * 15 + totalOutput * 75 +
  totalCacheRead * 1.5 + totalCacheCreate * 3.75) / 1_000_000;
```

**Validation issues**:
- **No overflow protection**: Large token counts could cause floating-point precision loss
- **No rate validation**: Hardcoded pricing (Opus) not validated against actual API
- **No negative value checks**: Negative tokens would produce negative costs

## Error Handling Patterns

### Explicit Error Handling

Only **one try-catch block** in entire codebase:

```javascript
// Lines 123-129: Session loading
try {
  const idx = JSON.parse(readFileSync(indexFile, 'utf-8'));
  // ... process index
} catch {}  // Silent failure - errors ignored!
```

**Issues**:
- Empty catch block silently swallows all errors
- No logging of failures
- No indication which projects failed to load
- Makes debugging production issues difficult

### Implicit Error Handling

All other I/O operations assume success:

```javascript
// Line 21: Will throw if stats file missing
const stats = JSON.parse(readFileSync(STATS_FILE, 'utf-8'));

// Line 81: Will throw if can't write output
writeFileSync(join(OUT_DIR, 'index.html'), html);
```

**Consequence**: Script exits with stack trace if:
- `~/.claude/stats-cache.json` doesn't exist
- Current directory isn't writable
- File read/write I/O fails
- JSON parsing fails (malformed data)

## Edge Cases & Data Integrity

### Handled Edge Cases

1. **Empty daily activity** (line 49)
   ```javascript
   const totalMessages = stats.totalMessages || daily.reduce(..., 0);
   ```
   Uses fallback calculation if field missing

2. **Missing hour counts** (line 60)
   ```javascript
   const maxHourCount = Math.max(...Object.values(hourCounts), 1);
   ```
   Defaults to 1 to prevent division by zero

3. **Empty daily activity for peak day** (line 53)
   ```javascript
   const peakDay = daily.reduce((max, d) => d.messageCount > max.messageCount ? d : max, daily[0] || { date: 'N/A', messageCount: 0 });
   ```
   Provides fallback object if array empty

4. **Missing session files** (line 119-120)
   ```javascript
   if (!existsSync(PROJECTS_DIR)) return all;
   if (!existsSync(indexFile)) continue;
   ```
   Handles missing directories and individual files gracefully

### Unhandled Edge Cases

1. **Empty or null fields**
   ```javascript
   // No validation that these fields exist
   const daily = stats.dailyActivity || [];
   const hourCounts = stats.hourCounts || {};
   ```
   Assumes structure if not null, will crash on wrong type

2. **Invalid date strings**
   ```javascript
   // Line 191, 192: No validation of date format
   const dt = new Date(d.date);
   const label = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
   ```
   `Invalid Date` string in UI if malformed

3. **Extremely large numbers**
   ```javascript
   // No protection against:
   // - Extremely large token counts (>Number.MAX_SAFE_INTEGER)
   // - Very large session counts causing memory issues
   // - Very large array allocations
   ```

4. **HTML/SQL Injection via data**
   ```javascript
   // XSS vulnerability in prompts table (line 478)
   <td class="py-3 px-4 text-sm text-gray-300">${escapeHtml(p.prompt)}</td>
   ```
   Properly escaped, but other fields (line 477, 479) also escaped - good practice

5. **Unicode and special characters**
   ```javascript
   // escapeHtml() only handles &, <, >, "
   // Doesn't handle other special characters like zero-width spaces
   ```

6. **Truncated prompts** (line 139)
   ```javascript
   prompt: s.firstPrompt.slice(0, 500)  // Silent truncation, no indicator
   ```

## Quality Assurance Approach

### What Works Well

1. **File-based CI** - Output files (data.json, index.html) are human-verifiable
2. **JSON export** - data.json provides machine-readable output for validation
3. **Graceful degradation** - Missing optional fields use sensible defaults
4. **HTML escaping** - Input sanitization prevents basic XSS
5. **Defensive defaults** - Uses `|| 0` pattern to avoid undefined arithmetic

### What's Missing

1. **Input validation schema** - No JSON schema validation of input files
2. **Unit tests** - No isolated function testing
3. **Integration tests** - No end-to-end testing with sample data
4. **Property-based tests** - No generative testing for edge cases
5. **Performance tests** - No benchmarking for large datasets
6. **Linting** - No ESLint configuration
7. **Type checking** - No TypeScript or JSDoc type annotations
8. **Logging** - Minimal console.log, no structured logging
9. **Metrics validation** - No verification that calculations are correct
10. **Regression tests** - No snapshots of expected output

## Specific Testing Gaps by Function

### `loadAllSessions()` (lines 117-132)

**Inputs to test**:
- Projects directory doesn't exist (returns empty array)
- Projects directory has no sessions-index.json files
- sessions-index.json files with invalid JSON
- sessions-index.json with missing `entries` field
- Large number of sessions (performance test)
- Sessions with malformed `created` dates
- Unicode in project names (special characters)

**Current tests**: None

### `extractPrompts()` (lines 134-144)

**Inputs to test**:
- Sessions without `firstPrompt` field (filtered out)
- Sessions with null/undefined `firstPrompt`
- Very long prompts (>500 chars) - truncation works?
- Special characters in prompts (HTML escape works?)
- Missing `summary`, `projectName`, `messageCount` fields

**Current tests**: None

### `generateHTML()` (lines 186-466)

**Inputs to test**:
- Empty daily activity (no bars)
- Single day of activity
- Very large message counts (bar height calculation)
- Missing models
- Single model (all 100%)
- No top days
- Hour counts with gaps (missing hours)
- Special characters in model names

**Current tests**: None

### `fmt()`, `fmtMoney()`, `pct()` (lines 146-159)

**Inputs to test**:
- Negative numbers
- Zero
- Fractional numbers (rounding behavior)
- Very large numbers (>1e9)
- NaN, Infinity
- Null/undefined inputs

**Current tests**: None

Example behavior not tested:
```javascript
fmt(0) // "0"
fmt(-100) // "-100" (negative numbers not formatted!)
pct(1, 0) // "0" (should handle division by zero - returns '0' string)
fmtMoney(-500) // "$-500" (negative costs not handled)
```

## Risk Assessment

### High Risk Areas

1. **Missing required files** (stats-cache.json)
   - **Impact**: Complete failure, script exits
   - **Mitigation**: Document requirements, add pre-flight checks

2. **Malformed JSON input**
   - **Impact**: Script crashes with parse errors
   - **Mitigation**: Add try-catch, validate schema before use

3. **Extreme token counts** (>2^53)
   - **Impact**: Floating-point precision loss, incorrect costs
   - **Mitigation**: Use BigInt or Decimal library

4. **XSS through user data**
   - **Impact**: Low - escapeHtml() is used, but incomplete
   - **Mitigation**: Add comprehensive sanitization, use template engine

### Medium Risk Areas

1. **Silent failures in session loading**
   - **Impact**: Missing data in dashboard, no error indication
   - **Mitigation**: Log errors, add validation feedback

2. **Invalid date formatting**
   - **Impact**: "Invalid Date" displayed in UI
   - **Mitigation**: Validate dates, provide fallback format

3. **Very large datasets**
   - **Impact**: Memory exhaustion, slow rendering
   - **Mitigation**: Add pagination, streaming, or sampling

### Low Risk Areas

1. **Model color mapping** (lines 161-171)
   - **Impact**: Unknown model shows gray (acceptable fallback)
   - **Mitigation**: Add warning comment

2. **Styling issues**
   - **Impact**: Cosmetic only, dashboard still functional
   - **Mitigation**: Manual visual testing before release

## Quality Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Lines of Code | ~550 | Moderate |
| Test Coverage | 0% | Critical Gap |
| Cyclomatic Complexity | ~8 (generateHTML) | Moderate |
| Error Handling | Try-catch count: 1 | Poor |
| Input Validation | Schema validation: None | Poor |
| Type Safety | No TypeScript | No |
| Documentation | README only, no JSDoc | Minimal |
| Linting | None | None |

## Recommendations for Testing This Project

### Phase 1: Foundation (Immediate)

1. **Add input validation**
   ```javascript
   // Create validate.mjs
   export function validateStatsFile(stats) {
     if (!stats.modelUsage) throw new Error('Missing modelUsage');
     if (!Array.isArray(stats.dailyActivity)) throw new Error('dailyActivity must be array');
     if (typeof stats.totalSessions !== 'number') throw new Error('totalSessions must be number');
     // ... more checks
   }
   ```

2. **Add pre-flight checks**
   ```javascript
   // In generate.mjs
   const statsPath = join(homedir(), '.claude', 'stats-cache.json');
   if (!existsSync(statsPath)) {
     console.error(`ERROR: ${statsPath} not found`);
     process.exit(1);
   }
   ```

3. **Add basic error handling**
   ```javascript
   // Wrap session loading in logging
   try {
     const idx = JSON.parse(readFileSync(indexFile, 'utf-8'));
   } catch (err) {
     console.warn(`Failed to load ${indexFile}: ${err.message}`);
   }
   ```

### Phase 2: Testing Framework (Short-term)

1. **Set up Jest**
   ```bash
   npm init -y
   npm install --save-dev jest
   npm install --save-dev @types/jest
   ```

2. **Create test files**
   ```
   tests/
   ├── fixtures/
   │   ├── stats-minimal.json
   │   ├── stats-empty.json
   │   ├── stats-large.json
   │   └── sessions-index.json
   ├── validate.test.js
   ├── format.test.js
   ├── generate.test.js
   └── integration.test.js
   ```

3. **Write unit tests** (Coverage targets: 80%+)
   ```javascript
   // tests/format.test.js
   import { fmt, fmtMoney, pct } from '../generate.mjs';

   describe('fmt', () => {
     test('formats millions', () => expect(fmt(1_500_000)).toBe('1.50M'));
     test('formats billions', () => expect(fmt(1_500_000_000)).toBe('1.50B'));
     test('handles zero', () => expect(fmt(0)).toBe('0'));
     test('handles negative', () => expect(fmt(-1000)).toBe('-1K'));
   });

   describe('fmtMoney', () => {
     test('formats currency', () => expect(fmtMoney(1500)).toBe('$1,500'));
     test('handles zero', () => expect(fmtMoney(0)).toBe('$0'));
     test('rounds correctly', () => expect(fmtMoney(1.5)).toBe('$2'));
   });
   ```

### Phase 3: Quality Gates (Medium-term)

1. **Add TypeScript**
   ```typescript
   // types.ts
   interface StatsCache {
     modelUsage: Record<string, TokenBreakdown>;
     dailyActivity: DailyActivity[];
     hourCounts: Record<number, number>;
     totalSessions: number;
     totalMessages: number;
     lastComputedDate: string;
   }
   ```

2. **Add JSDoc types** (easier first step)
   ```javascript
   /**
    * Format large numbers (K, M, B)
    * @param {number} n - The number to format
    * @returns {string} Formatted number
    * @throws {TypeError} if n is not a number
    */
   function fmt(n) { ... }
   ```

3. **Add ESLint**
   ```javascript
   // .eslintrc.json
   {
     "extends": "eslint:recommended",
     "env": { "node": true, "es2020": true },
     "parserOptions": { "ecmaVersion": 2020 }
   }
   ```

4. **Add GitHub Actions CI**
   ```yaml
   # .github/workflows/test.yml
   name: Test
   on: [push, pull_request]
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
         - run: npm ci && npm test
   ```

### Phase 4: Advanced (Long-term)

1. **Property-based testing** (using fast-check)
   ```javascript
   // Generate random valid stats objects
   test('handles any valid token distribution', () => {
     fc.assert(fc.property(fc.integer({ min: 0, max: 1e9 }), (tokens) => {
       // test fmt, cost calculation, etc.
     }));
   });
   ```

2. **Snapshot testing** for HTML output
   ```javascript
   test('generates valid HTML structure', () => {
     expect(generateHTML()).toMatchSnapshot();
   });
   ```

3. **Performance tests** for large datasets
   ```javascript
   test('handles 1M daily records in <1s', () => {
     const largeStats = generateLargeStats(1_000_000);
     const start = performance.now();
     generateHTML(largeStats);
     expect(performance.now() - start).toBeLessThan(1000);
   });
   ```

4. **Integration tests** with real Claude Code data
   ```javascript
   test('generates report from real stats.json', () => {
     const stats = JSON.parse(readFileSync(expandUser('~/.claude/stats-cache.json'), 'utf-8'));
     expect(() => generateHTML(stats)).not.toThrow();
   });
   ```

## Testing Checklist for Manual QA

Use this when `node generate.mjs` is run:

### Pre-Generation
- [ ] Verify `~/.claude/stats-cache.json` exists and is readable
- [ ] Verify current directory is writable
- [ ] Check available disk space (HTML can be large)

### During Generation
- [ ] All console messages appear (no silent failures)
- [ ] No error stack traces in output
- [ ] Script completes successfully or exits with clear error

### Post-Generation
- [ ] `index.html` exists and opens in browser
- [ ] `data.json` is valid JSON (use `jq` to validate)
- [ ] `prompts.json` is valid JSON
- [ ] Hero stats sum correctly:
  - `totalTokens = totalInput + totalOutput + totalCacheRead + totalCacheCreate`
  - `totalMessages ≈ sum of daily messageCount`
  - `totalSessions ≈ sum of daily sessionCount`
- [ ] All models appear in dashboard
- [ ] Daily activity chart has correct number of bars
- [ ] Top 5 days are actually the top 5
- [ ] Hour distribution covers all 24 hours
- [ ] Cost calculation: `($estimate < $1,000 * totalTokens/1e9)` (sanity check)
- [ ] Special characters (emoji, Unicode) render correctly
- [ ] No XSS payloads execute when viewing source
- [ ] Mobile layout works (test on phone or responsive mode)

## Conclusion

The Claude Usage Report project is a **well-designed dashboard generator** with **excellent output quality** but **zero formal test coverage**. The simplicity of the data transformation pipeline and the human-verifiable output files reduce risk, but as the project grows, automated testing becomes essential.

**Priority recommendation**: Start with **input validation** and **unit tests for format functions**, then expand to **integration tests** and **TypeScript migration**.

The project would benefit most from:
1. A pre-flight check to verify input files exist
2. A JSON schema validator for stats.json
3. Jest + 10-15 unit tests covering fmt(), fmtMoney(), pct()
4. Integration test with sample data
5. GitHub Actions to validate generated output is valid HTML/JSON

These additions would bring the project to "production-ready" quality without major refactoring.
