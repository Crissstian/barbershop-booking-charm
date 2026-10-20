import { z } from "zod";
export const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  category: z.enum(["capelli", "barba"]),
  price: z.number().finite().min(0).max(99999),
  price_from: z.boolean(),
  duration_min: z.number().int().min(10).max(480),
  active: z.boolean(),
  counts_as_haircut: z.boolean().default(false),
  sort: z.number().int().min(0).max(9999),
});
export type ServiceInput = z.infer<typeof serviceSchema>;