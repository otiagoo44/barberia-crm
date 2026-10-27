-- Daily bookkeeping mirrors Registro Diario. It uses the existing ledger,
-- cash controls, tenant lock, MFA, audit and idempotency; no parallel balances.
create function app_private.finance_record_income(p_org uuid,p_branch uuid,d jsonb) returns uuid
language plpgsql set search_path='' as $$
declare v uuid; amount bigint; catalog_amount bigint; line jsonb;
begin
 if not app_private.finance_access(p_org,p_branch,'report') then raise exception 'forbidden' using errcode='42501';end if;
 amount:=app_private.finance_amount(d->'amount_minor');
 if amount<=0 or (d->>'service_id' is null)=(d->>'item_id' is null) or length(coalesce(d->>'person_label',''))>120 then raise exception 'invalid_income' using errcode='22023';end if;
 line:=jsonb_build_object('service_id',d->'service_id','item_id',d->'item_id','staff_id',d->'staff_id','quantity',1,'price_minor',amount,'reason','Importe del registro diario');
 v:=app_private.finance_create_checkout(p_org,p_branch,jsonb_build_object('description',d->>'description','lines',jsonb_build_array(line)));
 select total_minor into catalog_amount from public.checkouts where organization_id=p_org and id=v;
 if amount<>catalog_amount and length(trim(coalesce(d->>'reason','')))<3 then raise exception 'price_change_reason_required' using errcode='23514';end if;
 update public.checkout_lines set unit_price_minor=amount,amount_minor=amount,
   metadata=metadata||jsonb_build_object('person_label',nullif(trim(d->>'person_label'),''),'catalog_price_minor',catalog_amount,'reason',d->>'reason')
 where organization_id=p_org and checkout_id=v;
 update public.checkouts set total_minor=amount where organization_id=p_org and id=v;
 perform app_private.finance_record_payment(p_org,p_branch,d||jsonb_build_object('checkout_id',v));
 perform app_private.finance_post_checkout(p_org,p_branch,v);
 return v;
