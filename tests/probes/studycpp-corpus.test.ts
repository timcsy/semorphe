/**
 * **探針：拿真實學生的程式碼當語料**（2026-09-09）。
 *
 * 來源：`github.com/core-keeper/StudyCpp`——218 個 `.cpp`、7327 行，
 * 內容是 AP325（吳邦一那本）、TIOJ、zeroJudge、APCS 的練習。
 *
 * 🔴 **它與這個專案既有的語料不同**：既有的是**我們自己寫的**
 * （測試檔的反引號片段、我們生的 Arduino 範例），而這一份是
 * **一個不知道 Semorphe 存在的人寫的**。
 *
 * > **一份自己造的語料，量的是「我們想到的那些輸入」。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const S = apcs as unknown as StylePreset
const CORPUS_DIR = process.env.STUDYCPP_DIR ?? ''

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 120_000)

function files(): { rel: string; code: string }[] {
  const out: { rel: string; code: string }[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git') continue
      const p = path.join(d, e.name)
      if (e.isDirectory()) { walk(p); continue }
      if (!e.name.endsWith('.cpp') && !e.name.endsWith('.cc')) continue
      out.push({ rel: path.relative(CORPUS_DIR, p), code: fs.readFileSync(p, 'utf8') })
    }
  }
  walk(CORPUS_DIR)
  return out.sort((a, b) => a.rel.localeCompare(b.rel))
}

/** 走一遍樹，收 componentId 與 raw_code 的原文。 */
function scan(n: SemanticNode | null | undefined,
  ids: Map<string, number>, raws: string[]): void {
  if (!n || typeof n !== 'object') return
  const id = n.componentId
  if (typeof id === 'string') {
    ids.set(id, (ids.get(id) ?? 0) + 1)
    if (id.includes('raw_')) {
      const t = (n.properties as Record<string, unknown> | undefined)?.['code']
        ?? (n.metadata as Record<string, unknown> | undefined)?.['rawCode']
      if (typeof t === 'string') raws.push(t.trim().slice(0, 120))
    }
  }
  for (const b of Object.values(n.slots ?? {})) for (const c of b ?? []) scan(c, ids, raws)
}

describe.skipIf(!process.env.STUDYCPP_DIR)('探針：StudyCpp 語料', () => {
  it('量：降級率、元件覆蓋、掉下去的語法', () => {
    const fs_ = files()
    expect(fs_.length, '🔴 語料沒讀到——設 STUDYCPP_DIR').toBeGreaterThan(50)

    const ids = new Map<string, number>()
    const raws: string[] = []
    const perFile: { rel: string; nodes: number; raw: number }[] = []
    let liftFail = 0, parseFail = 0, genFail = 0

    for (const f of fs_) {
      let root: SemanticNode | null = null
      try {
        const t = parser.parse(f.code)
        if (!t) { parseFail++; continue }
        root = createTestLifter().lift(t.rootNode as never) as SemanticNode
      } catch { liftFail++; continue }
      if (!root) { liftFail++; continue }

      const fIds = new Map<string, number>()
      const fRaws: string[] = []
      scan(root, fIds, fRaws)
      let n = 0
      for (const [k, v] of fIds) { ids.set(k, (ids.get(k) ?? 0) + v); n += v }
      raws.push(...fRaws)
      perFile.push({ rel: f.rel, nodes: n, raw: fRaws.length })

      try { generateCode(root, 'cpp', S) } catch { genFail++ }
    }

    const totalNodes = perFile.reduce((a, b) => a + b.nodes, 0)
    const totalRaw = perFile.reduce((a, b) => a + b.raw, 0)
    console.log(`\n╔══ StudyCpp 語料 ══╗`)
    console.log(`檔數 ${fs_.length}｜解析不了 ${parseFail}｜lift 不了 ${liftFail}｜產碼丟例外 ${genFail}`)
    console.log(`節點 ${totalNodes}｜降級 ${totalRaw}（${(totalRaw / totalNodes * 100).toFixed(1)}%）`)
    console.log(`用到的元件 ${[...ids.keys()].filter((k) => k.includes(':')).length} 種`)

    console.log(`\n── 降級最多的 15 個檔 ──`)
    for (const f of [...perFile].sort((a, b) => b.raw - a.raw).slice(0, 15)) {
      if (f.raw === 0) break
      console.log(`  ${String(f.raw).padStart(3)}/${String(f.nodes).padEnd(4)} ${f.rel}`)
    }

    console.log(`\n── 掉進殘差通道的原文（前 40，去重）──`)
    const seen = new Set<string>()
    let shown = 0
    for (const r of raws) {
      const k = r.replace(/\s+/g, ' ').slice(0, 60)
      if (seen.has(k) || k.length === 0) continue
      seen.add(k)
      console.log(`  ${k}`)
      if (++shown >= 40) break
    }
    console.log(`  （不同的殘差片段共 ${seen.size} 種）`)

    // ─── 使用者問的另一半：「用到的東西，在 semorphe 拿得到嗎」 ───
    //
    // ⚠️ 這裡**不重做可拿性護欄**（`audit-toolbox-reachability`，缺陷 1）
    //    ——它問的是「每一顆元件」，這裡問的是「這份語料用到的那些」。
    const inToolbox = new Set<string>()
    for (const cat of (JSON.parse(fs.readFileSync(
      path.join(process.cwd(), 'tests/baselines/toolbox.json'), 'utf8'),
    ) as { categories: { blocks: string[] }[] }).categories) {
      for (const b of cat.blocks) inToolbox.add(b)
    }
    // ⚠️ **兩族的「拿不到」是對的，要扣掉**——不扣的話這份名單永遠不會是空的，
    //    而一份永遠不空的名單，第二天之後就沒有人看了。
    //
    //    ① `cpp:program` 是**根**，工具箱裡本來就不該有它
    //    ② 中性形態（`cpp:container_push`／`pop`）——工具箱收的是它們的**具體形態**
    //       （`cpp_container_push_stack` 那幾顆），而那由第十九條可拿性護欄守
    const KNOWN_ABSENT = (k: string): boolean =>
      k === 'cpp:program' ||
      [...inToolbox].some((b) => b.startsWith(`${k.replace(':', '_')}_`))
    const missing = [...ids.keys()]
      .filter((k) => k.startsWith('cpp:'))
      .filter((k) => !inToolbox.has(k.replace(':', '_')))
      .filter((k) => !KNOWN_ABSENT(k))
      .sort((a, b) => (ids.get(b) ?? 0) - (ids.get(a) ?? 0))
    console.log(`\n── 用到了，而工具箱裡拿不到 ──`)
    if (missing.length === 0) console.log('  （沒有）')
    for (const m of missing) console.log(`  ${String(ids.get(m)).padStart(4)} 次  ${m}`)

    expect(true).toBe(true)
  }, 600_000)
})
