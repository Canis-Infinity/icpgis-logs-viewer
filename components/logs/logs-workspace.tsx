"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlignLeft,
  ArrowUp,
  BarChart3,
  Bug,
  CalendarIcon,
  CheckCircle2,
  Clock3,
  CircleX,
  Database,
  Eraser,
  FileText,
  FileX,
  FolderOpen,
  Info,
  List,
  Moon,
  RefreshCw,
  SlidersHorizontal,
  SquareCheckBig,
  SquareX,
  Sun,
  Table2,
  TriangleAlert
} from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LogEntry, LogSummary, PublicLogFile, WorkerReport } from "@/lib/log-types";
import { cn } from "@/lib/utils";

type ContentResponse = {
  file: PublicLogFile | null;
  entries: LogEntry[];
  levels: string[];
  fields: string[];
  truncated: boolean;
};

type ThemeMode = "light" | "dark";
type WorkspaceMode = "logs" | "report";
type ViewMode = "table" | "plain";

const emptySummary: LogSummary = {
  sources: [],
  files: [],
  dates: [],
  levels: [],
  fields: []
};

const pinnedFields = [
  "code",
  "event",
  "job",
  "Job",
  "component",
  "source",
  "method",
  "status",
  "statusCode",
  "exitCode",
  "durationMs",
  "elapsedMs",
  "RunId",
  "runId",
  "impact"
];

