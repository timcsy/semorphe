/** @vitest-environment jsdom */
/**
 * **護欄：面板可獨立掛載（spec 217 第四刀；與第五十八條「核心可獨立出貨」同形）**
 *
 * 它壞掉 ＝「面板是可獨立掛載的套件」這句話壞掉。做法：建出貨的兩支套件（`dist-sdk/semorphe.mjs`、`panels.mjs`），
 * 用 esbuild 建 `examples/panels-only/`（不經 Vite、不經 `app.ts`），在一個 DOM 裡跑它：
 *
 * ```
 * 程式碼 → 積木   工作區裡要有積木，而且有 if
 * 積木 → 程式碼   改一顆數字欄位，textarea 要跟著變
 * ```
 *
 * 🔴 三種結局要分得開（`build-guardrail` 第 9 步）：建不起來／跑不起來／跑了而互轉不對——前兩種不准被讀成綠的。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve(__dirname, '../..')
const SOURCE = '#include <iostream>\nusing namespace std;\nint main() {\n    int x = 5;\n    if (x > 3) {\n        cout << x;\n    }\n    return 0;\n}\n'

interface Summary { blocks: number; types: string[]; codeAfterEdit: string }

/** 判準本身——合成注入測得到它 */
export function judge(s: Summary): string[] {
  const bad: string[] = []
  if (s.blocks === 0) bad.push('工作區一顆積木都沒有——積木定義沒註冊、渲染器沒設、或兩支套件各帶一份核心（三種都不報錯）')
  if (!s.types.some((t) => /if/.test(t))) bad.push(`程式碼 → 積木沒有 if：${s.types.join(', ')}`)
  if (!/int x = 7;/.test(s.codeAfterEdit)) bad.push(`積木 → 程式碼沒有反映改動：\n${s.codeAfterEdit}`)
  return bad
}

type Run = { ok: true; summary: Summary } | { ok: false; stage: string; detail: string }
let result: Run

async function run(): Promise<Run> {
  const sh = (args: string[]): void => { execFileSync('node', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }) }
  try { sh(['tools/build-sdk.mjs']) } catch (e) { return { ok: false, stage: '出貨產物建不起來', detail: String(e) } }
  try { sh(['examples/panels-only/build.mjs']) } catch (e) { return { ok: false, stage: '例子在 esbuild 下建不起來', detail: String(e) } }
  try {
    const mod = await import(pathToFileURL(path.join(ROOT, 'examples/panels-only/dist/assemble.mjs')).href)
    const blocksEl = document.createElement('div')
    Object.assign(blocksEl.style, { width: '800px', height: '600px' })
    const codeEl = document.createElement('textarea')
    document.body.append(blocksEl, codeEl)
    const app = await mod.assemble({ blocksEl, codeEl, wasmDir: path.join(ROOT, 'public') })
    await app.codeToBlocks(SOURCE)
    const all = app.workspace().getAllBlocks(false) as { type: string; getField(n: string): { getValue(): unknown; setValue(v: unknown): void } | null; inputList: unknown[] }[]
    const types = all.map((b) => b.type)
    // 積木 → 程式碼：把 5 改成 7（找值是 5 的那一格欄位）
    let edited = false
    for (const b of all) for (const inp of (b as unknown as { inputList: { fieldRow: { name?: string; getValue(): unknown; setValue(v: unknown): void }[] }[] }).inputList) for (const f of inp.fieldRow) {
      if (!edited && f.name && String(f.getValue()) === '5') { f.setValue('7'); edited = true }
    }
    app.blocksToCode()
    return { ok: true, summary: { blocks: all.length, types, codeAfterEdit: codeEl.value } }
  } catch (e) {
    return { ok: false, stage: '例子在 DOM 裡跑不起來', detail: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) }
  }
}

beforeAll(async () => { result = await run() }, 180_000)

describe('護欄：面板可獨立掛載（spec 217 第四刀）', () => {
  it('★ 合成注入：工作區一顆積木都沒有一定要被判成失敗', () => {
    expect(judge({ blocks: 0, types: [], codeAfterEdit: 'int x = 7;' }).join('｜')).toContain('一顆積木都沒有')
  })
  it('★ 合成注入：積木改了而程式碼沒變一定要被判成失敗', () => {
    expect(judge({ blocks: 9, types: ['cpp_if'], codeAfterEdit: 'int x = 5;' })).not.toEqual([])
  })
  it('★ 合成注入：正確的輸入不得亂報', () => {
    expect(judge({ blocks: 9, types: ['cpp_if'], codeAfterEdit: 'int x = 7;' })).toEqual([])
  })
  it('★ 只靠出貨的套件：程式碼 ⇄ 積木兩個方向都走得通', () => {
    if (!result.ok) throw new Error(`${result.stage}\n${result.detail.slice(0, 1500)}`)
    expect(judge(result.summary), JSON.stringify(result.summary, null, 1)).toEqual([])
  })
})
