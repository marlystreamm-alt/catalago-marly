import { scanRechargeMail } from "../../src/lib/recharges/mail.server.ts";
export default async () => {
  try {
    return Response.json(await scanRechargeMail());
  } catch {
    return Response.json(
      { ok: false, error: "Revisa el estado de recargas en el panel." },
      { status: 500 },
    );
  }
};
export const config = { schedule: "*/5 * * * *" };
