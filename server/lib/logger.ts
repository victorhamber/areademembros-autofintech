type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SECURITY' | 'WEBHOOK';

export function log(level: Level, message: string, extra?: Record<string, unknown>) {
  const line = `[${level}] ${message}${extra ? ' ' + JSON.stringify(extra) : ''}`;
  if (level === 'ERROR') console.error(line);
  else console.log(line);
}
