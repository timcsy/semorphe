import { describe, it, expect } from 'vitest'
import { Scope } from '../../src/interpreter/scope'
import { RuntimeError } from '../../src/interpreter/errors'

describe('Scope', () => {
  it('should declare and get a variable', () => {
    const scope = new Scope()
    scope.declare('x', { type: 'int', value: 42 })
    expect(scope.get('x')).toEqual({ type: 'int', value: 42 })
  })

  it('should set an existing variable', () => {
    const scope = new Scope()
    scope.declare('x', { type: 'int', value: 1 })
    scope.set('x', { type: 'int', value: 2 })
    expect(scope.get('x')).toEqual({ type: 'int', value: 2 })
  })

  it('should look up parent scope for get', () => {
    const parent = new Scope()
    parent.declare('x', { type: 'int', value: 10 })
    const child = parent.createChild()
    expect(child.get('x')).toEqual({ type: 'int', value: 10 })
  })

  it('should set variable in parent scope when it exists there', () => {
    const parent = new Scope()
    parent.declare('x', { type: 'int', value: 5 })
    const child = parent.createChild()
    child.set('x', { type: 'int', value: 99 })
    expect(parent.get('x')).toEqual({ type: 'int', value: 99 })
  })

  it('should throw on get for undeclared variable', () => {
    const scope = new Scope()
    expect(() => scope.get('nope')).toThrow(RuntimeError)
  })

  it('should throw on duplicate declaration in same scope', () => {
    const scope = new Scope()
    scope.declare('x', { type: 'int', value: 1 })
    expect(() => scope.declare('x', { type: 'int', value: 2 })).toThrow(RuntimeError)
  })

  it('should allow same name declaration in child scope (shadowing)', () => {
    const parent = new Scope()
    parent.declare('x', { type: 'int', value: 1 })
    const child = parent.createChild()
    child.declare('x', { type: 'int', value: 2 })
    expect(child.get('x')).toEqual({ type: 'int', value: 2 })
    expect(parent.get('x')).toEqual({ type: 'int', value: 1 })
  })

  it('should return all visible variables via getAll', () => {
    const parent = new Scope()
    parent.declare('a', { type: 'int', value: 1 })
    const child = parent.createChild()
    child.declare('b', { type: 'string', value: 'hi' })
    const all = child.getAll()
    expect(all.get('a')).toEqual({ type: 'int', value: 1 })
    expect(all.get('b')).toEqual({ type: 'string', value: 'hi' })
  })

  /**
   * 🔴 **這支測試在 2026-08-15 被反轉了**（spec `127`）。
   *
   * ## 它原本斷言什麼
   *
   * `should set variable in current scope if not found anywhere`
   * ——寫一個從沒宣告過的名字，**會在當前作用域把它建立出來**。
   * 來自 `8887e4d`「Phase 2 foundational … TDD」，最早的地基階段，
   * **而它沒有寫任何理由**。
   *
   * ## 為什麼反轉
   *
   * 那個行為讓 `score = 90;`（忘了寫 `int`）跑得完並印出 90，而 C++ 拒絕它。
   * 使用者逐字：「**寫錯還能順利執行就是不合理的**」。
   * 而同一個類別的 `get()` 對**同一件事**早就會拋
   * ——**讀會拋，寫不會**，那個不對稱沒有任何理由支持它。
   *
   * 🔴 **而這支測試是唯一擋著的東西**：注入嚴格版跑全套，
   * 4167/4168 綠，**只有它失敗**。
   *
   * > **一支沒有寫理由的測試，記的是「當時的實作」而不是「當時的意圖」
   * > ——而後來的人分不出這兩者，於是它變成一道看起來像決定的擋牆。**
   *
   * ## ⚠️ 推翻這一條需要什麼
   *
   * 需要一個**真的需要隱式建立**的呼叫端，而它說得出
   * 「為什麼那個名字不能先宣告」。2026-08-15 查過三個候選——
   * 指標寫入、外層作用域、引用別名——**三個都不需要**
   * （它們的名字都宣告過，走的是 `refs` 或往上遞迴那兩條路）。
   *
   * 找到那樣一個呼叫端 → 這一條該讓路。**找不到就不要改回去。**
   */
  it('should refuse to write a name that was never declared', () => {
    const scope = new Scope()
    expect(() => scope.set('y', { type: 'int', value: 7 })).toThrow(/RUNTIME_ERR_UNDECLARED_VAR/)
  })

  it('still writes through to an outer scope that declared the name', () => {
    const parent = new Scope()
    parent.declare('n', { type: 'int', value: 1 })
    const child = parent.createChild()
    child.set('n', { type: 'int', value: 2 })
    expect(parent.get('n'), '往外找那條路不得被一起關掉').toEqual({ type: 'int', value: 2 })
  })
})

/**
 * 🔴 **一個名字可以綁到「一個算出來的位置」**（2026-09-20）。
 *
 * 在此之前 `refs` 只存得下 `(作用域, 名字)` 一組字串，於是兩個綁定點
 *（`cpp:func_call` 的參照參數、`cpp:var_declare_ref`）都只認得**裸的變數名**
 * ——而「否則」那一條是**安靜地改用傳值**。
 *
 * 這裡量的是機構本身：讀、寫、以及**寫進去之後原處真的變了**。
 */
describe('Scope：綁到一個算出來的位置', () => {
  /** 一個假的位置——背後是一個格子陣列的第 i 格。 */
  function cellPlace(cells: number[], i: number): { read(): { type: 'int', value: number }, write(v: { value: unknown }): void } {
    return {
      read: () => ({ type: 'int' as const, value: cells[i] }),
      write: (v) => { cells[i] = Number(v.value) },
    }
  }

  it('讀得到那一格', () => {
    const cells = [10, 20, 30]
    const s = new Scope()
    s.declarePlaceRef('r', cellPlace(cells, 1))
    expect(s.get('r')).toEqual({ type: 'int', value: 20 })
  })

  it('🔴 寫進去之後【原處】真的變了——這一條才是重點', () => {
    const cells = [10, 20, 30]
    const s = new Scope()
    s.declarePlaceRef('r', cellPlace(cells, 1))
    s.set('r', { type: 'int', value: 7 })
    expect(cells, '🔴 寫回去掉了——那正是「傳參考變成傳值」的症狀').toEqual([10, 7, 30])
  })

  it('子作用域看得到父層綁的位置，而且寫得回去', () => {
    const cells = [0, 0]
    const parent = new Scope()
    parent.declarePlaceRef('r', cellPlace(cells, 0))
    const child = parent.createChild()
    expect(child.get('r')).toEqual({ type: 'int', value: 0 })
    child.set('r', { type: 'int', value: 5 })
    expect(cells).toEqual([5, 0])
  })

  it('★ 錨點：綁到名字的那一種照舊', () => {
    const owner = new Scope()
    owner.declare('x', { type: 'int', value: 1 })
    const s = owner.createChild()
    s.declareRef('r', owner, 'x')
    s.set('r', { type: 'int', value: 9 })
    expect(owner.get('x')).toEqual({ type: 'int', value: 9 })
  })

  it('has／hasLocal 認得它', () => {
    const s = new Scope()
    s.declarePlaceRef('r', cellPlace([1], 0))
    expect(s.has('r')).toBe(true)
    expect(s.hasLocal('r')).toBe(true)
  })
})
