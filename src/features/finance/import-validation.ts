import { z } from "zod";
export const importCorrectionsSchema = z.record(
  z.string().regex(/^\d{1,4}$/),
  z
    .object({
      cells: z.partialRecord(
        z.enum(["0", "1", "2", "3", "4", "5", "6", "7"]),
        z.string().max(250),
      ),
      reason: z.string().max(500),
    })
    .strict(),
);
