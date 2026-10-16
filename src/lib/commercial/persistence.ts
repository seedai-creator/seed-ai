/** Retry only idempotent bookkeeping writes after transport failures, never provider calls. */
export async function persistUsage<T extends {error: {code?:string;message:string}|null}>(operation:()=>PromiseLike<T>):Promise<T>{
 const first=await operation();
 if(!first.error||first.error.code&&first.error.code!=='PGRST000')return first;
 await new Promise(resolve=>setTimeout(resolve,200));
 return await operation();
}
