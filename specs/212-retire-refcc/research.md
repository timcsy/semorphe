# Research：參照編譯器族退場

## R1 · 21 支各自拿參照編譯器做什麼（2026-11-04 逐檔量）

| 形狀 | 檔 | 處置 |
|---|---|---|
| **A 來回一趟的行為不變**：`runCpp(原始碼)` 對 `runCpp(產回的碼)` | fuzz-cpp-stacks-queues（9 對）、fuzz-cpp-strings（10 對）、fuzz-cpp-time、fuzz-cpp-macros、roundtrip-cpp-time | Cella 跑兩份、兩份都 accept、輸出相同 |
| **B 交叉檢查**：`runCppDetailed(src)` 的輸出當 Cella 的期望 | fuzz-cpp-iterators、fuzz-cpp-container-kinds、roundtrip-cpp-iterators、roundtrip-cpp-container-kinds、fuzz-cpp-containers-2、fuzz-cpp-ranges、fuzz-cpp-bits、fuzz-cpp-container-ends、roundtrip-cpp-container-pop-front、roundtrip-cpp-structured-binding、cpp-shape-coverage、audit-cin-fail-state | 期望改成寫死的字串 |
| **C 護欄族** | audit-lesson-answers-vs-compiler、audit-sanitizer-verdict、audit-refcc-headers、run-cpp-no-orphans | 見 R3 |
| **D 探針** | tests/probes/two-projections-behave | 併入新探針或照舊（已在 probes，預設跳過） |

## R2 · 交叉檢查的期望值從哪裡來

- **Decision**：一次性擷取——在有編譯器的這台機器上，讓每一個 `ref.output` 的呼叫點把值記下來，寫回測試成字串字面值；**只在 Cella 的輸出與它相同時才寫**，不同的逐條看是誰的錯（我們送錯 → 修 formalize；Cella 錯 → `knownCellaGap` 並回報）。
- **Rationale**：斷言條數不變（SC-004），而期望值是「當初的權威算出來、人看過的」，不是「Cella 跑什麼都對」。
- **Alternatives**：
  - 斷言改成 `verdict === 'accept'` 而不比輸出——會讓輸出錯了照樣綠，拒絕。
  - 期望值改由 Cella 自己算（快照）——自證，拒絕。

## R3 · 護欄族各自守什麼

| 護欄 | 實際守的東西 | 處置 |
|---|---|---|
| audit-lesson-answers-vs-compiler | 課文答案的輸出 ＝ 課文寫的預期輸出（老師 2026-09-21 的回饋） | **接手**：課文判決語料（109 支）的「Cella 輸出 vs 預期」改成斷言（`tests/probes/binding-verdict` 今天只印報表，`wrongOut` 沒有斷言）；新的那條放 `tests/integration/`，硬性零或附理由的釘子 |
| audit-sanitizer-verdict | `run-cpp.ts` 的 `sanitizerSaysUB` 自己對不對 | 消費者只剩它自己（`grep sanitizerSaysUB` 只有這兩個檔）⟹ 隨之退場；判定 UB 是 Cella 的事 |
| audit-refcc-headers | 餵參照編譯器的程式不得手列標頭 | 母體歸零 ⟹ 退場；教訓留在 experience |
| run-cpp-no-orphans | 參照程式逾時不留孤兒行程 | 輔助檔只剩探針用 ⟹ 退場；CLAUDE.md 那段 UE 行程的診斷留著（它也適用別的行程） |

## R4 · 輔助檔刪還是留

- **Decision**：`tests/helpers/run-cpp.ts` 留著，只給探針用；`audit-cella-only` 加一條硬性零：`tests/`（扣掉 `tests/probes/`）與 `src/components/**/*.test.ts` 不得 import 它。
- **Rationale**：FR-006 的探針要它；刪掉再寫一份更貴。
- **Alternatives**：搬進 `tests/probes/_lib/`——路徑換了但規則一樣，沒有多得到什麼。

## R5 · CI 與墊片

- workflow 沒有另外安裝 g++（ubuntu runner 自帶），也沒有設 `SEMORPHE_REFCC_INCLUDE`——CI 上它本來就用真的 GCC 標頭。
- 要改的是**本機**：長測試腳本的「全套要帶墊片」（`tools/long-test.sh` 的坑②）與 CLAUDE.md 的操作說明。探針自己在需要時讀墊片變數。

## R6 · 缺陷帳

- 釘的是 Cella 的缺陷 → 照舊（`knownCellaGap`）；釘的是參照編譯器或本機／CI 差異的 → 隨參照那一半刪除，`defect-ledger` 基線照實下調並寫明。
