import 'server-only';
import {goalsEnabled,goalSnapshot} from './server';
import {businessDay} from './domain';
import type {Signal} from '../radar/domain';
import {goalSignals} from './signals';
import {commercialDatabase} from '../commercial/server';
export async function goalRadarSignals(company:string):Promise<Signal[]>{
 if(!goalsEnabled())return [];const db=commercialDatabase(),owner=await db.from('company_members').select('user_id').eq('company_id',company).eq('role','owner').limit(1).maybeSingle();if(owner.error||!owner.data)return [];
 const snapshot=await goalSnapshot(company,owner.data.user_id);return snapshot.timezone?goalSignals(snapshot.progress,businessDay(snapshot.timezone)):[];
}
