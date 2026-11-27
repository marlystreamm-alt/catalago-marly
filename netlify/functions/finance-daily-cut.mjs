import {opsDB} from "../../src/lib/workspace/operations.server.ts";
export default async () => {
  const result=await opsDB().rpc("ma2_finance_generate_daily_cuts");
  if(result.error)return Response.json({ok:false,error:"No se pudo generar el corte diario"},{status:500});
  return Response.json({ok:true,generated:result.data});
};
// The database checks Monterrey time and prevents duplicate cuts, including retries.
export const config={schedule:"*/15 6-7 * * *"};
