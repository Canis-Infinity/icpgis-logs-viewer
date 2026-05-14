# logs_viewer

Next.js、React、shadcn-ui 風格的本機 log 檢視工具。

## 功能

- 透過 `config/log-sources.json` 設定多個 log 目錄。
- 依來源、日期、檔案檢視 log。
- 支援純文字 syntax highlighting 與表格檢視。
- 支援關鍵字、等級、欄位、日期區間、檔案篩選。
- 支援 Serilog 文字格式與 NDJSON 格式。
- 支援 worker log 多檔合併報表，彙整排程執行、KCG、THB、Playwright、Chromium、每日統計與結論。
- 支援亮色、暗色主題，偏好會保存在瀏覽器 localStorage。
- API 只讀取設定檔允許的目錄，避免任意路徑讀取。

## 介面說明

左側是工作區與資料來源控制：

- `Log 檢視`：單檔 log 瀏覽，可切換純文字與表格。
- `報表`：合併多個 `worker-*.log` 產生統計報表。
- `來源`：切換設定檔中的 log source。
- `日期`：依檔名日期篩選檔案。
- `Log files`：選取目前要檢視的檔案。

右側上方是目前工作區的篩選區：

- Log 檢視可篩選等級、關鍵字、欄位、欄位值、日期區間。
- 報表可勾選要合併統計的 worker 文字 log。
- `清除` 會依目前工作區清除對應篩選。
- `重新整理` 會重新掃描 log 檔案並更新內容。

## Worker 報表

報表目前針對背景 worker log 的固定格式設計，會讀取 `worker-*.log`，並從 `key=value` 欄位與文字訊息中彙整統計。

主要統計項目：

- Worker 總執行次數、hourly 次數、force-recalculate-risk 次數、成功與失敗次數。
- KCG、THB 抓取完成次數。
- THB HTTP 直接成功、Playwright 完成、Chromium 使用次數。
- 每日 worker 次數、KCG 筆數、THB 筆數、風險結果寫入筆數。
- THB HTTP 取得非 KML、retry-scheduled、本地快取儲存、cleanup 等其他統計。

報表不依賴 AI 或外部服務，結果完全由本機 log deterministic 計算。

## Log 格式

目前支援兩種格式。

### Serilog 文字格式

```text
[2026-05-14 10:45:04.873 +08:00 INF] RunId=... Job=hourly code=WKR-003 event=worker-start job=hourly
```

解析器會擷取：

- timestamp
- level
- message
- `key=value` 欄位

### NDJSON

每行是一筆 JSON，例如 Serilog JSON formatter 輸出的 log。解析器會優先讀取：

- `Timestamp`、`timestamp`、`time`
- `Level`、`level`
- `MessageTemplate`、`RenderedMessage`、`message`

巢狀物件會攤平成 `A.B.C` 欄位。

## 設定

log 來源設定在 `config/log-sources.json`。

```json
{
  "sources": [
    {
      "id": "bg-worker",
      "label": "背景 Worker",
      "paths": ["../icpgis_bg_worker/logs"],
      "filePatterns": ["*.log", "*.json"]
    }
  ],
  "maxReadBytes": 5242880,
  "maxRows": 2000
}
```

欄位說明：

- `sources`：可讀取的 log 來源清單。
- `id`：來源識別碼，用於 API 查詢。
- `label`：介面顯示名稱。
- `paths`：允許讀取的目錄，可使用相對路徑。
- `filePatterns`：允許顯示的檔名 pattern。
- `maxReadBytes`：單檔最多讀取 bytes。超過時會讀取檔案尾端。
- `maxRows`：單次 API 最多回傳列數。

API 只會讀取設定檔列出的目錄與符合 pattern 的檔案，不接受任意路徑。

## 開發

```bash
npm install
npm run dev
```

預設開發伺服器執行在 `http://localhost:3002`。

預設設定已包含：

```json
{
  "id": "bg-worker",
  "label": "背景 Worker",
  "paths": ["../icpgis_bg_worker/logs"]
}
```

如需增加來源，編輯 `config/log-sources.json`。

常用檢查指令：

```bash
npm run type-check
npm run lint
```

## 部署

先建立 production build：

```bash
npm install
npm run build
```

啟動 production server：

```bash
npm run start
```

預設 production server 執行在 `http://localhost:3002`。

部署時請確認：

- `config/log-sources.json` 的 `paths` 指向伺服器上實際存在的 log 目錄。
- 執行程序有讀取 log 目錄的權限。
- 若 log 檔案很大，依需求調整 `maxReadBytes` 與 `maxRows`。

## API

- `GET /api/logs`：回傳來源、檔案、日期、可用等級與欄位摘要。
- `GET /api/logs/content`：讀取單一 log 檔案內容，支援來源、檔案、日期、等級、關鍵字、欄位與時間區間篩選。
- `GET /api/logs/report`：讀取多個 worker log 並產生彙總報表。

## 專案結構

```text
app/
  api/logs/            API routes
  globals.css          Tailwind 與主題樣式
components/
  logs/                Log viewer 主要畫面
  ui/                  shadcn-ui 風格元件
config/
  log-sources.json     Log 來源設定
lib/
  log-config.ts        設定讀取
  log-files.ts         檔案掃描與安全限制
  log-parser.ts        Log 解析與篩選
  worker-report.ts     Worker 報表彙總
```
