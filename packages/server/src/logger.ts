import pino from 'pino';

export interface Logger {
  info: (obj: Record<string, unknown>, msg: string) => void;
  warn: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
  debug: (obj: Record<string, unknown>, msg: string) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

export function createLogger(name: string): Logger {
  const level = process.env.LOG_LEVEL || 'info';
  const isPretty = process.env.LOG_FORMAT === 'pretty';

  const logger = pino({
    name,
    level,
    transport: isPretty
      ? { target: 'pino-pretty' }
      : undefined,
  });

  return {
    info: (obj, msg) => logger.info(obj, msg),
    warn: (obj, msg) => logger.warn(obj, msg),
    error: (obj, msg) => logger.error(obj, msg),
    debug: (obj, msg) => logger.debug(obj, msg),
    child: (bindings) => createLoggerChild(name, bindings, level, isPretty),
  };
}

function createLoggerChild(
  name: string,
  bindings: Record<string, unknown>,
  level: string,
  isPretty: boolean
): Logger {
  const logger = pino({
    name,
    level,
    transport: isPretty
      ? { target: 'pino-pretty' }
      : undefined,
  }).child(bindings);

  return {
    info: (obj, msg) => logger.info(obj, msg),
    warn: (obj, msg) => logger.warn(obj, msg),
    error: (obj, msg) => logger.error(obj, msg),
    debug: (obj, msg) => logger.debug(obj, msg),
    child: (newBindings) => createLoggerChild(name, { ...bindings, ...newBindings }, level, isPretty),
  };
}
