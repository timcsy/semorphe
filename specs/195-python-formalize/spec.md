# Spec 195：Python 的 formalize 與 Cella 提供者的 Python 分支

**路線圖**：〈重構〉「7 Python」的前半段——使用者 2026-11-01 定「階段 6 等 Python 也有 Cella 再一起切」，所以排在 6 之前（history 317）。
**前提（draft 五之九）**：`@cella-lang/python` 0.1.202610312350 有 `python.verdict`／`python.types`／`python.session`，形狀與 C 家族相同。
**翻譯的定義**：Cella 維護的對照表 `packages/python/docs/components.json`（99 顆元件；參考實作 `tools/python/component_map_check.py` 的 `Expander`，
檔頭逐字「semorphe 照它寫 formalize 的轉換」）。

## 195a：formalize（本刀）

- **FR-001** 同步工具 `tools/sync-python-formalize.py`：對照表的每顆模板 → 那顆元件自己膠囊裡的 `formalize.json`（formalize 是元件自己的動詞，第 389 刀）；
  運算子表 → `providers/cella/formalize/python-tables.json`；Cella 的範例 → `tests/fixtures/python-component-map.json`。產出進版本控制，測試不依賴姊妹 repo。
- **FR-002** 展開器 `providers/cella/formalize/python.ts`：`Expander` 的移植（模板指令＋18 種具名轉換）；字串照 Python 的跳脫規則還原、浮點數照 Python 的 `repr`。
- **FR-003** 不猜（P6）：模板查不到、運算子查不到、`$unknown`、`$only` 出現在別的位置 → unknown，說出節點與元件；不送出不合法的 JSON。
  與參考實作的差別：參數預設值只認字面量與名字（參考實作把原始碼文字重新剖析）。
- **FR-004** 判決器多一個 `python` 分支（根節點 `program` → `python.verdict`）。⚠️ Python 編進同一個判決模組，第一次載入變久；之後再改成「用到才編」。

## 驗收（195a）

- Cella 的 140 個範例：照我們的展開器展開，與 generate.ts 產生的 Python 經 CPython `ast` 轉出的相同（`tests/unit/providers/formalize-python.test.ts`）。
- Python 課文 48 份解答（`tests/probes/python-verdict.test.ts`）：翻得出 47、47 筆 accept、**用產品判題的 `compareOutput` 比**，輸出全部一致。
  剩 1 份是對照表的缺口（`math_max` 用 `$slots`，`key=` 進不去）——已回報 cella，探針明列為已知缺口。
- 順帶修的課文缺陷：`python-beginner` 08、12 的「排回去」題，`check.stdout` 少了解答後半段的輸出——**學生排對也過不了**（產品逐行比；e2e 用「包含」所以沒抓到）。

## 195b：提供者的 Python 分支（下一刀）

除錯模組（`python.session` 的匯出，含 `stopVisits`）、`formalOf` 認 Python 目標、型別查詢、會話契約跑 Python。
