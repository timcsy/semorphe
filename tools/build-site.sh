#!/usr/bin/env bash
#
# **把兩份站合成一包**——主線在 `/`，快車道在 `/next/`。
#
# ## 🔴 為什麼是一包
#
# GitHub Pages 一個 repo 一個站，一次部署換掉整包。所以「`/next/` 推上去就在、
# 而 `/` 只有 e2e 綠了才動」這件事，不能靠兩次部署做到——**要在一包裡放兩份**。
#
# ```
# dist/          ← 主線：${MAIN_REF}（預設是 verified 分支＝最後一次 e2e 綠的那一版）
# dist/next/     ← 快車道：現在這個 commit，沒有驗過
# ```
#
# ## ⚠️ 為什麼快車道值得存在，而它為什麼不是子網域
#
# `localStorage` 是 **per-origin** 的。`next.semorphe.com` 會讓學生在快車道上的
# 存檔、進度、作品**在主站全部不存在**——而他不會知道，直到他回家打開主站。
#
# > **同一個 origin 是這條路的唯一理由，而代價就是每一條絕對路徑都要帶前綴
# > （`src/core/base-path.ts`）。少帶一條的症狀不是報錯，是只有 `/next/` 那邊 404。**
#
# 用法：`tools/build-site.sh [主線要用哪個 ref]`（省略＝`verified`，沒有就退回 HEAD）
set -euo pipefail
# ⚠️ **`$VAR` 後面接全形字元時，大括號不能省**——那些字是多位元組，
#    bash 會把它們當成變數名的一部分，於是這一行自己爆成 `MAIN_REF?: unbound variable`。
#    🪦 同一天在 `tools/to-gif.sh` 踩過一次，寫了墓碑，然後在這個檔又踩一次。
#    > **一個只在錯誤路徑上跑的字串，它的 bug 會等到你最需要那句話的時候才出現；
#    > 而一個寫在【別的檔】裡的墓碑，攔不住你在這個檔重犯。**
#    🟢 所以它現在有護欄：`tests/integration/audit-shell-var-braces.test.ts`
cd "$(dirname "$0")/.."

MAIN_REF="${1:-verified}"
if ! git rev-parse --verify --quiet "$MAIN_REF" >/dev/null; then
  echo "::notice::沒有 $MAIN_REF 這個 ref——主線改用 HEAD（第一次跑就是這樣）"
  MAIN_REF="HEAD"
fi
echo "主線 = ${MAIN_REF}（$(git rev-parse --short "$MAIN_REF")）· 快車道 = HEAD（$(git rev-parse --short HEAD)）"

rm -rf dist dist-next .build-main

# ① 快車道：這個 commit，掛在 /next/
#    ⚠️ `SITE_BASE` 是給課文頁產生器的（它走 tsx，沒有 import.meta.env），
#       `--base` 是給 Vite 的。兩個都要，而它們必須一致。
SITE_BASE=/next/ npx vite build --base=/next/ --outDir dist-next

# ② 主線：MAIN_REF，掛在 /
if [ "$(git rev-parse "$MAIN_REF")" = "$(git rev-parse HEAD)" ]; then
  # 一樣就不必再 checkout 一次
  npm run build
else
  # 🔴 **worktree 要完整歷史**——`sitemap.xml` 的 `lastmod` 問 `git log`，
  #    而淺複製裡 HEAD 沒有父節點 → 所有檔案都變成「今天新增」。
  #    （build job 的 `fetch-depth: 0` 就是為了這個。）
  git worktree add -f .build-main "$MAIN_REF"
  ln -s "$PWD/node_modules" .build-main/node_modules
  ( cd .build-main && npm run build )
  mv .build-main/dist dist
  git worktree remove --force .build-main
fi

mv dist-next dist/next

# ★ 入口條件——兩份都要真的在，而且不得是同一份
test -f dist/index.html          || { echo "::error::主線沒有 index.html"; exit 1; }
test -f dist/next/index.html     || { echo "::error::快車道沒有 index.html"; exit 1; }
grep -q '/next/assets/' dist/next/index.html \
  || { echo "::error::快車道的資產路徑沒有帶 /next/ 前綴——它在主站底下會 404"; exit 1; }
grep -q 'noindex' "$(find dist/next/lessons -name index.html | head -1)" \
  || { echo "::error::快車道的課文頁沒有 noindex——搜尋引擎會端出沒驗過的那一版"; exit 1; }

echo "🟢 兩份都在：主線 $(du -sh dist | cut -f1)（含快車道 $(du -sh dist/next | cut -f1)）"
