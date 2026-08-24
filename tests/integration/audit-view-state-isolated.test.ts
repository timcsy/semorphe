/**
 * @vitest-environment happy-dom
 *
 * **第五十七條：視圖的私有狀態，不回寫真實。**
 *
 * 流程圖面板要記住「使用者把這個節點拖到哪裡」。那份位置**只屬於那個面板**——
 * 它不是程式的一部分，換一個投影就沒有意義（積木面板不會有「x=340」這種事）。
 *
 * > **一個投影如果能改到被投影的東西，那它就不是投影了。**
 * > （P1 投影定理：唯一真實，各式投影。）
 *
 * 而這條的危險在於它**壞得很安靜**：面板拿到的 `event.tree` 是同一個物件參照，
 * 隨手在上面掛一個 `_layout` 就成了。症狀不是當下的錯誤，是
 * **下一次存檔／雜湊／比對時多出一份沒有人宣告過的資料**。
 *
 * ## 這條護欄的健康檢查是「合成注入」，不是「它今天綠的」
 *
 * 一個沒有任何視圖登錄的登錄表也會綠。所以下面有兩支注入：
 * 一支證明「弄髒了會被抓到」，一支證明「量的時候真的有東西在跑」。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { SemanticBus } from '../../src/core/semantic-bus'
import { registerView, connectViews, resetViews, registeredViews } from '../../src/core/view-registry'
import type { ViewHost, SemanticUpdateEvent } from '../../src/core/view-host'
import type { SemanticNode } from '../../src/core/types'
import { FlowPanel } from '../../src/ui/panels/flow-panel'

/** 穩定序列化——鍵排序過，所以「改了順序」與「改了內容」一樣抓得到 */
function hashTree(node: unknown): string {
  return JSON.stringify(node, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v as object).sort(([a], [b]) => a.localeCompare(b)))
    }
    return v
  })
}

function fixture(): SemanticNode {
  const step = (id: string, cid: string): SemanticNode => ({ id, componentId: cid, properties: {}, children: {} })
  return {
    id: 'root',
    componentId: 'python:program',
    properties: {},
    children: {
      body: [
        step('a', 'python:print'),
        {
          id: 'b',
          componentId: 'python:if',
          properties: {},
          children: { then_body: [step('c', 'python:print')] },
        },
      ],
    },
  }
}

/** 一個什麼都不做的視圖——登錄表要有東西，這條才在量東西 */
function inertView(id: string, onUpdate?: (e: SemanticUpdateEvent) => void): ViewHost {
  return {
    viewId: id,
    viewType: 'test',
    capabilities: { editable: false, needsLanguageProjection: false, consumedAnnotations: [] },
    initialize: async () => {},
    dispose: () => {},
    onSemanticUpdate: (e) => onUpdate?.(e),
    onExecutionState: () => {},
  }
}

function dispatch(views: ViewHost[], tree: SemanticNode): { before: string; after: string } {
  resetViews()
  for (const v of views) registerView(v)
  const bus = new SemanticBus()
  connectViews(bus)
  const before = hashTree(tree)
  bus.emit('semantic:update', { tree, source: 'blocks' })
  return { before, after: hashTree(tree) }
}

beforeEach(() => resetViews())

describe('護欄：視圖私有狀態不回寫真實（第五十七條）', () => {
  it('★ 合成注入：弄髒語義樹一定要被抓到', () => {
    const dirty = inertView('dirty', (e) => {
      ;(e.tree as unknown as Record<string, unknown>)['_layout'] = { x: 10 }
    })
    const { before, after } = dispatch([dirty], fixture())
    expect(after, '一個會弄髒真實的視圖，這條護欄必須看得出來——看不出來就等於沒在守').not.toBe(before)
  })

  it('★ 合成注入：改到深處也要被抓到（只比根不算比過）', () => {
    const dirty = inertView('deep', (e) => {
      e.tree.children['body']?.[1]?.children['then_body']?.push({
        id: 'ghost', componentId: 'python:pass', properties: {}, children: {},
      })
    })
    const { before, after } = dispatch([dirty], fixture())
    expect(after).not.toBe(before)
  })

  it('★ 入口條件：量的時候登錄表不是空的', () => {
    dispatch([inertView('a'), inertView('b')], fixture())
    expect(registeredViews().length, '零個視圖的登錄表也會綠——那時這條護欄什麼都沒量').toBe(2)
  })

  it('流程圖面板：手拖過節點之後，樹一模一樣——而且真的拖動了', () => {
    const panel = new FlowPanel(document.createElement('div'))
    const tree = fixture()
    const { before, after } = dispatch([panel], tree)
    expect(after, '面板在 onSemanticUpdate 裡弄髒了樹').toBe(before)

    const at = (id: string): { x: number; y: number } => {
      const hit = panel.boxPositions().find((b) => b.id === id)
      if (!hit) throw new Error(`圖上沒有 ${id}——那表示下面的「拖過了」是空過的`)
      return hit
    }
    const start = at('b')
    panel.moveNode('b', 40, 25)
    const moved = at('b')
    // ⚠️ **先證明真的動過**：不動也會通過「樹沒變」，而那時這一條什麼都沒守
    expect([moved.x - start.x, moved.y - start.y]).toEqual([40, 25])
    expect(hashTree(tree), '面板的私有狀態寫回了真實').toBe(before)
  })

  it('派送一次語義更新之後，樹一模一樣', () => {
    const seen: SemanticUpdateEvent[] = []
    const { before, after } = dispatch([inertView('reader', (e) => seen.push(e))], fixture())
    expect(seen.length, '事件沒送到 → 下一行的相等是空過的').toBe(1)
    expect(after).toBe(before)
  })
})
