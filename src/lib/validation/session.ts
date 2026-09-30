import { z } from "zod";

export const evidenceLinkSchema = z.object({
  url: z.string().url("Pega un enlace válido (https://...)."),
  title: z.string().trim().optional(),
});
