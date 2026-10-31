# Spec 190：階層下的來回一致（護欄）＋ 收合的子樹鍵

**路線圖**：vision〈分子〉「階層下的來回一致——fuzz：`分子 → 展開 → 收合 → 分子` 逐字相同」
**設計來源**：`knowledge/draft/2026-09-03-分子與粒度切換.md` §八之 3、§九之 4

## 需求

- **FR-001** 護欄 `tests/integration/audit-collapse-roundtrip.test.ts`：課文語料（C++／Arduino）每一顆收得起來的節點——
  ① 框的埠＝原本的對外接點、`boundaryOf` 一 in 零 out 且等於 `crossingEdges`、子樹不畫、沒有線指進框裡（硬性零）；
  ② 收合狀態怎麼動，產出的程式碼一字不差（硬性零）；
  ③ 鑰匙對回：重新 lift、最前面插一行——對到別顆是硬性零，對不回去入棘輪。
- **FR-002** 收合的鑰匙多一把子樹鍵（`S:`），對回規則：唯一 → 取；多顆 → 路徑挑；零顆 → 退回路徑。沒有子樹鍵的舊存檔照舊配對。

## 驗收

護欄綠；基線 `collapse-roundtrip.json`（relift_lost 0、shifted_lost 121）。
