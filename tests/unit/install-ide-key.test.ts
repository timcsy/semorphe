/**
 * 🔴 「認得出自己」的鍵，不可以拿會變的那一段去比。
 *
 * 2026-09-01 實際發生：本機留著兩個 semorphe 擴充，因為 publisher 從
 * `semorphe` 換成了 `timcsy`，而清舊版的迴圈是用 `publisher.name` 開頭比對的。
 * VSCode 兩個都載，兩邊註冊同一組指令 id——**而它不報錯**。
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error —— 純 JS 的工具模組，沒有型別宣告
import { isOurVscodeDir } from '../../tools/install-ide.lib.mjs'

const NAME = 'semorphe-vscode'

describe('install:ide 清舊版時「這是不是我們的目錄」', () => {
  it('🔴 publisher 換掉的舊目錄，一樣要認得出來', () => {
    // 這一條就是 2026-09-01 漏掉的那個。
    expect(isOurVscodeDir('semorphe.semorphe-vscode-0.10.4', NAME)).toBe(true)
  })

  it('現行 publisher 的目錄當然算', () => {
    expect(isOurVscodeDir('timcsy.semorphe-vscode-0.11.7', NAME)).toBe(true)
  })

  it('沒有 publisher 前綴的也算', () => {
    expect(isOurVscodeDir('semorphe-vscode-0.9.0', NAME)).toBe(true)
  })

  it('⚠️ 別人的擴充不能被誤刪', () => {
    expect(isOurVscodeDir('ms-python.python-2024.1.0', NAME)).toBe(false)
  })

  it('⚠️ 同前綴但不同 name 的不能被誤刪——`-` 後面必須是版本號', () => {
    expect(isOurVscodeDir('someone.semorphe-vscode-theme-1.0.0', NAME)).toBe(false)
  })

  it('name 裡的正則字元不得被當成語法', () => {
    expect(isOurVscodeDir('pub.a.b-1.0.0', 'a.b')).toBe(true)
    expect(isOurVscodeDir('pub.axb-1.0.0', 'a.b')).toBe(false)
  })
})
