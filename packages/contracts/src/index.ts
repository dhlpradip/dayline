import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('dayline-api'),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const readinessResponseSchema = z.object({
  status: z.enum(['ready', 'unavailable']),
  database: z.enum(['up', 'down']),
});
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string() }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
