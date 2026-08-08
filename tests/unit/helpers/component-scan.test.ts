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
    withTempFile(`a('print'); b("input"); c(\`if\`)\n`, (rel) => {
      const hits = scanFile(rel, ['print', 'input', 'if'])
      expect(hits.code.sort()).toEqual(['if', 'input', 'print'])
    })
  })

  it('關鍵字不誤報：裸的 if / return 不算命中', () => {
    withTempFile(`if (x) { return 1 }\nfor (;;) break\n`, (rel) => {
      const hits = scanFile(rel, ['if', 'return', 'break'])
      expect(hits.code).toEqual([])
    })
  })

  it('識別符不誤報：變數叫 print 不算命中', () => {
    withTempFile(`const print = 1\nprint + 2\n`, (rel) => {
      const hits = scanFile(rel, ['print'])
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
    withTempFile(`const a = 1\nconst b = 'print'\nconst c = 3\nconst d = 'print'\n`, (rel) => {
      const hits = scanFile(rel, ['print'])
      expect(hits.lines['print']).toEqual([2, 4])
    })
  })
})

describe('allComponentIds', () => {
  it('列舉出全部已註冊的元件身分，且無重複', () => {
    const ids = allComponentIds()
    expect(ids.length).toBeGreaterThan(100)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('print')
    expect(ids).toContain('cpp:string_at')
  })
})
