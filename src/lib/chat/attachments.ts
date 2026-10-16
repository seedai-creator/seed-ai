export const ATTACHMENT_CAPABILITIES = { text:true, image:false, pdf:false, office:false, audio:false, image_generation:false } as const;
export function validateTextAttachment(name:string,size:number,text:string){
 if(!/\.(txt|md|csv)$/i.test(name))return "UNSUPPORTED" as const;
 if(size>20480||text.length>2000||text.includes("\0")||!text.trim())return "TOO_LARGE" as const;
 return null;
}
