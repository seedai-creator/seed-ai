import test from 'node:test';
import assert from 'node:assert/strict';
import {adminMfaSatisfied,permittedAdminRole} from '../src/lib/auth/admin-security';
test('admin privilege and verified second factor are separate requirements',()=>{
 assert.equal(permittedAdminRole('SUPER_ADMIN','ADMIN_OPERATOR'),true);
 assert.equal(permittedAdminRole('ADMIN_VIEWER','ADMIN_OPERATOR'),false);
 for(const role of [null,'owner','user','UNKNOWN'])assert.equal(permittedAdminRole(role,'ADMIN_VIEWER'),false);
 for(const claims of [undefined,{}, {aal:'aal1'},{aal:'AAL2'},{aal:2},{nextLevel:'aal2'}])assert.equal(adminMfaSatisfied(claims),false);
 assert.equal(adminMfaSatisfied({aal:'aal2'}),true);
});
