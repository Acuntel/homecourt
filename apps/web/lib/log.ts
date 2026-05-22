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

const options: LoggerOptions =
  process.env.NODE_ENV === "development"
    ? { ...baseOptions, transport: { target: "pino-pretty" } }
    : baseOptions;

export const log = pino(options);
