/**
 * **指定給一個沒宣告的名字，必須停下來。**
 *
 * ## 為什麼這支是【行為端】而不是單元端
 *
 * 缺陷在 `Scope.set`，而**單元測試看不見它真正的失敗模式**：
 * 舊寫法用 `try { parent.get(name) } catch {}` 當「看看有沒有」，
 * 而改成拒絕之後 `parent.set()` 也會拋——**被那個 catch 吃掉之後，
 * 行為完全沒變，而它看起來像修好了**。
 *
 * > **一個為了「看看有沒有」而存在的 try/catch，
 * > 在被查的那件事本身開始拋錯的那天，會靜靜地把新行為吃掉。**
 *
 * 那條路徑只有**跑一段真的程式**才會走到。
 *
 * ## 🔴 限定：這是執行期，不是編輯期（1/3）
 *
 * C++ 在**編譯時**拒絕；我們在**跑到那一行時**才停。
 * **一段有這個錯誤而永遠跑不到那一行的程式，仍然會「成功」。**
 * ⚠️ **不得宣稱兩者等價。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { RuntimeError } from '../../src/interpreter/errors'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 30000)

async function run(src: string): Promise<{ out: string; stopped: RuntimeError | null }> {
  const tree = createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  try {
    await i.execute(tree)
    return { out: i.getOutput().join(''), stopped: null }
  } catch (e) {
    return { out: i.getOutput().join(''), stopped: e instanceof RuntimeError ? e : null }
  }
}

describe('指定給一個沒宣告的名字', () => {
  it('★ 會停下來，而訊息說得出是哪個名字', async () => {
    const r = await run('int main() {\n  score = 90;\n  cout << score << endl;\n  return 0;\n}')
    expect(r.stopped, '🔴 沒宣告就指定，而程式跑完了——C++ 拒絕這段程式').not.toBeNull()
    expect(r.stopped!.i18nKey, '應該與「讀一個沒宣告的名字」用同一則訊息').toBe('RUNTIME_ERR_UNDECLARED_VAR')
    expect(JSON.stringify(r.stopped!.params), '訊息裡要說得出是哪個名字').toContain('score')
  }, 60000)

  it('★ 讀與寫用同一則訊息——同一件事不得有兩種說法', async () => {
    const w = await run('int main() {\n  score = 90;\n  return 0;\n}')
    const rd = await run('int main() {\n  cout << score << endl;\n  return 0;\n}')
    expect(w.stopped?.i18nKey).toBe(rd.stopped?.i18nKey)
  }, 60000)

  it('★ 停下來之前已經印出的東西，必須還在', async () => {
    const r = await run('int main() {\n  cout << "before" << endl;\n  nope = 1;\n  return 0;\n}')
    expect(r.stopped, '應該停下來').not.toBeNull()
    expect(r.out, '🔴 一道會拒絕的檢查，必須回答「被拒絕的東西去哪了」——已印出的不得消失').toContain('before')
  }, 60000)

  // ★ 不亂報那一側——🔴 比「會報」更重要（build-guardrail 第 9 步）
  it.each([
    ['指標寫入（&x 後 *p = 7）', 'int main() {\n  int x = 1;\n  int* p = &x;\n  *p = 7;\n  cout << x << endl;\n  return 0;\n}', '7\n'],
    ['外層作用域寫入（迴圈內改 n）', 'int main() {\n  int n = 1;\n  for (int i = 0; i < 3; i = i + 1) {\n    n = n + i;\n  }\n  cout << n << endl;\n  return 0;\n}', '4\n'],
    ['引用別名寫入（int& r）', 'void bump(int& r) {\n  r = r + 10;\n}\nint main() {\n  int v = 1;\n  bump(v);\n  cout << v << endl;\n  return 0;\n}', '11\n'],
  ])('★ 不亂報：%s', async (_label, src, expected) => {
    const r = await run(src)
    expect(r.stopped, `🔴 這個寫法【宣告過】，不得被判成未宣告`).toBeNull()
    expect(r.out).toBe(expected)
  }, 60000)
})
