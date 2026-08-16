/**
 * 階段 6.6 ⑤ 的量測：**涵蓋率**與**假警報**。
 *
 * ⚠️ 需要 `tools/clangd-oracle/wasm/`（121 MB，不進版控）——取得方式見 README。
 * ⚠️ 需要 `/tmp/ours.json`（我們的判定）——由 `tests/probes/our-verdicts.test.ts` 產生。
 */
import { chromium } from 'playwright'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
if (!fs.existsSync(path.join(ROOT, 'wasm/clangd.wasm'))) {
  console.error('🔴 缺 wasm/clangd.wasm ——見 tools/clangd-oracle/README.md')
  process.exit(1)
}
const OURS = process.env.OURS ?? '/tmp/ours.json'
if (!fs.existsSync(OURS)) {
  console.error(`🔴 缺 ${OURS}（我們的判定）——先跑 npx vitest run tests/probes/our-verdicts.test.ts`)
  process.exit(1)
}
fs.copyFileSync(OURS, path.join(ROOT, 'samples.json'))

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' }
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]))
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end() }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(p)] || 'application/octet-stream',
    // clangd 是多執行緒的，需要 SharedArrayBuffer → 這裡直接給標頭。
    // ⚠️ 產品端在 GitHub Pages 上設不了標頭，要靠 coi-serviceworker（2026-08-15 實測可行）。
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  })
  fs.createReadStream(p).pipe(res)
})
await new Promise((r) => srv.listen(8095, '127.0.0.1', r))

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', (m) => { const t = m.text(); if (t.startsWith('[P]')) process.stdout.write('\r  ' + t.slice(3)) })
await page.goto('http://127.0.0.1:8095/oracle.html')
const { rows } = await page.evaluate(() => new Promise((res) => { window.__resolve = res }))
await browser.close()
srv.close()
fs.unlinkSync(path.join(ROOT, 'samples.json'))

/**
 * 🔴 **這個裁判有它看不懂的方言，那些必須歸「無法確定」。**
 *
 * `build-guardrail` 第 5 步：「判不出來的要歸【無法確定】，而且不計入任一類
 * ——為了讓數字好看而樂觀歸類，比沒有分類更糟。」
 *
 * ⚠️ 不排除它們的話，涵蓋率會從 **78% 變成 35%**——而那個數字
 * **看起來像一個發現**（6.5「紅的是世界，還是語料？」）。
 */
const noiseOf = (group, errs) => {
  if (group === 'Arduino') return 'Arduino 核心標頭不在 wasi sysroot 裡'
  if (errs.some((e) => e.code === 'pp_file_not_found')) return '標頭找不到'
  if (errs.some((e) => /__gcd/.test(e.msg))) return 'GCC 擴充（__gcd）不在 libc++ 裡'
  return null
}

const ours = new Map(JSON.parse(fs.readFileSync(OURS, 'utf8')).map((r) => [r.group + ' ' + r.name, r]))
const joined = rows.map((c) => {
  const o = ours.get(c.group + ' ' + c.name)
  const errs = c.errs ?? []
  const noise = noiseOf(c.group, errs)
  const clang = (c.threw || !c.done) ? '無法確定' : noise ? '無法確定' : errs.length ? '不合法' : '合法'
  return { group: c.group, name: c.name, clang, reason: noise ?? '', weRefuse: !!o?.weRefuse, codes: [...new Set(errs.map((e) => e.code))] }
})

const ill = joined.filter((r) => r.clang === '不合法')
const leg = joined.filter((r) => r.clang === '合法')
const unk = joined.filter((r) => r.clang === '無法確定')
const caught = ill.filter((r) => r.weRefuse)
const fp = leg.filter((r) => r.weRefuse)

console.log(`\n樣本 ${joined.length}｜不合法 ${ill.length}／合法 ${leg.length}／無法確定 ${unk.length}`)
console.log(`\n  涵蓋率  ${caught.length}/${ill.length} = ${(caught.length / ill.length * 100).toFixed(0)}%`)
console.log(`  假警報  ${fp.length}/${leg.length} = ${(fp.length / leg.length * 100).toFixed(1)}%`)
console.log('\n=== 缺口（clang 說不合法而我們放行）===')
for (const r of ill) if (!r.weRefuse) console.log(`  🔴 [${r.group}] ${r.name}  ${r.codes.join(',')}`)
console.log('\n=== 假警報（我們擋下而 clang 說合法）===')
for (const r of fp) console.log(`  ⚠️ [${r.group}] ${r.name}`)
if (!fp.length) console.log('  （0 筆）')
console.log('\n=== 無法確定（不計入任一邊）===')
const byReason = unk.reduce((a, r) => ((a[r.reason] = (a[r.reason] ?? 0) + 1), a), {})
for (const [k, v] of Object.entries(byReason)) console.log(`  ${v}  ${k}`)

fs.writeFileSync('/tmp/oracle-result.json', JSON.stringify(joined, null, 1))