export function LogsWorkspace() {
  const [summary, setSummary] = useState<LogSummary>(emptySummary);
  const [content, setContent] = useState<ContentResponse>({
    file: null,
    entries: [],
    levels: [],
    fields: [],
    truncated: false
  });
  const [report, setReport] = useState<WorkerReport | null>(null);
  const [sourceId, setSourceId] = useState("all");
  const [date, setDate] = useState("all");
  const [file, setFile] = useState("");
  const [level, setLevel] = useState("all");
  const [field, setField] = useState("all");
  const [fieldValue, setFieldValue] = useState("");
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("logs");
  const [view, setView] = useState<ViewMode>("plain");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedReportFiles, setSelectedReportFiles] = useState<string[]>([]);
  const [reportFilesInitialized, setReportFilesInitialized] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1280px)");

  const visibleFiles = useMemo(() => {
    return summary.files.filter((item) => {
      if (sourceId !== "all" && item.sourceId !== sourceId) return false;
      if (date !== "all" && item.date !== date) return false;
      return true;
    });
  }, [date, sourceId, summary.files]);

  const fields = content.fields.length ? content.fields : summary.fields;
  const selectedEntry =
    selectedEntryId === null
      ? null
      : content.entries.find((entry) => entry.id === selectedEntryId) ?? null;
  const levelCounts = useMemo(() => buildLevelCounts(content.entries), [content.entries]);
  const selectedFile = visibleFiles.find((item) => item.relativePath === file);
  const reportCandidateFiles = useMemo(
    () => visibleFiles.filter((item) => item.name.startsWith("worker-") && item.extension === "log"),
    [visibleFiles]
  );
  const areAllReportFilesSelected =
    reportCandidateFiles.length > 0 &&
    reportCandidateFiles.every((item) => selectedReportFiles.includes(item.relativePath));

  useEffect(() => {
    const stored = window.localStorage.getItem("logs-viewer-theme") as ThemeMode | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = stored ?? (prefersDark ? "dark" : "light");
    setTheme(nextTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("logs-viewer-theme", theme);
  }, [theme]);

  useEffect(() => {
    void loadSummary();
  }, []);

  useEffect(() => {
    if (visibleFiles.length === 0) {
      setFile("");
      return;
    }

    if (!file || !visibleFiles.some((item) => item.relativePath === file)) {
      setFile(visibleFiles[0].relativePath);
    }
  }, [file, visibleFiles]);

  useEffect(() => {
    const available = new Set(reportCandidateFiles.map((item) => item.relativePath));
    setSelectedReportFiles((current) => {
      const kept = current.filter((item) => available.has(item));
      if (kept.length > 0) return kept;
      if (reportFilesInitialized) return kept;
      return reportCandidateFiles.map((item) => item.relativePath);
    });
    setReportFilesInitialized(true);
  }, [reportCandidateFiles, reportFilesInitialized]);

  const loadContent = useCallback(
    async (nextSourceId?: string, nextFile?: string) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (nextSourceId) params.set("sourceId", nextSourceId);
      if (nextFile) params.set("file", nextFile);
      if (date !== "all") params.set("date", date);
      if (level !== "all") params.set("level", level);
      if (field !== "all") params.set("field", field);
      if (fieldValue) params.set("fieldValue", fieldValue);
      if (query) params.set("query", query);
      if (date === "all" && dateRange?.from) {
        params.set("from", `${formatDateOnly(dateRange.from)}T00:00:00`);
      }
      if (date === "all" && dateRange?.to) {
        params.set("to", `${formatDateOnly(dateRange.to)}T23:59:59`);
      }

      const response = await fetch(`/api/logs/content?${params.toString()}`, {
        cache: "no-store"
      });
      const data = (await response.json()) as ContentResponse;
      setContent(data);
      setSelectedEntryId(null);
      setLoading(false);
    },
    [date, dateRange, field, fieldValue, level, query]
  );

  const loadReport = useCallback(async () => {
    if (selectedReportFiles.length === 0) {
      setReport(null);
      setReportLoading(false);
      return;
    }

    setReportLoading(true);
    const params = new URLSearchParams();
    if (sourceId !== "all") params.set("sourceId", sourceId);
    if (date !== "all") params.set("date", date);
    selectedReportFiles.forEach((item) => params.append("file", item));

    const response = await fetch(`/api/logs/report?${params.toString()}`, {
      cache: "no-store"
    });
    const data = (await response.json()) as WorkerReport;
    setReport(data);
    setReportLoading(false);
  }, [date, selectedReportFiles, sourceId]);

  useEffect(() => {
    if (!file) return;
    const selected = visibleFiles.find((item) => item.relativePath === file);
    const nextSourceId = selected?.sourceId ?? (sourceId === "all" ? undefined : sourceId);
    void loadContent(nextSourceId, file);
  }, [file, loadContent, sourceId, visibleFiles]);

  useEffect(() => {
    if (workspaceMode !== "report") return;
    void loadReport();
  }, [loadReport, workspaceMode]);

  async function loadSummary() {
    setLoading(true);
    const response = await fetch("/api/logs", { cache: "no-store" });
    const data = (await response.json()) as LogSummary;
    setSummary(data);
    setLoading(false);
  }

  function refresh() {
    void loadSummary();
    if (file) {
      const selected = visibleFiles.find((item) => item.relativePath === file);
      void loadContent(selected?.sourceId, file);
    }
    if (workspaceMode === "report") {
      void loadReport();
    }
  }

  function switchTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  function selectDate(value: string) {
    setDate(value);
    setDateRange(undefined);
  }

  function selectDateRange(value: DateRange | undefined) {
    setDateRange(value);
    if (value?.from) {
      setDate("all");
    }
  }

  function clearSourceFilters() {
    setSourceId("all");
    selectDate("all");
    setFile(summary.files[0]?.relativePath ?? "");
  }

  function clearTopFilters() {
    setLevel("all");
    setQuery("");
    setField("all");
    setFieldValue("");
    setDateRange(undefined);
  }

  function clearReportFilters() {
    setSourceId("all");
    selectDate("all");
    setSelectedReportFiles([]);
    setReport(null);
  }

  function clearCurrentFilters() {
    if (workspaceMode === "report") {
      clearReportFilters();
      return;
    }

    clearTopFilters();
  }

  function selectFileItem(item: PublicLogFile) {
    setFile(item.relativePath);
    if (workspaceMode === "report" && item.name.startsWith("worker-") && item.extension === "log") {
      setSelectedReportFiles((current) =>
        current.includes(item.relativePath) ? current : [...current, item.relativePath]
      );
    }
    setShowFilePicker(false);
  }

  function toggleReportFile(relativePath: string, checked: boolean) {
    setSelectedReportFiles((current) => {
      if (checked) return Array.from(new Set([...current, relativePath]));
      return current.filter((item) => item !== relativePath);
    });
  }

  function selectAllReportFiles() {
    setSelectedReportFiles((current) => {
      const reportFilePaths = reportCandidateFiles.map((item) => item.relativePath);
      const allSelected =
        reportFilePaths.length > 0 &&
        reportFilePaths.every((item) => current.includes(item));

      return allSelected ? [] : reportFilePaths;
    });
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="px-4 py-4 min-h-dvh bg-background text-foreground md:px-6 md:py-6 xl:h-dvh xl:overflow-hidden">
      <div className="mx-auto grid max-w-[1800px] rounded-lg border bg-card xl:h-full xl:min-h-0 xl:overflow-hidden xl:grid-cols-[320px_1fr]">
        <aside className="flex flex-col p-4 border-b border-border bg-muted/35 xl:min-h-0 xl:border-b-0 xl:border-r">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <div className="text-sm text-muted-foreground">Local log viewer</div>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal">
                logs_viewer
              </h1>
            </div>
            <Button variant="outline" size="icon" onClick={switchTheme} title="切換主題">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>

          <div className="space-y-3">
            <Tabs
              value={workspaceMode}
              onValueChange={(value) => setWorkspaceMode(value as WorkspaceMode)}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="logs" title="Log 檢視">
                  <AlignLeft className="w-4 h-4" />
                  <span>Log 檢視</span>
                </TabsTrigger>
                <TabsTrigger value="report" title="報表">
                  <BarChart3 className="w-4 h-4" />
                  <span>報表</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearSourceFilters}>
                <Eraser className="w-4 h-4" />
              </Button>
            </div>

            <FormField id="log-source" label="來源">
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger id="log-source">
                  <SelectValue placeholder="選擇來源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部來源</SelectItem>
                  {summary.sources.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <DatePickerSimple
              date={parseDateOnly(date)}
              label="日期"
              placeholder="全部日期"
              onSelect={(value) => selectDate(value ? formatDateOnly(value) : "all")}
            />
          </div>

          <div className="flex items-center justify-between mt-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="w-4 h-4" />
              Log Files
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{formatNumber(visibleFiles.length)} 個檔案</Badge>
              <Button
                variant="outline"
                size="sm"
                className="xl:hidden"
                onClick={() => setShowFilePicker(true)}
              >
                <List className="w-4 h-4" />
                選擇檔案
              </Button>
            </div>
          </div>

          <div className="hidden pr-1 mt-3 space-y-2 overflow-auto xl:block xl:min-h-0 xl:flex-1">
            <LogFileList
              files={visibleFiles}
              selectedFile={file}
              onSelect={selectFileItem}
            />
          </div>
        </aside>

        <section className="flex min-h-[70dvh] min-w-0 flex-col bg-background xl:min-h-0">
          <header className="px-4 py-4 border-b shrink-0 border-border bg-card/80 backdrop-blur">
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary" className="h-8 gap-1.5 px-3">
                  {workspaceMode === "report" ? (
                    <>
                      <BarChart3 className="h-3.5 w-3.5" />
                      {formatNumber(selectedReportFiles.length)} 個報表檔案
                    </>
                  ) : (
                    <>
                      <FileText className="h-3.5 w-3.5" />
                      {formatNumber(content.entries.length)} 筆結果
                    </>
                  )}
                </Badge>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={clearCurrentFilters}
                    title={workspaceMode === "report" ? "清除報表篩選" : "清除上方篩選"}
                  >
                    <Eraser className="w-4 h-4" />
                    <span className="sr-only sm:not-sr-only">清除</span>
                  </Button>
                  <Button variant="outline" onClick={refresh} title="重新整理">
                    <RefreshCw className="w-4 h-4" />
                    <span className="sr-only sm:not-sr-only">重新整理</span>
                  </Button>
                  <Button
                    variant={showAdvancedFilters ? "default" : "outline"}
                    onClick={() => setShowAdvancedFilters((value) => !value)}
                    title="篩選"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="sr-only sm:not-sr-only">篩選</span>
                  </Button>
                </div>
              </div>
            </div>

            {showAdvancedFilters && (
              <div className="grid gap-3 p-3 mt-4 border rounded-md bg-muted/10">
                {workspaceMode === "report" ? (
                  <ReportFilePicker
                    files={reportCandidateFiles}
                    selectedFiles={selectedReportFiles}
                    areAllSelected={areAllReportFilesSelected}
                    onToggle={toggleReportFile}
                    onSelectAll={selectAllReportFiles}
                    onRefresh={loadReport}
                  />
                ) : (
                  <>
                    <LevelFilterGroup
                      value={level}
                      counts={levelCounts}
                      onChange={setLevel}
                    />
                    <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.35fr)_minmax(190px,1fr)_minmax(170px,0.85fr)_minmax(210px,1fr)]">
                      <FormField id="log-query" label="搜尋">
                        <Input
                          id="log-query"
                          className="h-9"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder={`搜尋${content.file?.name ? ` ${content.file.name}` : ""}`}
                        />
                      </FormField>
                      <FormField id="log-field" label="欄位">
                        <Select value={field} onValueChange={setField}>
                          <SelectTrigger id="log-field">
                            <SelectValue placeholder="選擇欄位" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全部欄位</SelectItem>
                            {fields.map((item) => (
                              <SelectItem key={item} value={item}>
                                {item}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormField>
                      <FormField id="log-field-value" label="欄位值">
                        <Input id="log-field-value" value={fieldValue} onChange={(event) => setFieldValue(event.target.value)} placeholder="欄位值" />
                      </FormField>
                      <DatePickerWithRange date={dateRange} onSelect={selectDateRange} />
                    </div>
                  </>
                )}
              </div>
            )}
          </header>

          <div className="flex flex-col gap-3 px-4 py-3 border-b shrink-0 border-border sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {workspaceMode === "report" ? (
                  <BarChart3 className="w-4 h-4" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <span className="truncate">
                  {workspaceMode === "report" ? "Worker 彙總報表" : content.file?.sourceLabel ?? "尚未選擇來源"}
                </span>
                {workspaceMode === "logs" && selectedFile && (
                  <Badge variant="outline" className="gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    {formatBytes(selectedFile.size)}
                  </Badge>
                )}
                {content.truncated && (
                  <Badge variant="secondary" className="gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    已讀取檔案尾端
                  </Badge>
                )}
              </div>
              <h2 className="flex items-center min-w-0 gap-2 mt-1 text-lg font-semibold">
                <span className="truncate">
                  {workspaceMode === "report" ? "多檔 worker log 統計" : content.file?.name ?? "尚未選擇檔案"}
                </span>
              </h2>
            </div>
            {workspaceMode === "logs" && (
              <Tabs value={view} onValueChange={(value) => setView(value as ViewMode)}>
                <TabsList>
                  <TabsTrigger value="plain" title="純文字">
                    <AlignLeft className="w-4 h-4" />
                    <span>純文字</span>
                  </TabsTrigger>
                  <TabsTrigger value="table" title="表格">
                    <Table2 className="w-4 h-4" />
                    <span>表格</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>

          <div
            className="grid min-h-[420px] flex-1 gap-0 xl:min-h-0 xl:grid-cols-1"
          >
            <div className="min-w-0 min-h-0">
              {workspaceMode === "report" ? (
                <WorkerReportView loading={reportLoading} report={report} />
              ) : loading ? (
                view === "plain" ? <PlainLogSkeleton /> : <TableLogSkeleton />
              ) : view === "plain" ? (
                <PlainLogView entries={content.entries} onSelect={setSelectedEntryId} selectedId={selectedEntryId} />
              ) : (
                <TableLogView entries={content.entries} onSelect={setSelectedEntryId} selectedId={selectedEntryId} />
              )}
            </div>
          </div>
          <footer className="px-4 py-3 text-xs border-t shrink-0 text-muted-foreground">
            © logs_viewer
          </footer>
        </section>
      </div>

      <MobileDrawer
        title="選擇 Log file"
        open={!isDesktop && showFilePicker}
        onOpenChange={setShowFilePicker}
      >
        <div className="space-y-2">
          <LogFileList files={visibleFiles} selectedFile={file} onSelect={selectFileItem} />
        </div>
      </MobileDrawer>

      <MobileDrawer
        title="詳細資訊"
        open={!isDesktop && selectedEntry !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEntryId(null);
        }}
      >
        {selectedEntry && (
          <EntryDetails
            entry={selectedEntry}
            className="h-auto p-0 border-0"
          />
        )}
      </MobileDrawer>

      <DesktopDrawer
        title="詳細資訊"
        open={isDesktop && selectedEntry !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEntryId(null);
        }}
      >
        {selectedEntry && (
          <EntryDetails
            entry={selectedEntry}
            className="h-auto p-0 border-0"
          />
        )}
      </DesktopDrawer>

      <Button
        variant="default"
        size="icon"
        className="fixed z-40 shadow-lg bottom-4 right-4 xl:hidden"
        onClick={scrollToTop}
        title="回到頂端"
      >
        <ArrowUp className="w-4 h-4" />
      </Button>
    </main>
  );
}

