/**
 * 契約測試：形態選擇（specs/097-multi-form-projection/contracts/form-selection.md）
 *
 * 這份契約管**投影方向**（語義 → 積木）在有多個形態時怎麼選。
 *
 * ## 為什麼這些測試長這樣
 *
 * **C-1 寫成「全函數」而不是「回傳正確的形態」**：因為回傳 `undefined` 會讓每個
 * 呼叫端各自發明退路——那是碎裂。而且「選不出來」在這個系統裡有一個正確答案
 * （中性的預設形態），不是一個錯誤。
 *
 * **C-5 用「同輸入同輸出 ＋ 節點無樹引用」操作化**：純度沒辦法直接斷言，但
 * 「投影是逐節點的」這件事可以——選擇函式只拿得到 node 與呈現位置，拿不到樹。
 */
import { describe, it, expect } from 'vitest'
import { selectForm, validateFormSet } from '../../../src/core/projection/form-selection'
import type { FormSet } from '../../../src/core/types'
import { createNode } from '../../../src/core/semantic-tree'

/** 依容器種類分的形態集合——本功能的第一個真實案例 */
const 容器形態: FormSet = {
  conceptId: 'synth_container_push',
  axis: { name: 'container_kind', from: 'property', property: 'container_kind' },
  // ⚠️ `_` 是保留鍵＝**中性形態**（軸值取不到時用的那個）。
  // 第一版把中性形態只寫在 `fallback` 而沒放進 `forms`，於是 FS-2
  // （fallback 必須在 forms 的值域裡）永遠不成立——**測試抓到的是設計缺口，
  // 不是實作 bug**。中性形態是一顆真實存在的積木，它本來就該被宣告出來。
  forms: { _: 'synth_container_push', stack: 'synth_stack_push', queue: 'synth_queue_push' },
  fallback: 'synth_container_push',
}

/** 依呈現位置分的形態集合——既有 expressionCounterpart 的一般化 */
const 位置形態: FormSet = {
  conceptId: 'synth_increment',
  axis: { name: 'role', from: 'position' },
  forms: { _: 'synth_increment', statement: 'synth_increment', expression: 'synth_increment_expr' },
  fallback: 'synth_increment',
}

/** 沒有軸的形態集合——絕大多數元件是這一種 */
const 單一形態: FormSet = {
  conceptId: 'synth_plain',
  axis: null,
  forms: { _: 'synth_plain' },
  fallback: 'synth_plain',
}

describe('C-1 選擇是全函數——任何輸入都回傳一個 blockType', () => {
  it('★ 軸值取得到 → 回對應的形態', () => {
    const node = createNode('synth_container_push', { obj: 'st', container_kind: 'stack' }, {})
    expect(selectForm(容器形態, node, {}).blockType).toBe('synth_stack_push')
  })

  it('★ 軸值取不到 → 回 fallback，且**不出聲**', () => {
    // 屬性不存在是**合法狀態**（CK-1：辨識查不到型別就不寫），不是缺陷。
    // 這裡出聲的話，每一顆沒有容器脈絡的積木都會噴一次警告。
    const node = createNode('synth_container_push', { obj: 'x' }, {})
    const r = selectForm(容器形態, node, {})
    expect(r.blockType).toBe('synth_container_push')
    expect(r.degraded).toBeUndefined()
  })

  it('★ 軸值取得到但沒有對應形態 → 回 fallback，**且出聲**', () => {
    // 這個不一樣：宣告說軸是 container_kind，而節點帶了一個宣告裡沒有的值
    // ——那是**宣告與資料不一致**，必須看得見。
    const node = createNode('synth_container_push', { obj: 'pq', container_kind: 'priority_queue' }, {})
    const r = selectForm(容器形態, node, {})
    expect(r.blockType).toBe('synth_container_push')
    expect(r.degraded?.reason, '宣告裡沒有的軸值必須出聲，否則新增容器種類時會靜默用錯形態').toContain('priority_queue')
  })

  it('★ 沒有軸 → 直接回唯一的形態', () => {
    const node = createNode('synth_plain', {}, {})
    expect(selectForm(單一形態, node, {}).blockType).toBe('synth_plain')
  })

  it('★ 依呈現位置的軸：statement 與 expression 各自選到不同形態', () => {
    const node = createNode('synth_increment', { var: 'i' }, {})
    expect(selectForm(位置形態, node, { position: 'statement' }).blockType).toBe('synth_increment')
    expect(selectForm(位置形態, node, { position: 'expression' }).blockType).toBe('synth_increment_expr')
  })

  it('★ 位置軸而呼叫端沒給位置 → fallback，不得丟例外', () => {
    const node = createNode('synth_increment', { var: 'i' }, {})
    expect(() => selectForm(位置形態, node, {})).not.toThrow()
    expect(selectForm(位置形態, node, {}).blockType).toBe('synth_increment')
  })
})

