export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export class Logger {
  private logLevel: LogLevel;
  
  constructor(logLevel: LogLevel = LogLevel.INFO) {
    this.logLevel = logLevel;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedMessage = args.length > 0 ? `${message} ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')}` : message;
    
    return `[${timestamp}] [${level}] ${formattedMessage}`;
  }

  error(message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.INFO) {
      console.log(this.formatMessage('INFO', message, ...args));
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, ...args));
    }
  }

  // サーバー操作専用のログメソッド
  serverOperation(operation: string, status: 'START' | 'SUCCESS' | 'ERROR', details?: any): void {
    const level = status === 'ERROR' ? 'ERROR' : 'INFO';
    const message = `[SERVER_OPERATION] ${operation}: ${status}`;
    
    if (status === 'ERROR') {
      this.error(message, details);
    } else {
      this.info(message, details);
    }
  }

  // ユーザーアクション専用のログメソッド
  userAction(userId: string, action: string, result: 'SUCCESS' | 'ERROR', details?: any): void {
    const message = `[USER_ACTION] User:${userId} Action:${action} Result:${result}`;
    
    if (result === 'ERROR') {
      this.error(message, details);
    } else {
      this.info(message, details);
    }
  }

  // 監視関連のログメソッド
  monitoring(event: string, data?: any): void {
    this.info(`[MONITORING] ${event}`, data);
  }
}

// グローバルロガーインスタンス
const logLevelEnv = process.env.LOG_LEVEL?.toUpperCase();
let logLevel = LogLevel.INFO;

switch (logLevelEnv) {
  case 'ERROR':
    logLevel = LogLevel.ERROR;
    break;
  case 'WARN':
    logLevel = LogLevel.WARN;
    break;
  case 'INFO':
    logLevel = LogLevel.INFO;
    break;
  case 'DEBUG':
    logLevel = LogLevel.DEBUG;
    break;
}

export const logger = new Logger(logLevel);