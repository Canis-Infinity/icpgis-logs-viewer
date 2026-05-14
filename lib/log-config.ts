import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LogConfig, LogSource } from "@/lib/log-types";

const DEFAULT_CONFIG: LogConfig = {
  sources: [],
  maxReadBytes: 5 * 1024 * 1024,
  maxRows: 2000
};

export async function readLogConfig(): Promise<LogConfig> {
  const configPath = path.join(process.cwd(), "config", "log-sources.json");
  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<LogConfig>;

  return {
    sources: normalizeSources(parsed.sources ?? []),
    maxReadBytes: parsed.maxReadBytes ?? DEFAULT_CONFIG.maxReadBytes,
    maxRows: parsed.maxRows ?? DEFAULT_CONFIG.maxRows
  };
}

export function resolveConfiguredPath(configPathValue: string) {
  return path.resolve(process.cwd(), configPathValue);
}

function normalizeSources(sources: LogSource[]) {
  return sources.map((source) => ({
    ...source,
    filePatterns: source.filePatterns?.length ? source.filePatterns : ["*.log", "*.json"]
  }));
}
