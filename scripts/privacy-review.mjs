// Read-only preparation for a human-reviewed privacy request. Never deletes data.
export function buildPrivacyReview(snapshot) {
 const {memberships,subscriptionCount,financialRecordCount,activeJobCount}=snapshot;
 if(!Array.isArray(memberships)||memberships.length>25||![subscriptionCount,financialRecordCount,activeJobCount].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('Incomplete privacy inventory');
 const companies=memberships.map(m=>{
  if(!/^[0-9a-f-]{36}$/i.test(m.companyId)||!['owner','member'].includes(m.role)
    ||!Number.isSafeInteger(m.members)||m.members<1||!Number.isSafeInteger(m.owners)
    ||m.owners<0||m.owners>m.members||(m.role==='owner'&&m.owners<1)
    ||(m.role==='member'&&m.owners===m.members))throw Error('Incomplete membership inventory');
  const handling=m.members===1&&m.role==='owner'?'EXCLUSIVE_COMPANY_REVIEW'
    :m.owners===0?'OWNERLESS_COMPANY_REVIEW'
    :m.role==='owner'&&m.owners===1?'TRANSFER_OWNERSHIP_FIRST':'PRESERVE_SHARED_COMPANY';
  return {companyId:m.companyId,handling};
 });
 if(new Set(companies.map(c=>c.companyId)).size!==companies.length)throw Error('Duplicate company inventory');
 return {automaticDeletionAllowed:false,companies,subscriptionCount,financialRecordCount,activeJobCount,
  requiredReviews:['VERIFY_IDENTITY_AND_SCOPE','CONFIRM_IMPACT_WITH_OWNER','CLASSIFY_RETENTION_AND_AUTHORSHIP',
    ...(subscriptionCount?['RECONCILE_SUBSCRIPTIONS']:[]),...(financialRecordCount?['REVIEW_FINANCIAL_RETENTION']:[]),
    ...(activeJobCount?['STOP_AND_RECONCILE_IN_FLIGHT_WORK']:[]),
    ...(companies.some(c=>c.handling==='TRANSFER_OWNERSHIP_FIRST')?['CONFIRM_ACCEPTED_OWNERSHIP_TRANSFER']:[]),
    'PREPARE_TRANSACTION_AND_AUTH_REVOCATION','VERIFY_DATA_AND_SHARED_COMPANIES','RECORD_MINIMAL_AUDIT_AND_BACKUP_SUPPRESSION'],
  limitation:'This inventory is not permission to delete. Authored content, legal holds, providers and backup retention require separate review.'};
}

export async function inspectPrivacyRequest(db,requestId) {
 if(!/^[0-9a-f-]{36}$/i.test(requestId))throw Error('Invalid request identifier');
 const request=await db.from('support_requests').select('id,user_id,category,status').eq('id',requestId).single();
 if(request.error||request.data?.category!=='DELETE_ACCOUNT'||!['OPEN','IN_REVIEW','AWAITING_USER'].includes(request.data.status))throw Error('An open deletion request is required');
 const user=request.data.user_id;
 const memberships=await db.from('company_members').select('company_id,role').eq('user_id',user).limit(26);
 if(memberships.error||!memberships.data||memberships.data.length>25)throw Error('Review memberships manually; inventory incomplete');
 const companyReviews=[];
 for(const member of memberships.data){
  const [total,owners]=await Promise.all([
   db.from('company_members').select('*',{count:'exact',head:true}).eq('company_id',member.company_id),
   db.from('company_members').select('*',{count:'exact',head:true}).eq('company_id',member.company_id).eq('role','owner'),
  ]);
  if(total.error||owners.error)throw Error('Membership count unavailable');
  companyReviews.push({companyId:member.company_id,role:member.role,members:total.count,owners:owners.count});
 }
 const counts=await Promise.all([
  db.from('subscriptions').select('*',{count:'exact',head:true}).eq('user_id',user),
  db.from('usage_logs').select('*',{count:'exact',head:true}).eq('user_id',user),
  db.from('ai_requests').select('*',{count:'exact',head:true}).eq('user_id',user),
 ]);
 if(counts.some(r=>r.error||r.count===null))throw Error('Dependency count unavailable');
 const inventory=await db.rpc('privacy_deletion_dependencies',{p_request:requestId});
 if(inventory.error)throw Error('Account dependency inventory unavailable');
 const dependencies=validateDependencyInventory(inventory.data,requestId);
 return {requestId,preparedAt:new Date().toISOString(),dependencies,...buildPrivacyReview({memberships:companyReviews,
  subscriptionCount:counts[0].count,financialRecordCount:counts[1].count+counts[2].count,
  activeJobCount:Object.values(dependencies.activeJobs).reduce((a,b)=>a+b,0)})};
}

export function validateDependencyInventory(value,requestId){
 const jobNames=['ai_requests','journal_jobs','business_model_jobs','external_research_runs','growth_map_requests'];
 if(!value||value.version!==1||value.request_id!==requestId||!Array.isArray(value.dependencies)||!value.dependencies.length
  ||!value.active_jobs||!jobNames.every(key=>Number.isSafeInteger(value.active_jobs[key])&&value.active_jobs[key]>=0))throw Error('Incomplete dependency inventory');
 const dependencies=value.dependencies.map(row=>{
  if(!row||!['table','column'].every(k=>typeof row[k]==='string'&&/^[a-z][a-z0-9_]{0,62}$/.test(row[k]))
   ||typeof row.nullable!=='boolean'||!['CASCADE','SET_NULL','SET_DEFAULT','RESTRICT','NO_ACTION'].includes(row.delete_action)
   ||!Number.isSafeInteger(row.count)||row.count<0)throw Error('Invalid dependency inventory');
  return {table:row.table,column:row.column,nullable:row.nullable,deleteAction:row.delete_action,count:row.count};
 });
 if(!dependencies.some(d=>d.table==='profiles'&&d.column==='id'&&d.count===1))throw Error('Subject profile unavailable');
 if(new Set(dependencies.map(d=>d.table+'.'+d.column)).size!==dependencies.length)throw Error('Duplicate dependency inventory');
 return {foreignKeys:dependencies,activeJobs:Object.fromEntries(jobNames.map(key=>[key,value.active_jobs[key]])),
  limitation:'Direct foreign keys only; content, JSON, company-wide work, Storage, sessions and providers require manual review.'};
}
