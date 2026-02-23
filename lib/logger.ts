import { Axiom } from "@axiomhq/js";

const DATASET = process.env.AXIOM_DATASET || "ado-pulse";
const SERVICE = "ado-pulse";

let axiom: Axiom | null = null;
if (process.env.AXIOM_API_TOKEN) {
  try {
    axiom = new Axiom({ token: process.env.AXIOM_API_TOKEN });
  } catch {
    // Fall back to console-only if Axiom init fails
  }
}

type Level = "info" | "warn" | "error";

interface LogEvent {
  level: Level;
  message: string;
  service: string;
  _time: string;
  [key: string]: unknown;
}

/**
 * Create a log event object with the current ISO timestamp.
 *
 * @param level - The log severity level (`info`, `warn`, or `error`)
 * @param message - The human-readable log message
 * @param data - Optional additional fields to merge into the event
 * @returns The constructed `LogEvent` with `_time` set to the current ISO 8601 timestamp, `level`, `message`, `service`, and any properties from `data`
 */
function buildEvent(
  level: Level,
  message: string,
  data?: Record<string, unknown>
): LogEvent {
  return {
    _time: new Date().toISOString(),
    level,
    message,
    service: SERVICE,
    ...data,
  };
}

/**
 * Emits a structured log event to stdout/stderr and, if configured, forwards it to Axiom.
 *
 * Writes the provided `event` as JSON to the console using `console.error` for level "error",
 * `console.warn` for level "warn", and `console.log` otherwise. If an Axiom client is configured,
 * attempts to ingest the event into the configured dataset; ingestion failures are swallowed and
 * do not propagate.
 *
 * @param event - The structured log entry to emit and optionally forward to Axiom
 */
function emit(event: LogEvent): void {
  // Always write structured JSON to console
  const consoleFn =
    event.level === "error"
      ? console.error
      : event.level === "warn"
        ? console.warn
        : console.log;
  consoleFn(JSON.stringify(event));

  // Send to Axiom if configured
  if (axiom) {
    try {
      axiom.ingest(DATASET, [event]);
      axiom.flush().catch(() => {});
    } catch {
      // Never throw from logging
    }
  }
}

export const logger = {
  info(message: string, data?: Record<string, unknown>): void {
    emit(buildEvent("info", message, data));
  },

  warn(message: string, data?: Record<string, unknown>): void {
    emit(buildEvent("warn", message, data));
  },

  error(message: string, data?: Record<string, unknown>): void {
    emit(buildEvent("error", message, data));
  },

  async flush(): Promise<void> {
    if (axiom) {
      try {
        await axiom.flush();
      } catch {
        // Never throw from logging
      }
    }
  },
};