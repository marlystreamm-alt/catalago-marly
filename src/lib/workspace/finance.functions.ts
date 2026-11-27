import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import {financeToday,canIncludePrevious} from "./finance";
const auth=z.object({code:z.string().min(4).max(200)}),id=z.string().uuid(),cents=z.number().int().min(1).max(100000000),date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v<=financeToday());
async function admin(code:string){await (await import("@/lib/notify/notify.server")).requireAdminCode(code);return (await import("./operations.server")).opsDB();}
const snapshot=async()=> (await import("./finance.server")).financeSnapshot();
export const financeLoad=createServerFn({method:"POST"}).validator((v:unknown)=>auth.parse(v)).handler(async({data})=>{await admin(data.code);return snapshot();});
export const financeListAccounts = createServerFn({ method: "POST" })
  .validator((value: unknown) => auth.parse(value))
  .handler(async ({ data }): Promise<{ id: string; name: string }[]> => {
    const db = await admin(data.code);
    const result = await db.from("ma2_finance_accounts").select("id,name").order("name");
    if (result.error) throw Error("No se pudieron cargar las cuentas.");
    return result.data ?? [];
  });

export const financeAddAccount=createServerFn({method:"POST"}).validator((v:unknown)=>auth.extend({name:z.string().trim().min(1).max(80),opening:z.number().int().min(-100000000).max(100000000)}).parse(v)).handler(async({data})=>{const db=await admin(data.code);const r=await db.from("ma2_finance_accounts").insert({name:data.name,opening_cents:data.opening});if(r.error)throw Error("No se pudo guardar la cuenta (revisa si ya existe)");return snapshot();});
const moveFields = auth.extend({
  requestId: id,
  kind: z.enum(["income", "expense", "transfer"]),
  account: id,
  amount: cents,
  category: z.string().trim().min(1).max(100),
});
const fullMove = moveFields.extend({
  toAccount: id.nullable(),
  date,
  note: z.string().max(400),
  reference: z.string().max(200),
});

async function recordFinanceMove(data: z.infer<typeof fullMove>) {
  const db = await admin(data.code);
  if (data.kind === "transfer" ? !data.toAccount || data.account === data.toAccount : data.toAccount !== null)
    throw Error("Selecciona cuentas distintas");
  const result = await db.from("ma2_finance_moves").insert({
    id: data.requestId,
    kind: data.kind,
    account_id: data.account,
    to_account_id: data.toAccount,
    amount_cents: data.amount,
    occurred_on: data.date,
    category: data.category,
    note: data.note,
    reference: data.reference,
  });
  if (result.error && result.error.code !== "23505") throw Error("No se pudo guardar el movimiento");
}

export const financeAddMove = createServerFn({ method: "POST" })
  .validator((value: unknown) => fullMove.parse(value))
  .handler(async ({ data }) => {
    await recordFinanceMove(data);
    return snapshot();
  });

const quickMove = moveFields.extend({ kind: z.enum(["income", "expense"]) });
export const financeQuickMove = createServerFn({ method: "POST" })
  .validator((value: unknown) => quickMove.parse(value))
  .handler(async ({ data }) => {
    await recordFinanceMove({ ...data, toAccount: null, date: financeToday(), note: "", reference: "" });
    return { saved: true };
  });
export const financeReconcile=createServerFn({method:"POST"}).validator((v:unknown)=>auth.extend({sourceKey:z.string().max(180),account:id,date,includePrevious:z.boolean().optional()}).parse(v)).handler(async({data})=>{const db=await admin(data.code);const current=await snapshot();const source=current.sources.find(s=>s.key===data.sourceKey);const debt=current.debts.find(d=>`debt:${d.id}`===data.sourceKey);if(!source&&!debt)throw Error("Movimiento no disponible");if(data.includePrevious&&!canIncludePrevious(source?.receivedAt))throw Error("La conciliación de medianoche terminó. Registra este pago en el día nuevo.");const r=await db.rpc("ma2_finance_post_reconciled",{p_id:crypto.randomUUID(),p_source:data.sourceKey,p_kind:source?.kind||(debt!.kind==="receivable"?"income":"expense"),p_account:data.account,p_amount:source?.amount||Number(debt!.amount_cents),p_date:source?.date||data.date,p_category:source?.category||"Liquidación de deuda",p_note:source?.title||debt!.name,p_received:source?.receivedAt||null,p_previous:data.includePrevious===true});if(r.error)throw Error("No se pudo conciliar. Actualiza y revisa el corte.");return snapshot();});
export const financeVoid=createServerFn({method:"POST"}).validator((v:unknown)=>auth.extend({moveId:id}).parse(v)).handler(async({data})=>{const db=await admin(data.code);const r=await db.from("ma2_finance_moves").update({voided_at:new Date().toISOString(),source_key:null}).eq("id",data.moveId).is("voided_at",null);if(r.error)throw Error("No se pudo anular");return snapshot();});
export const financeAddDebt=createServerFn({method:"POST"}).validator((v:unknown)=>auth.extend({kind:z.enum(["receivable","payable"]),name:z.string().trim().min(1).max(150),amount:cents,due:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),note:z.string().max(400)}).parse(v)).handler(async({data})=>{const db=await admin(data.code);const r=await db.from("ma2_finance_debts").insert({kind:data.kind,name:data.name,amount_cents:data.amount,due_on:data.due,note:data.note});if(r.error)throw Error("No se pudo registrar deuda");return snapshot();});
export const financeCut=createServerFn({method:"POST"}).validator((v:unknown)=>auth.extend({account:id,date,counted:z.number().int().min(-100000000).max(100000000)}).parse(v)).handler(async({data})=>{const db=await admin(data.code);const r=await db.rpc("ma2_finance_save_manual_cut",{p_account:data.account,p_day:data.date,p_counted:data.counted});if(r.error)throw Error("No se pudo guardar el corte. Si ya existe uno, confírmalo o elimínalo para rehacerlo.");return snapshot();});
export const financeConfirmCut=createServerFn({method:"POST"}).validator((v:unknown)=>auth.extend({cutId:id,counted:z.number().int().min(-100000000).max(100000000)}).parse(v)).handler(async({data})=>{const db=await admin(data.code);const r=await db.from("ma2_finance_cuts").update({counted_cents:data.counted,confirmed_at:new Date().toISOString()}).eq("id",data.cutId).is("deleted_at",null).is("confirmed_at",null).select("id").maybeSingle();if(r.error||!r.data)throw Error("El corte ya no está pendiente");return snapshot();});
export const financeDeleteCut=createServerFn({method:"POST"}).validator((v:unknown)=>auth.extend({cutId:id}).parse(v)).handler(async({data})=>{const db=await admin(data.code);const r=await db.from("ma2_finance_cuts").update({deleted_at:new Date().toISOString()}).eq("id",data.cutId).is("deleted_at",null);if(r.error)throw Error("No se pudo eliminar el corte");return snapshot();});
