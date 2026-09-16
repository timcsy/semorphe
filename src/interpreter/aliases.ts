/**
 * **名字的別名表**——一個名字在解析不到的時候，還可以問一次「它是誰的小名」。
 *
 * ## 🔴 它從真實的學生程式來（2026-09-16）
 *
 * 218 支競賽練習裡 **60 支有 `#define`**，而最大的一族是「取小名」：
 *
 *     #define x first        #define pb push_back
 *     #define y second       #define pii pair<int,int>
 *
 * 在此之前 `cpp:define` 只認**字面值**替換（`#define MAXN 100000` → 宣告一個變數），
 * 而取小名這一族什麼都不做，於是 `pr.x` 拋 UNDECLARED_VAR、`v.pb(5)` 找不到方法。
 * 實測 19 支撞在這裡。
 *
 * ## ⚠️ 為什麼是「查不到才問」，不是「進來就換掉」
 *
 * 進來就換掉＝在語義樹上做預處理，而那會把 `ll x;` 變成 `long long x;`
 * ——**使用者打的字被改了**。這個專案的根公理是「唯一真實，各式投影」，
 * 而程式碼那一份投影必須逐字是他寫的那一份。
 *
 * > **一個為了讓執行器看懂而做的替換，如果它會回頭改寫使用者的程式碼，
 * > 那它換掉的不只是一個名字。**
 *
 * 所以這張表只在**解析失敗的那一刻**被問一次，而樹一個字都不動。
 *
 * ## ⚠️ 它是中立的
 *
 * 「名字有別名」不是 C++ 的性質（`typedef`、`using`、Python 的
 * `Point = namedtuple(...)` 都是同一件事）。**填表的是語言的元件**，
 * 而核心只負責「查不到就再問一次」。
 *
 * 🔴 而它**不是巨集展開**：帶參數的 `#define rep(i,n) ...` 不進這張表
 * ——那是一段程式，不是一個名字。
 */

const aliases = new Map<string, string>()

/** 一個名字是誰的小名。`cpp:define` 那一類的元件在執行時填它。 */
export function setAlias(name: string, target: string): void {
  if (name === '' || target === '' || name === target) return
  aliases.set(name, target)
}

/**
 * 把小名換成本名——**查不到就原樣回去**。
 *
 * ⚠️ 只做一層還不夠（`#define a first` 之後有人再 `#define b a`），
 * 而**要防環**：`#define a b` ＋ `#define b a` 在真實的程式裡不會出現，
 * 但一個會無限迴圈的解析器不該靠「不會出現」活著。
 */
export function resolveAlias(name: string): string {
  let cur = name
  for (let i = 0; i < 8; i++) {
    const next = aliases.get(cur)
    if (next === undefined) return cur
    cur = next
  }
  return cur
}

/** 這個名字有小名嗎——給「查不到才問」的那一刻用，省下不必要的字串比對。 */
export function hasAlias(name: string): boolean {
  return aliases.has(name)
}

/** ⚠️ 每一次執行前要清——別名是那一份程式的，不是這個行程的。 */
export function resetAliases(): void {
  aliases.clear()
}
