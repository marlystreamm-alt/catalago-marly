import { useEffect } from "react";
import { appearanceStyle, normalizeAppearance } from "@/lib/appearance/theme";

/** Dialogs and sheets are rendered outside the workspace root; inherit the same brand tokens. */
export function useMa2Appearance(raw:unknown) {
  const appearance=normalizeAppearance(raw);
  const {palette,cardImage,cardOpacity,imageOpacity}=appearance;
  useEffect(()=>{
    const body=document.body;
    const tokens=appearanceStyle({palette,cardImage,cardOpacity,imageOpacity});
    const previous=new Map<string,string>();
    body.classList.add("ma2-appearance-active");
    for(const [key,value] of Object.entries(tokens))if(key.startsWith("--ma2-")&&value!=null){previous.set(key,body.style.getPropertyValue(key));body.style.setProperty(key,String(value));}
    return()=>{body.classList.remove("ma2-appearance-active");for(const [key,value] of previous)if(value)body.style.setProperty(key,value);else body.style.removeProperty(key);};
  },[palette,cardImage,cardOpacity,imageOpacity]);
}
