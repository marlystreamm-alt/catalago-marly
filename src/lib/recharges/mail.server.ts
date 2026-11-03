import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { opsDB, hashToken } from "@/lib/workspace/operations.server";
import { decryptPayload } from "@/lib/deliveries/deliveries.server";
import { parseBankNotice, authenticatedBankHeader } from "./parser";
import type { RechargeSettings } from "./settings";
export async function readConfig() {
  const { data, error } = await opsDB()
    .from("ma2_recharge_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar la configuración de recargas");
  return data as any;
}
export async function signature(settings: RechargeSettings, cipher: string) {
  return hashToken(
    JSON.stringify({
      email: settings.email.toLowerCase(),
      senders: settings.senders.map((v) => v.toLowerCase()).sort(),
      account: settings.account,
      cipher,
    }),
  );
}
async function connect(row: any) {
  const { password } = await decryptPayload<{ password: string }>(row.password_cipher);
  const s = row.settings as RechargeSettings;
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: s.email, pass: password },
    logger: false,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    disableAutoIdle: true,
  });
  client.on("error", () => {});
  try {
    await client.connect();
    return client;
  } catch {
    client.close();
    throw new Error("No se pudo conectar Gmail. Revisa el correo y su contraseña de aplicación.");
  }
}
export async function testMailbox(row: any) {
  const client = await connect(row);
  try {
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    lock.release();
    return true;
  } finally {
    await client.logout().catch(() => client.close());
  }
}
export async function scanRechargeMail() {
  const row = await readConfig();
  if (!row?.settings.enabled) return { enabled: false, processed: 0 };
  const now = new Date();
  const { data: claim, error: claimError } = await opsDB()
    .from("ma2_recharge_config")
    .update({ lease_until: new Date(Date.now() + 90000).toISOString() })
    .eq("id", 1)
    .eq("version", row.version)
    .lt("lease_until", now.toISOString())
    .select("id")
    .maybeSingle();
  if (claimError) throw new Error("No se pudo iniciar la revisión");
  if (!claim) return { enabled: true, busy: true, processed: 0 };
  let client: ImapFlow | undefined;
  let processed = 0;
  try {
    if (row.tested_signature !== (await signature(row.settings, row.password_cipher)))
      throw new Error("Prueba la conexión antes de activar las recargas");
    client = await connect(row);
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const mailbox = client.mailbox;
      if (!mailbox) throw new Error("No se pudo abrir la bandeja");
      const validity = String(mailbox.uidValidity);
      let cursor = validity === row.uid_validity ? Number(row.last_uid) : 0;
      const ids = await client.search(
        { since: new Date(row.started_at), uid: `${cursor + 1}:*` },
        { uid: true },
      );
      const batch = (ids || [])
        .filter((uid) => uid > cursor)
        .sort((a, b) => a - b)
        .slice(0, 20);
      if (batch.length) {
        const meta = await client.fetchAll(
          batch,
          { uid: true, size: true, internalDate: true },
          { uid: true },
        );
        for (const m of meta) {
          if (Date.now() - now.getTime() > 19000) break;
          if ((m.size || 0) > 350000) {
            cursor = Math.max(cursor, m.uid);
            continue;
          }
          const mail = await client.fetchOne(
            String(m.uid),
            { source: true, internalDate: true },
            { uid: true },
          );
          if (!mail || !mail.source) break;
          if (new Date(mail.internalDate || 0).getTime() < Date.parse(row.started_at)) {
            cursor = m.uid;
            continue;
          }
          const parsed = await simpleParser(mail.source, {
            skipHtmlToText: false,
            skipTextToHtml: true,
          });
          const sender = parsed.from?.value?.[0]?.address?.toLowerCase() || "";
          if (!(row.settings.senders as string[]).map((v) => v.toLowerCase()).includes(sender)) {
            cursor = m.uid;
            continue;
          }
          const extracted = parseBankNotice(parsed.text || "");
          const verified = authenticatedBankHeader(
            mail.source.toString("utf8"),
            sender,
            row.settings.senders,
          );
          const key = await hashToken(`${row.settings.email.toLowerCase()}:${validity}:${m.uid}`);
          const transfer = extracted.tracking
            ? await hashToken(`${row.settings.email.toLowerCase()}:${extracted.tracking}`)
            : null;
          const reason = !verified
            ? "No pasó la autenticación del remitente"
            : !extracted.incoming
              ? "El aviso no identifica una transferencia recibida"
              : !extracted.amountCents
                ? "No se encontró un importe único"
                : !extracted.tracking
                  ? "No se encontró una clave de rastreo"
                  : "Pendiente de coincidencia";
          const event = {
            source_key: key,
            config_signature: row.tested_signature,
            received_at: new Date(mail.internalDate || now).toISOString(),
            amount_cents: extracted.amountCents,
            reference: extracted.reference,
            tracking: extracted.tracking,
            transfer_key: transfer,
            verified: verified && extracted.incoming,
            status: !extracted.incoming ? "ignored" : "review",
            reason,
          };
          const inserted = await opsDB()
            .from("ma2_recharge_events")
            .upsert(event, { onConflict: "source_key", ignoreDuplicates: true })
            .select("id")
            .maybeSingle();
          if (inserted.error) throw new Error("No se pudo registrar un aviso");
          if (inserted.data && event.verified && event.amount_cents && transfer) {
            const result = await opsDB().rpc("ma2_recharge_settle", { p_event: inserted.data.id });
            if (result.error)
              throw new Error("No se pudo acreditar un aviso. Quedó pendiente de revisión.");
          }
          cursor = m.uid;
          processed++;
        }
      }
      const saved = await opsDB()
        .from("ma2_recharge_config")
        .update({
          last_uid: cursor,
          uid_validity: validity,
          last_check: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", 1)
        .eq("version", row.version);
      if (saved.error) throw new Error("No se pudo guardar la revisión");
    } finally {
      lock.release();
    }
    // Retry verified, unmatched notices when a previous processing attempt was interrupted.
    const pending = await opsDB()
      .from("ma2_recharge_events")
      .select("id")
      .eq("status", "review")
      .eq("verified", true)
      .gte("created_at", new Date(Date.now() - 86400000).toISOString())
      .order("created_at")
      .limit(20);
    if (pending.error) throw new Error("No se pudo revisar la cola de avisos");
    for (const e of pending.data || []) await opsDB().rpc("ma2_recharge_settle", { p_event: e.id });
    return { enabled: true, processed };
  } catch (e) {
    await opsDB()
      .from("ma2_recharge_config")
      .update({
        last_error: "No se completó la revisión. Comprueba la conexión y los avisos pendientes.",
      })
      .eq("id", 1)
      .eq("version", row.version);
    throw e;
  } finally {
    if (client) await client.logout().catch(() => client?.close());
    await opsDB()
      .from("ma2_recharge_config")
      .update({ lease_until: new Date().toISOString() })
      .eq("id", 1)
      .eq("version", row.version);
  }
}
