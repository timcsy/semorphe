# 152 — 收掉 `layer` 這一格，趁 Python 還沒開始填它

**日期**：2026-08-20 · **上游**：兩份 draft 的共同結論
（[universal 是外延主張](../../knowledge/draft/2026-08-11-universal是一份還沒被驗證的外延主張.md)
＋ [通解與特解](../../knowledge/draft/2026-08-20-通解與特解和小世界模型.md)）

## 出發點

233 顆元件每一顆都宣告 `layer`（universal 31 · lang-core 82 · lang-library 120），
**而生產路徑今天一個消費者都沒有**。

```
toolbox-builder   🔄 已改成【第四版】——它問的是那條【等價邊】，不再問 layer
                     檔內逐字：「第三版問的是 layer === 'universal'……
                     而這裡真正要的是【這顆是不是使用者偏好的 I/O 風格】」
listByLayer()     🔴 只有兩支【測試】呼叫，零生產呼叫者
其餘 .layer       🔴 只剩兩處【抄欄位】（concept-registry:53、block-spec-registry:41）
```

## 🔴 而它有一個真消費者，藏在護欄裡

⚠️ 「零消費者」這個結論我在這個專案**錯過兩次**（spec 144 漏掉護欄、spec 146 漏掉膠囊），
所以這次掃了 `tests/`。掃出來：

**中立性護欄**用 `layer` 把身分分成「語言專屬」與「universal」，
**只把前者算成違規**。它印出來的規則逐字：

> 「僅計語言專屬概念（lang-core／lang-library）；
> **universal 概念拔掉 C++ 後依然存在**，不妨礙 P9，改由就近性護欄涵蓋。」

🔴 **而那個理由今天是假的**：233 顆元件**全是 `cpp:` scope**，
`cpp:if` 拔掉 C++ 之後**不會依然存在**。

🟢 **但它現在豁免了 0 筆**（實測：universal 概念在中立範圍的引用 ＝ 0）。

> **一條理由為假、而目前沒有生效的規則——它不是無害的，
> 它是一顆等著在第一次被觸發時給出錯誤答案的地雷。**

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 🔴 這一格消失，而沒有任何行為改變 (Priority: P1)

**驗收**：233 個 `component.json` 的 `layer` 歸零；全套測試綠。
⚠️ **若有測試紅，那是證據說我漏了消費者**——不是那支測試該改。

### User Story 2 - 🔴 中立性護欄的豁免一起拿掉 (Priority: P1)

**驗收**：護欄改成**一律計入**，而數字**仍然是 0／0**（因為今天豁免的就是 0）。
🟢 它從此**更嚴**：將來任何元件身分出現在中立範圍都會被算到。

### User Story 3 - 🔴 它不准回來 (Priority: P1)

**驗收**：一條護欄，任何 `component.json` 重新長出 `layer` 就紅。

### Edge Cases

- **`code-keyboard.ts` 有一個同名但無關的 `this.layer`**（鍵盤的字母／符號層）
  → ⚠️ **批次刪除會誤傷**，判準是「讀的是概念的 `layer` 還是元件自己的狀態」
- **`listByLayer()` 的兩支測試**用的是**合成資料** → 隨 getter 一起退場

## Requirements *(mandatory)*

- **FR-001**：`layer` MUST 從 233 個 `component.json`、型別、兩處抄寫點移除
- **FR-002**：`listByLayer()` 與 `ConceptLayer` 型別 MUST 一併移除
- **FR-003**：🔴 中立性護欄的 universal 豁免 MUST 移除，而基線數字**不得因此改變**
- **FR-004**：MUST 有一條護欄擋它回來

## Success Criteria

- **SC-001**：`layer` 的生產與護欄消費者 ＝ 0，且**列得出來**
- **SC-002**：中立性護欄 0／0 不變
- **SC-003**：全套測試綠

## 明確排除

- **`abstractConcept`**——那是**關係**，不是分類標籤，它有真的消費者
- **元件的 `scope`（`cpp:`）**——身分的一部分，不是這一刀
- **Python 本身** · **那 5 個語言耦合點**（下一刀）

## 已知的坑

1. 🔴 **「零消費者」錯過兩次**——這次的安全網是**跑全套**，那正是前兩次接住我的
2. **同名的 `this.layer`**（鍵盤）不得誤傷
3. ⚠️ **移除豁免會讓護欄變嚴**——今天 0 筆所以無感，
   **而那正是動它的最好時機**（沒有數字要調）
