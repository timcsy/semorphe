# 有些網路連不上 semorphe.com——GitHub Pages 整組被擋

> 狀態：🟡 待使用者決定（2026-11-05；附推薦）。使用者回報：「在另外一台電腦無法開啟 semorphe.com，顯示 ERR_CONNECTION_RESET，有一些電腦則可以開；不能開的電腦開別的網站可以」。

## 量到的（2026-11-05，開發機當時的網路）

| 連線 | 結果 |
|---|---|
| `https://semorphe.com`、`https://www.semorphe.com` | ❌ reset |
| `https://timcsy.github.io`、`https://pages.github.com` | ❌ reset（**所有 GitHub Pages**） |
| `https://github.com` | ✅ |
| `http://semorphe.com`（80 埠） | ✅ 200 |

- TCP 連得上；送出 TLS 的 Client Hello 之後立刻被 reset——**網路上的過濾設備依 SNI 擋**的典型樣子。換 TLS 1.2、HTTP/1.1 一樣。
- DNS 正確（GitHub Pages 的 185.199.108～111.153 與 IPv6）；憑證有效（Let's Encrypt，到 2027-01-27）。
- ⟹ **不是 semorphe 的設定壞了**；是某些網路（學校／公司的內容過濾、電信業者的過濾服務、路由器的家長控制、防毒的網頁防護）把 GitHub Pages 整組擋掉。

## 順帶看到的

- `http://semorphe.com` 回 200 而不是轉到 https——GitHub Pages 的 **Enforce HTTPS** 似乎沒開。與這次無關，建議打開（repo → Settings → Pages）。這是使用者在 GitHub 上的設定，不經過 AI。

## 🟡 要你決定：學生在會擋 GitHub Pages 的網路上怎麼辦

| 選項 | 做法 | 代價 |
|---|---|---|
| **A（推薦）先不動託管，請網管加白名單**；同時把「被擋時怎麼辦」寫進說明頁 | 學校網管把 `semorphe.com`（與 `*.github.io`）放行 | 不花錢、不動 DNS；每個學校要各自處理一次 |
| B 在前面加 Cloudflare 代理（DNS 交給 Cloudflare、橘色雲） | 連線的 IP 與憑證換成 Cloudflare 的，不再落在「GitHub Pages 整組」的規則裡 | 要把網域的 DNS 搬到 Cloudflare；多一層要維護的設定；Cloudflare 的 IP 也可能被別的規則擋 |
| C 換託管（Cloudflare Pages／Netlify／自架） | 部署流程（`deploy.yml`）改發到新的地方 | 改 CI、搬 DNS；e2e 與預覽流程要跟著改 |

**推薦 A**：被擋的是特定網路的政策，最直接的解法是在那個網路放行；B／C 只是換一個「也可能被擋」的位置，而且動到 DNS 與部署。若真的有一批學校擋而網管不配合，再走 B（比 C 改得少）。

## 怎麼確認是哪一種擋（給使用者在那台電腦上做）

1. 改用手機熱點 → 能開 ⟹ 是原本的網路在擋。
2. 熱點也不能開 ⟹ 是那台電腦上的軟體（防毒的網頁防護、VPN、公司的管理程式）。