end $$;
revoke all on function app_private.finance_record_income(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

create function app_private.finance_daybook(p_org uuid,p_branch uuid,p_from date,p_to date,p_limit integer,p_offset integer,p_query text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare lo timestamptz;hi timestamptz;tz text;result jsonb;
begin
 if not app_private.finance_access(p_org,p_branch,'report') or not app_private.can_access_branch(p_org,p_branch) then raise exception 'forbidden' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>3660 or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 or p_query is null or length(p_query)>80 then raise exception 'invalid_finance_query' using errcode='22023';end if;
 select timezone into tz from public.branches where organization_id=p_org and id=p_branch;
 if tz is null then raise exception 'invalid_branch' using errcode='22023';end if;
 lo:=p_from::timestamp at time zone tz;hi:=(p_to+1)::timestamp at time zone tz;
 with movements as (
  select p.id,p.checkout_id entity_id,'checkout' entity_type,p.occurred_at,
   (p.occurred_at at time zone tz)::date local_date,
   case when p.direction=1 then 'Ingreso' else 'Devolución' end kind,
   c.status,coalesce((select name from public.customers where organization_id=p_org and id=c.customer_id),l.person,'') person,
   l.staff_name,l.concept,p.method_name_snapshot payment_method,p.payment_method_id,
   case when p.direction=1 then p.amount_minor else 0 end income_minor,
   case when p.direction=-1 then p.amount_minor else 0 end expense_minor,
   p.fee_minor,p.fee_status,p.amount_minor*p.direction balance_minor
  from public.payments p join public.checkouts c on c.organization_id=p.organization_id and c.id=p.checkout_id
  cross join lateral (select string_agg(distinct staff_name_snapshot,', ') staff_name,string_agg(name_snapshot,' + ' order by created_at,id) concept,max(coalesce(metadata->>'person_label',metadata->>'historical_person_label')) person from public.checkout_lines where organization_id=p_org and checkout_id=c.id) l
  where p.organization_id=p_org and p.branch_id=p_branch and p.occurred_at>=lo and p.occurred_at<hi
  union all
  select e.id,e.id,'expense',e.occurred_at,(e.occurred_at at time zone tz)::date,'Egreso',e.status,coalesce(e.vendor,''),
    (select name from public.staff where organization_id=p_org and id=e.staff_id),e.description,e.method_name_snapshot,e.payment_method_id,0,e.amount_minor,0,'known',-e.amount_minor
  from public.expenses e where e.organization_id=p_org and e.branch_id=p_branch and e.occurred_at>=lo and e.occurred_at<hi
  union all
  select e.id,e.id,'expense',e.reversed_at,(e.reversed_at at time zone tz)::date,'Reversión de gasto',e.status,coalesce(e.vendor,''),
    (select name from public.staff where organization_id=p_org and id=e.staff_id),e.description,e.method_name_snapshot,e.payment_method_id,0,-e.amount_minor,0,'known',e.amount_minor
  from public.expenses e where e.organization_id=p_org and e.branch_id=p_branch and e.reversed_at>=lo and e.reversed_at<hi
 ), totals as (
  select coalesce(sum(income_minor),0) income_minor,coalesce(sum(expense_minor),0) expense_minor,coalesce(sum(fee_minor),0) known_fees_minor,
    coalesce(sum(balance_minor),0) balance_before_fees_minor,count(*) filter(where fee_status='unknown') unknown_fees from movements
 )
 select jsonb_build_object('totals',(select to_jsonb(t)||jsonb_build_object('net_minor',case when unknown_fees=0 then balance_before_fees_minor-known_fees_minor else null end) from totals t),
 'methods',(select coalesce(jsonb_agg(to_jsonb(x) order by x.payment_method),'[]') from(select payment_method_id,payment_method,sum(income_minor) income_minor,sum(expense_minor) expense_minor,sum(balance_minor) balance_before_fees_minor,sum(fee_minor) known_fees_minor,count(*) filter(where fee_status='unknown') unknown_fees,case when count(*) filter(where fee_status='unknown')=0 then sum(balance_minor)-sum(fee_minor) else null end net_minor from movements group by payment_method_id,payment_method)x),
 'items',(select coalesce(jsonb_agg(to_jsonb(x) order by occurred_at desc,id desc,kind),'[]') from(select * from movements where p_query='' or strpos(lower(coalesce(person,'')||' '||coalesce(staff_name,'')||' '||coalesce(concept,'')),lower(p_query))>0 order by occurred_at desc,id desc,kind limit p_limit offset p_offset)x)) into result;
 return result;
end $$;
revoke all on function app_private.finance_daybook(uuid,uuid,date,date,integer,integer,text) from public,anon,authenticated,service_role;

do $patch$
declare source text;needle text;
begin
 source:=pg_get_functiondef('app_private.finance_record_payment(uuid,uuid,jsonb,boolean,timestamptz)'::regprocedure);
 needle:=$old$if f.id is null and not p_import then raise exception 'fee_rule_required' using errcode='23514';end if;$old$;
 if position(needle in source)=0 then raise exception 'pending_card_fee_patch_mismatch';end if;
 execute replace(source,needle,$new$if f.id is null and not p_import and m.type<>'card' then raise exception 'fee_rule_required' using errcode='23514';end if;$new$);
 -- Keep unknown fee_minor NULL. Existing distribution checks continue to fail closed.
 source:=pg_get_functiondef('app_private.finance_command(uuid,uuid,text,jsonb,uuid)'::regprocedure);
 needle:=$old$when 'create_checkout' then v:=app_private.finance_create_checkout(p_org,p_branch,d);$old$;
 if position(needle in source)=0 then raise exception 'daily_income_command_patch_mismatch';end if;
 execute replace(source,needle,$new$when 'record_income' then v:=app_private.finance_record_income(p_org,p_branch,d);
 $new$||needle);
 source:=pg_get_functiondef('app_private.finance_read(uuid,uuid,text,date,date,integer,integer,text,uuid)'::regprocedure);
 needle:=$old$case p_view$old$;
 if position(needle in source)=0 then raise exception 'daily_read_patch_mismatch';end if;
 execute replace(source,needle,$new$if p_view='daybook' then return app_private.finance_daybook(p_org,p_branch,p_from,p_to,p_limit,p_offset,p_query);end if;
 $new$||needle);
end $patch$;
