/**
 * EVE Centralized Logger
 * 
 * Enforces production readiness by ensuring that developer logs, stack traces, 
 * and console output are not leaked into the production build.
 */

const isProd = process.env.NODE_ENV === "production";

export const logger = {
  log: (...args: any[]) => {
    if (!isProd) {
      console.log(...args);
    }
  },
  info: (...args: any[]) => {
    if (!isProd) {
      console.info(...args);
    }
  },
  warn: (...args: any[]) => {
    if (!isProd) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    if (!isProd) {
      console.error(...args);
    } else {
      // In production, we might want to log this to a remote service like Sentry or Datadog
      // For now, we swallow the error to avoid leaking stack traces to the client console.
    }
  },
};

// Aliases for dev Log and dev error if needed elsewhere
export const devLog = logger.log;
export const devError = logger.error;
