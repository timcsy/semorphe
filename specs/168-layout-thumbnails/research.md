# Research：版面——四張示意圖

## 決策 1：二維宣告用「格子表」，而不是加第二個一維欄位

- **Decision**：版面宣告改成 `areas: readonly (readonly Layer[])[]`——一列一個陣列，
  同一層連續重複表示跨格（與 CSS `grid-template-areas` 同構）。

  ```ts
  focus         [['element'], ['state']]                          // element 是動態的，見決策 4
  compare       [['element', 'space'], ['state', 'state']]
  three-column  [['element','relation','space'], ['state','state','state']]
  grid          [['element','space'], ['relation','state']]       // 十字
  ```

- **Rationale**：
  - 🟢 **一份宣告同時餵三個消費者**：套用（CSS Grid）、示意圖（畫格子）、護欄（驗不變式）
    ——這正是 SC-004「新增一個版面只改一份宣告」的機制。
  - 🟢 與 CSS Grid **同構**，套用時不必翻譯：`areas` → `grid-template-areas` 字串。
  - 🟢 示意圖不必畫 SVG：**同一個 grid 縮小就是那張圖**。
- **Alternatives considered**：
  - 🪦 `layers: Layer[]` ＋ `rows: number`——表達得出格數，表達不出**哪一層在哪一格**。
  - 🪦 每個版面手寫一段 CSS class——三個消費者各讀各的，會漂開（`dual-truth` 的形狀）。
  - 🪦 手畫四張 SVG 縮圖——**圖與宣告會漂開**，而漂開時沒有任何機構會出聲。

## 決策 2：第八十一條護欄的兩條硬性零要改，而是「改準」不是「放寬」

量到的現況（`tests/integration/audit-layout-presets.test.ts`）：

```
line 52  🔴 硬性零：順序必須是 `LAYER_ORDER` 的【子序列】——不得重排
line 64  🔴 硬性零：`state` 不得出現在編輯區的預設裡
```

十字（`element,space ／ relation,state`）**兩條都違反**。

- **Decision**：把兩條**升成二維版本**，而不是刪掉：

  ```
  舊  由左到右必須是 LAYER_ORDER 的子序列
  新  【每一列】與【每一欄】都必須是 LAYER_ORDER 的子序列
      （同一層連續重複＝跨格，視為一格）

  舊  state 不得出現在編輯區的預設裡
  新  state 必須在【每一個】版面裡恰好出現一個連續區域——不得缺席
  ```

- **Rationale**：
  - 🟢 **四張圖逐一驗過，全部通過新規則**：

    | 版面 | 列 | 欄 |
    |---|---|---|
    | compare | (element,space) ✅ ／ (state) ✅ | (element,state) ✅ ／ (space,state) ✅ |
    | three-column | (element,relation,space) ✅ ／ (state) ✅ | 三欄各 (X,state) ✅ |
    | grid（十字） | (element,space) ✅ ／ (relation,state) ✅ | (element,relation) ✅ ／ (space,state) ✅ |

  - 🟢 新規則仍然擋掉**鏡像版面**（`space,element` 不是子序列）——FR-010 靠它。
  - 🔴 舊的 `state` 那條，它的理由逐字是「**列它進來會讓面板區變成一個可以被佈局關掉的東西**」
    ——而十字**沒有關掉它，是給了它一個對等的格子**。所以原本要防的事，
    新規則用「**必須出現**」防得更直接。

    > **一條規則如果是為了防止「消失」而寫成「不准出現」，
    > 它會連「換個位置出現」一起擋掉。**

- **Alternatives considered**：
  - 🪦 只放寬 `state` 那條、順序那條照舊——十字的列 `(element,space)` 通過，
    但**舊規則是把整個預設攤平成一維**來檢查，攤平後是 `element,space,relation,state`，
    `space` 在 `relation` 前面 → 仍然紅。所以兩條都得升。
  - 🪦 給十字開一個例外——例外會在第五張圖進來時再開一次。

## 決策 3：示意圖用 DOM 的 grid 畫，不用 SVG／canvas

- **Decision**：每一張圖是一個小的 `display: grid` 容器，格子是 `<div>`，
  `grid-template-areas` 由同一份宣告產生，格子裡放該層的 i18n 名稱。
- **Rationale**：
  - 🟢 **與實際版面共用同一段推導**——圖與畫面不可能不一致（SC-001 靠它）。
  - 🟢 i18n 直接用既有的層名稱鍵，不必為圖另外做一套（FR-008）。
  - 🟢 無新相依（憲法「簡約優先」）。
- **Alternatives**：🪦 SVG——要自己算座標，而 grid 免費給。

## 決策 4：`focus`（專注）維持動態，宣告用一個佔位

- **Decision**：`focus` 的編輯格寫成 `'*'`（＝使用者現在看的那一層），套用時代換。
- **Rationale**：spec 明文「專注顯示哪一層維持現有行為，本刀不改」。
  用佔位而不是特例分支，讓它仍然只是一份宣告。
- ⚠️ 護欄要認得 `'*'`：它不參與子序列檢查，但**每一個版面仍然必須有 state**。

## 決策 5：`state` 的容器不重做，只是被放到不同的格子

- **Decision**：`BottomPanel` 元件不動，它的**容器**成為 grid 的一格。
  十字時那一格在右下；其餘三張時它是橫跨整列的底部。
- **Rationale**：憲法「簡約優先」——今天它已經有主控台／變數分頁與拖曳高度，
  重做只會弄丟那些。而 FR-007（十字裡用分頁）**今天就已經是這樣**，不必新做。
- ⚠️ 已知風險：底部橫幅今天的高度是拖曳出來的 inline 樣式，
  而 grid 的列高也是 inline——**兩個地方寫同一份狀態**（`app-shell.ts:640` 那段註解
  記過同一個病）。→ 拖曳要改成寫 grid 的列高，不是寫元素高度。

## 決策 6：不做的（與 spec 的 Out of Scope 對齊）

自由 docking · 鏡像版面 · 每個槽的分頁列 · 改三欄順序 · 行動版版面。
