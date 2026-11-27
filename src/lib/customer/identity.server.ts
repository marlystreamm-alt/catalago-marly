import {opsDB} from "@/lib/workspace/operations.server";
import {mainAdminEmail} from "./main-admin.server";
import {eligibleIdentityEmail,freshIdentityProof,normalizedIdentityEmail} from "./identity-policy";

export async function verifiedCustomerIdentity(token:string,method:"otp"|"oauth"){
 const db=opsDB();
 const [{data:userData,error:userError},{data:claimData,error:claimError}]=await Promise.all([db.auth.getUser(token),db.auth.getClaims(token)]);
 const user=userData?.user,claims=claimData?.claims;
 if(userError||claimError||!user||!claims||!user.email_confirmed_at||claims.sub!==user.id)throw Error("El enlace de acceso no es válido o ya venció");
 const email=normalizedIdentityEmail(user.email||""),sessionId=freshIdentityProof(claims,method);
 if(!sessionId||!eligibleIdentityEmail(email,mainAdminEmail()))throw Error("El enlace no está disponible para esta cuenta");
 if(method==="oauth"&&!user.identities?.some((i:any)=>i.provider==="google"&&[true,"true"].includes(i.identity_data?.email_verified)&&normalizedIdentityEmail(String(i.identity_data?.email||""))===email))throw Error("Inicia sesión con una cuenta de Google con correo verificado");
 return {email,subject:user.id,sessionId,name:String(user.user_metadata?.full_name||user.user_metadata?.name||"")};
}
