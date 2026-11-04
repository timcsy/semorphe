/**
 * **排版提示走一趟積木**（spec 214）——`renderMapping.hints` 宣告的屬性，積木上沒有一格（「排版提示，不給學生編輯」），
 * 而走一趟積木回來不得被改寫。C++ 那兩顆在 `form-invariance` 量（連翻給 Cella 的程式一起比）；這裡量 Python 那兩顆。
 *
 * 原本：`{x for x in xs}` 走一趟積木變成 `[x for x in xs]`（集合變串列——行為變了）；`enumerate(xs, start=1)` 變成 `enumerate(xs, 1)`。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { liftPython, generatePython } from '../helpers/python-lift'
import { allComponentDefs } from '../helpers/component-scan'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import type { SemanticNode } from '../../src/core/types'
import fs from 'node:fs'
import path from 'node:path'

const projections = ['python/array_make_for', 'python/container_enumerate'].flatMap((c) =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/components', c, 'forms/blocks.json'), 'utf8')) as never[])

let renderer: PatternRenderer
let extractor: PatternExtractor
beforeAll(() => {
  expect(allComponentDefs().length, '元件掃描是空的').toBeGreaterThan(0)
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), projections)
  const specs = reg.getAll()
  renderer = new PatternRenderer()
  renderer.loadBlockSpecs(specs)
  extractor = new PatternExtractor()
  extractor.loadBlockSpecs(specs)
})

/** 把樹裡第一顆 `id` 換成它走一趟積木回來的樣子 */
function viaBlock(tree: SemanticNode, id: string): { before: SemanticNode; after: SemanticNode | null } {
  let before: SemanticNode | null = null
  const find = (n: SemanticNode): void => { if (!before && n.componentId === id) before = n; for (const v of Object.values(n.slots ?? {})) v.forEach(find) }
  find(tree)
  expect(before, `樹裡沒有 ${id}——下面會空過`).not.toBeNull()
  const block = renderer.render(before!, { renderBlock: (n) => renderer.render(n), renderExpression: (n) => renderer.render(n, undefined, 'expression'), renderStatementChain: () => null, nextBlockId: () => 'b' } as never, 'expression')
  return { before: before!, after: block ? extractor.extract(block as never) : null }
}

describe('排版提示走一趟積木（Python）', () => {
  it.each([
    ['python:array_make_for', 'a = {x for x in xs}\n', 'wrap', 'set'],
    ['python:array_make_for', 'a = sum(x for x in xs)\n', 'wrap', 'generator'],
    ['python:container_enumerate', 'b = list(enumerate(xs, start=1))\n', 'start_style', 'keyword'],
  ])('🔴 %s：%s 的 %s 留著', async (id, code, prop, value) => {
    const { before, after } = viaBlock(await liftPython(code), id)
    expect(before.properties[prop], '正向錨點：lift 記下了原文的寫法').toBe(value)
    expect(after?.properties[prop]).toBe(value)
  })
  it('對照組：預設寫法不帶提示（不憑空多出一格）', async () => {
    const { after } = viaBlock(await liftPython('a = [x for x in xs]\n'), 'python:array_make_for')
    expect(after?.properties.wrap ?? '').toBe('')
    expect(generatePython).toBeTypeOf('function')
  })
})
