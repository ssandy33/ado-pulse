/* eslint-disable @typescript-eslint/no-require-imports */

// Mock @axiomhq/js before importing the logger
const mockIngest = jest.fn();
const mockFlush = jest.fn().mockResolvedValue(undefined);

jest.mock("@axiomhq/js", () => ({
  Axiom: jest.fn().mockImplementation(() => ({
    ingest: mockIngest,
    flush: mockFlush,
  })),
}));

// Helper to reload the logger module with specific env vars
function loadLogger(env: Record<string, string | undefined>) {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    original[key] = process.env[key];
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }

  // Clear the module cache so the logger re-initializes
  jest.resetModules();

  // Re-apply mock after resetModules
  jest.mock("@axiomhq/js", () => ({
    Axiom: jest.fn().mockImplementation(() => ({
      ingest: mockIngest,
      flush: mockFlush,
    })),
  }));

  const mod = require("@/lib/logger");
  // Restore env in-place
  for (const key of Object.keys(env)) {
    if (original[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[key];
    }
  }
  return mod.logger;
}

describe("logger", () => {
  let consoleSpy: jest.SpiedFunction<typeof console.log>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("without AXIOM_API_TOKEN (console-only mode)", () => {
    let logger: ReturnType<typeof loadLogger>;

    beforeEach(() => {
      logger = loadLogger({ AXIOM_API_TOKEN: undefined });
    });

    it("logger.info writes structured JSON to console.log", () => {
      logger.info("test message", { key: "value" });
      expect(consoleSpy).toHaveBeenCalledTimes(1);

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output).toMatchObject({
        level: "info",
        message: "test message",
        service: "ado-pulse",
        key: "value",
      });
      expect(output._time).toBeDefined();
    });

    it("logger.warn writes to console.warn", () => {
      logger.warn("warning msg");
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      const output = JSON.parse(consoleWarnSpy.mock.calls[0][0] as string);
      expect(output.level).toBe("warn");
      expect(output.message).toBe("warning msg");
    });

    it("logger.error writes to console.error", () => {
      logger.error("error msg", { stack: "trace" });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(output.level).toBe("error");
      expect(output.stack).toBe("trace");
    });

    it("does not call Axiom ingest in console-only mode", () => {
      logger.info("no axiom");
      expect(mockIngest).not.toHaveBeenCalled();
    });

    it("flush resolves cleanly without Axiom", async () => {
      await expect(logger.flush()).resolves.toBeUndefined();
    });
  });

  describe("with AXIOM_API_TOKEN set", () => {
    let logger: ReturnType<typeof loadLogger>;

    beforeEach(() => {
      logger = loadLogger({
        AXIOM_API_TOKEN: "xaat-test-token",
        AXIOM_DATASET: "test-dataset",
      });
    });

    it("sends events to Axiom ingest", () => {
      logger.info("axiom test", { route: "/api/test" });

      expect(mockIngest).toHaveBeenCalledTimes(1);
      const [dataset, events] = mockIngest.mock.calls[0];
      expect(dataset).toBe("test-dataset");
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        level: "info",
        message: "axiom test",
        route: "/api/test",
      });
    });

    it("also writes to console when Axiom is configured", () => {
      logger.info("dual output");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(mockIngest).toHaveBeenCalledTimes(1);
    });

    it("flush calls Axiom flush", async () => {
      await logger.flush();
      expect(mockFlush).toHaveBeenCalledTimes(1);
    });

    it("does not throw when Axiom ingest throws", () => {
      mockIngest.mockImplementationOnce(() => {
        throw new Error("Axiom down");
      });
      expect(() => logger.info("should not throw")).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledTimes(1);
    });

    it("does not throw when Axiom flush rejects", async () => {
      mockFlush.mockRejectedValueOnce(new Error("flush error"));
      await expect(logger.flush()).resolves.toBeUndefined();
    });
  });

  describe("structured output format", () => {
    let logger: ReturnType<typeof loadLogger>;

    beforeEach(() => {
      logger = loadLogger({ AXIOM_API_TOKEN: undefined });
    });

    it("includes _time as ISO string", () => {
      logger.info("timestamp check");
      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(() => new Date(output._time)).not.toThrow();
      expect(new Date(output._time).toISOString()).toBe(output._time);
    });

    it("includes service field", () => {
      logger.info("service check");
      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.service).toBe("ado-pulse");
    });

    it("merges custom data fields", () => {
      logger.info("merge check", { url: "/test", durationMs: 42 });
      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.url).toBe("/test");
      expect(output.durationMs).toBe(42);
    });
  });
});
