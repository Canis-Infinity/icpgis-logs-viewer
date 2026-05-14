import type { LogEntry, PublicLogFile, WorkerReport } from "@/lib/log-types";

type SourceAccumulator = {
  source: string;
  fetchDoneRuns: number;
  httpCompleted: number;
  playwrightCompleted: number;
  chromiumUsed: number;
  failed: number;
};

type DailyAccumulator = WorkerReport["dailyStats"][number];

const reportSources = ["KCG", "THB"];

export function buildWorkerReport(
  files: PublicLogFile[],
  entries: LogEntry[]
): WorkerReport {
  const sourceStats = new Map<string, SourceAccumulator>();
  const dailyStats = new Map<string, DailyAccumulator>();
  const workerStarts = entries.filter((entry) => isEvent(entry, "worker-start"));
  const workerFinishes = entries.filter((entry) => isEvent(entry, "worker-finish"));
  const hourlyStarts = workerStarts.filter((entry) => firstField(entry, ["job", "Job"]) === "hourly");
  const forceStarts = workerStarts.filter(
    (entry) => firstField(entry, ["job", "Job"]) === "force-recalculate-risk"
  );
  const succeededRuns = workerFinishes.filter((entry) => entry.fields.status === "Succeeded");
  const failedRuns = workerFinishes.filter((entry) => entry.fields.status && entry.fields.status !== "Succeeded");
  const thbNotKml = entries.filter((entry) => fieldEquals(entry, "source", "THB") && isEvent(entry, "not-kml"));
  const thbRetryScheduled = entries.filter(
    (entry) => fieldEquals(entry, "source", "THB") && isEvent(entry, "retry-scheduled")
  );
  const thbLocalCacheSaved = entries.filter(
    (entry) => fieldEquals(entry, "source", "THB") && fieldEquals(entry, "method", "local-cache") && isEvent(entry, "save-succeeded")
  );
  const riskDone = entries.filter(
    (entry) => fieldEquals(entry, "job", "recalculate-risk-if-needed") && isEvent(entry, "done")
  );
  const riskRecalculated = riskDone.filter((entry) => entry.fields.recalculated === "true").length;
  const riskSkipped = riskDone.filter((entry) => entry.fields.recalculated === "false").length;
  const cleanupDone = entries.filter((entry) => fieldEquals(entry, "job", "cleanup") && isEvent(entry, "done"));
  const hourlyDurations = succeededRuns
    .filter((entry) => firstField(entry, ["job", "Job"]) === "hourly")
    .map((entry) => Number(entry.fields.durationMs))
    .filter((value) => Number.isFinite(value));

  for (const source of reportSources) {
    sourceStats.set(source, {
      source,
      fetchDoneRuns: 0,
      httpCompleted: 0,
      playwrightCompleted: 0,
      chromiumUsed: 0,
      failed: 0
    });
  }

  for (const entry of entries) {
    const date = entryDate(entry);
    const daily = ensureDaily(dailyStats, date);

    if (isEvent(entry, "worker-start")) {
      daily.workerRuns += 1;
      const job = firstField(entry, ["job", "Job"]);
      if (job === "hourly") daily.hourlyRuns += 1;
      if (job === "force-recalculate-risk") daily.forceRecalculateRiskRuns += 1;
    }

    if (isEvent(entry, "worker-finish") && entry.fields.status === "Succeeded") {
      daily.succeededRuns += 1;
    }

    for (const source of reportSources) {
      if (!fieldEquals(entry, "source", source)) continue;

      const sourceStat = ensureSource(sourceStats, source);
      if (isEvent(entry, "fetch-done")) {
        sourceStat.fetchDoneRuns += 1;
        const count = numberField(entry, "count");
        if (source === "KCG") daily.kcgTotal += count;
        if (source === "THB") daily.thbTotal += count;
      }

      if (fieldEquals(entry, "method", "http") && isEvent(entry, "fetch-succeeded")) {
        sourceStat.httpCompleted += 1;
        if (source === "THB") daily.thbHttpSuccessRuns += 1;
      }

      if (source === "KCG" && isEvent(entry, "fetch-done")) {
        sourceStat.httpCompleted += 1;
      }

      if (fieldEquals(entry, "method", "playwright") && isEvent(entry, "fetch-succeeded")) {
        sourceStat.playwrightCompleted += 1;
        if (source === "THB") daily.thbPlaywrightRuns += 1;
      }

      if (
        fieldEquals(entry, "method", "playwright") &&
        isEvent(entry, "browser-selected") &&
        (entry.fields.path ?? "").toLowerCase().includes("chromium")
      ) {
        sourceStat.chromiumUsed += 1;
      }

      if (entry.level === "error" || entry.level === "fatal" || isEvent(entry, "fetch-failed")) {
        sourceStat.failed += 1;
      }
    }

    const riskRows = matchNumber(entry.raw, /管線風險計算完成：共寫入\s+(\d+)\s+筆/);
    if (riskRows !== null) daily.riskRowsWritten = riskRows;

    const roadNameRows = matchNumber(entry.raw, /RoadName 有值\s+(\d+)\s+筆/);
    if (roadNameRows !== null) daily.roadNameRows = roadNameRows;
  }

  return {
    files,
    generatedAt: new Date().toISOString(),
    overview: {
      workerRuns: workerStarts.length,
      hourlyRuns: hourlyStarts.length,
      forceRecalculateRiskRuns: forceStarts.length,
      succeededRuns: succeededRuns.length,
      failedRuns: failedRuns.length
    },
    sourceStats: Array.from(sourceStats.values()),
    dailyStats: Array.from(dailyStats.values()).sort((a, b) => a.date.localeCompare(b.date)),
    otherStats: [
      { label: "THB HTTP 取得非 KML 次數", value: formatNumber(thbNotKml.length) },
      { label: "THB HTTP retry-scheduled 次數", value: formatNumber(thbRetryScheduled.length) },
      { label: "THB 本地快取儲存成功次數", value: formatNumber(thbLocalCacheSaved.length) },
      { label: "風險重算次數", value: formatNumber(riskRecalculated) },
      { label: "風險重算 skipped 次數", value: formatNumber(riskSkipped) },
      { label: "每次風險結果寫入筆數", value: formatDistinct(dailyStats, "riskRowsWritten") },
      { label: "每次 RoadName 有值筆數", value: formatDistinct(dailyStats, "roadNameRows") },
      { label: "hourly 平均執行時間", value: formatAverageDuration(hourlyDurations) },
      { label: "cleanup 刪除 log 檔", value: formatNumber(sumFields(cleanupDone, "deletedLogFiles")) },
      { label: "cleanup 刪除暫存檔", value: formatNumber(sumFields(cleanupDone, "deletedTempFiles")) },
      { label: "cleanup 刪除 job run", value: formatNumber(sumFields(cleanupDone, "deletedJobRuns")) }
    ],
    conclusions: buildConclusions(sourceStats, workerStarts.length, succeededRuns.length, failedRuns.length, riskRecalculated, riskSkipped)
  };
}

