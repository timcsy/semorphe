# Data Model：兩條基線的形狀

**核心約束（FR-008）**：兩條基線是**兩個檔**。不合併，不共用結構。
理由見 spec：殘差高＝模型還沒長到那裡（系統仍然正確），誤差高＝模型是錯的（系統會騙人）。

## 一、殘差基線 `tests/baselines/projection-residual.json`

```
_meta          note（這個數字是什麼、為什麼是棘輪、下降的兩種原因怎麼分）
語料
  語法完整      段數                ← 只有這一欄計入殘差
  語法有錯      段數（片段，不計入）  ← 必須存在，否則濾掉語料會看起來像改善
  總字元        語法完整那批的字元數
殘差
  字元數
  節點數
  率            殘差字元 / 總字元      ← 棘輪對象
  降級原因分佈   { syntax_error, nonstandard_but_valid, unsupported, (無) }
```

**驗證規則**

- 「率」只准下降（棘輪）。改善時 `assertRatchet` 會要求下調基線一起 commit。
- **兩欄語料段數變動 ⇒ 報告必須讓人看出數字變動來自語料而非模型**（FR-002、SC-002）。
- `(無)` 這個原因桶本身是一個訊號：殘差節點沒有 `degradationCause`
  ⇒ 殘差通道有資料但**沒有歸因**。記錄它，不在本 spec 處置。

## 二、誤差基線 `tests/baselines/behavior-error.json`

```
_meta
  參照編譯器     版本字串原文（例："Apple clang version 16.0.0 (clang-1600.0.26.6)"）
  旗標          "-std=c++17"
  note
語料（四欄，缺一不可 — FR-005）
  兩邊都跑得動    段數    ← 分母
  只有參照跑得動  段數
  只有直譯器跑得動 段數
  兩邊都跑不動    段數
誤差
  不一致筆數      ← 棘輪對象
  明細           [{ 語料摘要, 直譯器輸出, 參照輸出 }]     ← FR-004
```

⚠️ **分母（兩邊都跑得動）必須在基線裡**。只記分子的話，
**讓直譯器多壞掉幾段就能讓誤差下降**——縮分母比修分子容易。

## 三、判定落點 `tests/assets/behavior-error-decisions.json`

`build-guardrail` 第 11 步。護欄只排順序，不下結論——哪一筆是真誤差要人看。

```
[{ 語料鍵, 訊號, 判定, 理由 }]

判定 ∈ { 真誤差, 語料需要標準輸入, 語料是故意錯的示範, 其他（理由必填）}
```

**驗證規則**

- **每一筆判定必須有理由**——沒有理由的判定是把「懶得看」寫成「看過了」。
- **判定會過期**：訊號已不再出現卻還留著判定 ⇒ **報孤兒**。
  （基線過期會被棘輪抓到，**判定過期不會**——所以要另外查。）

## 四、共用的編譯執行工具 `tests/helpers/run-cpp.ts`

```
runCpp(code)            → 輸出字串，或丟例外
referenceCompilerInfo() → { 版本字串, 旗標 }
hasReferenceCompiler()  → boolean   （給 FR-006 用：false ⇒ 護欄要紅，不是 skip）
```

**收攏對象**：`tests/integration/fuzz-cpp-strings.test.ts`、`fuzz-cpp-stacks-queues.test.ts`
兩份私有實作 → 1（FR-013）。**收攏後那兩個檔的測試結果必須逐字不變**（SC-004）。
