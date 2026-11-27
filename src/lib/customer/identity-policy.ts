export const CUSTOMER_IDENTITY_CALLBACK="https://martgor.shop/recuperar-acceso";
// Public project configuration, never service credentials.
export const CUSTOMER_IDENTITY_AUTH_URL="https://dqynxsayqpwhjtfuonyd.supabase.co";
export const CUSTOMER_IDENTITY_PUBLIC_KEY="sb_publishable_jTnGvywiZOOCaZd_JNZ-6w_pa-SIi7j";
export const normalizedIdentityEmail=(value:string)=>value.trim().toLowerCase();
export const isCyberdocLogin=(email:string)=>/^cyberdoc[0-9]+@martgor\.shop$/i.test(email.trim());
export function eligibleIdentityEmail(email:string,adminEmail:string){
 const normalized=normalizedIdentityEmail(email);
 return Boolean(normalized&&normalized!==normalizedIdentityEmail(adminEmail)&&!isCyberdocLogin(normalized));
}
export function freshIdentityProof(claims:Record<string,unknown>,method:"otp"|"oauth",now=Math.floor(Date.now()/1000)){
 const sid=claims.session_id;
 if(typeof sid!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid))return null;
 const amr=Array.isArray(claims.amr)?claims.amr:[];
 const permitted=method==="otp"?["otp","magiclink"]:["oauth"];
 return amr.some(a=>a&&typeof a==="object"&&permitted.includes(a.method)&&typeof a.timestamp==="number"&&a.timestamp<=now+30&&now-a.timestamp<=900)?sid:null;
}
