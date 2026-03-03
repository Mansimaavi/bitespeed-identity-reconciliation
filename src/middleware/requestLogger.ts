import { Request, Response, NextFunction } from 'express';

/**
 * Simple request logging middleware.
 * Logs method and path for incoming requests.
 */
export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== 'production') {
    const timestamp = new Date().toISOString();
    process.stdout.write(`[${timestamp}] ${req.method} ${req.path}\n`);
  }
  next();
}
