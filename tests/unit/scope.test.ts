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
