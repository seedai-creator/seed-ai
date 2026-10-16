/** Versioned, pure scenario arithmetic. This module never calls a model or predicts demand. */
export const CALCULATION_VERSION = '1.0.0';
export type Interval = { min: number; max: number; approximate: boolean };
export type Period = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ONCE';
export type Quantity = Interval & {
  unit: 'MONEY' | 'MONEY_PER_UNIT' | 'UNITS' | 'RATIO';
  currency: string | null;
  period: Period;
  scope: string;
};
export class CalculationError extends Error {
  constructor(public code: string) { super(code); }
}
const fail = (code: string): never => { throw new CalculationError(code); };
export function interval(min: number, max = min, approximate = false): Interval {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max || Math.max(Math.abs(min),Math.abs(max)) > 1e15) fail('INVALID_RANGE');
  return { min, max, approximate };
}
function checked(value: Interval): Interval { return interval(value.min, value.max, value.approximate); }
export function add(a: Interval, b: Interval): Interval {
  checked(a); checked(b); return interval(a.min+b.min,a.max+b.max,a.approximate||b.approximate);
}
export function subtract(a: Interval,b: Interval): Interval {
  checked(a); checked(b); return interval(a.min-b.max,a.max-b.min,a.approximate||b.approximate);
}
export function multiply(a: Interval,b: Interval): Interval {
  checked(a); checked(b); const products=[a.min*b.min,a.min*b.max,a.max*b.min,a.max*b.max];
  return interval(Math.min(...products),Math.max(...products),a.approximate||b.approximate);
}
export function divide(a: Interval,b: Interval): Interval {
  checked(a); checked(b); if(b.min<=0&&b.max>=0)fail('ZERO_DENOMINATOR');
  return multiply(a,interval(1/b.max,1/b.min,b.approximate));
}
function nonnegative(value: Interval) { checked(value); if(value.min<0)fail('NEGATIVE_INPUT'); }
function positive(value: Interval) { checked(value); if(value.min<=0)fail('NON_POSITIVE_INPUT'); }
function ratio(value: Interval) { nonnegative(value); if(value.max>1)fail('INVALID_RATIO'); }
export function quantity(value: Quantity): Quantity {
  checked(value);
  if(!['MONEY','MONEY_PER_UNIT','UNITS','RATIO'].includes(value.unit)||!['DAY','WEEK','MONTH','YEAR','ONCE'].includes(value.period)||!value.scope?.trim())fail('INVALID_DIMENSION');
  const monetary=value.unit==='MONEY'||value.unit==='MONEY_PER_UNIT';
  if(monetary ? !value.currency||!/^[A-Z]{3}$/.test(value.currency) : value.currency!==null)fail('INVALID_CURRENCY');
  return {...value};
}
export function compatible(a: Quantity,b: Quantity,period=true) {
  quantity(a);quantity(b);
  if(a.scope!==b.scope)fail('SCOPE_MISMATCH');
  if(a.currency&&b.currency&&a.currency!==b.currency)fail('CURRENCY_MISMATCH');
  if(period&&a.period!==b.period)fail('PERIOD_MISMATCH');
}
/** Months are never silently replaced by 30 days. Cross-family conversion requires explicit days. */
export function normalizePeriod(q: Quantity,to: Period,days?: {source:number;target:number}): Quantity {
  quantity(q);if(q.period===to)return {...q};
  if(q.period==='ONCE'||to==='ONCE')return fail('NON_RECURRING_PERIOD');
  let factor: number;
  if(days){if(!Number.isFinite(days.source)||!Number.isFinite(days.target)||days.source<=0||days.target<=0)fail('INVALID_PERIOD_DURATION');factor=days.target/days.source;}
  else if(q.period==='MONTH'&&to==='YEAR')factor=12;
  else if(q.period==='YEAR'&&to==='MONTH')factor=1/12;
  else if(q.period==='DAY'&&to==='WEEK')factor=7;
  else if(q.period==='WEEK'&&to==='DAY')factor=1/7;
  else return fail('EXPLICIT_PERIOD_DURATION_REQUIRED');
  if(q.unit==='RATIO'||q.unit==='MONEY_PER_UNIT')fail('NON_FLOW_NORMALIZATION');
  return {...q,...multiply(q,interval(factor)),period:to};
}
export const FORMULAS = {
  REVENUE: {expression:'price × volume',inputs:['price','volume']},
  CONTRIBUTION_PER_UNIT: {expression:'price − variable_cost',inputs:['price','variable_cost']},
  TOTAL_CONTRIBUTION: {expression:'(price − variable_cost) × volume',inputs:['price','variable_cost','volume']},
  INCREMENTAL_CONTRIBUTION: {expression:'scenario_contribution − baseline_contribution − additional_cost',inputs:['scenario_contribution','baseline_contribution','additional_cost']},
  REQUIRED_REVENUE_VOLUME: {expression:'baseline_revenue ÷ new_price',inputs:['baseline_revenue','new_price']},
  REQUIRED_CONTRIBUTION_VOLUME: {expression:'baseline_contribution ÷ new_contribution_per_unit',inputs:['baseline_contribution','new_contribution_per_unit']},
  HIRING_BREAK_EVEN_SALES: {expression:'fully_loaded_cost ÷ contribution_per_sale',inputs:['fully_loaded_cost','contribution_per_sale']},
  BREAK_EVEN_REVENUE: {expression:'additional_cost ÷ contribution_ratio',inputs:['additional_cost','contribution_ratio']},
  MARKETING_LEADS: {expression:'spend ÷ conditional_cpl',inputs:['spend','conditional_cpl']},
  MARKETING_SALES: {expression:'conditional_leads × conditional_conversion',inputs:['conditional_leads','conditional_conversion']},
  CAPACITY_UTILIZATION: {expression:'required_volume ÷ capacity',inputs:['required_volume','capacity']},
  CAPACITY_GAP: {expression:'required_volume − capacity',inputs:['required_volume','capacity']},
  SIMPLE_PAYBACK: {expression:'investment ÷ incremental_period_contribution',inputs:['investment','incremental_period_contribution']},
  CHANGED_PRICE: {expression:'price × (1 + change_ratio)',inputs:['price','change_ratio']},
  DISCOUNT_PRICE: {expression:'price × (1 − discount_ratio)',inputs:['price','discount_ratio']},
} as const;
export type Formula = keyof typeof FORMULAS;
export type Calculation = {formula:Formula;version:string;inputs:Record<string,Quantity>;output:Quantity;rounding:'NONE';limitations:string[]};
export function calculate(formula:Formula,inputs:Record<string,Quantity>):Calculation {
  const spec=FORMULAS[formula];if(!spec)fail('UNKNOWN_FORMULA');
  if(Object.keys(inputs).length!==spec.inputs.length||spec.inputs.some(k=>!inputs[k]))fail('INVALID_OPERANDS');
  const values=spec.inputs.map(k=>quantity(inputs[k]));
  for(const v of values){if(!(formula==='CHANGED_PRICE'&&v===values[1])&&!(formula==='INCREMENTAL_CONTRIBUTION'&&(v===values[0]||v===values[1])))nonnegative(v);}
  const [a,b,c]=values;
  const price=(v:Quantity)=>{if(v.unit!=='MONEY_PER_UNIT'||v.period!=='ONCE')fail('EXPECTED_UNIT_PRICE');};
  const money=(v:Quantity)=>{if(v.unit!=='MONEY')fail('EXPECTED_MONEY');};
  const units=(v:Quantity)=>{if(v.unit!=='UNITS')fail('EXPECTED_UNITS');};
  const share=(v:Quantity)=>{if(v.unit!=='RATIO'||v.period!=='ONCE')fail('EXPECTED_RATIO');ratio(v);};
  compatible(a,b,false);if(c)compatible(a,c,false);
  let result:Interval;let unit:Quantity['unit']=a.unit,period:Period=a.period,currency=a.currency;
  const limitations:string[]=[];
  switch(formula){
    case 'REVENUE':price(a);units(b);result=multiply(a,b);unit='MONEY';period=b.period;break;
    case 'CONTRIBUTION_PER_UNIT':price(a);price(b);result=subtract(a,b);break;
    case 'TOTAL_CONTRIBUTION':price(a);price(b);units(c);result=multiply(subtract(a,b),c);unit='MONEY';period=c.period;break;
    case 'INCREMENTAL_CONTRIBUTION':money(a);money(b);money(c);compatible(a,b);compatible(a,c);result=subtract(subtract(a,b),c);break;
    case 'REQUIRED_REVENUE_VOLUME':case 'REQUIRED_CONTRIBUTION_VOLUME':case 'HIRING_BREAK_EVEN_SALES':
      money(a);price(b);positive(b);result=divide(a,b);unit='UNITS';currency=null;break;
    case 'BREAK_EVEN_REVENUE':money(a);share(b);positive(b);result=divide(a,b);break;
    case 'MARKETING_LEADS':money(a);price(b);positive(b);result=divide(a,b);unit='UNITS';currency=null;limitations.push('CONDITIONAL_CPL_NOT_A_FORECAST');break;
    case 'MARKETING_SALES':units(a);share(b);result=multiply(a,b);limitations.push('CONDITIONAL_CONVERSION_NOT_A_FORECAST');break;
    case 'CAPACITY_UTILIZATION':units(a);units(b);compatible(a,b);positive(b);result=divide(a,b);unit='RATIO';period='ONCE';currency=null;break;
    case 'CAPACITY_GAP':units(a);units(b);compatible(a,b);result=subtract(a,b);break;
    case 'SIMPLE_PAYBACK':money(a);money(b);positive(b);if(a.period!=='ONCE'||b.period==='ONCE')fail('PAYBACK_REQUIRES_RECURRING_CONTRIBUTION');result=divide(a,b);unit='UNITS';period=b.period;currency=null;limitations.push('PERIOD_COUNT_NOT_DISCOUNTED_CASH_FLOW');break;
    case 'CHANGED_PRICE':price(a);if(b.unit!=='RATIO'||b.period!=='ONCE'||b.min<=-1)fail('INVALID_PRICE_CHANGE');result=multiply(a,add(interval(1),b));break;
    case 'DISCOUNT_PRICE':price(a);share(b);if(b.max>=1)fail('INVALID_PRICE_CHANGE');result=multiply(a,subtract(interval(1),b));break;
  }
  return {formula,version:CALCULATION_VERSION,inputs:structuredClone(inputs),output:{...result,unit,period,currency,scope:a.scope},rounding:'NONE',limitations};
}
/** Round only for presentation. Approximate data uses two significant digits. */
export function displayQuantity(q:Quantity,locale:string):string {
  quantity(q);
  const options:Intl.NumberFormatOptions=q.approximate?{maximumSignificantDigits:2}:{maximumFractionDigits:2};
  if(q.currency){options.style='currency';options.currency=q.currency;}
  else if(q.unit==='RATIO'){options.style='percent';}
  const fmt=new Intl.NumberFormat(locale,options);
  return (q.approximate?'≈ ':'')+fmt.format(q.min)+(q.min===q.max?'':' – '+fmt.format(q.max));
}
/** Whole-sale thresholds are rounded upwards only at presentation; raw audit stays exact. */
export function displayCalculation(result:Calculation,locale:string):string {
  const threshold=['REQUIRED_REVENUE_VOLUME','REQUIRED_CONTRIBUTION_VOLUME','HIRING_BREAK_EVEN_SALES'].includes(result.formula);
  return displayQuantity(threshold?{...result.output,min:Math.ceil(result.output.min),max:Math.ceil(result.output.max)}:result.output,locale);
}
