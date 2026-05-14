export type LogSource = {
  id: string;
  label: string;
  paths: string[];
  filePatterns?: string[];
};

export type LogConfig = {
  sources: LogSource[];
  maxReadBytes: number;
  maxRows: number;
};

export type LogFile = {
  sourceId: string;
  sourceLabel: string;
  name: string;
  relativePath: string;
  absolutePath: string;
  size: number;
  modifiedAt: string;
  date: string | null;
  extension: string;
};

export type PublicLogFile = Omit<LogFile, "absolutePath">;

export type LogEntry = {
  id: string;
  sourceId: string;
  fileName: string;
  lineNumber: number;
  timestamp: string | null;
  level: string;
  type: "json" | "text";
  message: string;
  fields: Record<string, string>;
  raw: string;
};

export type LogSummary = {
  sources: Array<Pick<LogSource, "id" | "label">>;
  files: PublicLogFile[];
  dates: string[];
  levels: string[];
  fields: string[];
};

export type LogFilters = {
  sourceId?: string;
  file?: string;
  date?: string;
  level?: string;
  query?: string;
  field?: string;
  fieldValue?: string;
  from?: string;
  to?: string;
};

export type WorkerReport = {
  files: PublicLogFile[];
  generatedAt: string;
  overview: {
    workerRuns: number;
    hourlyRuns: number;
    forceRecalculateRiskRuns: number;
    succeededRuns: number;
    failedRuns: number;
  };
  sourceStats: Array<{
    source: string;
    fetchDoneRuns: number;
    httpCompleted: number;
    playwrightCompleted: number;
    chromiumUsed: number;
    failed: number;
  }>;
  dailyStats: Array<{
    date: string;
    workerRuns: number;
    hourlyRuns: number;
    forceRecalculateRiskRuns: number;
    succeededRuns: number;
    kcgTotal: number;
    thbTotal: number;
    thbPlaywrightRuns: number;
    thbHttpSuccessRuns: number;
    riskRowsWritten: number;
    roadNameRows: number;
  }>;
  otherStats: Array<{
    label: string;
    value: string;
  }>;
  conclusions: Array<{
    title: string;
    description: string;
  }>;
};
