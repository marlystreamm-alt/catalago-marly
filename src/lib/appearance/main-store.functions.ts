import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeAppearance } from "./theme";

export const mainAppearanceLoad=createServerFn({method:"GET"}).handler(async()=>{
  const { readRecords }=await import("@/lib/workspace/operations.server");
  const cfg=(await readRecords("config")).find(r=>r.status==="active");
  try{return normalizeAppearance(JSON.parse(cfg?.data.storeAppearance||"{}"));}catch{return normalizeAppearance({});}
});
export const mainAppearanceSave=createServerFn({method:"POST"}).validator((v:unknown)=>z.object({code:z.string().min(4).max(1000),appearance:z.unknown()}).parse(v)).handler(async({data})=>{
  await (await import("@/lib/notify/notify.server")).requireAdminCode(data.code);
  const ops=await import("@/lib/workspace/operations.server");
  const cfg=(await ops.readRecords("config")).find(r=>r.status==="active");
  const appearance=normalizeAppearance(data.appearance);
  const patch={...cfg?.data,storeAppearance:JSON.stringify(appearance)};
  if(cfg)await ops.changeRecord(cfg,{data:patch});else await ops.createRecord("config","Configuración MA²","active",patch);
  return appearance;
});
