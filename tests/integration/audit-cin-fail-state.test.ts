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
 * 第一版用同步的單次執行（`execSync`）連跑七次，於是同一輪的
 * `bus-update-not-user-edit` **每次紅不同支**——`execSync` 阻塞整條 Node
 * 執行緒，把時間敏感的測試推過門檻。
 *
 * > **一支自己會過的測試，可以只因為它【佔住執行緒的時間】而弄紅別人。
 * > 而那時紅的是別人，沒有人會來查這一支。**
 *
 * ## spec 205（重構 6c-3）：受測的換成 Cella，權威仍是參照編譯器
 *
 * ```
 * 前半（failbit 黏住）    受測：Cella 的判決（runCella，stdin 一次給完）   權威：參照編譯器（不變）
 * 後半（getline 要等人）  受測：Cella 的工作階段（awaiting-input → supplyInput）
 * ```
 *
 * ⚠️ **三條的程式換了輸出的寫法**（`printf("%s", s.c_str())` → `cout << s`）：當時 formalize 翻不出 `c_str()`（`cpp:string_as_cstring`；spec 215 補上），
 * 照原樣的話這三條會停在「翻不出」、守不到 failbit。換寫法不換語義——兩邊（Cella 與參照編譯器）跑的是同一段新程式，期望值照舊由參照編譯器給；
 * `c_str()` 那個缺口另外釘一條（最後一支）。
 *
 * 2026-11-04（spec 212，6c-5）：參照編譯器那一半拿掉——期望值是當時 g++ 跑出來、與 Cella 一致的字串，寫死在這裡
 * （擷取在本機的 Apple clang 上做；這一檔的呼叫點全部兩邊相同，不同的那幾條原本就包在 `knownCellaGap` 裡，期望字串照樣寫 g++ 的值）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import { CppParser } from '../../src/languages/cpp/parser'
import { runCella, expectCellaOut, knownCellaGap } from '../helpers/cella-run'
import { cellaProvider, openCella, waitSession } from '../helpers/cella-session'
import type { SemanticNode } from '../../src/core/types'

const HEAD = '#include <bits/stdc++.h>\nusing namespace std;\n'

let parser: CppParser
let lifter: ReturnType<typeof createTestLifter>

/** `stdin` 以陣列寫，餵兩邊時都接成同一串（每行補換行；空陣列是空檔案）——**同一份輸入**。 */
const stdinOf = (lines: string[]): string => (lines.length > 0 ? lines.join('\n') + '\n' : '')

/**
 * `expected`：參照編譯器（當時的 g++）餵同一份 stdin 跑出來的輸出，與 Cella 一致——寫死在這裡（spec 212）。
 * `cellaGap`：Cella 今天與參照編譯器不一致、而**參照編譯器是對的**的那幾條——照 knownCellaGap 釘住（修好時會紅），原因寫在那一條上。
 */
const CASES: { name: string; body: string; stdin: string[]; expected: string; cellaGap?: RegExp }[] = [
  {
    name: '格式錯的 token 之後，下一個 >> 也必須失敗（failbit 黏住）',
    body: 'int main(){int n=9,m=7;cin>>n;cin>>m;printf("n=%d m=%d\\n",n,m);return 0;}',
    stdin: ['abc 5'],
    expected: "n=0 m=7\n",
  },
  {
    name: 'while(cin>>x) 遇到非數字必須停，不得吞掉它繼續跑',
    body: 'int main(){int x=0;int c=0;while(cin>>x){c++;if(c>9)break;}printf("c=%d\\n",c);return 0;}',
    stdin: ['1 abc 3'],
    expected: "c=1\n",
  },
  {
    name: '輸入耗盡之後，後面的 >> 不得再讀到東西',
    body: 'int main(){int a=9,b=8,c=7;cin>>a>>b;cin>>c;printf("a=%d b=%d c=%d\\n",a,b,c);return 0;}',
    stdin: ['5'],
    expected: "a=5 b=8 c=7\n",
  },
  // 🔴 以下三條是**反向**的：它們今天就是對的，這一刀不得把它們弄壞。
  {
    name: '正常讀到底的 while(cin>>x) 要照常跑完（回 0 是它的終止條件）',
    body: 'int main(){int x=0,s=0;while(cin>>x){s+=x;}printf("s=%d\\n",s);return 0;}',
    stdin: ['1 2 3'],
    expected: "s=6\n",
  },
  {
    name: '跨行的 token 要接得起來',
    body: 'int main(){int a=0,b=0;cin>>a>>b;printf("a=%d b=%d\\n",a,b);return 0;}',
    stdin: ['4', '6'],
    expected: "a=4 b=6\n",
  },
  {
    name: '空行是空白，>> 要跳過它繼續讀，不是就此失敗',
    body: 'int main(){int a=9;cin>>a;printf("a=%d\\n",a);return 0;}',
    stdin: ['', '5'],
    expected: "a=5\n",
  },
  {
    name: '字串的 >> 讀不到時同樣黏住',
    // spec 205：原本 printf("%s", s.c_str())——見檔頭
    body: 'int main(){string s="old";int n=9;cin>>n;cin>>s;cout<<"n="<<n<<" s="<<s<<"\\n";return 0;}',
    stdin: ['zz 7'],
    expected: "n=0 s=old\n",
  },
  // `getline` 與 `>>` 是**同一條流**，所以它也看同一個 failbit。
  // ⚠️ 而它與 `>>` 對變數的處置**又不一樣**（量出來的，不是推出來的）：
  //    已經失敗 → 完全不動；乾淨的流遇 EOF → **清空**。
  {
    name: 'getline 在 >> 失敗之後不得再讀到東西，而且不動變數',
    body: 'int main(){int n=9;string s="OLD";cin>>n;getline(cin,s);cout<<"n="<<n<<" s=["<<s<<"]\\n";return 0;}',
    stdin: ['abc', 'hello'],
    expected: "n=0 s=[OLD]\n",
  },
  {
    name: 'getline 在乾淨的流上遇到 EOF 要把字串清空',
    body: 'int main(){string s="OLD";getline(cin,s);cout<<"s=["<<s<<"]\\n";return 0;}',
    stdin: [],
    expected: "s=[]\n",
    // 🟢 Cella 0.1.202611021533 修好（之前印 `s=[OLD]`）。標準 [string.io]：getline 建好 sentry 就先 `str.erase()` 再讀——遇 EOF 時字串已經清空。
  },
]

