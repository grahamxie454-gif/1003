# 照片改存 Cloudflare R2

Supabase 繼續處理登入、照片註解及 `trip_photos` 資料。新照片檔案由私有 R2 bucket 儲存，Worker 驗證 Supabase 使用者後才允許上傳／刪除，並依 `get_shared_trip` 和 `trip_photos` 的 RLS 簽發一小時有效的圖片連結。任何拿到有效圖片連結的人在有效期限內都可讀取該圖片，與原本 Supabase signed URL 相同。

## 部署

1. 在 Cloudflare 開啟 R2 並建立私有 bucket `1003-photo`。不要開啟公開存取，不需要建立或傳送 R2 access key。
2. 根目錄的 `wrangler.jsonc` 已將 `PHOTOS` 綁定至 `1003-photo`。
3. 在 Worker 的 Variables and Secrets 設定 `SUPABASE_ANON_KEY`，值使用 `js/core.js` 裡現有的公開 `SB_KEY`。不要使用 `service_role` key。部署設定會保留控制台中的這個變數。
4. `ALLOWED_ORIGINS` 填網站實際 origin，以逗號分隔。GitHub Pages 的 origin 是 `https://grahamxie454-gif.github.io`，不包含 `/1003/`。保留有需要的本機 origin。
5. 在專案根目錄執行 `npx wrangler login`，使用自己的 Cloudflare 帳號登入，再執行 `npx wrangler deploy`。首次執行需允許 npm 安裝官方 Wrangler CLI。若使用 Cloudflare Git 部署，將部署命令設為 `npx wrangler deploy`、根目錄設為 `/`。
6. 在 Worker 的 Secrets 設定新增 `PHOTO_SIGNING_KEY`，使用隨機且至少 32 字元的秘密（例如密碼管理器產生的 64 字元值）。CLI 可用 `npx wrangler secret put PHOTO_SIGNING_KEY` 安全輸入。不要將它寫入 Git、前端或聊天。
7. `js/photo-storage.js` 已設定 Worker HTTPS origin `https://1003.grahamxie454.workers.dev`。更新網站部署後，新上傳才會走 R2。此值空白時仍使用原本 Supabase Storage。
8. 若在 Codex 雲端環境測試，另在環境網路設定允許實際 Worker hostname。R2 binding 在 Cloudflare 端存取 bucket，不需瀏覽器直接連線 R2 S3 API。

## 驗證

在專案根目錄執行 `node --test worker/*.test.mjs`。這些測試使用模擬 Supabase 與 R2，涵蓋完整上傳／簽名／讀取、禁止覆寫、不同使用者刪除、無權限行程、RLS 不可見照片、過期及竄改連結、無效路徑、來源與檔案驗證。

部署後以已登入帳號在分享頁上傳 JPEG（前端仍會轉檔並移除 EXIF），確認：

- R2 bucket 出現 `行程 UUID/照片 UUID.jpg`。
- `trip_photos.path` 是 `r2:行程 UUID/照片 UUID.jpg`；若現有資料庫對 path 有額外限制，需要由資料庫管理者確認相容性，本專案沒有提供 schema。
- 分享頁及幻燈片能顯示新舊照片。
- 上傳者可以修改註解／刪除照片，其他使用者不能刪除。
- 未登入者不能取得新連結；無權限行程不能讀取照片。

## 舊圖片與失敗處理

舊的 `trip_photos.path` 沒有 `r2:` 前綴，仍從 Supabase Storage 讀取及刪除。部署 Worker 後，登入 `migrate-r2.html` 可搬移目前帳號上傳的舊照片。工具會依序複製、驗證 R2、更新資料列，再刪除來源；驗證失敗時會復原資料列並保留 Supabase 原檔。其他使用者上傳的照片須由該使用者登入執行，或另行使用受控的管理端遷移。

上傳 R2 成功但資料列新增失敗時，前端會嘗試清除 R2 檔。照片刪除沿用原本流程：先刪除資料列，再清除檔案；清除失敗會顯示訊息，管理者可在 bucket 手動清除殘留檔。Worker 以物件 metadata 中的使用者 ID 驗證刪除權限，因此資料列已刪除時仍能清理。兩個服務間沒有原子交易，請定期檢查孤立物件。

Worker 僅接受 JPEG、最多 10 MiB，禁止覆寫現有 key。照片連結一小時後到期，長時間開著幻燈片時請重新整理。圖片大小限制由 Worker 執行；前端顯示的部分失敗可重新嘗試。
