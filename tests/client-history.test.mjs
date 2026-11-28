import test from "node:test";
import assert from "node:assert/strict";
import {buildClientHistories,recentClientAssignment} from "../src/lib/customer/client-history.ts";
const contact=(id,whatsapp)=>({id,module:"clients",title:id,status:"active",data:{whatsapp},createdAt:"2026-09-01",updatedAt:"2026-09-01",version:1});
test("client history joins web purchases by ID and Cyberdoc by unique phone, without duplicating stock",()=>{
 const records=[contact("web","8441111111"),contact("cyber","8442222222"),contact("manual","8443333333")];
 const data={accounts:[{id:"a",client_id:"web"}],purchases:[{id:"p",client_id:"web",stock_id:"s",title:"Netflix",created_at:"2026-11-10",amount_cents:5000}],stock:[{id:"s",related_order_id:"p",client_whatsapp:"8441111111",delivered_on:"2026-11-10"},{id:"m",client_whatsapp:"8443333333",delivered_on:"2026-11-12",platform:"Disney"}],released:[],orders:[{id:"c",source_key:"cyberdocsmx_bot",whatsapp:"528442222222",status:"completed",service_name:"Prime",delivered_on:"2026-11-20"}],replacements:[{purchase_id:"p",report_id:"r",created_at:"2026-11-18"}]};
 const histories=buildClientHistories(records,data);
 assert.deepEqual([...histories.get("web").origins],["web"]);
 assert.equal(histories.get("web").rows.length,2);
 assert.deepEqual([...histories.get("cyber").origins],["cyberdoc"]);
 assert.deepEqual([...histories.get("manual").origins],["manual"]);
 assert.equal(histories.get("manual").rows.length,1);
});
test("inactivity is one calendar month without assignment, not last recharge or report",()=>{
 const row=(date,kind,detail="Entregado")=>({id:"x",title:"Cuenta",date,kind,detail});
 assert.equal(recentClientAssignment("2026-09-01",[row("2026-10-28","Cuenta entregada")],"2026-11-28"),true);
 assert.equal(recentClientAssignment("2026-09-01",[row("2026-10-27","Cuenta entregada"),row("2026-11-27","Reporte")],"2026-11-28"),false);
 assert.equal(recentClientAssignment("2026-11-15",[],"2026-11-28"),true);
 assert.equal(recentClientAssignment("2026-09-01",[row("2026-11-27","Pedido Cyberdoc","Pendiente")],"2026-11-28"),false);
});
