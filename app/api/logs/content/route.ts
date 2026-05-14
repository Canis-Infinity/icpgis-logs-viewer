import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { readLogConfig } from "@/lib/log-config";
import { findAllowedLogFile, listLogFiles, toPublicLogFile } from "@/lib/log-files";
import {
  collectFields,
  collectLevels,
  filterLogEntries,
  parseLogContent
} from "@/lib/log-parser";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sourceId = searchParams.get("sourceId") ?? undefined;
  const filePath = searchParams.get("file") ?? undefined;
  const config = await readLogConfig();

  const targetFile =
    sourceId && filePath
      ? await findAllowedLogFile(sourceId, filePath)
      : (await listLogFiles()).find((file) => (sourceId ? file.sourceId === sourceId : true));

  if (!targetFile) {
    return NextResponse.json({ entries: [], levels: [], fields: [], file: null });
  }

  const raw = await readFile(targetFile.absolutePath, "utf8");
  const sliced = raw.length > config.maxReadBytes ? raw.slice(-config.maxReadBytes) : raw;
  const entries = parseLogContent(targetFile, sliced);
  const filters = {
    level: searchParams.get("level") ?? undefined,
    date: searchParams.get("date") ?? undefined,
    query: searchParams.get("query") ?? undefined,
    field: searchParams.get("field") ?? undefined,
    fieldValue: searchParams.get("fieldValue") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined
  };
  const filteredEntries = filterLogEntries(entries, filters).slice(-config.maxRows);
  const safeFile = toPublicLogFile(targetFile);

  return NextResponse.json({
    file: safeFile,
    truncated: raw.length > config.maxReadBytes,
    entries: filteredEntries,
    levels: collectLevels(entries),
    fields: collectFields(entries)
  });
}
