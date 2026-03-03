import express, { Request, Response, NextFunction } from 'express';
import { env } from './config/env';
import identifyRoutes from './routes/identifyRoutes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

const app = express();

// CORS headers for cross-origin requests
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

app.use(express.json());
app.use(requestLogger);

// Root endpoint with API info
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'Bitespeed Identity Reconciliation API',
    version: '1.0.0',
    endpoints: {
      identify: 'POST /identify',
      health: 'GET /health',
    },
    documentation: 'https://github.com/Mansimaavi/bitespeed-identity-reconciliation',
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/', identifyRoutes);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
});