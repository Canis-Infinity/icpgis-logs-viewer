import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { listLogFiles, toPublicLogFile } from "@/lib/log-files";
import { parseLogContent } from "@/lib/log-parser";
import { buildWorkerReport } from "@/lib/worker-report";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sourceId = searchParams.get("sourceId") ?? undefined;
  const date = searchParams.get("date") ?? undefined;
  const selectedFiles = searchParams.getAll("file");
  const files = await listLogFiles();
  const reportFiles = files.filter((file) => {
    if (sourceId && sourceId !== "all" && file.sourceId !== sourceId) return false;
    if (date && date !== "all" && file.date !== date) return false;
    if (selectedFiles.length > 0 && !selectedFiles.includes(file.relativePath)) return false;
    return file.name.startsWith("worker-") && file.extension === "log";
  });

  const entries = (
    await Promise.all(
      reportFiles.map(async (file) => {
        const raw = await readFile(file.absolutePath, "utf8");
        return parseLogContent(file, raw);
      })
    )
  ).flat();

  return NextResponse.json(
    buildWorkerReport(reportFiles.map(toPublicLogFile), entries)
  );
}
