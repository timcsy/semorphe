/**
 * **「這個檔案裡除了骨架本身，還有沒有東西？」**
 *
 * 🔴 它從哪來（2026-08-31）：使用者逐字——「換骨架就要跳出警告，並且說要把
 * 這檔案所有內容都清除」。換骨架是**破壞性**的，所以要問一句。
 *
 * ⚠️ 而那句問話需要這支函式：不扣掉現在那份骨架自己的框，一支空的
 * `int main(){ return 0; }` 也算「有作品」——於是**每一次**換骨架都會被問，
 * 而那時清掉的其實什麼都不是。
 *
 * > **一句「你的東西會不見」的警告，在其實沒有東西的時候，
 * > 教會使用者的是「這個問句可以無視」。**
 *
 * ⚠️ 它與「藏起來」（`stripScaffoldNodes`）不是同一件事：藏起來必須**可逆**，
 * 所以兩個進入點時它刻意不做；這裡問的只是「還剩什麼」，攤平無所謂。
 */
import { describe, it, expect } from 'vitest'
import { unwrapSkeletonFrame } from '../../../src/core/scaffold-nodes'
import '../../../src/core/load-language-packs'

interface N { id: string; componentId: string; properties: Record<string, unknown>; children: Record<string, N[]> }
const n = (componentId: string, properties: Record<string, unknown> = {}, body: N[] = []): N =>
  ({ id: componentId + Math.random(), componentId, properties, children: { body } })
const program = (body: N[]): N => n('cpp:program', {}, body)
const names = (t: unknown) => ((t as N).children.body ?? []).map(
  (x) => x.componentId + (x.properties.name ? `(${String(x.properties.name)})` : ''))

describe('換骨架前：扣掉骨架自己之後還剩什麼', () => {
  it('★ 入口條件——骨架宣告真的載進來了', () => {
    // 錨在**合成量**（拆得動幾種），不是「還剩幾個沒拆」
    expect(names(unwrapSkeletonFrame(program([n('cpp:print')]), 'main'))).toEqual(['cpp:print'])
  })

  it('main → 拆掉 int main() 的框，裡面的語句提到頂層', () => {
    const t = program([n('cpp:func_def', { name: 'main' }, [n('cpp:print'), n('cpp:var_declare')])])
    expect(names(unwrapSkeletonFrame(t, 'main'))).toEqual(['cpp:print', 'cpp:var_declare'])
  })

  it('🔴 `return 0` 一起拆掉——留著它會變成學生沒寫過也看不懂的一行', () => {
    const t = program([n('cpp:func_def', { name: 'main' }, [n('cpp:print'), n('cpp:return')])])
    expect(names(unwrapSkeletonFrame(t, 'main'))).toEqual(['cpp:print'])
  })

  it('arduino → 【兩個】框都拆，語句按宣告順序接起來', () => {
    const t = program([
      n('cpp:func_def', { name: 'setup' }, [n('cpp:pin_mode')]),
      n('cpp:func_def', { name: 'loop' }, [n('cpp:digital_write')]),
    ])
    expect(names(unwrapSkeletonFrame(t, 'arduino'))).toEqual(['cpp:pin_mode', 'cpp:digital_write'])
  })

  it('★ 注入（不亂報）：不是進入點的函式一顆都不准動', () => {
    // 沒有這一支的話，一個「把所有函式都攤平」的實作也會通過上面每一支
    const t = program([n('cpp:func_def', { name: '自己寫的' }, [n('cpp:print')])])
    expect(names(unwrapSkeletonFrame(t, 'main'))).toEqual(['cpp:func_def(自己寫的)'])
  })

  it('🔴 `using namespace std;` 也要扣掉——不然空程式在「淡的」模式下也算有作品', () => {
    // 2026-08-31 實測：漏了它，一支空程式每次換骨架都跳警告
    const t = program([n('cpp:using_namespace', { name: 'std' }),
                       n('cpp:func_def', { name: 'main' }, [n('cpp:return')])])
    expect(names(unwrapSkeletonFrame(t, 'main'))).toEqual([])
  })

  it('★ 注入（不亂報）：沒有進入點的骨架，原樣通過', () => {
    const t = program([n('cpp:func_def', { name: 'main' }, [n('cpp:print')])])
    expect(names(unwrapSkeletonFrame(t, 'none'))).toEqual(['cpp:func_def(main)'])
  })

  it('🔴 一支【空的】main：扣掉框之後是空的——所以換骨架時不該問', () => {
    // 這一支釘的是那句警告的**入口條件**：沒有東西的時候不要問
    const t = program([n('cpp:func_def', { name: 'main' }, [n('cpp:return')])])
    expect(names(unwrapSkeletonFrame(t, 'main')), '🔴 空程式會被判成「有作品」→ 每次換骨架都問').toEqual([])
  })

  it('🔴 main 裡有東西：扣掉框之後不是空的——所以要問', () => {
    const t = program([n('cpp:func_def', { name: 'main' }, [n('cpp:print'), n('cpp:return')])])
    expect(names(unwrapSkeletonFrame(t, 'main')), '🔴 使用者的作品會被靜靜清掉').toEqual(['cpp:print'])
  })
})
