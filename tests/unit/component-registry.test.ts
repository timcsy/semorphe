/**
 * 膠囊契約 C1–C4 的單元測試——**每一條違反都要 throw，不得安靜地少一顆**
 *
 * 這裡測的是驗證函式本身，不是真實的膠囊。理由與 `component-scan` 的
 * `scanText` 分離同一條：錨在真實檔案上的測試，會在那些檔案被修好的那天失效。
 */
import { describe, it, expect } from 'vitest'
import { idToDir } from '../../src/core/component/types'
import { CELLS, VIEWS } from '../../src/core/component/views'

describe('膠囊契約：身分與路徑的換算', () => {
  it('C1：<scope>:<name> 換成 <scope>/<name>', () => {
    expect(idToDir('cpp:vector_declare')).toBe('cpp/vector_declare')
  })

  it('C1：第三方 scope 也走同一條路', () => {
    expect(idToDir('@someone:boost_vector')).toBe('@someone/boost_vector')
  })

  it('C1：沒有冒號要 throw，不得回傳一個看起來合理的東西', () => {
    expect(() => idToDir('vector_declare')).toThrow(/<scope>:<name>/)
  })

  it('C1：名字裡有第二個冒號時，只切第一個', () => {
    // 分隔符不可能出現在名字裡（G 定的封閉詞彙 ＋ 底線分隔），
    // 但萬一有，行為要是確定的而不是「看起來對」。
    expect(idToDir('cpp:a:b')).toBe('cpp/a:b')
  })

  it('今天的視圖是積木與程式碼兩個、都是雙向；格子不多不少（spec 181）', () => {
    expect(VIEWS).toEqual({ blocks: 'both', code: 'both' })
    expect([...CELLS]).toEqual(['blocks.render', 'blocks.lift', 'code.render', 'code.lift', 'code.liftStrategy', 'formalize', 'execute'])
  })
})
