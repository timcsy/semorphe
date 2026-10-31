/**
 * **explicit 風格（google、c）：產出的程式碼裡，標準函式庫的名字加 `std::`**。
 *
 * ## 🔴 為什麼有這一支（2026-10-31，第 384 刀拆模板路徑時量到）
 *
 * `namespace_style: 'explicit'` 在產碼端**從來沒有實作**：產生器一律寫 `vector`、`cout`，
 * 而補丁器在 explicit 下（正確地）不補 `using namespace std;` ⟹ 產出**編不過**。
 * 課文 86 份 C++ 解答用 google 風格產回來，**70 份編不過**（`cout`×121、`endl`×115、`vector`×44……）。
 * 之前沒人發現，是因為第二套產碼路徑的模板寫死了 `std::`，剛好把它蓋住。
 *
 * ## 為什麼在這裡做，而不是改每一個產生器
 *
 * 會產出 std 名字的產生器散在幾十顆膠囊與共用的 runtime 裡；逐一改會留下漏網的那一顆。
 * 這裡是**一個地方**：對產出的文字做詞法掃描（跳過字串、字元、註解、前置處理行），
 * 只碰「不是成員存取、沒被限定過、也不是學生自己宣告的」名字。
 */

/** 這個專案的產生器會寫出來的標準函式庫名字。⚠️ 只列 `std` 裡的；C 函式庫（`sqrt`、`printf`）不加。 */
export const STD_NAMES: ReadonlySet<string> = new Set([
  // 串流與操縱子
  'cout', 'cin', 'cerr', 'clog', 'endl', 'flush', 'fixed', 'scientific', 'setprecision', 'setw', 'setfill', 'boolalpha', 'noboolalpha',
  'getline', 'ws', 'istream', 'ostream', 'stringstream', 'istringstream', 'ostringstream', 'ifstream', 'ofstream', 'fstream',
  // 容器與型別
  'vector', 'string', 'deque', 'list', 'stack', 'queue', 'priority_queue', 'set', 'multiset', 'map', 'multimap',
  'unordered_map', 'unordered_set', 'pair', 'tuple', 'array', 'bitset', 'greater', 'less', 'numeric_limits',
  // 演算法與工具函式
  'sort', 'stable_sort', 'reverse', 'swap', 'max', 'min', 'max_element', 'min_element', 'find', 'count', 'count_if',
  'accumulate', 'fill', 'unique', 'lower_bound', 'upper_bound', 'binary_search', 'next_permutation', 'prev_permutation',
  'make_pair', 'make_tuple', 'tie', 'get', 'to_string', 'stoi', 'stol', 'stoll', 'stod', 'stof', 'move',
  'begin', 'end', 'iota', 'gcd', 'lcm', 'abs',
])

/**
 * 只會以**樣板**出現的名字：後面接 `<` 才是 std 的那一個（第 392 刀）。
 * 🔴 Arduino core 的 `map(x, 0, 1023, 0, 255)` 被寫成 `std::map(...)`——編不過；
 *    學生自己沒宣告、而來自別的函式庫的同名函式也一樣。
 */
const TEMPLATE_ONLY: ReadonlySet<string> = new Set([
  'vector', 'deque', 'list', 'stack', 'queue', 'priority_queue', 'set', 'multiset', 'map', 'multimap',
  'unordered_map', 'unordered_set', 'tuple', 'array', 'bitset', 'greater', 'less', 'numeric_limits',
])

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/y

/**
 * 掃描 `code`，把 `STD_NAMES` 裡、沒被限定、也不在 `userNames` 裡的識別字前面加 `std::`。
 * 冪等：已經是 `std::x` 的不會變成 `std::std::x`。
 */
export function qualifyStd(code: string, userNames: ReadonlySet<string> = new Set()): string {
  let out = ''
  let i = 0
  const n = code.length
  let lineStart = true
  while (i < n) {
    const c = code[i]
    // 前置處理行（`#include <string>`）整行照搬
    if (lineStart && c === '#') {
      const end = code.indexOf('\n', i)
      const stop = end < 0 ? n : end
      out += code.slice(i, stop)
      i = stop
      continue
    }
    if (c === '\n') { out += c; i++; lineStart = true; continue }
    if (c !== ' ' && c !== '\t') lineStart = false
    // 註解
    if (c === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i)
      const stop = end < 0 ? n : end
      out += code.slice(i, stop); i = stop; continue
    }
    if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      const stop = end < 0 ? n : end + 2
      out += code.slice(i, stop); i = stop; continue
    }
    // 字串與字元字面（含跳脫）
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n && code[j] !== c) { if (code[j] === '\\') j++; j++ }
      out += code.slice(i, j + 1); i = j + 1; continue
    }
    if (/[A-Za-z_]/.test(c)) {
      IDENT.lastIndex = i
      const id = IDENT.exec(code)![0]
      const before = out.replace(/\s+$/, '')
      const qualified = before.endsWith('::') || before.endsWith('.') || before.endsWith('->')
      const asTemplate = /^\s*</.test(code.slice(i + id.length, i + id.length + 8))
      const isStd = STD_NAMES.has(id) && (!TEMPLATE_ONLY.has(id) || asTemplate)
      out += !qualified && isStd && !userNames.has(id) ? `std::${id}` : id
      i += id.length
      continue
    }
    out += c
    i++
  }
  return out
}
