/**
 * 「語言專屬的語法記號」偵測——語法耦合護欄的判定核心。
 *
 * 分成純函式是為了兩件事：**合成注入**能餵字串進來（不掃真實檔案），
 * 以及能拿**已知答案的樣本**（git 裡 059 之前的程式碼）驗證它真的抓得到。
 *
 * ## 判定保守：三個桶，而「無法確定」不計入安全
 *
 * | 桶 | 意義 |
 * |---|---|
 * | **確定** | 這個記號**不可能**是別的東西——在 TypeScript 裡沒有同形的合法用途 |
 * | **無法確定** | 同形於核心自己的東西（例如 `'int'` 既是 C++ 型別也是核心的執行期型別標籤） |
 * | 乾淨 | 兩者皆非 |
 *
 * **「無法確定」單獨報，不算違規也不算安全。** 為了讓數字好看而樂觀歸類，
 * 比沒有護欄更糟。
 */

/** 一個語法記號，以及**為什麼它不可能是別的東西** */
export interface SyntaxToken {
  token: string
  /** 為什麼這個記號在 TypeScript 原始碼的字串字面裡只可能是 C 家族語法 */
  why: string
}

/**
 * 確定是 C 家族語法的記號。
 *
 * 每一個都要能回答「在 TypeScript 的字串字面裡，它還可能是什麼？」
 * 答得出第二種用途的，就不該在這份清單裡——移去下面的 AMBIGUOUS。
 */
export const DEFINITE_TOKENS: SyntaxToken[] = [
  { token: '#include', why: '前置處理指令，TypeScript 沒有對應物' },
  { token: '#define', why: '前置處理巨集定義，TypeScript 沒有對應物' },
  { token: '#ifdef', why: '條件編譯，TypeScript 沒有對應物' },
  { token: '#ifndef', why: '條件編譯，同上' },
  { token: '#endif', why: '條件編譯的結尾，同上' },
  { token: '#pragma', why: '編譯器指示詞，TypeScript 沒有對應物' },
  { token: 'std::', why: 'C++ 的命名空間解析，TypeScript 用 `.`' },
  { token: 'using namespace', why: 'C++ 專屬宣告' },
  { token: 'nullptr', why: 'C++11 的空指標字面，TypeScript 用 null/undefined' },
  { token: '->', why: 'C/C++ 透過指標取成員。TypeScript 的箭頭函式是 `=>`，不同形' },
  { token: '/**', why: '文件註解開頭。核心不該產生也不該剝除任何語言的註解符號' },
  { token: '*/', why: '區塊註解結尾。核心不該產生也不該剝除任何語言的註解符號' },
  // ── 標準函式庫的型別名（095 加入）───────────────────────────────────────
  //
  // ⚠️ **這一組是耦合的第四種形式，而三條護欄裡沒有一條數得到它。**
  //
  // 編號接 `knowledge/history/021`：import 第一種、身分第二種、語法第三種。
  //
  // 095 實作 `istringstream` 時，判斷「`>>` 是讀值還是位移」的規則第一版寫在
  // `src/core/lift/lifter.ts`——核心層於是出現了兩個寫死的 C++ 型別字串。
  //
  // | 護欄 | 量什麼 | 有沒有數到 |
  // |---|---|---|
  // | 中立性 | 元件身分字串 | ✗ 型別名不是身分 |
  // | 語法耦合（當時） | 前置處理指令／`std::`／註解符號 | ✗ 清單裡沒有型別名 |
  // | 就近性 | 一個元件的實作散在幾個檔 | ✓ 但它量的不是語言耦合 |
  //
  // **叫的那一條量的甚至不是這件事。** 見 `knowledge/history/021`。
  //
  // 這幾個為什麼是「確定」而不是「無法確定」：`int`／`string` 同形於核心的
  // 執行期型別標籤，這幾個**在 TypeScript 裡沒有任何合法用途**。而含它們的
  // 元件身分（`cpp_istringstream_declare`）帶著底線前綴，被詞界規則排除——
  // 那條規則是為 `'u_endl'` 加的，這裡直接受益。
  { token: 'istringstream', why: 'C++ 的輸入字串串流型別，TypeScript 沒有對應物' },
  { token: 'ostringstream', why: 'C++ 的輸出字串串流型別，同上' },
  { token: 'stringstream', why: 'C++ 的雙向字串串流型別，同上' },
  { token: 'size_t', why: 'C/C++ 的大小型別，TypeScript 用 number' },
]

/**
 * 同形於核心自己的東西——**判不出來，單獨報**。
 *
 * 這些不算違規（可能是核心正當的用法），也不算安全（可能真的是語法耦合）。
 * 要判定它們得看上下文，而 `build-guardrail` 第 6 步明講：
 * 「靜態判斷不能下結論，只能排順序。」
 */
