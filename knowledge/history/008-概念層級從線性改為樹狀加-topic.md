# 008：從「線性 CognitiveLevel」到「樹狀層級樹 + Topic 維度」

> 日期：2026-03-11

## 轉移

- **舊**：概念層級是線性序列 L0 → L1 → L2，全語言共用一套。實作為 `CognitiveLevel`。
- **新**：概念層級是**樹狀結構**（分支可疊加，看到的是聯集），且新增 **Topic 維度**——同一語言在不同主題下有不同的層級樹、積木可見性、甚至積木的輸入欄位。實作為 Topic System，取代 CognitiveLevel。

```
語言: C++
  ├─ Topic: 初學 C++    L0: 變數、cout、if、while
  ├─ Topic: Arduino     L0: digitalRead、analogWrite、delay、Serial.print
  └─ Topic: 競賽程式    L0: 快速 I/O(scanf/printf)、變數、陣列
```

## 為什麼變

線性模型假設「所有學習者走同一條路，只是走多遠不同」。這個假設在遇到第二種教學情境時就崩了：Arduino 課的 L0 該有 `digitalRead`，競賽課的 L0 該有 `scanf`，初學課的 L0 兩者都不該有。線性序列無法同時滿足——把三者的 L0 取聯集會爆掉初學者，取交集會讓另外兩門課無法上。

樹狀 + Topic 的關鍵設計選擇：

1. **Topic 是純投影層概念，不污染語義層**。SemanticNode 不知道 Topic 存在；Lifter 保持 Topic-agnostic，盡可能辨識所有概念。這保證了同一份程式碼在三個 Topic 下 lift 出**完全相同**的語義樹。
2. **base + override 模型**避免 `(概念 × Topic × Level)` 的組合爆炸——Topic 只定義與 base BlockSpec 不同的部分。
3. **分支可疊加**：樹的分支不互斥，可見積木是所有已啟用分支的聯集。這與 User Context 的慣性快取一致——系統記住使用者已探索的分支，不強制單一路徑。

後來這個轉移被回頭理解為一個更大的類比：線性解鎖類似 RNN 的步進遞迴（容易卡在局部最佳解），Topic + enabledBranches 類似 Transformer 的自注意力（結構從一開始就完整存在，遮罩決定可見子集）。見 [三維錨定](../concepts/三維錨定.md) 的注意力遮罩段落。

## 狀態

✅ 已採用（spec `022-topic-system`，commit `46d0f18` "implement Topic System replacing CognitiveLevel"）。

**未完成的尾巴**：`manifest.json` 的 `topics` 欄位仍未加入，等階段 7 統一做 manifest-driven plugin system。
