import { z } from 'zod';

// Every tool returns EITHER its data shape OR this structured-error shape.
// Tools never throw: a missing fixture or an out-of-range lookup surfaces as
// {status:'unavailable', reason} so downstream steps degrade instead of crashing.
export const Unavailable = z.object({
  status: z.literal('unavailable'),
  reason: z.string(),
});
export type Unavailable = z.infer<typeof Unavailable>;
