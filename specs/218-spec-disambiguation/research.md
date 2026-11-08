# Research: 規格消歧試驗

## R1 · 判決怎麼注入（兩個宿主）
- **Decision**: 比對器只依賴一個函式型別 `Judge = (tree, scenario) => Promise<RunOutcome>`；產品的 Judge 包 Cella 提供者；測試的 Judge 包 `runCella`；cos-mos 批次自己寫一個。
- **Rationale**: 照草稿的設計約束（cos-mos 的 Node 批次讀不到瀏覽器的 worker）；與 `Provider` 的「由呼叫端注入」同一招。
- **Alternatives**: 比對器直接呼叫 Cella 提供者——會把瀏覽器 worker 綁進核心，Node 跑不了。

## R2 · Arduino 的板子輸入怎麼送
- **Decision**: 判決請求（`CheckRequest`）多一格選用的 `boardInputs?: {t,key,value}[]`；Cella 提供者把它放進程式 JSON 的 `inputs`（同測試輔助 `runCella` 今天的做法）。
- **Rationale**: Cella 的判決本來就收這個形狀；只差產品的請求沒有那一格。
- **Alternatives**: 另開一個判決入口——兩份入口會漂移。

## R3 · 解讀的參考解答檔名
- **Decision**: `solutions/<task>~<interp>.<ext>`（波浪號分隔），`solutionFor` 改成只比對 `<task>.<ext>`（後面不准再有點或波浪號）。
- **Rationale**: 今天的 `solutionFor` 用前綴 `<task>.` 比對——`ex1.a.c` 會被當成 `ex1` 的解答撈出來（誰先被 glob 列到就回誰）。換分隔字元＋收緊比對，兩邊都不會撞。
- **Alternatives**: 草稿寫的 `<task>.<interp>.<ext>`——要讓 `solutionFor` 認得副檔名清單才分得開，脆弱。

## R4 · C 的標準輸入產生器搬進產品
- **Decision**: `tests/helpers/stdin-from-tree.ts` 的邏輯搬到 `src/languages/cpp/scenarios/stdin.ts`，測試輔助改成 re-export（既有測試不動）；產生多組：每個讀取依型別給邊界值（0、負數、大數、空輸入、提前結尾）。
- **Rationale**: 情境要能分出「讀到 0 停」與「讀到結尾停」這種讀法——一組輸入分不出，要多組、含邊界。
- **Alternatives**: 隨機——不可重現（SC-001 要可重現）。

## R5 · Arduino 情境產生器
- **Decision**: 從語意樹找讀取的輸入腳（`digitalRead`／`analogRead` 的腳位），產生幾條時間序列：一直低、一直高、某時刻按下、按下又放開、類比值階梯。
- **Rationale**: 按鈕題的兩種讀法（按一下切換 vs. 按住才亮）在「按下又放開」那條才分得出。
- **Alternatives**: 讓老師手寫情境——第一版不做（產生器先行，之後可加「老師補的情境」）。

## R6 · 老師的選擇存哪
- **Decision**: localStorage（`semorphe-disambiguation` 鍵，課文 id＋題目 id → 解讀 id）。
- **Rationale**: 草稿「定題意與留紀錄歸 cos-mos」——正式紀錄等 cos-mos；第一版本地存，介面一個函式，之後換實作。
