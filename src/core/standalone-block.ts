/**
 * 「一段獨立的複合語句要包成什麼節點」的宣告登記處。
 *
 * ## 為什麼需要這個模組
 *
 * `core/lift/lifter.ts` 原本直接 `import { buildBlock } from '.../components/cpp/block/lift'`
 * ——**核心 import 了一顆 C++ 元件**。
 *
 * 🔴 而 P9 的原文逐字寫著這個判準（`principles.md:158`）：
 *
 * > 「拔掉 C++，只裝 Python stub → 所有視圖仍啟動，**無 `languages/cpp/` import**」
 *
 * ⚠️ 而那顆元件的檔頭自己說「**這裡只提供建構子，讓那一處不必寫死身分字串**」
 * ——**那是把【字面耦合】換成了【模組耦合】**，而兩條既有的護欄都看不到後者
 * （一條掃字串字面、一條只掃視圖／UI）。
 *
 * ## 分工——與 `degradation-blocks` 逐字同形
 *
 * | 誰 | 提供什麼 |
 * |---|---|
 * | 核心 | **機制**——「這個 compound 是獨立的」這個判斷（只有展平那一步看得到父節點） |
 * | 語言套件 | **身分**——獨立區塊在這個語言裡叫什麼 |
 *
 * ## 🔴 沒宣告時【拋錯】，不猜
 *
 * `lifter` 是**每次 lift 都會走**的主路徑。猜一個 `'block'` 身分的話，
 * 它會**靜靜地產生錯的語義樹**——而那種錯要到 round-trip 或執行才浮現。
 *
 * > **主路徑上的降級要出聲；一個看起來合理的預設值在這裡是最貴的。**
 *
 * 見 `specs/155-import-dimension/`
 */
import type { SemanticNode } from './types'

type BlockBuilder = (body: SemanticNode[]) => SemanticNode

let declared: BlockBuilder | null = null

/** 語言套件註冊 lift 時呼叫。 */
export function declareStandaloneBlockBuilder(build: BlockBuilder): void {
  declared = build
}

/**
 * 包一段獨立的複合語句。
 *
 * 🔴 **沒有語言套件宣告過就拋錯**——見檔頭「沒宣告時拋錯，不猜」。
 */
export function buildStandaloneBlock(body: SemanticNode[]): SemanticNode {
  if (!declared) {
    throw new Error(
      '沒有語言套件宣告「獨立區塊」的建構子（`declareStandaloneBlockBuilder`）。'
      + '⚠️ 這條路徑每次 lift 都會走，猜一個身分會靜靜地產生錯的語義樹。',
    )
  }
  return declared(body)
}
