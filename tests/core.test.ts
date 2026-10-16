import test from "node:test";
import assert from "node:assert/strict";
import {eligibleMemories,parseMemoryCandidates,relevantMemory,type MemoryItem} from "../src/lib/memory/automatic";
import {validateTextAttachment,ATTACHMENT_CAPABILITIES} from "../src/lib/chat/attachments";
import {validateEvidence,type Diagnosis} from "../src/lib/diagnosis/contracts";
test("a remembered hypothesis cannot be cited as confirmed diagnostic evidence",()=>{
 const diagnosis={evidence:[{source:"CONFIRMED_MEMORY",quote:"preço alto"}]} as Diagnosis;
 assert.throws(()=>validateEvidence(diagnosis,[],JSON.stringify([{kind:"HYPOTHESIS",value:"preço alto"}])));
});
test("memory requires exact current-message evidence, explicit scope and category",()=>{
 const c={key:"price_concern",kind:"HYPOTHESIS",value:"O preço pode limitar vendas",evidence:"acho que meu preço está alto",certainty:"EXPLICIT",scope:"CURRENT_COMPANY",observed_at:null,replaces_current:false};
 assert.equal(eligibleMemories(parseMemoryCandidates([c]),c.evidence)[0].kind,"HYPOTHESIS");
 assert.equal(eligibleMemories(parseMemoryCandidates([c]),"Outra mensagem").length,0);
 assert.equal(eligibleMemories(parseMemoryCandidates([{...c,scope:"SIMULATION"}]),c.evidence).length,0);
 assert.equal(eligibleMemories(parseMemoryCandidates([{...c,certainty:"AMBIGUOUS"}]),c.evidence).length,0);
 assert.throws(()=>parseMemoryCandidates([{...c,kind:"INVENTED"}]));
});
test("context is bounded, ranked and never includes another tenant or deleted memory",()=>{
 const rows=Array.from({length:50},(_,i)=>({id:String(i),company_id:i===0?"other":"a",key:"item_"+i,kind:i===1?"GOAL":"FACT",value:i===2?"aumentar vendas":"contexto",observed_at:"2026-09-30",updated_at:"2026-09-30",created_at:"2026-09-30",version:1,manual:false,deleted:i===3})) as MemoryItem[];
 const result=relevantMemory(rows,"a","vendas");assert.equal(result.length,8);assert.equal(result[0].key,"item_2");assert.ok(result.some(x=>x.kind==="GOAL"));assert.ok(!result.some(x=>["item_0","item_3"].includes(x.key)));
});
test("attachments accept bounded text and clearly reject unsupported or binary input",()=>{
 assert.equal(validateTextAttachment("menu.csv",20,"produto,preço"),null);
 assert.equal(validateTextAttachment("photo.png",20,"not text"),"UNSUPPORTED");
 assert.equal(validateTextAttachment("report.pdf",20,"text"),"UNSUPPORTED");
 assert.equal(validateTextAttachment("report.txt",21000,"text"),"TOO_LARGE");
 assert.equal(validateTextAttachment("data.txt",5,"a\0b"),"TOO_LARGE");
 assert.equal(ATTACHMENT_CAPABILITIES.image_generation,false);
});