function FormField({
  id,
  label,
  children
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Field className="w-full">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
    </Field>
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);

    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);
    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}

function LogFileList({
  files,
  selectedFile,
  onSelect
}: {
  files: PublicLogFile[];
  selectedFile: string;
  onSelect: (item: PublicLogFile) => void;
}) {
  if (files.length === 0) {
    return (
      <Empty className="min-h-[180px]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpen className="w-5 h-5" />
          </EmptyMedia>
          <EmptyTitle>沒有 log 檔案</EmptyTitle>
          <EmptyDescription>
            目前來源與日期條件下沒有可瀏覽的 log。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {files.map((item) => (
        <button
          key={`${item.sourceId}:${item.relativePath}`}
          className={`group w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
            selectedFile === item.relativePath
              ? "border-primary bg-accent text-accent-foreground shadow-sm"
              : "border-transparent bg-background/70 hover:border-border hover:bg-background"
          }`}
          onClick={() => onSelect(item)}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate">{item.name}</span>
            <span className="text-xs shrink-0 text-muted-foreground">{formatBytes(item.size)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1 text-xs text-muted-foreground">
            <span className="truncate">{item.sourceLabel}</span>
            <span className="shrink-0">{item.date ?? "未分日期"}</span>
          </div>
        </button>
      ))}
    </>
  );
}

function DesktopDrawer({
  title,
  open,
  onOpenChange,
  children
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="right"
      shouldScaleBackground={false}
    >
      <DrawerContent className="hidden border-l-0 xl:flex xl:w-[min(560px,44vw)] xl:max-w-none">
        <div className="flex flex-col flex-1 min-h-0">
          <DrawerHeader className="text-left border-b">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {title}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 min-h-0 p-4 overflow-auto">
            {children}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function MobileDrawer({
  title,
  open,
  onOpenChange,
  children
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="xl:hidden">
        <div className="flex flex-col flex-1 w-full max-w-2xl min-h-0 mx-auto">
          <DrawerHeader className="text-left border-b">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {title}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 min-h-0 p-4 overflow-auto">
            {children}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ReportFilePicker({
  files,
  selectedFiles,
  areAllSelected,
  onToggle,
  onSelectAll,
  onRefresh
}: {
  files: PublicLogFile[];
  selectedFiles: string[];
  areAllSelected: boolean;
  onToggle: (relativePath: string, checked: boolean) => void;
  onSelectAll: () => void;
  onRefresh: () => void;
}) {
  return (
    <FieldSet className="gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <FieldLegend className="text-sm">報表檔案</FieldLegend>
          <FieldDescription className="text-xs">
            選取要合併統計的 worker 文字 log。
          </FieldDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onSelectAll} disabled={files.length === 0}>
            {areAllSelected ? <SquareX className="w-4 h-4" /> : <SquareCheckBig className="w-4 h-4" />}
            {areAllSelected ? "取消全選" : "全選"}
          </Button>
          <Button variant="default" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4" />
            更新報表
          </Button>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {files.length === 0 ? (
          <Empty className="min-h-[180px] md:col-span-2 xl:col-span-3">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BarChart3 className="w-5 h-5" />
              </EmptyMedia>
              <EmptyTitle>沒有 worker 報表檔案</EmptyTitle>
              <EmptyDescription>
                目前條件下找不到 `worker-*.log`，請調整來源或日期。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          files.map((file) => (
            <Field
              key={file.relativePath}
              orientation="horizontal"
              className="min-w-0 px-3 py-2 border rounded-md bg-background"
            >
              <Checkbox
                id={`report-file-${file.relativePath}`}
                checked={selectedFiles.includes(file.relativePath)}
                onCheckedChange={(checked) => onToggle(file.relativePath, checked === true)}
              />
              <FieldLabel
                htmlFor={`report-file-${file.relativePath}`}
                className="flex items-center flex-1 min-w-0 gap-2 text-sm cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
                <span className="ml-auto text-xs shrink-0 text-muted-foreground">
                  {file.date ?? "未分日期"}
                </span>
              </FieldLabel>
            </Field>
          ))
        )}
      </div>
    </FieldSet>
  );
}

function WorkerReportView({
  loading,
  report
}: {
  loading: boolean;
  report: WorkerReport | null;
}) {
  if (loading) return <ReportSkeleton />;

  if (!report || report.files.length === 0) {
    return (
      <div className="h-full p-6 overflow-auto">
        <Empty className="min-h-[260px]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Database className="w-5 h-5" />
            </EmptyMedia>
            <EmptyTitle>沒有可產生報表的資料</EmptyTitle>
            <EmptyDescription>
              請選取至少一個 worker 文字 log，再按更新報表。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const overviewItems = [
    { label: "Worker 總執行次數", value: report.overview.workerRuns, icon: Activity },
    { label: "hourly 排程執行次數", value: report.overview.hourlyRuns, icon: Clock3 },
    { label: "force-recalculate-risk 執行次數", value: report.overview.forceRecalculateRiskRuns, icon: RefreshCw },
    { label: "成功次數", value: report.overview.succeededRuns, icon: CheckCircle2 },
    { label: "失敗次數", value: report.overview.failedRuns, icon: CircleX }
  ];

  return (
    <div className="h-full p-4 overflow-auto">
      <div className="max-w-6xl mx-auto space-y-5">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">總覽</h3>
            {report.files.map((file) => (
              <Badge key={file.relativePath} variant="outline">
                {file.name}
              </Badge>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-5">
            {overviewItems.map((item) => {
              const Icon = item.icon;

              return (
                <Card key={item.label} className="flex min-h-[104px] flex-col justify-between p-4">
                  <div className="flex items-start min-w-0 gap-2 text-xs leading-5 text-muted-foreground">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 break-words">{item.label}</span>
                  </div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {formatNumber(item.value)}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <ReportSection title="KCG、THB 抓取方式統計">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <ReportHead>來源</ReportHead>
                <ReportHead align="right">抓取完成次數</ReportHead>
                <ReportHead align="right">HTTP 直接完成</ReportHead>
                <ReportHead align="right">Playwright 完成</ReportHead>
                <ReportHead align="right">其中使用 Chromium</ReportHead>
                <ReportHead align="right">失敗</ReportHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.sourceStats.map((item) => (
                <TableRow key={item.source}>
                  <ReportCell className="font-medium">{item.source}</ReportCell>
                  <NumberCell value={item.fetchDoneRuns} />
                  <NumberCell value={item.httpCompleted} />
                  <NumberCell value={item.playwrightCompleted} />
                  <NumberCell value={item.chromiumUsed} />
                  <NumberCell value={item.failed} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ReportSection>

        <ReportSection title="每日統計">
          <Table className="min-w-[1280px]">
            <TableHeader>
              <TableRow>
                <ReportHead>日期</ReportHead>
                <ReportHead align="right">Worker 總次數</ReportHead>
                <ReportHead align="right">hourly</ReportHead>
                <ReportHead align="right">force-recalculate-risk</ReportHead>
                <ReportHead align="right">成功</ReportHead>
                <ReportHead align="right">KCG 筆數合計</ReportHead>
                <ReportHead align="right">THB 筆數合計</ReportHead>
                <ReportHead align="right">THB Playwright 次數</ReportHead>
                <ReportHead align="right">THB HTTP 次數</ReportHead>
                <ReportHead align="right">風險寫入筆數</ReportHead>
                <ReportHead align="right">RoadName 有值</ReportHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.dailyStats.map((item) => (
                <TableRow key={item.date}>
                  <ReportCell className="font-mono">{item.date}</ReportCell>
                  <NumberCell value={item.workerRuns} />
                  <NumberCell value={item.hourlyRuns} />
                  <NumberCell value={item.forceRecalculateRiskRuns} />
                  <NumberCell value={item.succeededRuns} />
                  <NumberCell value={item.kcgTotal} />
                  <NumberCell value={item.thbTotal} />
                  <NumberCell value={item.thbPlaywrightRuns} />
                  <NumberCell value={item.thbHttpSuccessRuns} />
                  <NumberCell value={item.riskRowsWritten} />
                  <NumberCell value={item.roadNameRows} />
                </TableRow>
              ))}
              <TableRow>
                <ReportCell className="font-semibold">合計</ReportCell>
                <NumberCell value={sumReportField(report.dailyStats, "workerRuns")} />
                <NumberCell value={sumReportField(report.dailyStats, "hourlyRuns")} />
                <NumberCell value={sumReportField(report.dailyStats, "forceRecalculateRiskRuns")} />
                <NumberCell value={sumReportField(report.dailyStats, "succeededRuns")} />
                <NumberCell value={sumReportField(report.dailyStats, "kcgTotal")} />
                <NumberCell value={sumReportField(report.dailyStats, "thbTotal")} />
                <NumberCell value={sumReportField(report.dailyStats, "thbPlaywrightRuns")} />
                <NumberCell value={sumReportField(report.dailyStats, "thbHttpSuccessRuns")} />
                <NumberCell value={sumReportField(report.dailyStats, "riskRowsWritten")} />
                <NumberCell value={sumReportField(report.dailyStats, "roadNameRows")} />
              </TableRow>
            </TableBody>
          </Table>
        </ReportSection>

        <ReportSection title="其他統計">
          <Table>
            <TableHeader>
              <TableRow>
                <ReportHead>項目</ReportHead>
                <ReportHead align="right">統計</ReportHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.otherStats.map((item) => (
                <TableRow key={item.label}>
                  <ReportCell>{item.label}</ReportCell>
                  <ReportCell className="font-mono text-right">{formatNumericText(item.value)}</ReportCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ReportSection>

        <ReportSection title="結論">
          <Table>
            <TableHeader>
              <TableRow>
                <ReportHead className="w-48">結論</ReportHead>
                <ReportHead>說明</ReportHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.conclusions.map((item) => (
                <TableRow key={item.title}>
                  <ReportCell className="font-medium">{item.title}</ReportCell>
                  <ReportCell>{item.description}</ReportCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ReportSection>
      </div>
    </div>
  );
}

function ReportHead({
  align = "left",
  className,
  children
}: {
  align?: "left" | "right";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TableHead
      className={cn(
        "h-10 whitespace-nowrap text-xs font-medium text-muted-foreground",
        align === "right" && "text-right",
        className
      )}
    >
      {children}
    </TableHead>
  );
}

function ReportCell({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <TableCell className={cn("text-sm", className)}>{children}</TableCell>;
}

function ReportSection({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="overflow-auto border rounded-md bg-card">{children}</div>
    </section>
  );
}

function NumberCell({ value }: { value: number }) {
  return (
    <ReportCell className="font-mono text-right tabular-nums">
      {formatNumber(value)}
    </ReportCell>
  );
}

function ReportSkeleton() {
  return (
    <div className="h-full p-4 overflow-auto">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-56 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function DatePickerSimple({
  date,
  label,
  placeholder,
  onSelect
}: {
  date: Date | undefined;
  label: string;
  placeholder: string;
  onSelect: (date: Date | undefined) => void;
}) {
  return (
    <Field className="w-full">
      <FieldLabel htmlFor="date-picker-simple">{label}</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id="date-picker-simple"
            className="justify-start font-normal"
          >
            {date ? format(date, "PPP") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onSelect}
            defaultMonth={date}
          />
        </PopoverContent>
      </Popover>
    </Field>
  );
}

function DatePickerWithRange({
  date,
  onSelect
}: {
  date: DateRange | undefined;
  onSelect: (date: DateRange | undefined) => void;
}) {
  const [numberOfMonths, setNumberOfMonths] = useState(1);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateNumberOfMonths = () => setNumberOfMonths(mediaQuery.matches ? 2 : 1);

    updateNumberOfMonths();
    mediaQuery.addEventListener("change", updateNumberOfMonths);
    return () => mediaQuery.removeEventListener("change", updateNumberOfMonths);
  }, []);

  return (
    <Field className="w-full">
      <FieldLabel htmlFor="date-picker-range">日期範圍</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id="date-picker-range"
            className="w-full min-w-0 justify-start px-2.5 font-normal"
          >
            <CalendarIcon className="w-4 h-4 shrink-0" />
            {date?.from ? (
              <span className="truncate">
                {date.to
                  ? `${format(date.from, "LLL dd, y")} - ${format(date.to, "LLL dd, y")}`
                  : format(date.from, "LLL dd, y")}
              </span>
            ) : (
              <span className="truncate">Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={onSelect}
            numberOfMonths={numberOfMonths}
          />
        </PopoverContent>
      </Popover>
    </Field>
  );
}

function LevelFilterGroup({
  value,
  counts,
  onChange
}: {
  value: string;
  counts: Record<string, number>;
  onChange: (level: string) => void;
}) {
  const items = [
    { level: "debug", count: counts.debug ?? 0 },
    { level: "info", count: counts.info ?? 0 },
    { level: "warn", count: counts.warn ?? 0 },
    { level: "error", count: (counts.error ?? 0) + (counts.fatal ?? 0) }
  ];

  return (
    <FieldSet className="gap-2 p-3 border rounded-md bg-muted/20">
      <div>
        <FieldLegend className="text-sm">等級篩選</FieldLegend>
        <FieldDescription className="text-xs">
          選取一個等級過濾目前結果，再次點選可取消。
        </FieldDescription>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        {items.map((item) => {
          const active = value === item.level || (item.level === "error" && value === "fatal");
          const Icon = levelIcon(item.level);

          return (
            <Field
              key={item.level}
              orientation="horizontal"
              className={cn(
                "min-w-0 rounded-md border bg-background px-3 py-2 transition-colors",
                active && "border-primary bg-accent"
              )}
            >
              <Checkbox
                id={`level-filter-${item.level}`}
                checked={active}
                onCheckedChange={(checked) => {
                  onChange(checked ? item.level : "all");
                }}
              />
              <FieldLabel
                htmlFor={`level-filter-${item.level}`}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-sm"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{levelLabel(item.level)}</span>
                <span className="ml-auto text-xs shrink-0 text-muted-foreground">
                  {formatNumber(item.count)}
                </span>
              </FieldLabel>
            </Field>
          );
        })}
      </div>
    </FieldSet>
  );
}

function PlainLogView({
  entries,
  onSelect,
  selectedId
}: {
  entries: LogEntry[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <div className="plain-log h-full overflow-auto p-4 text-[13px] leading-6">
      {entries.length === 0 ? (
        <Empty className="min-h-[260px]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileX className="w-5 h-5" />
            </EmptyMedia>
            <EmptyTitle>沒有符合條件的 log</EmptyTitle>
            <EmptyDescription>
              調整搜尋、等級、欄位或日期範圍後再試一次。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        entries.map((entry) => (
          <button
            key={entry.id}
            className={`grid w-full grid-cols-[4rem_minmax(0,1fr)] rounded px-2 py-0.5 text-left font-mono hover:bg-accent/70 dark:hover:bg-white/10 ${
              selectedId === entry.id ? "log-line-selected" : ""
            }`}
            onClick={() => onSelect(entry.id)}
          >
            <span className="text-right select-none text-muted-foreground">{formatNumber(entry.lineNumber)}</span>
            <span className="min-w-0 pl-3 break-words whitespace-pre-wrap">
              <HighlightedLine line={formatNumericText(entry.raw)} />
            </span>
          </button>
        ))
      )}
    </div>
  );
}

function PlainLogSkeleton() {
  return (
    <div className="h-full p-4 space-y-2 overflow-auto">
      {Array.from({ length: 18 }).map((_, index) => (
        <div
          className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3"
          key={index}
        >
          <Skeleton className="w-8 h-4 justify-self-end" />
          <Skeleton className={`h-4 ${index % 4 === 0 ? "w-3/4" : "w-full"}`} />
        </div>
      ))}
    </div>
  );
}

function TableLogView({
  entries,
  onSelect,
  selectedId
}: {
  entries: LogEntry[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  if (entries.length === 0) {
    return (
      <div className="p-4">
        <Empty className="min-h-[260px]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileX className="w-5 h-5" />
            </EmptyMedia>
            <EmptyTitle>沒有符合條件的 log</EmptyTitle>
            <EmptyDescription>
              調整搜尋、等級、欄位或日期範圍後再試一次。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <Table className="min-w-[1180px]">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-16">行</TableHead>
            <TableHead className="w-28">等級</TableHead>
            <TableHead className="w-48">時間</TableHead>
            <TableHead className="w-28">代碼</TableHead>
            <TableHead className="w-32">事件</TableHead>
            <TableHead className="w-28">Job</TableHead>
            <TableHead>訊息</TableHead>
            <TableHead className="w-40">耗時</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow
              key={entry.id}
              data-state={selectedId === entry.id ? "selected" : undefined}
              className="cursor-pointer"
              onClick={() => onSelect(entry.id)}
            >
              <TableCell className="font-mono text-xs text-muted-foreground">{formatNumber(entry.lineNumber)}</TableCell>
              <TableCell>
                <LevelBadge level={entry.level} />
              </TableCell>
              <TableCell className="font-mono text-xs">{formatTimestamp(entry.timestamp)}</TableCell>
              <TableCell className="font-mono text-xs">{formatNumericText(fieldValue(entry, "code"))}</TableCell>
              <TableCell className="truncate">{formatNumericText(fieldValue(entry, "event"))}</TableCell>
              <TableCell className="truncate">{formatNumericText(firstFieldValue(entry, ["job", "Job"]))}</TableCell>
              <TableCell className="max-w-[460px] truncate text-muted-foreground">{formatNumericText(entry.message)}</TableCell>
              <TableCell className="font-mono text-xs">
                {formatNumericText(firstFieldValue(entry, ["elapsedMs", "durationMs"]))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TableLogSkeleton() {
  return (
    <div className="h-full p-4 overflow-auto">
      <div className="min-w-[1180px] space-y-3">
        <div className="grid grid-cols-[4rem_7rem_12rem_7rem_8rem_7rem_minmax(20rem,1fr)_10rem] gap-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton className="h-4" key={index} />
          ))}
        </div>
        {Array.from({ length: 14 }).map((_, index) => (
          <div
            className="grid grid-cols-[4rem_7rem_12rem_7rem_8rem_7rem_minmax(20rem,1fr)_10rem] gap-4"
            key={index}
          >
            <Skeleton className="h-4" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4" />
            <Skeleton className="w-16 h-4" />
            <Skeleton className="w-20 h-4" />
            <Skeleton className="w-16 h-4" />
            <Skeleton className={index % 3 === 0 ? "h-4 w-3/4" : "h-4"} />
            <Skeleton className="w-12 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EntryDetails({
  entry,
  className
}: {
  entry: LogEntry;
  className?: string;
}) {
  const entries = Object.entries(entry.fields);
  const pinned = pinnedFields
    .filter((key, index, array) => array.indexOf(key) === index)
    .map((key) => [key, entry.fields[key]] as const)
    .filter(([, value]) => value !== undefined);
  const others = entries.filter(([key]) => !pinnedFields.includes(key));

  return (
    <aside
      className={cn(
        "h-full p-4 overflow-auto bg-card",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Selected entry</div>
          <div className="flex items-center gap-2 mt-1">
            <LevelBadge level={entry.level} />
            <span className="font-mono text-xs text-muted-foreground">#{formatNumber(entry.lineNumber)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{entry.type}</Badge>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <DetailItem label="時間" value={entry.timestamp ?? "-"} />
        <DetailItem label="檔案" value={entry.fileName} />
        <DetailItem label="訊息" value={formatNumericText(entry.message)} multiline />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">常用欄位</h3>
          <Badge variant="outline">{formatNumber(pinned.length)} 個</Badge>
        </div>
        <FieldGrid items={pinned} />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">全部欄位</h3>
          <Badge variant="outline">{formatNumber(entries.length)} 個</Badge>
        </div>
        <FieldGrid items={[...pinned, ...others]} />
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-sm font-semibold">Raw</h3>
        <pre className="p-3 overflow-auto text-xs leading-5 border rounded-md max-h-56 bg-muted text-foreground">
          {formatNumericText(entry.raw)}
        </pre>
      </div>
    </aside>
  );
}

function FieldGrid({ items }: { items: ReadonlyArray<readonly [string, string | undefined]> }) {
  if (items.length === 0) {
    return (
      <Empty className="min-h-[140px]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Database className="w-5 h-5" />
          </EmptyMedia>
          <EmptyTitle>沒有欄位</EmptyTitle>
          <EmptyDescription>
            這筆 log 沒有可拆解的結構化欄位。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden border rounded-md">
      {items.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[minmax(92px,0.4fr)_minmax(0,1fr)] border-b last:border-b-0 sm:grid-cols-[120px_1fr]">
          <div className="px-3 py-2 text-xs font-medium bg-muted/60 text-muted-foreground">{key}</div>
          <div className="min-w-0 px-3 py-2 font-mono text-xs break-words">{formatNumericText(value)}</div>
        </div>
      ))}
    </div>
  );
}

function DetailItem({
  label,
  value,
  multiline
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="p-3 border rounded-md bg-background">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <div className={multiline ? "break-words text-sm" : "truncate font-mono text-xs"}>
        {formatNumericText(value)}
      </div>
    </div>
  );
}

function HighlightedLine({ line }: { line: string }) {
  const pattern =
    /(\[[^\]]+\])|\b(https?:\/\/[^\s,]+)|\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b|\b(INF|WRN|ERR|DBG|FTL|Information|Warning|Error|Debug|Fatal)\b|\b(code=[^\s,]+)|\b([A-Za-z][\w.-]*=)/gi;
  const parts: Array<{ text: string; className?: string }> = [];
  let lastIndex = 0;

  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ text: line.slice(lastIndex, index) });
    }

    const className = match[1]
      ? "log-token-time"
      : match[2]
        ? "log-token-url"
        : match[3]
          ? "log-token-id"
          : match[4]
            ? "log-token-level"
            : match[5]
              ? "log-token-code"
              : "log-token-key";

    parts.push({ text: match[0], className });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < line.length) {
    parts.push({ text: line.slice(lastIndex) });
  }

  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part.text}:${index}`} className={part.className}>
          {part.text}
        </span>
      ))}
    </>
  );
}

function LevelBadge({ level }: { level: string }) {
  const Icon = levelIcon(level);
  return (
    <Badge className={levelBadgeClass(level, false)}>
      <Icon className="h-3.5 w-3.5" />
      {levelLabel(level)}
    </Badge>
  );
}

function levelIcon(level: string) {
  if (level === "error" || level === "fatal") return CircleX;
  if (level === "warn") return TriangleAlert;
  if (level === "debug") return Bug;
  return Info;
}

function levelBadgeClass(level: string, active: boolean, pill = false) {
  const size = pill ? "h-8 px-3" : "";
  if (active) return `${size} gap-1.5 bg-primary text-primary-foreground`;
  if (level === "error" || level === "fatal") {
    return `${size} gap-1.5 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300`;
  }
  if (level === "warn") {
    return `${size} gap-1.5 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300`;
  }
  if (level === "debug") {
    return `${size} gap-1.5 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300`;
  }
  return `${size} gap-1.5 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300`;
}

function levelLabel(level: string) {
  const labels: Record<string, string> = {
    debug: "Debug",
    info: "Info",
    warn: "Warning",
    error: "Error",
    fatal: "Fatal"
  };
  return labels[level] ?? level;
}

function fieldValue(entry: LogEntry, key: string) {
  return entry.fields[key] ?? "-";
}

function firstFieldValue(entry: LogEntry, keys: string[]) {
  for (const key of keys) {
    const value = entry.fields[key];
    if (value) return value;
  }
  return "-";
}

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) return "-";
  return timestamp.replace("T", " ");
}

function buildLevelCounts(entries: LogEntry[]) {
  return entries.reduce<Record<string, number>>((result, entry) => {
    result[entry.level] = (result[entry.level] ?? 0) + 1;
    return result;
  }, {});
}

function sumReportField<T extends Record<K, number>, K extends keyof T>(items: T[], key: K) {
  return items.reduce((total, item) => total + item[key], 0);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${formatNumber(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatDecimal(bytes / 1024, 1)} KB`;
  return `${formatDecimal(bytes / 1024 / 1024, 1)} MB`;
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

function formatNumericText(value: string | undefined) {
  if (!value) return value ?? "";

  return value.replace(/(?<![\w./:-])\d{4,}(?![\w./:-])/g, (match) => formatNumber(Number(match)));
}

function parseDateOnly(value: string) {
  if (value === "all") return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
