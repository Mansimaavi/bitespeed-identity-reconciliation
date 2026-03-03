import { Request, Response, NextFunction } from 'express';
import { reconcileIdentity } from '../services/identify';
import { ValidationError } from '../utils/errors';

/**
 * POST /identify
 * Request: { email?: string, phoneNumber?: string | number }
 * At least one field must be present. Validation and errors are handled by the service.
 */
export async function identify(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, phoneNumber } = req.body ?? {};
    // Convert phoneNumber to string if it's a number (spec allows number type)
    const normalizedPhone = phoneNumber != null ? String(phoneNumber) : phoneNumber;
    const result = await reconcileIdentity(email, normalizedPhone);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
