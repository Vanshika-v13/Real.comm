const isDev = import.meta.env.DEV;

const log = (level, scope, message, detail) => {
  if (!isDev && level === 'debug') return;
  const prefix = `[RTC:${scope}]`;
  const payload = detail !== undefined ? [message, detail] : [message];
  if (level === 'error') console.error(prefix, ...payload);
  else if (level === 'warn') console.warn(prefix, ...payload);
  else console.log(prefix, ...payload);
};

export const mediaLog = {
  debug: (scope, message, detail) => log('debug', scope, message, detail),
  info: (scope, message, detail) => log('info', scope, message, detail),
  warn: (scope, message, detail) => log('warn', scope, message, detail),
  error: (scope, message, detail) => log('error', scope, message, detail),
};
