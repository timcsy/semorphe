/**
 * **`pop_front` 的 round-trip**——四個面向各驗一次。
 *
 * ## 它從哪來
 *
 * 使用者學生的 218 支競賽練習裡 **18 支**用到 `.pop_front(`（`deque` 的 BFS 佇列
 * 是 AP325 的日常）。在補上這顆元件之前，那 18 支全部拋
 * `UNDECLARED_VAR: dq（不是一個物件）`——方法名沒登錄，掉到泛用的 method_call。
 *
 * ## 真語料上量到的（2026-09-16，那 18 支）
 *
 *     ① lift 認得        18/18
 *     ② 產碼保住         18/18
 *     ③ 語義不動點       18/18
 *     ④ 跑起來與 g++ 一樣  6 一致 · 0 支因 pop_front 失敗
 *
 * ⚠️ 剩下那幾支的錯是**別的族**（索引越界、`#define rep(i,n)` 帶參數的巨集、
 * 未宣告的名字）——見 `knowledge/history/241`「還開著的」。
 *
 * ## ⚠️ 這裡的程式是從語料**蒸餾**出來的，不是抄一整支
 *
 * 常駐測試不得依賴外部 repo（`STUDYCPP_DIR` 沒設時那批探針會跳過，而**跳過的
 * 護欄與不存在的護欄長得一樣**）。所以把那 18 支的共同形狀留在這裡。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { generateCode } from '../../src/core/projection/code-generator'
import { runCppDetailed, hasReferenceCompiler } from '../helpers/run-cpp'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const ROOT = process.cwd()
const S = apcs as unknown as StylePreset
let parser: Parser
let lifter: ReturnType<typeof createTestLifter>

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
}, 120_000)

const lift = (c: string): SemanticNode =>
  lifter.lift(parser.parse(c)!.rootNode as never) as SemanticNode
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) ids(k as SemanticNode, out)
  return out
}

/** 那 18 支的共同形狀——BFS 的佇列迴圈。 */
/**
 * 🔴 **標頭走墊片，不手列**（2026-09-18，CI 抓到）——本機是 Apple clang（libc++）、
 * CI 是 GNU g++（libstdc++），而**兩者對「哪個標頭遞移帶進哪個」的答案不同**。
 * 手列的話，本機全綠而 CI 紅，訊息還會說「測試自己的問題」。
 * 見第 120 條護欄 `audit-refcc-headers`。
 */
const BFS = `#include <bits/stdc++.h>
using namespace std;
int main(){
    deque<int> dq;
    dq.push_back(1); dq.push_back(2); dq.push_back(3);
    while(!dq.empty()){
        int x = dq.front();
        dq.pop_front();
        cout << x;
    }
    return 0;
}
`

describe('round-trip：容器的前端移除', () => {
  it('🔴 身分：lift 出來的是這顆元件本身，不是降級也不是末端那一族', () => {
    const a = ids(lift(BFS))
    expect(a, '🔴 沒認出來 → 下面每一條都在驗空集合').toContain('cpp:container_pop_front')
    expect(a).not.toContain('cpp:raw_code')
    // ⚠️ 不寫別顆元件的完整身分（就近性護欄兩個方向都會報）——用尾綴比對
    expect(a.filter((x) => /:(vector_pop|container_pop)$/.test(x)),
      '🔴 前端被判成末端——那會靜靜地拿掉錯的那一個').toEqual([])
  })

  it('🔴 產碼：`pop_front` 不得在來回一趟裡變成別的東西', () => {
    const gen = generateCode(lift(BFS), 'cpp', S)
    expect(gen).toContain('.pop_front();')
  })

  it('🔴 語義不動點：轉一圈回來是同一棵樹', () => {
    const once = ids(lift(BFS)).join(',')
    const twice = ids(lift(generateCode(lift(BFS), 'cpp', S))).join(',')
    expect(twice).toBe(once)
  })

  it.runIf(hasReferenceCompiler())('🔴 行為：跑起來與參照編譯器一樣', async () => {
    const ref = runCppDetailed(BFS)
    expect(ref.ok, `🔴 參照編譯器收不下（測試自己的問題）：${ref.ok ? '' : ref.message}`).toBe(true)
    const out: string[] = []
    const interp = new SemanticInterpreter({ maxSteps: 200_000 })
    interp.setOutputCallback((x) => out.push(x))
    await interp.execute(lift(BFS), [])
    expect(out.join(''), '🔴 取出的順序不對——先進先出變成後進先出').toBe(ref.ok ? ref.output : '')
  }, 60_000)

  it('🔴 帶下標的接收者：`d2[i].pop_front()`（相鄰串列的慣用寫法）', async () => {
    const src = `#include <bits/stdc++.h>\nusing namespace std;\ndeque<int> d2[5];\n`
      + `int main(){ int i=3; d2[i].push_back(7); d2[i].push_back(9); d2[i].pop_front();`
      + ` cout << d2[3].front(); return 0; }\n`
    expect(ids(lift(src))).toContain('cpp:container_pop_front')
    const out: string[] = []
    const interp = new SemanticInterpreter({ maxSteps: 200_000 })
    interp.setOutputCallback((x) => out.push(x))
    await interp.execute(lift(src), [])
    expect(out.join(''), '🔴 接收者在組裝時被壓成字串——要走 receiverOf').toBe('9')
  })
})
