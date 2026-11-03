import { z } from "zod";
export const rechargeSettings = z
  .object({
    enabled: z.boolean().default(false),
    email: z.string().email(),
    senders: z.array(z.string().email()).min(1).max(10),
    bank: z.string().trim().min(1).max(100),
    holder: z.string().trim().min(1).max(150),
    account: z.string().regex(/^\d{10,18}$/, "Escribe una cuenta o CLABE de 10 a 18 dígitos"),
    note: z.string().max(1000).default(""),
    minimum: z.number().int().min(1).max(100000).default(10),
    maximum: z.number().int().min(1).max(1000000).default(5000),
    minutes: z.number().int().min(5).max(1440).default(60),
    openLimit: z.number().int().min(1).max(5).default(2),
    dailyLimit: z.number().int().min(0).max(100).default(0),
    uniqueCents: z.boolean().default(false),
    bonusPercent: z.number().int().min(0).max(100).default(0),
  })
  .refine((s) => s.maximum >= s.minimum, "El máximo debe ser mayor o igual al mínimo")
  .refine(
    (s) => s.maximum * (1 + s.bonusPercent / 100) + (s.uniqueCents ? 0.99 : 0) <= 1000000,
    "El máximo más el regalo debe ser menor o igual a un millón de pesos",
  );
export type RechargeSettings = z.infer<typeof rechargeSettings>;
export type RechargeRequest = {
  id: string;
  client_id: string;
  reference: string;
  amount_cents: number;
  payable_cents: number;
  status: string;
  created_at: string;
  expires_at: string;
  credited_at: string | null;
  bonus_percent: number;
};
export type RechargeEvent = {
  id: string;
  received_at: string;
  amount_cents: number | null;
  reference: string | null;
  status: string;
  reason: string;
  verified: boolean;
  request_id: string | null;
};
export function paymentDetails(s: RechargeSettings) {
  return {
    enabled: s.enabled,
    bank: s.bank,
    holder: s.holder,
    account: s.account,
    note: s.note,
    minimum: s.minimum,
    maximum: s.maximum,
    minutes: s.minutes,
    uniqueCents: s.uniqueCents,
    bonusPercent: s.bonusPercent,
  };
}
