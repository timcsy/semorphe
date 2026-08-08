/**
 * 辨識脈絡終於插電——字串方法不再降級成容器方法（076）
 *
 * ## 這個缺口的形狀
 *
 * `s.clear()` 與 `v.clear()` 都被辨識成 `cpp_container_clear`。辨識層有一句
 * 註解解釋為什麼：
 *
 * > 「共用的方法名一律用通用容器概念，**為了避免型別消歧問題**。」
 *
 * 讀起來像「型別消歧做不到，所以只好降級」。
 *
 * **而辨識脈絡有一整套作用域與型別追蹤**——`declare` / `getType` /
 * `pushScope` / `lookup`，四個方法**零呼叫者**。消歧的工具一直都在，
 * 只是從來沒有人接上。
 *
 * > 一句解釋為什麼「只能這樣」的註解，**會讓那個限制看起來是本質的**。
 * > 而這比沒有註解更難發現——沒有註解的話下一個人會去查。
 *
 * 見 `knowledge/concepts/執行機構.md`「機制有了，沒人接上」第五個實例。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

let tp: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tp = new Parser()
  tp.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

function concepts(code: string): string[] {
  const sem = lifter.lift(tp.parse(code)!.rootNode as never)
  const out: string[] = []
  const walk = (n: SemanticNode | null | undefined): void => {
    if (!n) return
    if (n.conceptId) out.push(n.conceptId)
    for (const k of Object.keys(n.children ?? {})) {
      const v = (n.children as Record<string, SemanticNode[]>)[k]
      for (const c of Array.isArray(v) ? v : [v]) walk(c)
    }
  }
  walk(sem)
  return out
}

describe('脈絡有型別時，方法辨識成專屬概念', () => {
  it('★ `s.clear()`（s 是 string）→ 字串專屬', () => {
    expect(
      concepts('int main(){ string s; s.clear(); }'),
      '字串的 clear 被辨識成通用容器版——專屬身分掉了',
    ).toContain('cpp:string_clear')
  })

  it('★ `s.push_back(c)`（s 是 string）→ 字串專屬', () => {
    expect(concepts("int main(){ string s; s.push_back('a'); }")).toContain('cpp:string_push_back')
  })
})

describe('脈絡沒有型別時，保守地留在通用版', () => {
  it('★ 容器的同名方法仍然是通用版', () => {
    const c = concepts('int main(){ vector<int> v; v.clear(); }')
    expect(c, 'vector 的 clear 被誤判成字串版了').toContain('cpp:container_clear')
    expect(c).not.toContain('cpp:string_clear')
  })

  it('★ 型別不明的變數 → 通用版，**不得猜**', () => {
    // 沒有宣告就沒有型別。猜一個的話，猜錯會靜默產生一個錯的身分，
    // 而那比留在通用版更糟——通用版至少是誠實的降級。
    const c = concepts('int main(){ unknownVar.clear(); }')
    expect(c, '型別不明卻猜了一個專屬身分').not.toContain('cpp:string_clear')
  })

  it('★ 同名變數在內層被遮蔽時，用內層的型別', () => {
    // 這支是**作用域**追蹤的釘子，不只是「有沒有型別表」。
    // 只做一張平表的實作會在這裡拿到外層的 string。
    const c = concepts('int main(){ string s; { vector<int> s; s.clear(); } }')
    expect(c, '內層的 vector 遮蔽了外層的 string，卻還是辨識成字串版').not.toContain('cpp:string_clear')
  })
})

describe('★ 自我驗證：脈絡真的被填了', () => {
  it('沒有這支的話，一個「什麼都不填」的實作也會讓上面的保守測試通過', () => {
    // 正面那兩支才是證據——它們只有在脈絡真的有型別時才會過。
    // 這支把它們的前提釘住：型別追蹤不是空的。
    expect(concepts('int main(){ string s; s.clear(); }')).toContain('cpp:string_clear')
  })
})
