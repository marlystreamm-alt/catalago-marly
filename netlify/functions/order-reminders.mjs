import { runPendingReminders } from "../../src/lib/notify/notify.server.ts";

export default async () => Response.json(await runPendingReminders());
export const config = { schedule: "*/15 * * * *" };
