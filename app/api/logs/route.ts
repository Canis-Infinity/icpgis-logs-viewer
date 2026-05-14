import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { listLogFiles, toPublicLogFile } from "@/lib/log-files";
import { collectFields, collectLevels, parseLogContent } from "@/lib/log-parser";
import { readLogConfig } from "@/lib/log-config";
import type { LogSummary } from "@/lib/log-types";

export async function GET() {
  const [config, files] = await Promise.all([readLogConfig(), listLogFiles()]);
  const sampleEntries = (
    await Promise.all(
      files.slice(0, 8).map(async (file) => {
        try {
          const raw = await readFile(file.absolutePath, "utf8");
          return parseLogContent(file, raw).slice(0, 200);
        } catch {
          return [];
        }
      })
    )
  ).flat();

  const summary: LogSummary = {
    sources: config.sources.map((source) => ({
      id: source.id,
      label: source.label
    })),
    files: files.map(toPublicLogFile),
    dates: Array.from(new Set(files.map((file) => file.date).filter(Boolean) as string[])).sort(),
    levels: collectLevels(sampleEntries),
    fields: collectFields(sampleEntries)
  };

  return NextResponse.json(summary);
}
