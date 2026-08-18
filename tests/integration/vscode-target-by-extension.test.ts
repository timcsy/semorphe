/**
 * 🔴 **`.ino` 不該套 `main()` 架構。**
 *
 * ## 病歷（2026-08-18，Arduino IDE 實測）
 *
 * 使用者在 Arduino IDE 開一個 sketch，面板用的是 `C++（預設）` 目標，
 * 於是鷹架把 `setup()`／`loop()` **包進了 `int main()`**：
 *
 * ```cpp
 * using namespace std;
 * int main() {
 *     void setup() { … }
 *     void loop() { … }
 *     return 0;
 * }
 * ```
 *
 * ⚠️ **那不是顯示問題，它寫進了使用者的檔案。**
 *
 * > **一個「通用的預設」在一個有明確慣例的檔案格式上，不是中立，是錯的。**
 *
 * ## 自我否證聲明（⚠️ 寫在斷言之前）
 *
 * > **如果 `arduino` 這個目標不存在、或它指的課程清單沒有登錄，
 * > 那麼下游會「回退到現況」——而那是【安靜的】，這支測試也照樣綠。**
 *
 * 所以第一條就驗那兩樣東西**真的在**。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { defaultTargetForPath, resolveConfig, DEFAULT_CONFIG } from '../../src/vscode/sync/settings'

const targetIds = ['cpp', 'c', 'cpp-competitive', 'arduino'].map((id) =>
  JSON.parse(readFileSync(`src/languages/cpp/targets/${id}.json`, 'utf8')) as
    { id: string; topic: string })

describe('.ino 的預設目標是 Arduino', () => {
  it('🔴 正向錨點：`arduino` 這個目標真的存在，而且指得到一份課程清單', () => {
    const arduino = targetIds.find((t) => t.id === 'arduino')
    expect(arduino, '🔴 目標不存在 → 下游安靜回退 → 下面每一條都空過').toBeTruthy()
    // 課程清單檔在不在——`applyHostConfig` 找不到 topic 時是 **no-op**（安靜的）
    expect(() => readFileSync(`src/languages/cpp/topics/${arduino!.topic}.json`)).not.toThrow()
  })

  it('🔴 預設目標必須是一個【登錄過的】ID', () => {
    // ⚠️ 這裡曾經寫 `cpp-beginner`，而那個目標不存在
    //    ——認不得的 ID 在下游是「回退到現況」，所以它從來沒有出過聲。
    expect(targetIds.map((t) => t.id)).toContain(DEFAULT_CONFIG.targetId)
  })

  it('.ino / .pde → arduino', () => {
    expect(defaultTargetForPath('/x/sketch_aug18a.ino')).toBe('arduino')
    expect(defaultTargetForPath('/x/OLD.PDE')).toBe('arduino')
  })

  it('.cpp / .c / 沒有路徑 → 預設', () => {
    expect(defaultTargetForPath('/x/main.cpp')).toBe(DEFAULT_CONFIG.targetId)
    expect(defaultTargetForPath('/x/main.c')).toBe(DEFAULT_CONFIG.targetId)
    expect(defaultTargetForPath(undefined)).toBe(DEFAULT_CONFIG.targetId)
  })

  it('⚠️ 而它只是【預設】——設定過的話仍然照設定走', () => {
    const cfg = resolveConfig({ target: { workspace: 'cpp' } }, '/x/sketch.ino')
    expect(cfg.targetId, '🔴 預設蓋過了明講的設定').toBe('cpp')
  })

  it('沒設定時，.ino 解出來就是 arduino', () => {
    expect(resolveConfig({}, '/x/sketch.ino').targetId).toBe('arduino')
  })
})
