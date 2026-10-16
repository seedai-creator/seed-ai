import {reservationError} from '../commercial/usage-errors';
import {translateMessage} from '../i18n/messages';
import type {Locale} from '../i18n/config';
import {externalLabels} from './labels';
export function externalFailureMessage(locale:Locale,code:string|null|undefined):string {
 const reasons:Record<string,string>={REQUEST_BUDGET:'REQUEST_BUDGET',AI_PAUSED:'GLOBAL_BUDGET',GLOBAL_BUDGET:'GLOBAL_BUDGET',DAILY_USAGE_LIMIT:'DAILY_BUDGET',EXTERNAL_USAGE_LIMIT:'EXTERNAL_BUDGET'};
 if(code&&reasons[code])return translateMessage(locale,reservationError(reasons[code]).message);
 const labels=externalLabels(locale);
 return ['USAGE_LIMIT','HARD_LIMIT','AI_ACCESS_BLOCKED','DIAGNOSIS_LIMIT'].includes(code??'')?labels.budget:labels.failed;
}
