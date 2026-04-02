type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatMessage(level: LogLevel, message: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  return data ? `${prefix} ${message} ${JSON.stringify(data)}` : `${prefix} ${message}`;
}

export const logger = {
  info: (msg: string, data?: unknown) => console.log(formatMessage('info', msg, data)),
  warn: (msg: string, data?: unknown) => console.warn(formatMessage('warn', msg, data)),
  error: (msg: string, data?: unknown) => {
    console.error(formatMessage('error', msg, data));
    // TODO: Sentry.captureException or Sentry.captureMessage here
  },
  debug: (msg: string, data?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatMessage('debug', msg, data));
    }
  },
};
