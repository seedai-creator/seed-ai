import 'server-only';
import OpenAI from 'openai';
import type {Response,ResponseCreateParamsNonStreaming} from 'openai/resources/responses/responses';
export {webRequest} from './request';
export type {ExternalRequest} from './request';
// Supported by Responses API; SDK 7.22 omits this field in the create type.

export interface ExternalResearchProvider {
 start(request:ResponseCreateParamsNonStreaming,signal:AbortSignal):Promise<Response>;
 retrieve(id:string):Promise<Response>;
 cancel(id:string):Promise<Response>;
}
export class OpenAIWebSearchProvider implements ExternalResearchProvider {
 constructor(private client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:105000,maxRetries:0})){}
 start(request:ResponseCreateParamsNonStreaming,signal:AbortSignal){return this.client.responses.create(request,{signal});}
 retrieve(id:string){return this.client.responses.retrieve(id);}
 cancel(id:string){return this.client.responses.cancel(id);}
}
