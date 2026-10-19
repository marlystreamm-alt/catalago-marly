import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { InstructionMethod } from "./types";

const base = z.object({ code: z.string().min(4) });
const payload = z.object({
  name: z.string().min(1).max(160),
  instruction: z.string().max(20000).default(""),
  notes: z.string().max(5000).default(""),
  link: z.string().max(3000).default(""),
  image: z.string().max(4_000_000).default(""),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100000).default(0),
});

export const methodsList = createServerFn({ method: "POST" })
  .validator((v: unknown) => base.parse(v))
  .handler(async ({ data }): Promise<InstructionMethod[]> => {
    const s = await import("./methods.server");
    await s.requireAdminCode(data.code);
    return s.listMethods();
  });

export const methodsSave = createServerFn({ method: "POST" })
  .validator((v: unknown) => base.extend({ id: z.string().uuid().optional(), method: payload }).parse(v))
  .handler(async ({ data }): Promise<InstructionMethod> => {
    const s = await import("./methods.server");
    await s.requireAdminCode(data.code);
    const now = new Date().toISOString();
    if (data.id) {
      const current = (await s.listMethods()).find((x) => x.id === data.id);
      if (!current) throw new Error("Método no encontrado");
      return s.updateMethod(data.id, {
        ...data.method,
        createdAt: current.createdAt,
        updatedAt: now,
      });
    }
    return s.insertMethod({ ...data.method, createdAt: now, updatedAt: now });
  });

export const methodsDelete = createServerFn({ method: "POST" })
  .validator((v: unknown) => base.extend({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const s = await import("./methods.server");
    await s.requireAdminCode(data.code);
    await s.deleteMethod(data.id);
    return { ok: true };
  });
