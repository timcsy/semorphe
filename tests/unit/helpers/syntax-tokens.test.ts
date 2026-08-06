/**
 * 語法記號偵測的自我驗證（第九條護欄的健康檢查）
 *
 * ## ⚠️ 這裡才是判斷那條護欄有沒有壞的地方，不是它的報表
 *
 * 語法耦合護欄的基線是 **0**。而 `build-guardrail` 第 9 步講得很清楚：
 *
 * > 「**基線是 0 的時候，這一步是唯一的健康檢查**——一條回報零違規的健康
 * > 護欄，與一條什麼都沒量到的護欄，產出完全相同。」
 *
 * ## 三層驗證，缺一不可
 *
 * | 層 | 證明什麼 |
 * |---|---|
 * | 合成注入（正向） | 含語法記號的字串**會**被報出 |
 * | 合成注入（反向） | 乾淨的 TypeScript **不**被誤報 |
 * | **已知答案的樣本** | 它在**真實的、當時確實有問題的程式碼**上抓得到 |
 *
 * 第三層是 `build-guardrail` 第 6 步要求的：
 *
 * > 「**判準本身可以是對的，把它自動化的第一版仍然會量錯。**……
 * > 要用靜態判斷，先在**已知答案的樣本**上驗過。」
 *
 * 樣本是 git 裡 059 動工之前的三個核心檔——那時它們確實在產生與剝除 C 家族
 * 的註解語法，而**中立性護欄一筆都沒數到**。這條護欄若抓不到它們，它就沒有
 * 存在的價值。
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { scanSyntaxTokens, DEFINITE_TOKENS, AMBIGUOUS_TOKENS } from '../../helpers/syntax-tokens'
import { splitCodeAndComments } from '../../helpers/component-scan'
import { REPO_ROOT } from '../../helpers/guardrail'

const scan = (src: string) => scanSyntaxTokens(splitCodeAndComments(src).code)

describe('合成注入（正向）：含語法記號的字串必須被報出', () => {
  it('★ 前置處理指令', () => {
    const r = scan(`const s = \`#include <\${h}>\\n\``)
    expect(
      r.definite.map((h) => h.token),
      '沒抓到 → 掃描壞了。**這時報表上的「0」是假的**，而它與健康的 0 長得一模一樣。',
    ).toContain('#include')
  })

  it('★ 命名空間解析', () => {
    expect(scan(`return 'std::' + name`).definite.map((h) => h.token)).toContain('std::')
  })

  it('★ 指標取成員——而箭頭函式 `=>` 不得被誤判成它', () => {
    expect(scan(`return obj + '->' + field`).definite.map((h) => h.token)).toContain('->')
    expect(
      scan(`const f = (x: number) => x + 1\nconst g = 'a => b'`).definite.map((h) => h.token),
      '把 `=>` 誤判成 `->` 的話，每一個箭頭函式都會變成違規',
    ).not.toContain('->')
  })

  it('★ 註解符號——059 修掉的正是這一類', () => {
    expect(scan(`return indent + '/** ' + text`).definite.map((h) => h.token)).toContain('/**')
  })
})

describe('合成注入（反向）：乾淨的程式碼不得被報出', () => {
  it('★ 一般的 TypeScript', () => {
    const src = `
      export function add(a: number, b: number): number {
        const label = 'sum'
        return a + b
      }
    `
    expect(
      scan(src).definite,
      '什麼都報的掃描器也會通過所有正向注入——這一支是唯一分得出來的地方',
    ).toEqual([])
  })

  it('★ 註解裡的語法記號不算——那是說明，不是產出', () => {
    const src = `
      // 這裡原本會產生 #include 與 std:: ——已搬進語言套件
      /** 例如 '->' 這種寫法 */
      const x = 1
    `
    expect(
      scan(src).definite,
      '把註解算進去的話，每一份解釋這條護欄的說明文件都會變成違規',
    ).toEqual([])
  })

  it('★ 記號出現在識別字裡不算——只看字串字面內部', () => {
    expect(scan(`const includePath = 1; const stdlib = 2`).definite).toEqual([])
  })
})

describe('已知答案的樣本：059 之前的核心程式碼（第 6 步要求）', () => {
  const at059之前 = (path: string): string =>
    execFileSync('git', ['show', `35e96d8:${path}`], { cwd: REPO_ROOT, encoding: 'utf8' })

  it('★ 抓得到當時 code-generator 產生的註解語法', () => {
    const r = scan(at059之前('src/core/projection/code-generator.ts'))
    expect(
      r.definite.map((h) => h.token),
      '這條護欄在**當時確實有問題的真實程式碼**上什麼都沒抓到 → 它沒有存在的價值。' +
        '那六處耦合是中立性護欄看不見的，這條就是為它們蓋的。',
    ).toContain('/**')
  })

  it('★ 抓得到當時 lifter 剝除的註解語法', () => {
    const r = scan(at059之前('src/core/lift/lifter.ts'))
    expect(r.definite.length, '當時 lifter.ts:152 在剝 `//` 與 `/* */`').toBeGreaterThan(0)
  })

  it('★ 而現在的同兩個檔必須是乾淨的——證明它分得出前後', () => {
    // 只釘結果不夠（第 8 步）：如果它對「有問題」和「已修好」都回報同一件事，
    // 上面兩支會通過而這條護欄毫無鑑別力。
    const fs = require('node:fs') as typeof import('node:fs')
    const path = require('node:path') as typeof import('node:path')
    for (const rel of ['src/core/projection/code-generator.ts', 'src/core/lift/lifter.ts']) {
      const now = scan(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'))
      expect(now.definite, `${rel} 現在應該是乾淨的（059 已搬走）`).toEqual([])
    }
  })
})

describe('清單本身的健康', () => {
  it('★ 每個記號都有「為什麼它不可能是別的東西」', () => {
    for (const t of [...DEFINITE_TOKENS, ...AMBIGUOUS_TOKENS]) {
      expect(t.why.length, `${t.token} 沒有理由——理由是這份清單唯一可複查的東西`).toBeGreaterThan(5)
    }
  })

  it('★ 兩份清單不得重疊——同一個記號不能既確定又不確定', () => {
    const d = new Set(DEFINITE_TOKENS.map((t) => t.token))
    const 重疊 = AMBIGUOUS_TOKENS.filter((t) => d.has(t.token)).map((t) => t.token)
    expect(重疊).toEqual([])
  })
})
