import "std/dotenv/load.ts";
import { z } from "zod";

const AppConfig = z.object({
  API_ID: z.coerce.number().min(1),
  API_HASH: z.string().regex(/^[0-9a-fA-F]{32}$/),
  SESSION_STRING: z.string(),
  SECRET: z.string().optional(),
  DENO_KV_PATH: z.string().optional()
}).transform((data) => ({
  telegram: {
    id: data.API_ID,
    hash: data.API_HASH,
  },
  session: data.SESSION_STRING,
  secret: data.SECRET,
  kv: {
    path: data.DENO_KV_PATH,
  }
}));

export const config = AppConfig.parse(Deno.env.toObject());
export type AppConfig = z.infer<typeof AppConfig>;
