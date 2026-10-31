/**
 * **判決綁定語料**（Cella 的衍生原則 C18「判決綁定」）（spec 180 T009）：每一筆 `{id, text, program?}`，交給 Cella 的 CI。
 *
 * - `text`：semorphe 的 render（程式碼）——課文解答 lift 之後，用產品的產碼路徑（產生器 → 補丁器）產回來的 C++。
 * - `program`：formalize 翻得出時附上 Cella 的程式 JSON；翻不出來的不送（unknown 的理由另列在 `unknown`）。
 *
 * Cella 拿 clang 讀「semorphe 的 text」與「Cella 的 generate(program)」，比兩棵樹（綁定比對，四之十三後的 cella 回覆）。
 * ⚠️ 只有設了 `BINDING_CORPUS_OUT=<路徑>` 才寫檔——不讓 npm test 有副作用（our-verdicts 那一次的教訓）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { buildBindingCorpus } from '../helpers/binding-corpus'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

describe('判決綁定語料', () => {
  it('★ 每一份來源都產得出 text；翻得出的附 program', () => {
    const rows = buildBindingCorpus(parser).map(({ tree: _t, ...r }) => r)
    const cRows = rows.filter((r) => String(r.id).startsWith('c-bridge/'))
    expect(cRows.filter((r) => String(r.text).includes('<cstdio>')).map((r) => r.id), '🔴 C 程式的 text 用了 C++ 的標頭').toEqual([])
    const withProgram = rows.filter((r) => r.program).length
    console.log(`判決綁定語料：${rows.length} 筆，附 program 的 ${withProgram} 筆`)
    expect(rows.length).toBeGreaterThan(90)
    if (process.env.BINDING_CORPUS_OUT) {
      fs.writeFileSync(process.env.BINDING_CORPUS_OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
      console.log(`寫到 ${process.env.BINDING_CORPUS_OUT}`)
    }
  })
})
