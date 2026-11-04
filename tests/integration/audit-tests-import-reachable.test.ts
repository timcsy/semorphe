/**
 * **測試驗的，必須是產品執行的那一份**（2026-10-31 立）。
 *
 * ## 為什麼
 *
 * 大掃除那天，同一個形狀量到五次：護欄或測試 import 一個**產品走不到**的模組，於是綠燈證明的是
 * 「那份程式碼是對的」，而產品跑的是另一份（`field-write`、`cpp/module.ts`、`identity`、`ComponentRegistry`、
 * `TemplateGenerator`——最後那個還讓 google 風格 70 / 86 份課文解答編不過而沒人發現）。
 * 見 `knowledge/draft/retired/2026-10-31-三條待確認的教訓.md`（已寫進 experience） 第四、五條。
 *
 * ## 怎麼量
 *
 * 從產品入口出發，沿靜態 import、`import('…')`、`import.meta.glob('…')`、worker 入口（`new URL('…', import.meta.url)`）走一遍得到「產品可達」的集合；
 * 每支測試 import 的 `src/` 模組都要在裡面。刻意的例外列在 `ALLOWED`，**每一筆附理由**。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, printReport } from '../helpers/guardrail'

const ENTRIES = ['src/main.ts', 'src/vscode/extension.ts', 'src/vscode/webview/main.ts', 'src/sdk/index.ts']

/** 刻意不在產品路徑上的模組——每一筆說得出為什麼。 */
const ALLOWED: Record<string, string> = {
  'src/languages/cpp/vocab/arduino.ts': '`@cos-mos/arduino` 詞彙套件第一版（2026-11-04）：匯出探針與單元測試先用；宿主層的結構頻道 `onStructure` 接上時產品才走到它（vision〈@cos-mos/arduino 詞彙套件〉的步驟 3，cos-mos specs/017 T004）',
  'src/core/naming.ts': '護欄專用的命名詞彙表（審 component.json 的資料，產品不需要）',
  'src/languages/cpp/naming.ts': '同上，C++ 的詞彙',
  'src/languages/python/naming.ts': '同上，Python 的詞彙',
  'src/core/component/judges.ts': '「哪條測試判哪一路」的 metadata，本來就是測試的資料',
  'src/core/component/path-syntax.ts': '階層身分的語法（vision〈分子與粒度切換〉的前置）；投影函式呼叫產品的 idToDir／deriveBlockType，只剩分類這一層是它自己的',
  'src/core/molecule.ts': 'vision〈分子與粒度切換〉的切口計算——流程的框只收整棵子樹（埠由節點自己的接點給），多選接上時才走到它（spec 187）',
  // 🟢 2026-10-31（spec 182）：`providers/cella/formalize`、`verdict.ts` 三筆拿掉——Cella 提供者接上了，它們在產品路徑上
  // ⏳ 2026-11-03（spec 205 T008）：JS 直譯器的登記拿掉了，它與它的提供者從產品走不到——**期限是 6c-4**：直譯器連同 import 它的測試一起刪，這兩筆也跟著拿掉
}

const EXT = ['', '.ts', '.tsx', '.json', '/index.ts']

function resolve(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.') && !spec.startsWith('/src/')) return null
  const base = spec.startsWith('/src/') ? path.join(REPO_ROOT, spec) : path.resolve(path.dirname(path.join(REPO_ROOT, fromFile)), spec)
  for (const e of EXT) {
    const p = base + e
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return path.relative(REPO_ROOT, p)
  }
  return null
}

