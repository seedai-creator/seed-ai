import type {Dimension} from './domain';
export type Mapping={code:string;unit:string;role:'PRIMARY'|'SUPPORTING'|'GUARDRAIL'|'CONTEXT';higherIsBetter:boolean;definition:string};
const m=(code:string,unit:string,definition:string,higherIsBetter=true):Mapping=>({code,unit,role:'PRIMARY',higherIsBetter,definition});
export const METRIC_MAPPING:Record<Dimension,Mapping[]>={
 ACQUISITION:[m('leads','count','INQUIRIES'),m('qualified_opportunities','count','QUALIFIED_OPPORTUNITIES'),m('store_visitors','count','STORE_VISITORS'),m('new_customers','count','NEW_CUSTOMERS')],
 CONVERSION:[m('conversion','percent','SALES_PER_LEAD'),m('proposal_close_rate','percent','CLOSED_PER_PROPOSAL'),m('visitor_conversion','percent','SALES_PER_VISITOR'),m('appointment_conversion','percent','COMPLETED_PER_REQUESTED')],
 TICKET:[m('average_ticket','money','REVENUE_PER_SALE'),m('average_contract_value','money','REVENUE_PER_CONTRACT'),m('arpu','money','REVENUE_PER_ACTIVE_USER')],
 FREQUENCY:[m('frequency','ratio','TRANSACTIONS_PER_ACTIVE_CUSTOMER')],
 RETENTION:[m('retention','percent','CUSTOMERS_RETAINED'),m('churn','percent','CUSTOMERS_LOST',false),m('renewal_rate','percent','CONTRACTS_RENEWED'),m('repeat_purchase_rate','percent','ELIGIBLE_CUSTOMERS_RETURNING')],
 MARGIN:[m('gross_margin','percent','GROSS_MARGIN'),m('contribution_margin','percent','CONTRIBUTION_MARGIN'),m('operating_margin','percent','OPERATING_MARGIN'),m('net_margin','percent','NET_MARGIN')],
};
export const CONTEXT_MAPPING:Mapping[]=[{...m('response_time','hours','RESPONSE_TIME',false),role:'SUPPORTING'},{...m('capacity_utilization','percent','VOLUME_PER_CAPACITY'),role:'GUARDRAIL'},{...m('cac','money','ACQUISITION_COST_PER_CUSTOMER',false),role:'CONTEXT'}];
// Change thresholds define meaningful movement in this MVP, never an industry ideal.
export const RULES={availability:{id:'METRIC_AVAILABILITY',version:'1'},applicability:{id:'BUSINESS_APPLICABILITY',version:'1'},comparison:{id:'COMPARABLE_PERIODS',version:'1'},trend:{id:'INTERNAL_TREND',version:'1',relativeTolerance:.05,percentagePointTolerance:1},goal:{id:'EXPLICIT_GOAL_COMPARISON',version:'1'},bottleneck:{id:'GOAL_LINKED_CONSTRAINT',version:'1'},capacity:{id:'REPORTED_CAPACITY_BOUND',version:'1'}} as const;
export const STALE_DAYS={DAY:3,WEEK:14,MONTH:62,QUARTER:120,YEAR:400,CUSTOM_RANGE:90,UNKNOWN:0} as const;
export function dimensionFor(metric:string|null){return (Object.keys(METRIC_MAPPING) as Dimension[]).find(d=>METRIC_MAPPING[d].some(m=>m.code===metric))??null;}
