-- Profit sharing is an estimate of the period, never a commission or payment.
alter table public.finance_settings
 add column remuneration_model text not null default 'commission' check (remuneration_model in ('commission','equal_profit_share')),
 add column profit_share_staff_ids uuid[] not null default '{}';

create function app_private.configure_profit_settings(p_org uuid, d jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare settings public.finance_settings; model text; partners uuid[]; result jsonb;
begin
 if not app_private.has_org_role(p_org,array['organization_owner','finance']) then raise exception 'forbidden' using errcode='42501'; end if;
 select * into settings from public.finance_settings where organization_id=p_org for update;
 model:=coalesce(d->>'remuneration_model',settings.remuneration_model,'commission');
 partners:=case when d ? 'profit_share_staff_ids' then array(select jsonb_array_elements_text(d->'profit_share_staff_ids')::uuid) else coalesce(settings.profit_share_staff_ids,'{}'::uuid[]) end;
 if model not in ('commission','equal_profit_share') or cardinality(partners)>20 or
 cardinality(partners)<>(select count(distinct x) from unnest(partners) x) or
 (model='equal_profit_share' and cardinality(partners)<2) or
 exists(select 1 from unnest(partners) x where not exists(select 1 from public.staff where organization_id=p_org and id=x and active))
 then raise exception 'invalid_profit_partners' using errcode='22023'; end if;
 partners:=array(select x from unnest(partners) x order by x);
 -- Lock the economic model after sales to preserve the meaning of past reports.
 if settings.id is not null and
 (settings.remuneration_model<>model or settings.profit_share_staff_ids is distinct from partners) and
 exists(select 1 from public.checkouts where organization_id=p_org and status in ('posted','reversed'))
 then raise exception 'remuneration_model_locked_after_sales' using errcode='23514'; end if;
 insert into public.finance_settings(organization_id,advances_deductible,remuneration_model,profit_share_staff_ids)
 values(p_org,coalesce((d->>'advances_deductible')::boolean,settings.advances_deductible,false),model,partners)
 on conflict(organization_id) do update set advances_deductible=excluded.advances_deductible,
 remuneration_model=excluded.remuneration_model,profit_share_staff_ids=excluded.profit_share_staff_ids
 returning to_jsonb(finance_settings.*) into result;
 return result;
end $$;
revoke all on function app_private.configure_profit_settings(uuid,jsonb) from public,anon,authenticated,service_role;

create function app_private.profit_share_summary(p_org uuid, p_branch uuid, totals jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare settings public.finance_settings; profit bigint; share bigint; count_partners integer;
begin
 if not app_private.finance_access(p_org,p_branch,'report') then raise exception 'forbidden' using errcode='42501'; end if;
 select * into settings from public.finance_settings where organization_id=p_org;
 if settings.remuneration_model is distinct from 'equal_profit_share' then return null; end if;
 count_partners:=cardinality(settings.profit_share_staff_ids);
 -- Historical unknown commissions are preserved and block a definitive estimate.
 if coalesce((totals->>'unknown_fees')::bigint,0)=0 and coalesce((totals->>'unknown_commissions')::bigint,0)=0 then
 profit:=(totals->>'gross_revenue_minor')::bigint-(totals->>'payment_processing_fees_minor')::bigint
 -(totals->>'operating_expenses_minor')::bigint-(totals->>'barber_commissions_minor')::bigint;
 share:=greatest(profit,0)/count_partners;
 end if;
 return jsonb_build_object('model','equal_profit_share','profit_minor',profit,'per_partner_minor',share,
 'remainder_minor',case when share is null then null else greatest(profit,0)-share*count_partners end,
 'partners',(select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name,s.id)
 from public.staff s where s.organization_id=p_org and s.id=any(settings.profit_share_staff_ids)));
end $$;
revoke all on function app_private.profit_share_summary(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

-- Extend the audited transaction/read paths without replacing their permission,
-- tenant-locking, idempotency, event or audit behavior. Assert expected source.
do $patch$
declare source text; original text; replacement text;
begin
 source:=pg_get_functiondef('app_private.finance_command(uuid,uuid,text,jsonb,uuid)'::regprocedure);
 original:=$old$insert into public.finance_settings(organization_id,advances_deductible) values(p_org,(d->>'advances_deductible')::boolean) on conflict(organization_id) do update set advances_deductible=excluded.advances_deductible returning id,to_jsonb(finance_settings.*) into v,after_data;$old$;
 replacement:=$new$after_data:=app_private.configure_profit_settings(p_org,d); v:=(after_data->>'id')::uuid;$new$;
 if position(original in source)=0 then raise exception 'finance_settings_patch_mismatch'; end if;
 execute replace(source,original,replacement);

 source:=pg_get_functiondef('app_private.finance_read(uuid,uuid,text,date,date,integer,integer,text,uuid)'::regprocedure);
 original:=$old$return jsonb_build_object('totals',result||$old$;
 replacement:=$new$return jsonb_build_object('profit_sharing',app_private.profit_share_summary(p_org,p_branch,result),'totals',result||$new$;
 if position(original in source)=0 then raise exception 'finance_summary_patch_mismatch'; end if;
 execute replace(source,original,replacement);

 source:=pg_get_functiondef('app_private.finance_post_checkout(uuid,uuid,uuid,timestamptz)'::regprocedure);
 original:=$old$r:=null;$old$;
 -- Participants receive a profit share, so new service sales accrue no commission.
 -- Keep existing commission history and snapshots untouched.
 replacement:=$new$if exists(select 1 from public.finance_settings where organization_id=p_org and remuneration_model='equal_profit_share' and l.staff_id=any(profit_share_staff_ids)) then continue; end if;
 r:=null;$new$;
 if position(original in source)=0 then raise exception 'finance_post_patch_mismatch'; end if;
 execute replace(source,original,replacement);
end $patch$;
