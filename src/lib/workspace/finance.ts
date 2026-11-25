export type FinanceAccount={id:string;name:string;opening_cents:number;created_at:string};
export type FinanceMove={id:string;kind:"income"|"expense"|"transfer";account_id:string;to_account_id:string|null;amount_cents:number;occurred_on:string;category:string;note:string;reference:string;source_key:string|null;voided_at:string|null};
export type FinanceSource={key:string;kind:"income"|"expense";amount:number;date:string;category:string;title:string};
export type FinanceDebt={id:string;kind:"receivable"|"payable";name:string;amount_cents:number;due_on:string|null;note:string;created_at:string};
export const financeToday=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Monterrey",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export function cashBalance(account: FinanceAccount,moves:FinanceMove[],until="9999-12-31"){
 return Number(account.opening_cents)+moves.filter(m=>!m.voided_at&&m.occurred_on<=until).reduce((n,m)=>n+(m.account_id===account.id?(m.kind==="income"?Number(m.amount_cents):-Number(m.amount_cents)):0)+(m.to_account_id===account.id?Number(m.amount_cents):0),0);
}
export function cashTotals(moves:FinanceMove[],from:string,to:string){const rows=moves.filter(m=>!m.voided_at&&m.occurred_on>=from&&m.occurred_on<=to);const income=rows.filter(m=>m.kind==="income").reduce((n,m)=>n+Number(m.amount_cents),0),expense=rows.filter(m=>m.kind==="expense").reduce((n,m)=>n+Number(m.amount_cents),0);return {income,expense,net:income-expense};}
