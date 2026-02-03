/**
 * Production-safe logger
 * Prevents sensitive data from being logged in production
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  
  private sanitizeArgs(args: unknown[]): unknown[] {
    return args.map((arg) => {
      if (typeof arg === 'object' && arg !== null) {
        const sanitized = { ...arg } as Record<string, unknown>;
        
        // Remove sensitive keys
        const sensitiveKeys = [
          'password',
          'token',
          'apiKey',
          'api_key',
          'secret',
          'csrf',
          'csrfToken',
          'authorization',
          'cookie',
          'session',
        ];
        
        for (const key of sensitiveKeys) {
          if (key in sanitized) {
            sanitized[key] = '[REDACTED]';
          }
        }
        
        return sanitized;
      }
      return arg;
    });
  }
  
  log(...args: unknown[]): void {
    if (this.isDevelopment) {
      console.log(...this.sanitizeArgs(args));
    }
  }
  
  info(...args: unknown[]): void {
    if (this.isDevelopment) {
      console.info(...this.sanitizeArgs(args));
    }
  }
  
  warn(...args: unknown[]): void {
    if (this.isDevelopment) {
      console.warn(...this.sanitizeArgs(args));
    }
  }
  
  error(...args: unknown[]): void {
    // Always log errors, but sanitize them
    console.error(...this.sanitizeArgs(args));
  }
  
  debug(...args: unknown[]): void {
    if (this.isDevelopment) {
      console.debug(...this.sanitizeArgs(args));
    }
  }
}

export const logger = new Logger();
