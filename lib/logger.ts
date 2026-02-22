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
