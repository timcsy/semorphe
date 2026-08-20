/**
 * 區塊註解的內容不得在 積木 → 語義樹 的方向掉
 *
 * ## 這支測試的來歷
 *
 * 推導一致性護欄（第二十四條）逼出來的：`deriveRenderMapping` 有**兩份**，
 * 而抽取那份的欄位型別清單少了 `field_multilinetext`。
 *
 * ```
 * 渲染 fields = {"TEXT":"區塊註解內容"}
 * 抽回 props  = {}                      ← 掉了
 * ```
 *
 * 使用者在積木編輯器裡寫的區塊註解**會消失**，而唯一的症狀是
 * 「切換積木風格之後東西不見了」——那時他已經不記得自己寫過什麼。
 *
 * `cpp_doc_comment` 沒中，只因為它剛好有**顯式**的 `renderMapping.fields`。
 * 兩顆長得幾乎一樣，一顆會掉一顆不會——這就是為什麼推導必須只有一份。
 */
import { describe, it, expect } from 'vitest'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { allCppConcepts, allCppProjections } from '../../src/languages/cpp/all-declarations'
import { createNode } from '../../src/core/semantic-tree'

function pipeline(): { render: PatternRenderer; extract: PatternExtractor } {
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allCppConcepts(), allCppProjections())
  const specs = reg.getAll()
  const render = new PatternRenderer()
  const extract = new PatternExtractor()
  render.loadBlockSpecs(specs)
  extract.loadBlockSpecs(specs)
  return { render, extract }
}

describe('多行文字欄位走一圈不掉內容', () => {
  const samples: [string, string, string][] = [
    ['cpp:block_comment', 'text', '第一行\n第二行\n第三行'],
    ['cpp:doc_comment', 'brief', '這個函式做什麼'],
  ]

  for (const [componentId, prop, value] of samples) {
    it(`★ ${componentId}.${prop} 渲染後抽得回來`, () => {
      const { render, extract } = pipeline()
      const state = render.render(createNode(componentId, { [prop]: value }) as never)
      expect(state, `${componentId} 渲染不出積木`).not.toBeNull()

      const back = extract.extract(state as never)
      expect(
        back?.properties?.[prop],
        `內容在 積木 → 語義樹 的方向掉了——使用者寫的東西會消失，` +
          `而唯一的症狀是「切換積木風格之後不見了」`,
      ).toBe(value)
    })
  }

  it('★ 換行保得住——多行文字的重點就是多行', () => {
    const { render, extract } = pipeline()
    const value = 'a\nb'
    const state = render.render(createNode('cpp:block_comment', { text: value }) as never)
    const back = extract.extract(state as never)
    expect(String(back?.properties?.text)).toContain('\n')
  })
})