export const AMBIGUOUS_TOKENS: SyntaxToken[] = [
  { token: 'int', why: '既是 C++ 型別，也是核心 RuntimeValue 的型別標籤' },
  { token: 'char', why: '既是 C++ 型別，也是核心 RuntimeValue 的型別標籤' },
  { token: 'bool', why: '既是 C++ 型別，也是核心 RuntimeValue 的型別標籤' },
  { token: 'void', why: '既是 C++ 型別，也是 TypeScript 自己的型別' },
  { token: 'double', why: '既是 C++ 型別，也是核心 RuntimeValue 的型別標籤' },
  { token: 'string', why: '既是 C++ 型別，也是 TypeScript 自己的型別' },
  { token: '<<', why: 'C++ 的串流插入，也是任何語言的左移運算子' },
  { token: '>>', why: 'C++ 的串流抽取，也是任何語言的右移運算子' },
  { token: '::', why: 'C++ 的解析運算子，但也可能是別的語言的路徑分隔' },
  // ⚠️ 這五個**看起來**該是「確定」，實測後不是：它們在 `src/ui/` 是**風格
  // 偏好的識別字**（`io_style === 'printf' ? 'cstdio' : 'iostream'`），不是被
  // 產生出去的語法。判不出來就不判——`build-guardrail` 第 5 步。
  { token: 'printf', why: '既是 C 的函式名，也是 UI 的 io_style 風格識別字' },
  { token: 'scanf', why: '同 printf' },
  { token: 'cout', why: '既是 iostream 的物件名，也出現在 UI 的風格名稱字串裡' },
  { token: 'cin', why: '同 cout' },
  { token: 'iostream', why: '既是 C++ 標頭名，也是 UI 的 ioPreference 值' },
  {
    token: 'endl',
    why:
      'iostream 的操縱器——但**它在這個系統裡同時是一個元件身分**（`register(\'endl\', …)`）。' +
      '第一版把它列為「確定」，於是把三處概念身分報成語法耦合。',
  },
]

/**
 * 正則字面裡的語法記號。
 *
 * ⚠️ **這一組是「已知答案的樣本」抓出來的缺口，不是想出來的。**
 *
 * 偵測器的第一版只看字串字面，於是漏掉了 059 修掉的其中一處：
 *
 * ```
 * // src/core/lift/lifter.ts:152（059 之前）
 * text: node.text.replace(/^\/\/\s?/, '').replace(/^\/\*\s?|\s?\*\/$/g, ''),
 * ```
 *
 * **核心層剝除 C 家族註解符號的那一整段，全部寫在正則字面裡。** 只掃字串
 * 字面的話，這條護欄會對它回報「乾淨」——而那正是它存在要治的東西。
 *
 * 判準：`\/`（反斜線加斜線）在 TypeScript 程式碼裡**只可能**出現在正則字面
 * （字串裡要寫成 `\\/`）。所以這個形式是明確的。
 */
export const REGEX_ESCAPED_TOKENS: SyntaxToken[] = [
  { token: '\\/\\/', why: '正則裡的 `//`——核心在剝除 C 家族的行註解符號' },
  { token: '\\/\\*', why: '正則裡的 `/*`——核心在剝除 C 家族的區塊註解開頭' },
  { token: '\\*\\/', why: '正則裡的 `*/`——核心在剝除 C 家族的區塊註解結尾' },
]

export interface SyntaxHit {
  token: string
  why: string
  lines: number[]
}

export interface SyntaxScanResult {
  definite: SyntaxHit[]
  ambiguous: SyntaxHit[]
}

/**
 * 把記號包成「只匹配字串字面內部」的 regex。
 *
 * ⚠️ **詞形記號要加詞界。** 第一版沒加，於是 `'u_endl'`（一個積木型別）
 * 被報成 C++ 的 `endl`——三處誤報。判準：記號由字母數字底線組成的話，
 * 它前後必須不是識別字字元。符號類（`->`、`std::`、`#include`）不受此限。
 */
function inStringLiteral(token: string): RegExp {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const 詞形 = /^[A-Za-z_][A-Za-z0-9_ ]*$/.test(token)
  const body = 詞形 ? `(?<![A-Za-z0-9_])${esc}(?![A-Za-z0-9_])` : esc
  return new RegExp(`(['"\`])[^'"\`\\n]*${body}[^'"\`\\n]*\\1`)
}

/**
 * 掃一段**程式碼文字**（呼叫端要先剝掉註解）。
 *
 * 只看字串字面內部——`// 這是註解` 不算，`const s = '// 這會被產生出去'` 才算。
 */
export function scanSyntaxTokens(code: string): SyntaxScanResult {
  const lines = code.split('\n')

  const collect = (defs: SyntaxToken[], hit: (line: string, token: string) => boolean): SyntaxHit[] => {
    const out: SyntaxHit[] = []
    for (const { token, why } of defs) {
      const at: number[] = []
      lines.forEach((l, i) => {
        if (hit(l, token)) at.push(i + 1)
      })
      if (at.length > 0) out.push({ token, why, lines: at })
    }
    return out
  }

  return {
    definite: [
      ...collect(DEFINITE_TOKENS, (l, tk) => inStringLiteral(tk).test(l)),
      // 正則字面用**字面包含**比對，不繞 regex。
      // 繞 regex 的話 `new RegExp('\\/\\/')` 匹配的是**渲染後的 `//`**，
      // 而我們要找的是原始碼裡的 `\/\/` 那四個字元——第一版就是這樣寫錯的，
      // 而抓到它的是已知答案的樣本，不是 code review。
      ...collect(REGEX_ESCAPED_TOKENS, (l, tk) => l.includes(tk)),
    ],
    ambiguous: collect(AMBIGUOUS_TOKENS, (l, tk) => inStringLiteral(tk).test(l)),
  }
}
