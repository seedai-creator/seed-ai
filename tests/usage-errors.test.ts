import test from 'node:test';
import assert from 'node:assert/strict';
import {reservationError} from '../src/lib/commercial/usage-errors';
import {translateMessage} from '../src/lib/i18n/messages';
import {externalFailureMessage} from '../src/lib/external/failure-message';
test('quota, rate and uncertain errors remain distinct and localized',()=>{
 const quota=reservationError('DIAGNOSIS_LIMIT');
 const rate=reservationError('RATE_LIMIT');
 assert.equal(quota.code,'DIAGNOSIS_LIMIT');assert.equal(rate.code,'RATE_LIMIT');
 assert.notEqual(quota.message,rate.message);
 for(const reason of ['DIAGNOSIS_LIMIT','RATE_LIMIT','DUPLICATE_REQUEST','PRO_REQUIRED','REQUEST_BUDGET','GLOBAL_BUDGET','DAILY_BUDGET','EXTERNAL_BUDGET',null]) {
  const error=reservationError(reason);
  assert.notEqual(translateMessage('en-US',error.message),error.message);
 }
 assert.equal(reservationError('PRO_REQUIRED').code,'PRO_REQUIRED');
 assert.equal(reservationError(null).code,'USAGE_UNAVAILABLE');
});

test('research UI distinguishes insufficient reservation from an empty allowance or a service pause',()=>{
 assert.match(externalFailureMessage('pt-BR','REQUEST_BUDGET'),/saldo restante/);
 assert.match(externalFailureMessage('en-US','AI_PAUSED'),/does not mean/);
 assert.notEqual(externalFailureMessage('es-ES','DAILY_USAGE_LIMIT'),externalFailureMessage('es-ES','USAGE_LIMIT'));
});
