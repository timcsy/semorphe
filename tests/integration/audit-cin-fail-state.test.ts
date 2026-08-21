/**
 * 護欄：`cin >>` 的**失敗狀態會黏住**——而 Semorphe 曾經每次都當作全新。
 *
 * ## 為什麼有這一條
 *
 * 使用者 2026-08-21：「順便把 C++ 那個靜默回 0 也修掉」。
 * 🔴 而追下去發現我原本的描述是**錯的**：那個 `return {type:'int', value:0}`
 * 是 `cin >> a >> b` 的**回傳值**（讀成功幾筆），`while (cin >> x)` 正是靠它
 * 終止的——它是對的，不能動。
 *
 * 真正的病在旁邊一行，而且更嚴重：
 *
 * | 輸入 | 真 g++ | 修之前的 Semorphe |
 * |---|---|---|
 * | `cin>>n; cin>>m;` ← `abc 5` | `n=0 m=7` | `n=0` **`m=5`** |
 * | `while(cin>>x)` ← `1 abc 3` | 跑 **1** 圈 | 跑 **3** 圈 |
 *
 * C++ 的 `>>` 一旦失敗就設 `failbit`，**之後每一次 `>>` 都立刻失敗**直到
 * `clear()`。Semorphe 把壞掉的 token 吞掉、給變數一個 0、然後**繼續讀下一個**。
 *
 * > **一個「回 0」如果同時是合法的回傳值與失敗的代號，
 * > 那麼「它到底失敗了沒有」這個問題在程式裡沒有地方可以問。**
 *
 * ## 量測機構
 *
 * 每一條都跟**參照編譯器**對答案（`knowledge/concepts/等價與觀察集.md` §七：
 * 行為由量測定義，不由宣告定義）。我對 `cin` 在 EOF 時的行為**猜錯過一次**
 * ——以為 C++11 會把變數設成 0，而 libc++ 實測是保持舊值。
 *
 * ⚠️ 參照編譯器**一次批次跑完**（`beforeAll`），不是在每支 `it` 裡各跑一次。
 * 第一版用 `runCppDetailed`（`execSync`）連跑七次，於是同一輪的
 * `bus-update-not-user-edit` **每次紅不同支**——`execSync` 阻塞整條 Node
 * 執行緒，把時間敏感的測試推過門檻。
 *
 * > **一支自己會過的測試，可以只因為它【佔住執行緒的時間】而弄紅別人。
 * > 而那時紅的是別人，沒有人會來查這一支。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import { CppParser } from '../../src/languages/cpp/parser'
import { runCppBatchDetailed, hasReferenceCompiler } from '../helpers/run-cpp'
import type { SemanticNode } from '../../src/core/types'

const HEAD = '#include <iostream>\n#include <cstdio>\n#include <string>\nusing namespace std;\n'

let parser: CppParser
let lifter: ReturnType<typeof createTestLifter>
/** 參照編譯器的答案，與 `CASES` 同序。 */
let reference: string[]

async function runSemorphe(body: string, stdin: string[]): Promise<string> {
  const tree = lifter.lift((await parser.parse(body)).rootNode as never) as SemanticNode
  expect(tree, '提升不得回 null——負向斷言在空樹上會空過').not.toBeNull()
  const interp = new SemanticInterpreter()
  await interp.execute(tree, stdin)
  return interp.getOutput().join('')
}

