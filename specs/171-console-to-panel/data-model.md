# Phase 1：資料模型

## 版面預設 —— 少了一層

```ts
interface LayoutPresetSpec {
  readonly id: 'focus' | 'compare' | 'three-column'   // 🪦 'grid' 退場
  readonly nameKey: string
  /**
   * 🔴 **只含 element／relation／space**——主控台不在這裡。
   *
   * ⚠️ 而型別要說得出這件事：`EditorLayer = Exclude<UnderstandingLayer, 'state'>`
   * ——不是靠註解，是靠**編不過**。
   */
  readonly areas: readonly (readonly (EditorLayer | '*')[])[]
  readonly cols?: readonly string[]
  // 🪦 `rows` 退場——三張版面全是純欄，沒有第二列
}
```

🟢 **每一張的 `areas` 都是一列**：

```
專注    [['*']]
對照    [['element', 'space']]
三欄    [['element', 'relation', 'space']]
```

⟹ `normalizeShape`／`reduceAreas` 大幅簡化（沒有列要合併），
而「一格跨兩列」那整個概念在版面這一側消失。

## 主控台的可見狀態 —— 它不住在版面裡

```ts
interface ConsoleVisibility {
  /** 使用者把它關掉了嗎。⚠️ **切換版面不得動它**（FR-006）。 */
  readonly hidden: boolean
}
```

🔴 **它是一個獨立的狀態，不是版面的一部分。** 版面決定「編輯區怎麼分欄」，
而主控台開不開是另一個問題——這正是這一刀在說的事。

## 「有輸出就自己回來」

```
輸出到達 → 主控台是關的？ → 打開它 → 再寫進去
                ↓ 否
              直接寫
```

⚠️ **只回來一次**：程式印一百行不該讓它跳一百次。
🔴 而「等輸入」也算輸出——`cin` 的提示不出現的話，使用者會以為程式當掉了。

> **一個「程式在等你」的狀態，如果沒有地方顯示，它與「程式壞了」長得一樣。**
