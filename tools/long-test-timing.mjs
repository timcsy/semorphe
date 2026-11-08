#!/usr/bin/env node
/**
 * **長測試的每檔耗時 ＋「過了但變慢」的報告**（2026-11-07，使用者決定「測試執行資源有限」②的後半——經 cos-mos-main → semorphe-main 轉達）。
 *
 *   node tools/long-test-timing.mjs <輸出目錄> <狀態目錄> <這一輪的名字> <這一輪結束時的負載>
 *
 * 讀 `<輸出目錄>` 裡的 `test-*.log`（vitest 每檔一行 ` ✓ <檔> (N tests) <毫秒>ms`）與 `e2e-*.log`
 * （playwright 每支一行 `✓ N [chromium] › <檔>:行:欄 › 標題 (<時間>)`，依檔加總），
 * 寫成 `<狀態目錄>/timing/<名字>.tsv`（檔、毫秒、類別），再和【上一輪】那份比：
 *   變慢 ＝ 這一輪 ≥ 上一輪 × 1.5，而且多了 ≥ 5 秒（短的檔抖一下不算）。
 *
 * ⚠️ 變慢先看負載：兩輪的負載寫在每份檔的第一行（`# 負載=…`），負載差很多時「變慢」多半是機器忙，不是測試變重。
 * 只報、不擋——結果不影響長測試的 exit。
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const [outDir, stateDir, name, load] = process.argv.slice(2)
if (!outDir || !stateDir || !name) {
  console.error('用法：long-test-timing.mjs <輸出目錄> <狀態目錄> <名字> [負載]')
  process.exit(2)
}

// eslint-disable-next-line no-control-regex
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '')
const ms = (num, unit) => Math.round(Number(num) * (unit === 'ms' ? 1 : unit === 's' ? 1000 : 60_000))

/** @type {Map<string, { ms: number, kind: string }>} */
const files = new Map()
const add = (file, t, kind) => {
  const prev = files.get(file)
  files.set(file, { ms: (prev?.ms ?? 0) + t, kind })
}

for (const f of readdirSync(outDir)) {
  // ⚠️ 輸出目錄常是 scratchpad，裡面有別的子目錄——讀到目錄會 EISDIR 整支掛掉、這一輪的計時就沒了（2026-11-09 撞到）
  if (!statSync(join(outDir, f)).isFile()) continue
  const text = strip(readFileSync(join(outDir, f), 'utf8'))
  if (f.startsWith('test-') && f.endsWith('.log')) {
    for (const line of text.split('\n')) {
      // 檔那一行縮排一格；測試那一行縮排更多，不收
      const m = /^ [✓❯×↓] (\S+\.test\.ts) \(\d+ tests?[^)]*\)(?: (\d+(?:\.\d+)?)(ms|s))?\s*$/.exec(line)
      if (m) add(m[1], m[2] ? ms(m[2], m[3]) : 0, '全套')
    }
  } else if (f.startsWith('e2e-') && f.endsWith('.log')) {
    for (const line of text.split('\n')) {
      const m = /[✓✘-] +\d+ \[[a-z]+\] › (\S+?):\d+:\d+ › .*\((\d+(?:\.\d+)?)(ms|s|m)\)\s*$/.exec(line)
      if (m) add(m[1], ms(m[2], m[3]), 'e2e')
    }
  }
}

if (files.size === 0) {
  console.log('⏱ 每檔耗時：紀錄裡一個檔都沒抓到（格式變了？）——不寫')
  process.exit(0)
}

const dir = join(stateDir, 'timing')
mkdirSync(dir, { recursive: true })
// 上一輪：timing/ 裡最新的那一份（不含這一輪）
const prevFile = readdirSync(dir).filter((x) => x.endsWith('.tsv') && x !== `${name}.tsv`)
  .map((x) => ({ x, t: statSync(join(dir, x)).mtimeMs })).sort((a, b) => b.t - a.t)[0]?.x

const rows = [...files].sort((a, b) => b[1].ms - a[1].ms)
writeFileSync(join(dir, `${name}.tsv`), `# 負載=${load ?? '—'}\n` + rows.map(([f, v]) => `${f}\t${v.ms}\t${v.kind}`).join('\n') + '\n')

const total = (kind) => rows.filter(([, v]) => v.kind === kind).reduce((s, [, v]) => s + v.ms, 0)
console.log(`⏱ 每檔耗時：${files.size} 個檔（全套各檔加總 ${(total('全套') / 60000).toFixed(1)} 分、e2e ${(total('e2e') / 60000).toFixed(1)} 分）→ ${join(dir, `${name}.tsv`)}`)

if (!prevFile || !existsSync(join(dir, prevFile))) { console.log('   （沒有上一輪可比）'); process.exit(0) }
const prevText = readFileSync(join(dir, prevFile), 'utf8')
const prevLoad = /^# 負載=(.*)$/m.exec(prevText)?.[1] ?? '—'
const prev = new Map(prevText.split('\n').filter((l) => l && !l.startsWith('#')).map((l) => { const [f, t] = l.split('\t'); return [f, Number(t)] }))
const slower = rows
  .filter(([f, v]) => prev.has(f) && v.ms >= prev.get(f) * 1.5 && v.ms - prev.get(f) >= 5000)
  .map(([f, v]) => `${f} ${(prev.get(f) / 1000).toFixed(1)} → ${(v.ms / 1000).toFixed(1)} 秒`)
if (slower.length === 0) { console.log(`   和上一輪（${prevFile.replace(/\.tsv$/, '')}）比：沒有變慢的檔`); process.exit(0) }
console.log(`🐢 過了但變慢（和上一輪 ${prevFile.replace(/\.tsv$/, '')} 比；負載 上一輪 ${prevLoad} → 這一輪 ${load ?? '—'}——負載差很多時先當作機器忙）：`)
for (const s of slower.slice(0, 15)) console.log(`   ${s}`)
if (slower.length > 15) console.log(`   …另 ${slower.length - 15} 個`)
