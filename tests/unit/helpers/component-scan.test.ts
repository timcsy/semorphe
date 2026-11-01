/**
 * 掃描規則的單元測試（T007）
 *
 * 誤報風險全部集中在這條規則上——規則錯了，四條護欄裡有兩條的數字就不可信。
 * 所以它自己要有測試。
 */
import { describe, it, expect } from 'vitest'
import { splitCodeAndComments, scanFile, allComponentIds } from '../../helpers/component-scan'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { REPO_ROOT } from '../../helpers/guardrail'

function withTempFile(content: string, fn: (relPath: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-'))
  const abs = path.join(dir, 'sample.ts')
  fs.writeFileSync(abs, content, 'utf8')
  const rel = path.relative(REPO_ROOT, abs)
  try {
    fn(rel)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('splitCodeAndComments', () => {
  it('把行註解與區塊註解分離出去', () => {
    const { code, comments } = splitCodeAndComments(
      `const a = 1 // 這是註解\n/* 區塊\n註解 */\nconst b = 2\n`,
    )
    expect(code).toContain('const a = 1')
    expect(code).toContain('const b = 2')
    expect(code).not.toContain('這是註解')
    expect(comments).toContain('這是註解')
    expect(comments).toContain('區塊')
  })

  it('不把字串裡的 // 當成註解', () => {
    const { code, comments } = splitCodeAndComments(`const url = 'http://example.com/print'\n`)
    expect(code).toContain('http://example.com/print')
    expect(comments).toBe('')
  })

  it('區塊註解保留換行，行號不位移', () => {
    // 原始碼第 5 行是 const b = 2（第 2-4 行被區塊註解佔掉）→ 索引 4
    const { code } = splitCodeAndComments(`const a = 1\n/* x\ny\nz */\nconst b = 2\n`)
    const lines = code.split('\n')
    expect(lines[0]).toContain('const a = 1')
    expect(lines[4]).toContain('const b = 2')
  })

  it('行註解不位移行號', () => {
    // 原始碼第 2 行是 const b = 2 → 索引 1
    const { code } = splitCodeAndComments(`const a = 1 // 註解\nconst b = 2\n`)
    const lines = code.split('\n')
    expect(lines[0]).toContain('const a = 1')
    expect(lines[1]).toContain('const b = 2')
  })

  // 🔴 第 215 刀：第 214 刀在 strategies.ts 寫了 `text.replace(/'/g, '')`，那個引號被當成字串的開頭，
  //    後面整個檔的註解變成程式碼——只在註解裡提到的十顆元件一起「外洩」
  it('🔴 正規式字面量裡的引號不是字串的開頭', () => {
    const { code, comments } = splitCodeAndComments(`const t = s.replace(/'/g, '')\n// 只在註解裡：'cpp:x'\nconst b = 2\n`)
    expect(comments).toContain("'cpp:x'")
    expect(code).not.toContain("'cpp:x'")
    expect(code).toContain('const b = 2')
  })

  it('🔴 字元類裡的 / 與跳脫的 / 不結束正規式；旗標跟著走', () => {
    const { code, comments } = splitCodeAndComments(`const r = /[/']\\/x"/gi // 註解\n`)
    expect(code).toContain(`/[/']\\/x"/gi`)
    expect(comments).toContain('註解')
  })

  // 🔴 第 215c 刀：215 讓正規式回到程式碼之後，`comment-projection-snapshot` 在 CI 紅了——分隔符號 `/` 緊接跳脫的 `\/`
  //    拼出假的 `/\/`。換掉分隔符號、內容照留；判準照抄那支護欄
  it('🔴 regexDelimiter：路徑正規式不再拼出假的 //，真的在剝 // 的照樣抓得到', () => {
    const lineComment = /['"`/]\\?\/\\?\/|\/\\\//
    const path = splitCodeAndComments(`const id = p.replace(/^\\/lessons\\//, '').replace(/\\/lesson\\.json$/, '')\n`, { regexDelimiter: '«' }).code
    expect(path).toContain('lesson')
    expect(lineComment.test(path)).toBe(false)
    const strip = splitCodeAndComments(`const t = s.replace(/\\/\\/.*$/, '')\n`, { regexDelimiter: '«' }).code
    expect(lineComment.test(strip)).toBe(true)
  })

  it('★ 除號不是正規式：a / b / c 之後的註解照樣是註解', () => {
    const { code, comments } = splitCodeAndComments(`const q = a / b / c // 'cpp:y'\nconst w = (n) / 2 // 另一個\n`)
    expect(code).toContain('a / b / c')
    expect(code).toContain('(n) / 2')
    expect(comments).toContain("'cpp:y'")
    expect(comments).toContain('另一個')
  })
})

describe('scanFile — 只匹配完整的引號字串字面', () => {
  it('前綴不誤報：cpp:string_at 不得命中 cpp:string_at_expr', () => {
    // ⚠️ 兩個樣本必須**共用前綴**，否則這支測試就不再測前綴誤報了。
    // 命名空間遷移把第一個改成 `cpp:string_at`、第二個留在 `cpp_string_at_expr`，
    // 前綴當場不共用——測試會綠，而它綠得沒有意義。
    withTempFile(`const x = 'cpp:string_at_expr'\n`, (rel) => {
      const hits = scanFile(rel, ['cpp:string_at', 'cpp:string_at_expr'])
      expect(hits.code).toEqual(['cpp:string_at_expr'])
      expect(hits.code).not.toContain('cpp:string_at')
    })
  })

  it('三種引號都算：單引號、雙引號、反引號', () => {
    withTempFile(`a('cpp:print'); b("cpp:input"); c(\`cpp:if\`)\n`, (rel) => {
      const hits = scanFile(rel, ['cpp:print', 'cpp:input', 'cpp:if'])
      expect(hits.code.sort()).toEqual(['cpp:if', 'cpp:input', 'cpp:print'])
    })
  })

  it('關鍵字不誤報：裸的 if / return 不算命中', () => {
    withTempFile(`if (x) { return 1 }\nfor (;;) break\n`, (rel) => {
      const hits = scanFile(rel, ['cpp:if', 'cpp:return', 'cpp:break'])
      expect(hits.code).toEqual([])
    })
  })

  it('識別符不誤報：變數叫 print 不算命中', () => {
    withTempFile(`const print = 1\nprint + 2\n`, (rel) => {
      const hits = scanFile(rel, ['cpp:print'])
      expect(hits.code).toEqual([])
    })
  })

  it('註解中的引用歸入 commentOnly，不入 code', () => {
    withTempFile(`// cpp:string_at — character access\nconst x = 1\n`, (rel) => {
      const hits = scanFile(rel, ['cpp:string_at'])
      expect(hits.code).toEqual([])
      expect(hits.commentOnly).toEqual(['cpp:string_at'])
    })
  })

  it('同時出現在程式碼與註解時，算程式碼引用', () => {
    withTempFile(`// cpp:string_at 說明\nconst x = 'cpp:string_at'\n`, (rel) => {
      const hits = scanFile(rel, ['cpp:string_at'])
      expect(hits.code).toEqual(['cpp:string_at'])
      expect(hits.commentOnly).toEqual([])
    })
  })

  it('記錄命中的行號', () => {
    withTempFile(`const a = 1\nconst b = 'cpp:print'\nconst c = 3\nconst d = 'cpp:print'\n`, (rel) => {
      const hits = scanFile(rel, ['cpp:print'])
      expect(hits.lines['cpp:print']).toEqual([2, 4])
    })
  })
})

describe('allComponentIds', () => {
  it('列舉出全部已註冊的元件身分，且無重複', () => {
    const ids = allComponentIds()
    expect(ids.length).toBeGreaterThan(100)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('cpp:print')
    expect(ids).toContain('cpp:string_at')
  })
})
