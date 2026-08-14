/**
 * **三情境語料**——資訊競賽／APCS／Arduino。
 *
 * ## 為什麼它住在一個【不是 `.test.ts`】的檔案裡
 *
 * 🔴 `tests/integration/audit-behavior-error.test.ts` 會掃
 * `tests/integration/*.test.ts` 的**反引號字面**當作 C++ 語料
 * （見該檔的 `fetchCorpus`，以及 `knowledge/history/059`）。
 *
 * 所以任何要在 `tests/integration/` 底下用到這批語料的護欄，
 * **都不能把它寫進自己的檔案裡**——那會讓另一條護欄的分母無聲地變大。
 *
 * > **一份語料放在哪個檔案裡，會決定另一條護欄量到什麼。**
 *
 * 消費者：`tests/probes/scenario-coverage.test.ts`（涵蓋率探測）、
 * `tests/integration/audit-false-syntax-error.test.ts`（第四十三條護欄）。
 */
export const H = '#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\nusing namespace std;\n'
export const COMPETITIVE: Record<string, string> = {
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

export const APCS_CORPUS: Record<string, string> = {
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

export const ARDUINO: Record<string, string> = {
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