/** `import.meta.glob('/src/components/*\/*\/component.json')` → 符合的檔。只支援 `*` 一層一個。 */
function expandGlob(pattern: string): string[] {
  const parts = pattern.replace(/^\//, '').split('/')
  let acc = ['']
  for (const part of parts) {
    const next: string[] = []
    for (const dir of acc) {
      const abs = path.join(REPO_ROOT, dir)
      if (part.includes('*')) {
        if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) continue
        const re = new RegExp('^' + part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
        for (const e of fs.readdirSync(abs)) if (re.test(e)) next.push(path.join(dir, e))
      } else next.push(path.join(dir, part))
    }
    acc = next
  }
  return acc.filter((p) => fs.existsSync(path.join(REPO_ROOT, p)) && fs.statSync(path.join(REPO_ROOT, p)).isFile())
}

function importsOf(file: string): string[] {
  const src = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')
  const out: string[] = []
  for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) {
    const r = resolve(file, m[1])
    if (r) out.push(r)
  }
  for (const m of src.matchAll(/import\.meta\.glob\(\s*['"]([^'"]+)['"]/g)) out.push(...expandGlob(m[1]))
  // 🔴 Web Worker 的入口（spec 182）：`new Worker(new URL('./worker.ts', import.meta.url))` 不是 import，
  //    而 worker 帶進來的模組（Cella 的判決、資產、快取）全在產品路徑上——不認得它，那一整支會被判成「走不到」
  for (const m of src.matchAll(/new\s+URL\(\s*['"]([^'"]+\.ts)['"]\s*,\s*import\.meta\.url/g)) {
    const r = resolve(file, m[1])
    if (r) out.push(r)
  }
  return out
}

function reachable(): Set<string> {
  const seen = new Set<string>()
  const stack = [...ENTRIES]
  while (stack.length) {
    const f = stack.pop()!
    if (seen.has(f)) continue
    seen.add(f)
    if (/\.(ts|tsx)$/.test(f)) for (const g of importsOf(f)) if (!seen.has(g)) stack.push(g)
  }
  return seen
}

function testFiles(): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(path.join(REPO_ROOT, d), { withFileTypes: true })) {
      const rel = path.join(d, e.name)
      if (e.isDirectory()) walk(rel)
      else if (e.name.endsWith('.test.ts')) out.push(rel)
    }
  }
  walk('tests')
  return out
}

const reach = reachable()
const offenders: { test: string; mod: string }[] = []
for (const t of testFiles()) {
  for (const mod of importsOf(t)) {
    if (!mod.startsWith('src/') || !/\.(ts|tsx)$/.test(mod)) continue
    if (reach.has(mod) || ALLOWED[mod]) continue
    offenders.push({ test: t, mod })
  }
}

describe('護欄：測試驗的是產品執行的那一份', () => {
  it('★ 入口條件：真的走到了產品的模組（含 glob 載入的膠囊）', () => {
    expect(reach.size, '可達集合太小 → 走訪壞了，下面的零是假的').toBeGreaterThan(800)
    expect([...reach].some((f) => f.includes('src/components/cpp/print/generate.ts')), 'glob 載入的膠囊沒走到').toBe(true)
  })

  it('★ 注入：一個產品走不到的模組必須被抓到', () => {
    expect(reach.has('src/core/molecule.ts'), '今天分子的切口計算還沒接進產品——它若變成可達，這支注入要換一個例子').toBe(false)
  })

  it('★ 注入：worker 入口（`new Worker(new URL(…))`）帶進來的模組算走得到', () => {
    expect(reach.has('src/providers/cella/worker.ts'), 'worker 入口沒被認出來').toBe(true)
    expect(reach.has('src/providers/cella/verdict.ts'), 'worker 帶進來的模組沒走到').toBe(true)
  })

  it('★ 例外名單裡的每一筆都還存在，而且真的走不到（走得到了就該從名單拿掉）', () => {
    const stale = Object.keys(ALLOWED).filter((m) => !fs.existsSync(path.join(REPO_ROOT, m)) || reach.has(m))
    expect(stale).toEqual([])
  })

  it('🔴 硬性零：測試不得 import 產品走不到、又沒有列進例外的模組', () => {
    printReport('測試 import 的模組都在產品路徑上嗎', [
      `產品可達：${reach.size} 個檔；例外：${Object.keys(ALLOWED).length} 筆`,
      ...offenders.map((o) => `  ${o.test} → ${o.mod}`),
    ])
    expect(offenders.map((o) => `${o.test} → ${o.mod}`)).toEqual([])
  })
})
