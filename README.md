# 2027 台東 x 墾丁家庭旅行

手機優先的純靜態家庭旅行行程導航網站，不需要 React、Node、資料庫或後端服務。

## 網站網址

https://demag9145-cloud.github.io/2027-family-trip/

## 本機預覽

在專案資料夾執行：

```bash
python -m http.server 8000
```

然後開啟：

```text
http://localhost:8000/
```

## 更新方式

修改完成後：

```bash
git add .
git commit -m "Update itinerary"
git push
```

## GitHub Pages

此網站從 `main` branch 的 `/` root folder 部署到 GitHub Pages。

## 進度說明

每支手機的目前行程存在自己的 `localStorage`，不會跨手機同步。使用者可在「查看今日完整行程」或「查看四天行程」中手動選擇目前行程。

## 家長工具

預設密碼：`2027`

家長工具密碼為純前端簡易防誤觸機制，並非安全登入。密碼可在 `app.js` 的 `PARENT_TOOL_PASSWORD` 修改，不應放入真正重要或常用的私人密碼。

## 修改行程

所有行程資料都在 `data/itinerary.js`。

菜單圖片放在 `assets/menus/`，地圖圖片放在 `assets/maps/`。路徑需與 `data/itinerary.js` 內引用一致，GitHub Pages 會區分檔名大小寫。
