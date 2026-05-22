import pino, { type LoggerOptions } from "pino";

const baseOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    app: "homecourt-web",
    env: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_RELEASE,
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.ssnLast4"],
};

// Disable pino-pretty transport when running under Playwright — the
// pino-pretty thread-stream crashes inside Next's dev workers, which
// turns into "Server Error: the worker has exited" in the browser.
const usePretty =
  process.env.NODE_ENV === "development" && process.env.HOMECOURT_DISABLE_PINO_PRETTY !== "1";

const options: LoggerOptions = usePretty
  ? { ...baseOptions, transport: { target: "pino-pretty" } }
  : baseOptions;

export const log = pino(options);