beforeAll(async () => {
  registerCppLanguage()
  parser = new CppParser()
  await parser.init('public')
  lifter = createTestLifter()
}, 60_000)

describe('cin 的失敗狀態（Cella 對照參照編譯器）', () => {
  // spec 212：原本是「參照編譯器必須在」——參照編譯器退場後，守的是同一件事：每一條都有權威（當時的 g++）給的期望值
  it('每一條都有參照編譯器給的期望值——沒有它就量不出對錯，不得跳過', () => {
    for (const c of CASES) expect(c.expected.length, `「${c.name}」沒有寫死的期望值——空的比對會空過`).toBeGreaterThan(0)
  })

  CASES.forEach((c) => {
    it(c.name, async () => {
      const expected = c.expected
      expect(expected.length, '參照輸出不得是空的——空的比對會空過').toBeGreaterThan(0)
      const body = () => expectCellaOut(HEAD + c.body, expected, { stdin: stdinOf(c.stdin) })
      if (c.cellaGap) await knownCellaGap(c.cellaGap, body)
      else await body()
    })
  })

  /** `s.c_str()` 原本翻不出（cpp:string_as_cstring）——spec 215 補上 formalize（printf 的 `%s` 引數就是它），釘子拔掉 */
  it('`printf("%s", s.c_str())` 翻得出、印得對', async () => {
    await expectCellaOut(HEAD + 'int main(){string s="old";printf("s=%s\\n",s.c_str());return 0;}', 's=old\n')
  })
})

/**
 * 🔴 這一條量不到參照編譯器上——它問的是**瀏覽器裡的互動**。
 *
 * Python 的 `input()` 犯過一模一樣的病（spec 173）：用 `io.read()` 而不等使用者，
 * 於是學生按下執行，提示印出來了，而程式**當場就用空字串跑完**。
 * `getline(cin, name)` 是同一顆病在 C++ 這一側。
 *
 * spec 205：受測的換成 Cella 的工作階段——學生按執行走的那條路。
 */
describe('getline 要等使用者（Cella 工作階段）', () => {
  it('跑到 getline 必須停下來等（awaiting-input），提示已經印出來；給了一行之後才繼續', async () => {
    const body = 'int main(){string name;cout<<"請輸入名字：";getline(cin,name);cout<<"hello, "<<name<<endl;return 0;}'
    const tree = lifter.lift((await parser.parse(HEAD + body)).rootNode as never) as SemanticNode
    expect(tree).not.toBeNull()
    const p = await cellaProvider()
    await waitSession(p, tree)
    const { s, out } = openCella(p, tree)
    const o = await s.launch(tree, { stopOnEntry: false })
    expect(o, '沒有進入等待＝沒有問使用者（拿空字串就走了）').toMatchObject({ kind: 'stopped', stop: { reason: 'awaiting-input' } })
    expect(out(), '等的時候提示要已經看得到').toBe('請輸入名字：')
    expect(await s.supplyInput('小明')).toEqual({ kind: 'ended' })
    expect(out()).toBe('請輸入名字：hello, 小明\n')
  }, 400_000)

  it('★ 反向：判決那條路（stdin 一次給完）不停下來，直接讀', async () => {
    const r = await runCella(HEAD + 'int main(){string name;getline(cin,name);cout<<"hello, "<<name<<endl;return 0;}', { stdin: '小明\n' })
    expect(r.verdict).toBe('accept')
    expect(r.out).toBe('hello, 小明\n')
  })
})
