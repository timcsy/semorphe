# Implementation Plan: 深嵌入的 formalize（180）

**Branch**: `180-deep-formalize` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

## Summary

語義樹 → Cella 的程式 JSON（`@cella-lang/cfamily` 的 `cfamily.syntax`），先 C++／Arduino。
這是盟約第 2 條的防腐層：semorphe 保留自己的模型，在邊界上翻譯；Cella 改了什麼，被對照表吸收，不擴散到元件。

## Technical Context

- 目標格式：Cella repo `packages/cfamily/src/syntax.cella`（620 行，`deriving Json`：`{"k": 建構子名, <參數名>: 值}`）。
  運算式約 60 種（`eVar` `eBin` `eCall` `eMCall` `eIndex` `eCast` `eConstCast` `eReinterpretCast` `eDynCast` `eHole`…）、
  敘述約 30 種（`sDeclV` `sIf` `sFor` `sForRange` `sCout` `sScanf` `sPrintf` `sHole`…）、頂層 18 種（`iFun` `iVar` `iInclude` `iUsing` `iClass`…）。
  宣告用 `DeclId` 指名；每個建構子第一欄是節點標籤 `n`。
- 判定者：Cella 的 JSON 解碼（缺欄位、多欄位、未知建構子都帶路徑報錯）＋ 判決的 `invalid`。
- 依賴：Cella 套件升級（卡在 peer 釘選，已回報）——**只擋 SC-002 的驗證**，其餘可先做。

## Design

```
src/providers/cella/formalize/          ← 防腐層住在 Cella 提供者裡（核心不認它；spec 179 的分層）
  index.ts            formalize(tree, { board? }) → { program } | { unknown: [{ nodeId, construct, reason }] }
  scope.ts            靜態作用域走訪：參照 → 宣告節點（DeclId）
  map/<元件>.ts 或一張表  元件 → 建構子；展開成多個建構子的元件（sort_range、計數迴圈、裝置積木）各自一個函式
  support.ts          Cella 的支援清單（函式、成員、partial）→ 送出前的判斷
  holes.ts            空槽 → eHole／sHole（`<節點>#<槽名>`）
```

- **對照表的形狀**：每顆 C++ 元件一筆：`{ componentId, to: 建構子名[] | 'unsupported', why? }`，由護欄比對元件清單（FR-007、SC-004）。
  初始時未對應的元件標 `unsupported` 並附理由 ⟹ 棘輪：「未對應數只准下降」。
- **節點標籤的規則**：學生看得到的那一層掛標籤（一顆積木 ＝ 一個標籤）；展開出來的內部建構子不掛，或掛 `<節點>/<角色>`（Cella 的 id 慣例，見四之十一的元件對照草稿）。
- **作用域**：一趟走訪建符號表；遮蔽照 C++ 規則；`::x` 標 unknown（四之十的約定）。

## Phases（第一批，不需要 Cella 升級）

1. 對照表骨架 ＋ 護欄（每顆 C++ 元件都在表上；未對應數棘輪）。
2. 作用域走訪 ＋ 單元測試（遮蔽、區塊、迴圈變數、參數、全域）。
3. 最小子集的翻譯：變數宣告、賦值、算術與比較、if／while／for、cout／cin、函式定義與呼叫——對課文前幾課的解答產出程式 JSON，
   形狀以 `syntax.cella` 為準做結構檢查（欄位名、建構子名）。
4. C18 語料的 `text` 半邊（`{id, text}`）交給 Cella（cella 說只先交 `text` 對他們有用）。

## Phases（第二批，等 Cella 升級）

5. 接 Cella 的判決入口，量 SC-002（`invalid` 為 0）與 SC-003（problem 標得回節點）。
6. 支援清單接上真正的套件版本。

## Risks

- 對照表會很長（250 顆 C++ 元件）：高於語法的元件（`sort_range`、計數迴圈、Arduino 裝置）要逐顆想清楚展開方式——cella 說會讀我們的 component.json 給草稿（四之十）。
- 語義樹的形狀與 Cella 的建構子不一一對應的地方（例如我們的 `cpp:print` 一顆對 `sCout` 一串）：以 Cella 的語意為準，對照表吸收差異。
