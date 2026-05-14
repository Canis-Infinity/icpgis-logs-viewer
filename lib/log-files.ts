import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { readLogConfig, resolveConfiguredPath } from "@/lib/log-config";
import type { LogFile, LogSource, PublicLogFile } from "@/lib/log-types";

export async function listLogFiles(): Promise<LogFile[]> {
  const config = await readLogConfig();
  const files = await Promise.all(
    config.sources.flatMap((source) =>
      source.paths.map(async (configuredPath) => {
        const root = resolveConfiguredPath(configuredPath);
        return listSourceFiles(source, root, root);
      })
    )
  );

  return files
    .flat()
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export async function findAllowedLogFile(sourceId: string, relativePath: string) {
  const files = await listLogFiles();
  return files.find(
    (file) => file.sourceId === sourceId && file.relativePath === relativePath
  );
}

export function toPublicLogFile(file: LogFile): PublicLogFile {
  const { sourceId, sourceLabel, name, relativePath, size, modifiedAt, date, extension } = file;
  return { sourceId, sourceLabel, name, relativePath, size, modifiedAt, date, extension };
}

async function listSourceFiles(
  source: LogSource,
  root: string,
  baseRoot: string
): Promise<LogFile[]> {
  try {
    const rootStat = await stat(root);
    if (!rootStat.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return listSourceFiles(source, absolutePath, baseRoot);
      }

      if (!entry.isFile() || !matchesPatterns(entry.name, source.filePatterns ?? [])) {
        return [];
      }

      const fileStat = await stat(absolutePath);
      const relativePath = path.relative(baseRoot, absolutePath);
      const extension = path.extname(entry.name).replace(".", "").toLowerCase();

      return [
        {
          sourceId: source.id,
          sourceLabel: source.label,
          name: entry.name,
          relativePath,
          absolutePath,
          size: fileStat.size,
          modifiedAt: fileStat.mtime.toISOString(),
          date: extractDate(entry.name),
          extension
        }
      ];
    })
  );

  return files.flat();
}

function matchesPatterns(fileName: string, patterns: string[]) {
  return patterns.some((pattern) => {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`, "i").test(fileName);
  });
}

function extractDate(fileName: string) {
  const compact = fileName.match(/(20\d{2})(\d{2})(\d{2})/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }

  const dashed = fileName.match(/(20\d{2}-\d{2}-\d{2})/);
  return dashed?.[1] ?? null;
}