describe('C-5 選擇只讀 node 與呈現位置', () => {
  it('★ 同輸入同輸出（無隱藏狀態）', () => {
    const node = createNode('synth_container_push', { obj: 'st', container_kind: 'stack' }, {})
    const a = selectForm(容器形態, node, {})
    const b = selectForm(容器形態, node, {})
    expect(a.blockType).toBe(b.blockType)
  })

  it('★ 節點沒有父節點／樹的引用也選得出來', () => {
    // 投影是逐節點的。這支釘住「選擇不得走樹」——走樹的實作在這裡會壞，
    // 因為這個節點是孤立的。
    const 孤立節點 = createNode('synth_container_push', { obj: 'q', container_kind: 'queue' }, {})
    expect(selectForm(容器形態, 孤立節點, {}).blockType).toBe('synth_queue_push')
  })
})

describe('FS-1..FS-4 形態集合的不變式', () => {
  it('★ FS-1：forms 非空', () => {
    const bad = { ...單一形態, forms: {} }
    expect(validateFormSet(bad).ok).toBe(false)
  })

  it('★ FS-2：fallback 必須在 forms 的值域裡', () => {
    const bad = { ...容器形態, fallback: 'synth_not_a_form' }
    const v = validateFormSet(bad)
    expect(v.ok).toBe(false)
    expect(v.reason).toContain('fallback')
  })

  it('★ FS-3：有軸 ⟺ 形態多於一個', () => {
    expect(validateFormSet({ ...單一形態, axis: { name: 'x', from: 'position' } }).ok, '只有一個形態卻宣告了軸').toBe(false)
    expect(validateFormSet({ ...容器形態, axis: null }).ok, '多個形態卻沒有軸').toBe(false)
  })

  it('★ 合法的形態集合必須通過', () => {
    // 反向：一個什麼都拒絕的驗證器也能通過上面每一支
    expect(validateFormSet(容器形態).ok).toBe(true)
    expect(validateFormSet(位置形態).ok).toBe(true)
    expect(validateFormSet(單一形態).ok).toBe(true)
  })
})

describe('C-3 同一身分的任兩形態必須等價', () => {
  it('★ 所有形態的 blockType 互不相同', () => {
    // 兩個形態指向同一顆積木＝那不是兩個形態，是宣告錯了
    // ⚠️ 不含保留鍵 `_`——`_` 與某個軸值指向同一顆積木是**合法的**
    // （中性形態剛好就是敘述版，位置軸那組就是這樣）。重複只在**軸值之間**才算錯。
    const bad = { ...容器形態, forms: { _: 'synth_n', stack: 'synth_same', queue: 'synth_same' }, fallback: 'synth_n' }
    expect(validateFormSet(bad).ok).toBe(false)
  })
})

describe('C-4 反向唯一——一個 blockType 只能屬於一個 conceptId', () => {
  it('★ 兩個形態集合共用同一個 blockType 必須被擋下', () => {
    const 另一個: FormSet = {
      conceptId: 'synth_other',
      axis: null,
      forms: { _: 'synth_stack_push' }, // ← 撞到容器形態的 stack 形態
      fallback: 'synth_stack_push',
    }
    const v = validateFormSet(另一個, [容器形態])
    expect(v.ok, '共用 blockType 的話反推不出 conceptId').toBe(false)
    expect(v.reason).toContain('synth_stack_push')
  })

  it('★ 反向：不撞的兩個形態集合必須通過', () => {
    expect(validateFormSet(位置形態, [容器形態]).ok).toBe(true)
  })
})
