# Quickstart：驗證多形態機制

## 前置

```bash
npm test              # 動工前必須全綠——這是所有比較的基準
```

## 驗證順序（刻意由外而內）

### 1. 學生看得到的那件事（SC-001）

**這一條先驗，因為它是這個功能存在的理由。**

```bash
npx vitest run tests/integration/multi-form-container.test.ts
```

**期望**：同一個 `cpp_container_push` 概念，接在堆疊變數上的積木文字提到**頂端**，接在佇列變數上的提到**尾端**。

⚠️ **驗的是積木上的文字（MSG0），不是 tooltip。** 來源教訓：tooltip 大多是對的，MSG0 才是說謊的地方，而 MSG0 是學生一邊拼一邊讀的那句。

### 2. 產出與行為必須完全相同（C-3、SC-002）

```bash
npx vitest run tests/integration/multi-form-container.test.ts -t "產出相同"
```

**期望**：兩個形態產生的 C++ 完全相同（都是 `.push(...)`），執行結果完全相同。

**若這一條紅**：代表它們不是兩個形態，**是兩個概念**——那要退回去重新判身分，不是修渲染。

### 3. 執行器沒有被複製（SC-004）

```bash
npx vitest run tests/integration/audit-executor-duplicates.test.ts
```

**期望**：重複註冊維持 **0**。

### 4. 舊存檔載得起來（SC-003）

```bash
npx vitest run tests/unit/storage-version.test.ts
```

**期望**：既有那支「從 1 到 `CURRENT_VERSION` 的每一階都要有 Upgrade」的測試綠。

⚠️ **`CURRENT_VERSION` 調成 2 而 `UPGRADES[1]` 沒寫的話，這支會直接紅。** 那是刻意的——它讓「忘記寫轉換」不可能悄悄過去。

### 5. 護欄全部不上升（SC-005、FR-015）

```bash
npx vitest run tests/integration/audit-*.test.ts
```

**期望**：身分健檢、就近性、中立性、雙重真相、語法耦合、執行器重複註冊——**一條都不上升**。

⚠️ **中立性特別要看**：C-2 說選擇規則不得以元件身分分支。**破了這條，中立性護欄就會叫**——那是這份契約唯一有機械檢查的一條。

### 6. 全套

```bash
npm test
```

**期望**：212 檔全綠。

⚠️ **不要用 `head` 看 FAIL 列**——截斷輸出等於沒有讀。要嘛完整列出，要嘛只看 `Test Files: N passed` 那一行。

## 手動驗（機器驗不到的那一格）

開瀏覽器，拖一顆「加入元素」積木接到堆疊變數上，**不要滑鼠停留**，讀積木上的字。

問自己：**我知道等一下 pop 會拿到什麼嗎？**

答不出來就是沒修好——不論測試多綠。

## 如果卡住

| 症狀 | 先看哪裡 |
|---|---|
| 兩個形態都渲染成同一顆 | `PatternRenderer.renderSpecs`（**活的路徑**），不是 `BlockSpecRegistry.byConceptId`（零呼叫者） |
| 選不出形態 | 節點上有沒有 `container_kind`——辨識時查不到型別就不會寫（CK-1，這是刻意的） |
| 存檔載不進來 | `UPGRADES[1]` 有沒有寫；`judge()` 回傳什麼判定 |
| 中立性護欄叫了 | 選擇規則裡有沒有出現具體元件身分（破 C-2） |
