/**
 * **探測（不是護欄）**：資訊競賽／APCS／Arduino 三個使用情境，我們缺什麼。
 *
 * 每段量三路：
 *   辨識  raw_code／unresolved 節點數（殘差通道）
 *   投影  產出的碼餵回參照編譯器，輸出是否與原始碼一致
 *   執行  直譯器輸出 vs 參照編譯器輸出
 *
 * ## 為什麼是探測而不是護欄
 *
 * 既有的兩條護欄（`audit-projection-residual`／`audit-behavior-error`）從
 * **教學文件的程式碼區塊**撈語料，所以它們量的是「我們寫過的東西」。
 * 這一支反過來：**先想清楚使用者在哪裡用它**，再去看那些寫法通不通。
 *
 * > **一個語料庫如果來自我們自己的文件，它量不出「使用者會寫而我們沒寫過」的東西。**
 *
 * ⚠️ 沒有棘輪是刻意的——這裡的數字要靠**看報表**推動，而不是靠一條會擋 CI 的線。
 * 缺口修好之後對應的樣本會從報表消失；那才是它的訊號。
 *
 * ## 自我否證
 *
 * **如果任何一組的段數斷言變紅，代表語料沒載入，這份報表不算數**
 * ——錨在段數（合成量）上，不錨在缺口數上：缺口數正是這支要推向零的東西。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { runCppDetailed } from '../helpers/run-cpp'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const style: StylePreset = {
  id: 'apcs', name: { 'zh-TW': 'APCS', en: 'APCS' }, io_style: 'cout',
  naming_convention: 'camelCase', indent_size: 4, brace_style: 'K&R',
  namespace_style: 'using', header_style: 'individual',
}

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 30000)

const H = '#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\nusing namespace std;\n'

/** 競賽：可執行的完整程式 */
const COMPETITIVE: Record<string, string> = {
  // ⚠️ 真實的競賽第一行是 `#include <bits/stdc++.h>`，而 macOS 的 clang 沒有那個標頭
  // ——用它的話這一段會落進「參照跑不動」而不是「我們跑錯」，**缺口會消失在分母裡**。
  '加速框架': `${H}int main(){ ios::sync_with_stdio(false); cin.tie(nullptr); cout << 42; return 0; }`,
  '加速框架的 ios_base 寫法': `${H}int main(){ ios_base::sync_with_stdio(false); cin.tie(0); cout << 7; return 0; }`,
  'typedef long long': `${H}typedef long long ll;\nint main(){ ll a = 3000000000; cout << a; }`,
  'using 型別別名': `${H}using ll = long long;\nint main(){ ll a = 5; cout << a; }`,
  'pair 與 make_pair': `${H}int main(){ pair<int,int> p = make_pair(3,4); cout << p.first << p.second; }`,
  'pair 的 first/second 賦值': `${H}int main(){ pair<int,string> p; p.first=1; p.second="a"; cout << p.first << p.second; }`,
  'vector of pair 排序': `${H}int main(){ vector<pair<int,int>> v; v.push_back({2,1}); v.push_back({1,5}); sort(v.begin(),v.end()); cout << v[0].first; }`,
  '二維 vector': `${H}int main(){ vector<vector<int>> g(2, vector<int>(3, 7)); cout << g[1][2]; }`,
  'sort 自訂比較函式': `${H}bool cmp(int a, int b){ return a > b; }\nint main(){ vector<int> v = {1,3,2}; sort(v.begin(), v.end(), cmp); cout << v[0]; }`,
  'sort 用 lambda': `${H}int main(){ vector<int> v = {1,3,2}; sort(v.begin(), v.end(), [](int a, int b){ return a > b; }); cout << v[0]; }`,
  'priority_queue 小根堆': `${H}#include <queue>\nint main(){ priority_queue<int, vector<int>, greater<int>> pq; pq.push(3); pq.push(1); cout << pq.top(); }`,
  'map 迭代': `${H}#include <map>\nint main(){ map<string,int> m; m["a"]=1; m["b"]=2; for(auto& kv : m) cout << kv.first << kv.second; }`,
  'set 去重': `${H}#include <set>\nint main(){ set<int> s; s.insert(3); s.insert(3); cout << s.size(); }`,
  'struct 帶建構式': `${H}struct Node { int v; Node(int x) : v(x) {} };\nint main(){ Node n(5); cout << n.v; }`,
  'struct 帶 operator<': `${H}struct P { int x; bool operator<(const P& o) const { return x < o.x; } };\nint main(){ P a{3}, b{5}; cout << (a < b); }`,
  '常數 INF': `${H}const int INF = 1e9;\nint main(){ cout << INF; }`,
  '遞迴 DFS': `${H}int f(int n){ if(n<=1) return 1; return n*f(n-1); }\nint main(){ cout << f(5); }`,
  'lower_bound 二分搜': `${H}int main(){ vector<int> v={1,3,5,7}; cout << (lower_bound(v.begin(),v.end(),5)-v.begin()); }`,
  '__gcd': `${H}int main(){ cout << __gcd(12, 18); }`,
  '位元運算 popcount': `${H}int main(){ cout << __builtin_popcount(7); }`,
  '陣列 memset': `${H}#include <cstring>\nint dp[10];\nint main(){ memset(dp, 0, sizeof(dp)); cout << dp[3]; }`,
  '全域二維陣列': `${H}int g[5][5];\nint main(){ g[1][2] = 8; cout << g[1][2]; }`,
  'queue BFS': `${H}#include <queue>\nint main(){ queue<int> q; q.push(1); q.push(2); q.pop(); cout << q.front(); }`,
  '結構陣列排序': `${H}struct S { int a; };\nbool cmp(S x, S y){ return x.a < y.a; }\nint main(){ vector<S> v = {{3},{1}}; sort(v.begin(), v.end(), cmp); cout << v[0].a; }`,
  'to_string 與 stoi': `${H}int main(){ cout << stoi("42") + 1 << to_string(7); }`,
  'max_element': `${H}int main(){ vector<int> v={1,9,3}; cout << *max_element(v.begin(), v.end()); }`,
  'auto 迴圈累加': `${H}int main(){ vector<int> v={1,2,3}; int s=0; for(auto x : v) s+=x; cout << s; }`,
}

