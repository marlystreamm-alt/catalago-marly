export type RequestMode = "link" | "email" | "both";
export const REQUEST_MODE_LABELS: Record<RequestMode,string> = { link: "Entrega mediante enlace", email: "Entrega manual · correo y WhatsApp", both: "Correo del cliente y entrega mediante enlace" };
export const isOnRequestMessage = (message: string) => /^Modalidad:\s*Por encargo\s*$/im.test(message);
export const requestEmail = (message: string) => /^Correo del cliente:\s*([^\n\r]+)$/im.exec(message)?.[1]?.trim() || "";