function buildConclusions(
  sourceStats: Map<string, SourceAccumulator>,
  workerRuns: number,
  succeededRuns: number,
  failedRuns: number,
  riskRecalculated: number,
  riskSkipped: number
) {
  const kcg = sourceStats.get("KCG");
  const thb = sourceStats.get("THB");

  return [
    {
      title: "排程執行狀態",
      description:
        failedRuns === 0
          ? `${formatNumber(workerRuns)} 次 worker 中有 ${formatNumber(succeededRuns)} 次完成，未看到失敗完成紀錄。`
          : `${formatNumber(workerRuns)} 次 worker 中有 ${formatNumber(succeededRuns)} 次完成，${formatNumber(failedRuns)} 次失敗。`
    },
    {
      title: "KCG 抓取方式",
      description: kcg ? `${formatNumber(kcg.fetchDoneRuns)} 次都是 HTTP 直接完成。` : "未看到 KCG 抓取紀錄。"
    },
    {
      title: "THB 抓取方式",
      description: thb
        ? `HTTP 直接成功 ${formatNumber(thb.httpCompleted)} 次，Playwright 完成 ${formatNumber(thb.playwrightCompleted)} 次，其中 Chromium 使用 ${formatNumber(thb.chromiumUsed)} 次。`
        : "未看到 THB 抓取紀錄。"
    },
    {
      title: "風險重算",
      description: `重新計算 ${formatNumber(riskRecalculated)} 次，略過 ${formatNumber(riskSkipped)} 次。`
    }
  ];
}

function ensureSource(stats: Map<string, SourceAccumulator>, source: string) {
  const current = stats.get(source);
  if (current) return current;

  const created = {
    source,
    fetchDoneRuns: 0,
    httpCompleted: 0,
    playwrightCompleted: 0,
    chromiumUsed: 0,
    failed: 0
  };
  stats.set(source, created);
  return created;
}

function ensureDaily(stats: Map<string, DailyAccumulator>, date: string) {
  const current = stats.get(date);
  if (current) return current;

  const created = {
    date,
    workerRuns: 0,
    hourlyRuns: 0,
    forceRecalculateRiskRuns: 0,
    succeededRuns: 0,
    kcgTotal: 0,
    thbTotal: 0,
    thbPlaywrightRuns: 0,
    thbHttpSuccessRuns: 0,
    riskRowsWritten: 0,
    roadNameRows: 0
  };
  stats.set(date, created);
  return created;
}

function isEvent(entry: LogEntry, event: string) {
  return entry.fields.event === event;
}

function fieldEquals(entry: LogEntry, field: string, value: string) {
  return entry.fields[field] === value;
}

function firstField(entry: LogEntry, fields: string[]) {
  for (const field of fields) {
    const value = entry.fields[field];
    if (value) return value;
  }
  return "";
}

function numberField(entry: LogEntry, field: string) {
  const value = Number(entry.fields[field]);
  return Number.isFinite(value) ? value : 0;
}

function entryDate(entry: LogEntry) {
  return entry.timestamp?.slice(0, 10) ?? entry.fileName.match(/(20\d{2})(\d{2})(\d{2})/)?.slice(1).join("-") ?? "未分日期";
}

function matchNumber(value: string, pattern: RegExp) {
  const match = value.match(pattern);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumFields(entries: LogEntry[], field: string) {
  return entries.reduce((total, entry) => total + numberField(entry, field), 0);
}

function formatDistinct<K extends keyof DailyAccumulator>(
  stats: Map<string, DailyAccumulator>,
  key: K
) {
  const values = Array.from(new Set(Array.from(stats.values()).map((item) => item[key]).filter(Boolean)));
  if (values.length === 0) return "0";
  return values.map((value) => (typeof value === "number" ? formatNumber(value) : String(value))).join("、");
}

function formatAverageDuration(values: number[]) {
  if (values.length === 0) return "-";
  const averageMs = values.reduce((total, value) => total + value, 0) / values.length;
  return `約 ${formatDecimal(averageMs / 1000, 1)} 秒`;
}

function formatNumber(value: number) {
  return value.toLocaleString("zh-TW");
}

function formatDecimal(value: number, fractionDigits: number) {
  return value.toLocaleString("zh-TW", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
}