/** `stdin` 以陣列給 Semorphe、以換行串給參照編譯器——**同一份輸入的兩種投影**。 */
const CASES: { name: string; body: string; stdin: string[] }[] = [
  {
    name: '格式錯的 token 之後，下一個 >> 也必須失敗（failbit 黏住）',
    body: 'int main(){int n=9,m=7;cin>>n;cin>>m;printf("n=%d m=%d\\n",n,m);return 0;}',
    stdin: ['abc 5'],
  },
  {
    name: 'while(cin>>x) 遇到非數字必須停，不得吞掉它繼續跑',
    body: 'int main(){int x=0;int c=0;while(cin>>x){c++;if(c>9)break;}printf("c=%d\\n",c);return 0;}',
    stdin: ['1 abc 3'],
  },
  {
    name: '輸入耗盡之後，後面的 >> 不得再讀到東西',
    body: 'int main(){int a=9,b=8,c=7;cin>>a>>b;cin>>c;printf("a=%d b=%d c=%d\\n",a,b,c);return 0;}',
    stdin: ['5'],
  },
  // 🔴 以下兩條是**反向**的：它們今天就是對的，這一刀不得把它們弄壞。
  {
    name: '正常讀到底的 while(cin>>x) 要照常跑完（回 0 是它的終止條件）',
    body: 'int main(){int x=0,s=0;while(cin>>x){s+=x;}printf("s=%d\\n",s);return 0;}',
    stdin: ['1 2 3'],
  },
  {
    name: '跨行的 token 要接得起來',
    body: 'int main(){int a=0,b=0;cin>>a>>b;printf("a=%d b=%d\\n",a,b);return 0;}',
    stdin: ['4', '6'],
  },
  {
    name: '空行是空白，>> 要跳過它繼續讀，不是就此失敗',
    body: 'int main(){int a=9;cin>>a;printf("a=%d\\n",a);return 0;}',
    stdin: ['', '5'],
  },
  {
    name: '字串的 >> 讀不到時同樣黏住',
    body: 'int main(){string s="old";int n=9;cin>>n;cin>>s;printf("n=%d s=%s\\n",n,s.c_str());return 0;}',
    stdin: ['zz 7'],
  },
  // `getline` 與 `>>` 是**同一條流**，所以它也看同一個 failbit。
  // ⚠️ 而它與 `>>` 對變數的處置**又不一樣**（量出來的，不是推出來的）：
  //    已經失敗 → 完全不動；乾淨的流遇 EOF → **清空**。
  {
    name: 'getline 在 >> 失敗之後不得再讀到東西，而且不動變數',
    body: 'int main(){int n=9;string s="OLD";cin>>n;getline(cin,s);printf("n=%d s=[%s]\\n",n,s.c_str());return 0;}',
    stdin: ['abc', 'hello'],
  },
  {
    name: 'getline 在乾淨的流上遇到 EOF 要把字串清空',
    body: 'int main(){string s="OLD";getline(cin,s);printf("s=[%s]\\n",s.c_str());return 0;}',
    stdin: [],
  },
]

beforeAll(async () => {
  registerCppLanguage()
  parser = new CppParser()
  await parser.init('public')
  lifter = createTestLifter()
  const outcomes = await runCppBatchDetailed(
    CASES.map((c) => HEAD + c.body),
    8,
    // 空的 stdin 也要餵**空檔案**而不是省略——「沒有輸入」與「輸入耗盡」
    // 在這條護欄裡必須走同一條路。
    CASES.map((c) => (c.stdin.length > 0 ? c.stdin.join('\n') + '\n' : '')),
  )
  reference = outcomes.map((r, i) => {
    if (!r.ok) throw new Error(`參照編譯器跑不動第 ${i + 1} 段（${CASES[i].name}）：${r.message}`)
    return r.output!
  })
}, 60_000)

describe('cin 的失敗狀態（對照參照編譯器）', () => {
  it('參照編譯器必須在——沒有它就量不出對錯，不得跳過', () => {
    expect(hasReferenceCompiler()).toBe(true)
  })

  CASES.forEach((c, i) => {
    it(c.name, async () => {
      const expected = reference[i]
      expect(expected.length, '參照輸出不得是空的——空的比對會空過').toBeGreaterThan(0)
      expect(await runSemorphe(c.body, c.stdin)).toBe(expected)
    })
  })
})

/**
 * 🔴 這一條量不到參照編譯器上——它問的是**瀏覽器裡的互動**。
 *
 * Python 的 `input()` 犯過一模一樣的病（spec 173）：用 `io.read()` 而不等使用者，
 * 於是學生按下執行，提示印出來了，而程式**當場就用空字串跑完**。
 * `getline(cin, name)` 是同一顆病在 C++ 這一側。
 */
describe('getline 要等使用者（瀏覽器條件）', () => {
  it('有 inputProvider 時必須等，而不是拿空字串就走', async () => {
    const body = 'int main(){string name;cout<<"請輸入名字：";getline(cin,name);cout<<"hello, "<<name<<endl;return 0;}'
    const tree = lifter.lift((await parser.parse(body)).rootNode as never) as SemanticNode
    expect(tree).not.toBeNull()
    const interp = new SemanticInterpreter()
    let waited = false
    interp.setWaitingCallback(() => { waited = true })
    interp.setInputProvider(() => Promise.resolve('小明'))
    await interp.execute(tree, [])
    expect(waited, '沒有進入等待＝沒有問使用者').toBe(true)
    expect(interp.getOutput().join('')).toBe('請輸入名字：hello, 小明\n')
  })
})