/** APCS：教學／檢定常見寫法 */
const APCS_CORPUS: Record<string, string> = {
  '二維陣列走訪': `${H}int main(){ int a[2][3] = {{1,2,3},{4,5,6}}; int s=0; for(int i=0;i<2;i++) for(int j=0;j<3;j++) s+=a[i][j]; cout << s; }`,
  '函式傳陣列': `${H}int sum(int a[], int n){ int s=0; for(int i=0;i<n;i++) s+=a[i]; return s; }\nint main(){ int a[3]={1,2,3}; cout << sum(a,3); }`,
  'string 逐字元': `${H}int main(){ string s = "abc"; for(int i=0;i<s.length();i++) cout << s[i]; }`,
  'string substr 與 find': `${H}int main(){ string s="hello"; cout << s.substr(1,3) << s.find("ll"); }`,
  '氣泡排序': `${H}int main(){ int a[4]={4,2,3,1}; for(int i=0;i<4;i++) for(int j=0;j<3;j++) if(a[j]>a[j+1]) swap(a[j],a[j+1]); cout << a[0] << a[3]; }`,
  'switch 敘述': `${H}int main(){ int x=2; switch(x){ case 1: cout << "a"; break; case 2: cout << "b"; break; default: cout << "c"; } }`,
  'do while': `${H}int main(){ int i=0; do { cout << i; i++; } while(i<3); }`,
  '巢狀迴圈印圖形': `${H}int main(){ for(int i=1;i<=3;i++){ for(int j=0;j<i;j++) cout << "*"; cout << endl; } }`,
  'printf 格式化': `${H}#include <cstdio>\nint main(){ printf("%d %.2f\\n", 5, 3.14159); }`,
  '三元運算子': `${H}int main(){ int a=5; cout << (a>3 ? "big" : "small"); }`,
  '取餘與整數除法': `${H}int main(){ cout << 7/2 << " " << 7%2; }`,
  '布林與邏輯運算': `${H}int main(){ bool b = true && !false; cout << b; }`,
  '傳參考修改': `${H}void inc(int& x){ x++; }\nint main(){ int a=1; inc(a); cout << a; }`,
  '結構體陣列': `${H}struct S { string n; int s; };\nint main(){ S arr[2] = {{"a",90},{"b",80}}; cout << arr[0].n << arr[1].s; }`,
  '費氏數列迴圈': `${H}int main(){ int a=0,b=1; for(int i=0;i<5;i++){ int t=a+b; a=b; b=t; } cout << a; }`,
  'char 判斷大小寫': `${H}#include <cctype>\nint main(){ char c='a'; cout << (isalpha(c)?1:0) << (char)toupper(c); }`,
  '一維陣列最大值': `${H}int main(){ int a[5]={3,9,2,7,5}; int m=a[0]; for(int i=1;i<5;i++) if(a[i]>m) m=a[i]; cout << m; }`,
  'break 與 continue': `${H}int main(){ for(int i=0;i<5;i++){ if(i==1) continue; if(i==3) break; cout << i; } }`,
}

