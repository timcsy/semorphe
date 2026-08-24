/**
 * 檔案分類的雙向注入
 *
 * ## 為什麼這支測試值得存在
 *
 * 這份分類決定了兩條護欄的數字（就近性、身分健檢）。分類錯了，它們會回報
 * 一個**看起來很健康的數字**——而錯的方向剛好是有利的：把清單算成實作會
 * 讓「擴散」看起來很嚴重，把清單排除掉會讓它看起來一夜改善。
 *
 * ⚠️ **兩個方向都要釘。** 只釘「清單被判成清單」的話，一個「什麼都判成清單」
 * 的函式也會通過——而那會讓就近性永遠是 0。
 */
import { describe, it, expect } from 'vitest'
import { classifyFile } from '../helpers/file-classification'

describe('檔案分類', () => {
  it('★ 清單：登錄表的視圖與策展', () => {
    expect(classifyFile('src/languages/cpp/topics/cpp-beginner.json'), '課程清單是策展，不是實作').toBe('清單')
    expect(classifyFile('src/languages/cpp/topics/cpp-competitive.json')).toBe('清單')
    expect(classifyFile('src/languages/cpp/toolbox-categories.ts'), '工具箱清單同理').toBe('清單')
  })

  it('★ 宣告：元件自己的定義', () => {
    expect(classifyFile('src/languages/cpp/std/vector/components.json')).toBe('宣告')
    expect(classifyFile('src/languages/cpp/std/vector/blocks.json')).toBe('宣告')
    expect(classifyFile('src/core/universal-components.json')).toBe('宣告')
    expect(classifyFile('src/core/universal-blocks.json')).toBe('宣告')
  })

  it('★ 清冊：產生出來的紀錄', () => {
    expect(classifyFile('tests/baselines/locality.json'), '基線列出每顆元件，算成測試的話「零測試足跡」永遠是 0').toBe('清冊')
    expect(classifyFile('tests/assets/executor-inventory.json')).toBe('清冊')
    expect(classifyFile('tests/reports/completeness.md')).toBe('清冊')
  })

  it('★ 反向：真正的實作**不得**被歸成別的（否則就近性會空掉）', () => {
    // 沒有這一支的話，一個「什麼都判成清單」的函式也會通過上面三支，
    // 而就近性會回報零擴散——與一個完美集中的系統長得一模一樣。
    expect(classifyFile('src/languages/cpp/std/vector/executors.ts'), '執行器是實作').toBe('實作')
    expect(classifyFile('src/core/foo.ts')).toBe('實作')
    expect(classifyFile('src/core/toolbox-builder.ts'), '**組工具箱的程式碼是實作**——只有那份清單資料才是清單').toBe('實作')
    // ⚠️ 2026-08-10 改判：測試自成一類（`'測試'`），不再算「實作」。
    // 觸發它的是元件膠囊——自證測住在膠囊裡，而它的**負向斷言必然提到別的
    // 元件身分**（「`stack<int> s` 不得被認成 vector」）。算成實作擴散的話，
    // 搬一顆元件會讓別的七顆的擴散度上升，而它們一行都沒動。
    //
    // **這不是把測試「排除掉」**——它有自己的桶，護欄各自決定要不要算。
    // 就近性不算（測試不在 production 執行），完備性仍然可以算。
    expect(classifyFile('tests/integration/sstream-input.test.ts'), '測試自成一類，不是清冊').toBe('測試')
    expect(classifyFile('src/components/cpp/vector_declare/spec.test.ts'), '膠囊裡的自證測也是測試').toBe('測試')
  })

  it('★ 反向：`.test.ts` 之外的 src 檔仍然是實作（不得整批被新規則吃掉）', () => {
    // 沒有這一支的話，一個把 `src/**` 都判成「測試」的規則也會通過上面那支。
    expect(classifyFile('src/components/cpp/vector_declare/generate.ts')).toBe('實作')
    expect(classifyFile('src/components/cpp/vector_declare/component.json'), '膠囊的宣告與 components.json 同一類').toBe('宣告')
    expect(classifyFile('src/components/cpp/vector_declare/forms/blocks.json')).toBe('宣告')
  })

  it('★ 判準是路徑規則，不是檔名清單（FC-1）', () => {
    // 一份**還不存在**的清單檔要能被判對——手寫清單做不到這件事。
    expect(classifyFile('src/languages/python/topics/py-beginner.json')).toBe('清單')
    expect(classifyFile('src/languages/python/std/list/components.json')).toBe('宣告')
  })
})
