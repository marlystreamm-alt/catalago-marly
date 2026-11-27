import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import {CUSTOMER_IDENTITY_CALLBACK,CUSTOMER_IDENTITY_AUTH_URL,CUSTOMER_IDENTITY_PUBLIC_KEY,eligibleIdentityEmail} from "./identity-policy";
const email=z.string().trim().email().max(254).transform(v=>v.toLowerCase());
const token=z.string().min(50).max(10000);
const password=z.string().min(10,"Usa al menos 10 caracteres").max(128).refine(v=>/[a-záéíóúñ]/i.test(v)&&/\d/.test(v),"Incluye letras y números");
const ops=()=>import("@/lib/workspace/operations.server"),customer=()=>import("./customer.server");
const neutral={ok:true as const};

export const customerRequestRecovery=createServerFn({method:"POST"}).validator((v:unknown)=>z.object({email}).parse(v)).handler(async({data})=>{
 const c=await customer(),db=(await ops()).opsDB();
 await c.customerThrottle("customer-recovery",data.email,3);
 if(!eligibleIdentityEmail(data.email,(await import("./main-admin.server")).mainAdminEmail()))return neutral;
 const r=await db.from("ma2_customer_accounts").select("id,client_id,access_mode").eq("email",data.email).is("business_id",null).eq("active",true).eq("access_mode","normal").maybeSingle();
 if(r.error)throw Error("No se pudo solicitar el enlace. Intenta más tarde.");
 if(!r.data)return neutral;
 const record=await (await ops()).readRecord(r.data.client_id);
 if(record.module!=="clients"||record.status!=="active")return neutral;
 // Same managed email service used by the existing administrator recovery.
 const sent=await db.auth.signInWithOtp({email:data.email,options:{shouldCreateUser:true,emailRedirectTo:CUSTOMER_IDENTITY_CALLBACK}});
 // Do not disclose whether a specific address is registered or deliverable.
 if(sent.error)console.warn("Customer recovery email was not sent",sent.error.code||"provider_error");
 return neutral;
});

export const customerResetFromLink=createServerFn({method:"POST"}).validator((v:unknown)=>z.object({accessToken:token,password}).parse(v)).handler(async({data})=>{
 const c=await customer(),identity=await (await import("./identity.server")).verifiedCustomerIdentity(data.accessToken,"otp");
 await c.customerThrottle("customer-reset",identity.email,5);
 const p=await import("./password.server"),salt=p.customerSalt();
 const r=await (await ops()).opsDB().rpc("ma2_customer_reset_verified",{p_email:identity.email,p_session:identity.sessionId,p_hash:await p.customerHash(data.password,salt),p_salt:salt});
 if(r.error||!r.data)throw Error("El enlace ya se utilizó, venció o no corresponde a una cuenta de la tienda");
 // A reset invalidates the old customer sessions in the same database transaction.
 return neutral;
});

export const customerGoogleAccess=createServerFn({method:"POST"}).validator((v:unknown)=>z.object({accessToken:token,currentPassword:z.string().max(128).optional(),name:z.string().trim().max(100).optional(),whatsapp:z.string().max(25).optional()}).parse(v)).handler(async({data})=>{
 const c=await customer(),s=await ops(),db=s.opsDB();
 const identity=await (await import("./identity.server")).verifiedCustomerIdentity(data.accessToken,"oauth");
 await c.customerThrottle("customer-google",identity.email,10);
 const result=await db.from("ma2_customer_accounts").select("id,client_id,email,password_hash,salt,active,access_mode,identity_user_id").eq("email",identity.email).is("business_id",null).maybeSingle();
 if(result.error)throw Error("No se pudo iniciar sesión");
 const a=result.data;
 if(a&&(!a.active||a.access_mode!=="normal"||(a.identity_user_id&&a.identity_user_id!==identity.subject)))throw Error("Esta cuenta no admite acceso con Google");
 if(a){const record=await s.readRecord(a.client_id);if(record.module!=="clients"||record.status!=="active")throw Error("Tu acceso está suspendido");}
 if(a&&!a.identity_user_id&&!data.currentPassword)return {status:"link" as const,email:identity.email};
 if(!a&&(!data.name||!data.whatsapp))return {status:"register" as const,email:identity.email,name:identity.name};
 const p=await import("./password.server");
 let salt="",hash="",payload="";
 if(a&&!a.identity_user_id&&!(await p.customerMatches(data.currentPassword||"",a.salt,a.password_hash)))throw Error("La contraseña no es correcta. Puedes restablecerla por correo.");
 if(!a){
  const {validFullName,validWhatsApp,phoneNumber}=await import("@/lib/workspace/model");
  if(!validFullName(data.name||"")||!validWhatsApp(data.whatsapp||""))throw Error("Escribe tu nombre completo y WhatsApp con lada");
  salt=p.customerSalt();hash=await p.customerHash(crypto.randomUUID()+crypto.randomUUID(),salt);
  payload=await (await import("@/lib/deliveries/deliveries.server")).encryptPayload({email:identity.email,whatsapp:phoneNumber(data.whatsapp!),shopId:"main"});
 }
 const r=await db.rpc("ma2_customer_google_verified",{p_email:identity.email,p_subject:identity.subject,p_session:identity.sessionId,p_current_hash:a&&!a.identity_user_id?a.password_hash:null,p_name:a?null:data.name,p_hash:hash,p_salt:salt,p_payload:payload});
 if(r.error||!r.data)throw Error("No se pudo completar el acceso. Vuelve a iniciar sesión con Google.");
 await c.customerSession(String(r.data));return {status:"ok" as const};
});

// Public status only; no credentials are config exposed to the browser.
export const customerIdentityOptions=createServerFn({method:"GET"}).handler(async()=>{
 try{
  const url=CUSTOMER_IDENTITY_AUTH_URL,key=CUSTOMER_IDENTITY_PUBLIC_KEY;
  const res=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:key},signal:AbortSignal.timeout(5000)});
  const config=res.ok?await res.json():null;
  return {google:config?.external?.google===true,email:config?.external?.email===true};
 }catch{return {google:false,email:false};}
});
