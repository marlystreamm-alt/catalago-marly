/** The administrator identity uses the same address as verified password recovery. */
export function mainAdminEmail(){return (process.env.MA2_ADMIN_EMAIL?.trim()||"marlystreamm@gmail.com").toLowerCase();}
export async function mainAdminSignIn(password:string){
 const {requireAdminPassword}=await import("@/lib/notify/notify.server");
 const {createServerSession}=await import("@/lib/sessions.server");
 const verification=await requireAdminPassword(password);
 const session=await createServerSession("Marla",{hours:12});
 return {...session,mustChangePassword:verification.mustChangePassword};
}
