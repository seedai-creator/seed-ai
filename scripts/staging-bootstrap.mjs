import {createHash} from 'node:crypto';
import shared from '../supabase/shared-migrations.json' with {type:'json'};

export function buildStagingBootstrap(migrations,project) {
  if(!/^[a-z]{20}$/.test(project??'')||!migrations.length)throw Error('Invalid staging manifest');
  const names=new Set();
  const parts=migrations.map(({name,sql})=>{
    // Keep legacy 12-digit versions and the official CLI's 14-digit timestamps.
    if(!/^\d{12}(?:\d{2})?_[a-z0-9_]+\.sql$/.test(name)||names.has(name))throw Error('Invalid migration name');
    names.add(name);
    const opening=sql.match(/^(?:\s|--[^\n]*(?:\n|$))*begin;\s*/i),closing=sql.match(/commit;\s*$/i);
    const hash=createHash('sha256').update(sql).digest('hex');
    // These four historical landing files had no transaction wrapper. Their
    // exact content was reviewed (only CRLF/LF may differ on checkout).
    const hashLF=createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex');
    const imported=shared.migrations.some(file=>file.file===name&&file.sha256LF===hashLF);
    if(!imported&&(!opening||!closing||closing.index<opening[0].length))throw Error('Review transaction boundaries: '+name);
    const body=imported?sql:sql.slice(opening[0].length,closing.index);
    return `-- Migration: ${name}\n-- SHA256: ${hash}\n${body}`;
  });
  return `-- SEED AI: INITIAL STAGING SETUP ONLY\n-- Project: ${project}\n-- Dashboard: https://supabase.com/dashboard/project/${project}/sql/new\n-- Requires an empty public schema and no application users.\n-- One transaction: any error rolls back this entire bootstrap.\n-- Run once; do not rerun against an installed project.\nbegin;\nset local lock_timeout='5s';\nset local statement_timeout='120s';\ndo $bootstrap$\nbegin\n perform pg_advisory_xact_lock(hashtextextended('seed-staging-bootstrap',0));\n if exists(select 1 from pg_tables where schemaname='public') or exists(select 1 from auth.users) then\n  raise exception 'Staging bootstrap requires an empty public schema and no Auth users' using errcode='55000';\n end if;\nend $bootstrap$;\n\n${parts.join('\n')}\n-- Keep the new environment closed until invitations and integration checks.\nupdate public.operations_controls set closed_beta=true,disable_ai=true,disable_uploads=true,version=version+1,updated_at=now() where id;\ncommit;\n`;
}