/** Arduino：沒有 main，參照編譯器編不過——只量辨識與投影 */
const ARDUINO: Record<string, string> = {
  'setup/loop 骨架': `void setup(){ pinMode(13, OUTPUT); }\nvoid loop(){ digitalWrite(13, HIGH); delay(1000); digitalWrite(13, LOW); delay(1000); }`,
  '#define 腳位': `#define LED 13\nvoid setup(){ pinMode(LED, OUTPUT); }\nvoid loop(){ digitalWrite(LED, HIGH); }`,
  'Serial 輸出': `void setup(){ Serial.begin(9600); }\nvoid loop(){ Serial.println("hello"); delay(500); }`,
  'analogRead 與 map': `int val;\nvoid setup(){ Serial.begin(9600); }\nvoid loop(){ val = analogRead(A0); int b = map(val, 0, 1023, 0, 255); analogWrite(9, b); }`,
  'millis 計時': `unsigned long prev = 0;\nvoid loop(){ if (millis() - prev > 1000) { prev = millis(); } }`,
  'byte 型別': `byte b = 255;\nvoid setup(){ Serial.begin(9600); Serial.println(b); }`,
  'String 物件': `String msg = "hi";\nvoid setup(){ Serial.begin(9600); Serial.println(msg); }`,
  'digitalRead 判斷': `void setup(){ pinMode(2, INPUT); }\nvoid loop(){ if (digitalRead(2) == HIGH) { digitalWrite(13, HIGH); } }`,
  'const int 腳位': `const int BUTTON = 2;\nvoid setup(){ pinMode(BUTTON, INPUT_PULLUP); }`,
  'for 掃描腳位': `void setup(){ for (int i = 2; i < 6; i++) pinMode(i, OUTPUT); }`,
}

function residualOf(n: SemanticNode, acc: { count: number; kinds: Set<string> }): void {
  if (n.conceptId === 'raw_code' || n.conceptId === 'unresolved') {
    acc.count++
    acc.kinds.add(String(n.metadata?.rawCode ?? '').slice(0, 40).replace(/\n/g, '⏎'))
    return
  }
  for (const bucket of Object.values(n.children ?? {})) for (const c of bucket ?? []) residualOf(c, acc)
}

async function probe(src: string, runnable: boolean) {
  const tree = parser.parse(src)!
  const st = createTestLifter().lift(tree.rootNode as never) as SemanticNode
  const acc = { count: 0, kinds: new Set<string>() }
  residualOf(st, acc)
  let code = ''
  try { code = generateCode(st, 'cpp', style) } catch (e) { code = `GENTHROW ${(e as Error).message}` }

  let ours = '', ref = '', regen = ''
  if (runnable) {
    const r = runCppDetailed(src)
    ref = r.ok ? r.output : `✘${r.stage}:${r.message.split('\n').find(l => l.includes('error')) ?? ''}`.slice(0, 90)
    const rg = runCppDetailed(code)
    regen = rg.ok ? rg.output : `✘${rg.stage}:${rg.message.split('\n').find(l => l.includes('error')) ?? ''}`.slice(0, 90)
    const i = new SemanticInterpreter({ maxSteps: 200000 })
    try { await i.execute(st); ours = i.getOutput().join('') } catch (e) { ours = `✘${(e as Error).message}`.slice(0, 90) }
  }
  return { residual: acc.count, kinds: [...acc.kinds], code, ours, ref, regen }
}

describe('三情境覆蓋探測', () => {
  for (const [label, corpus, runnable] of [['競賽', COMPETITIVE, true], ['APCS', APCS_CORPUS, true], ['Arduino', ARDUINO, false]] as const) {
    it(`${label}`, async () => {
      // ★ 入口條件——錨在**語料段數**上（合成量），見檔頭的自我否證
      expect(Object.keys(corpus).length).toBeGreaterThan(5)
      const rows: string[] = []
      let residual = 0, execMismatch = 0, projMismatch = 0, refCannotRun = 0
      for (const [name, src] of Object.entries(corpus)) {
        const r = await probe(src, runnable)
        const flags: string[] = []
        if (r.residual > 0) { residual++; flags.push(`辨識${r.residual}:${r.kinds.join('|')}`) }
        if (runnable) {
          // 🔴 **「參照編不過」與「我們算錯」是兩件事**，而它們原本混在同一欄。
          //
          // `__gcd` 是 libstdc++ 的擴充，macOS 的 clang 用 libc++ 沒有它
          // ——那一筆是**我們比參照寬容**，不是我們算錯。混在一起的話，
          // 缺口的數字會被一批「參照跑不動」灌水，而那個方向是**看不出來的**：
          // 兩者的症狀都是「這一段紅了」。
          if (r.ref.startsWith('✘compile')) {
            refCannotRun++
            flags.push(`參照編不過（我們算出 ${JSON.stringify(r.ours)}）——不是我們的缺陷`)
          } else {
            if (r.ours !== r.ref) { execMismatch++; flags.push(`執行 ours=${JSON.stringify(r.ours)} ref=${JSON.stringify(r.ref)}`) }
            if (r.regen !== r.ref) { projMismatch++; flags.push(`投影 regen=${JSON.stringify(r.regen)}`) }
          }
        }
        if (flags.length) rows.push(`  ✘ ${name}\n      ${flags.join('\n      ')}`)
      }
      console.log(`\n═══ ${label}：${Object.keys(corpus).length} 段｜辨識缺 ${residual}｜執行不符 ${execMismatch}｜投影不符 ${projMismatch}｜參照編不過 ${refCannotRun}\n${rows.join('\n')}`)
    }, 300000)
  }
})
