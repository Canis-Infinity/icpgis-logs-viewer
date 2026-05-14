import type { LogEntry, LogFile, LogFilters } from "@/lib/log-types";

const textLogPattern =
  /^\[(?<timestamp>[^\]]+?)\s+(?<level>[A-Z]{3,5})\]\s*(?<rest>.*)$/;
const keyPattern = /(?<key>[A-Za-z][\w.-]*)=/g;
const multiWordValueKeys = new Set([
  "impact",
  "message",
  "preview",
  "CONTENT",
  "NAME",
  "Properties.Impact",
  "Properties.Message",
  "Properties.Preview"
]);

export function parseLogContent(file: LogFile, content: string): LogEntry[] {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => parseLine(file, line, index + 1));
}

export function filterLogEntries(entries: LogEntry[], filters: LogFilters) {
  return entries.filter((entry) => {
    if (filters.level && filters.level !== "all" && normalizeLevel(entry.level) !== filters.level) {
      return false;
    }

    if (filters.date && filters.date !== "all") {
      const entryDate = entry.timestamp?.slice(0, 10) ?? "";
      if (entryDate !== filters.date && !entry.fileName.includes(filters.date.replaceAll("-", ""))) {
        return false;
      }
    }

    if (filters.from && entry.timestamp && entry.timestamp < filters.from) {
      return false;
    }

    if (filters.to && entry.timestamp && entry.timestamp > filters.to) {
      return false;
    }

    if (filters.field && filters.field !== "all") {
      const matchingValues = getMatchingFieldValues(entry, filters.field);
      if (matchingValues.length === 0) return false;

      if (filters.fieldValue && !hasText(matchingValues.join(" "), filters.fieldValue)) return false;
    } else if (filters.fieldValue) {
      const allFieldValues = Object.values(entry.fields).join(" ");
      if (!hasText(allFieldValues, filters.fieldValue)) return false;
    }

    if (filters.query) {
      const haystack = `${entry.raw} ${JSON.stringify(entry.fields)}`.toLowerCase();
      if (!haystack.includes(filters.query.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}

function getMatchingFieldValues(entry: LogEntry, field: string) {
  const normalizedField = field.toLowerCase();
  return Object.entries(entry.fields)
    .filter(([key]) => key.toLowerCase().includes(normalizedField))
    .map(([, value]) => value);
}

function hasText(value: string, query: string) {
  return value.toLowerCase().includes(query.toLowerCase());
}

export function collectLevels(entries: LogEntry[]) {
  return Array.from(new Set(entries.map((entry) => normalizeLevel(entry.level)))).sort();
}

export function collectFields(entries: LogEntry[]) {
  return Array.from(new Set(entries.flatMap((entry) => Object.keys(entry.fields)))).sort();
}

export function normalizeLevel(level: string) {
  const value = level.toLowerCase();
  if (["inf", "information", "info"].includes(value)) return "info";
  if (["wrn", "warning", "warn"].includes(value)) return "warn";
  if (["err", "error"].includes(value)) return "error";
  if (["dbg", "debug"].includes(value)) return "debug";
  if (["ftl", "fatal"].includes(value)) return "fatal";
  return value || "unknown";
}

function parseLine(file: LogFile, line: string, lineNumber: number): LogEntry {
  const jsonEntry = parseJsonLine(file, line, lineNumber);
  if (jsonEntry) {
    return jsonEntry;
  }

  const match = line.match(textLogPattern);
  const fields: Record<string, string> = {};
  let timestamp: string | null = null;
  let level = "unknown";
  let message = line;

  if (match?.groups) {
    timestamp = normalizeTimestamp(match.groups.timestamp);
    level = normalizeLevel(match.groups.level);
    message = match.groups.rest.trim();
    collectKeyValues(message, fields);
  }

  return {
    id: `${file.sourceId}:${file.relativePath}:${lineNumber}`,
    sourceId: file.sourceId,
    fileName: file.name,
    lineNumber,
    timestamp,
    level,
    type: "text",
    message,
    fields,
    raw: line
  };
}

function parseJsonLine(file: LogFile, line: string, lineNumber: number): LogEntry | null {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const fields = flattenFields(parsed);
    const message =
      stringValue(parsed.MessageTemplate) ??
      stringValue(parsed.RenderedMessage) ??
      stringValue(parsed.message) ??
      line;
    const level = normalizeLevel(
      stringValue(parsed.Level) ?? stringValue(parsed.level) ?? "unknown"
    );

    return {
      id: `${file.sourceId}:${file.relativePath}:${lineNumber}`,
      sourceId: file.sourceId,
      fileName: file.name,
      lineNumber,
      timestamp:
        stringValue(parsed.Timestamp) ??
        stringValue(parsed.timestamp) ??
        stringValue(parsed.time) ??
        null,
      level,
      type: "json",
      message,
      fields,
      raw: line
    };
  } catch {
    return null;
  }
}

function flattenFields(value: unknown, prefix = ""): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (result, [key, fieldValue]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (fieldValue && typeof fieldValue === "object" && !Array.isArray(fieldValue)) {
        Object.assign(result, flattenFields(fieldValue, fullKey));
      } else if (fieldValue !== undefined && fieldValue !== null) {
        result[fullKey] = String(fieldValue);
      }

      return result;
    },
    {}
  );
}

function collectKeyValues(message: string, fields: Record<string, string>) {
  const matches = Array.from(message.matchAll(keyPattern));

  matches.forEach((match, index) => {
    if (!match.groups || match.index === undefined) return;

    const key = match.groups.key;
    const valueStart = match.index + match[0].length;
    const nextMatch = matches[index + 1];
    const valueEnd = nextMatch?.index ?? message.length;
    const rawValue = message.slice(valueStart, valueEnd).trim();

    fields[key] = normalizeFieldValue(key, rawValue);
  });
}

function normalizeFieldValue(key: string, rawValue: string) {
  if (rawValue.startsWith('"')) {
    const quoted = rawValue.match(/^"([^"]*)"/);
    return quoted?.[1] ?? rawValue.replace(/^"|"$/g, "");
  }

  if (multiWordValueKeys.has(key)) {
    return rawValue.replace(/,$/, "").trim();
  }

  const token = rawValue.split(/[\s,]+/)[0]?.trim() ?? "";
  if (token === "===" || token.endsWith(":")) {
    return "";
  }

  return token;
}

function normalizeTimestamp(timestamp: string) {
  const withoutZoneLabel = timestamp.replace(/\s\+\d{2}:\d{2}$/, "");
  return withoutZoneLabel.replace(" ", "T");
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
