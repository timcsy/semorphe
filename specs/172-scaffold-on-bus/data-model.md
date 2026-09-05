# Phase 1：那則事件的形狀

⚠️ **這一刀不新增任何型別**。`SemanticUpdateEvent.scaffold` 早就在
（`src/core/view-host.ts:107`）：

```ts
scaffold?: { nodeIds: string[]; mode: 'hidden' | 'ghost' | 'editable' }
```

## 唯一的新東西：一則【只帶告示】的更新

```
欄位            一般的 semantic:update      骨架重發
──────────────────────────────────────────────────────────
tree            ✅                          ✅（同一棵，沒有變）
code            ✅                          ✅
scaffold        ✅                          ✅  ← 這則事件的全部目的
blockState      ✅                          🔴 【不帶】
mappings        ✅                          不帶（樹沒變，對映沒變）
source          'code' / 'blocks' / …       'resync'
originViewId    發起的視圖                   不帶（發起的是真相那側）
```

🔴 **`blockState` 缺席不是省略，是設計**：積木面板的重畫閘在它上面
（`blockly-panel.ts:214` `if (!mine && event.blockState)`），
所以不帶它 ＝ **只套骨架，不重畫**。

> **一個「這則事件要做多少事」的旋鈕，剛好已經長在收的那一端了
> ——而它本來是為了別的理由長出來的。**

## 各視圖收到它會做什麼

| 視圖 | 行為 | 依據 |
|---|---|---|
| 積木 | 只套骨架（淡化／鎖拖曳），**不重畫** | 重畫閘在 `blockState` |
| 流程 | 讀 `scaffold` ＋ `rebuild()` 一次 | `flow-panel.ts:968`（它本來每次更新都 rebuild） |
| 程式碼 | 不受影響 | 它不讀 `scaffold` |

## 狀態轉換

沒有。骨架告示是**每次都全量重述**的（`nodeIds` 是完整清單，不是 diff）
——這是 `scaffoldNotice()` 既有的設計，這一刀不改。
