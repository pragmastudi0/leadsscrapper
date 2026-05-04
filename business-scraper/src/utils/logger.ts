export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export class Logger {
  private static colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    debug: '\x1b[36m',
    info: '\x1b[34m',
    success: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
  };

  private static getTimestamp(): string {
    return new Date().toLocaleTimeString('es-AR');
  }

  static debug(message: string): void {
    console.log(`${this.colors.debug}[${this.getTimestamp()}] DEBUG:${this.colors.reset} ${message}`);
  }

  static info(message: string): void {
    console.log(`${this.colors.info}[${this.getTimestamp()}] INFO:${this.colors.reset} ${message}`);
  }

  static success(message: string): void {
    console.log(`${this.colors.success}[${this.getTimestamp()}] ✓ ${message}${this.colors.reset}`);
  }

  static warn(message: string): void {
    console.log(`${this.colors.warn}[${this.getTimestamp()}] ⚠ WARNING:${this.colors.reset} ${message}`);
  }

  static error(message: string): void {
    console.error(`${this.colors.error}[${this.getTimestamp()}] ✗ ERROR:${this.colors.reset} ${message}`);
  }

  static separator(): void {
    console.log('\n' + '='.repeat(80) + '\n');
  }

  static header(title: string): void {
    this.separator();
    console.log(`${this.colors.bright}${this.colors.info}${title}${this.colors.reset}`);
    this.separator();
  }
}
