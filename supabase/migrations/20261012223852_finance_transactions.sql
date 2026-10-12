create function app_private.finance_amount(p_value jsonb,p_signed boolean default false) returns bigint language plpgsql immutable set search_path='' as $$
declare n numeric;begin
 if p_value is null or p_value='null'::jsonb or (p_value#>>'{}') !~ (case when p_signed then '^-?[0-9]+$' else '^[0-9]+$' end) then raise exception 'integer_amount_required' using errcode='22023';end if;
 n:=(p_value#>>'{}')::numeric;if abs(n)>9000000000000 then raise exception 'amount_out_of_range' using errcode='22023';end if;return n::bigint;end $$;
create function app_private.finance_round(p_amount bigint,p_rate integer,p_fixed bigint default 0) returns bigint language sql immutable set search_path='' as $$
 select floor(p_amount::numeric*p_rate/10000+0.5)::bigint+p_fixed $$;
create function app_private.finance_session(p_org uuid,p_branch uuid,p_session uuid) returns uuid language plpgsql set search_path='' as $$
declare v uuid;begin
 select id into v from public.cash_sessions where organization_id=p_org and branch_id=p_branch and status='open' and id=p_session for update;
 if v is null then raise exception 'open_cash_session_required' using errcode='23514';end if;return v;end $$;
create function app_private.finance_expected(p_org uuid,p_session uuid) returns bigint language sql stable set search_path='' as $$
 select s.opening_amount_minor+coalesce((select sum(amount_minor) from public.cash_movements where organization_id=p_org and cash_session_id=s.id),0) from public.cash_sessions s where s.organization_id=p_org and s.id=p_session $$;

create function app_private.finance_rebuild_day(p_org uuid,p_branch uuid,p_date date) returns void language plpgsql set search_path='' as $$
declare tz text; lo timestamptz; hi timestamptz;begin
 select timezone into tz from public.branches where organization_id=p_org and id=p_branch;
 lo:=p_date::timestamp at time zone tz;hi:=(p_date+1)::timestamp at time zone tz;
 insert into public.daily_financial_metrics(organization_id,branch_id,local_date,gross_revenue_minor,collected_minor,refunds_minor,expenses_minor,operating_expenses_minor,payment_processing_fees_minor,barber_commissions_minor,paid_checkouts,unknown_fees,unknown_commissions)
 select p_org,p_branch,p_date,
 coalesce((select sum(total_minor) from public.checkouts where organization_id=p_org and branch_id=p_branch and posted_at>=lo and posted_at<hi),0)-coalesce((select sum(total_minor) from public.checkouts where organization_id=p_org and branch_id=p_branch and reversed_at>=lo and reversed_at<hi and posted_at is not null),0),
 coalesce((select sum(amount_minor*direction) from public.payments where organization_id=p_org and branch_id=p_branch and occurred_at>=lo and occurred_at<hi),0),
 coalesce((select sum(amount_minor) from public.payments where organization_id=p_org and branch_id=p_branch and direction=-1 and occurred_at>=lo and occurred_at<hi),0),
 coalesce((select sum(amount_minor) from public.expenses where organization_id=p_org and branch_id=p_branch and occurred_at>=lo and occurred_at<hi),0)-coalesce((select sum(amount_minor) from public.expenses where organization_id=p_org and branch_id=p_branch and reversed_at>=lo and reversed_at<hi),0),
 coalesce((select sum(amount_minor) from public.expenses where organization_id=p_org and branch_id=p_branch and category_kind_snapshot in ('operating','salary') and occurred_at>=lo and occurred_at<hi),0)-coalesce((select sum(amount_minor) from public.expenses where organization_id=p_org and branch_id=p_branch and category_kind_snapshot in ('operating','salary') and reversed_at>=lo and reversed_at<hi),0),
 coalesce((select sum(fee_minor) from public.payments where organization_id=p_org and branch_id=p_branch and occurred_at>=lo and occurred_at<hi),0),
 coalesce((select sum(amount_minor*direction) from public.commission_entries where organization_id=p_org and branch_id=p_branch and occurred_at>=lo and occurred_at<hi),0),
 (select count(*) from public.checkouts where organization_id=p_org and branch_id=p_branch and posted_at>=lo and posted_at<hi),
 (select count(*) from public.payments where organization_id=p_org and branch_id=p_branch and direction=1 and fee_status='unknown' and occurred_at>=lo and occurred_at<hi),
 (select count(*) from public.commission_entries where organization_id=p_org and branch_id=p_branch and calculation_status='unknown' and occurred_at>=lo and occurred_at<hi)
 on conflict(organization_id,branch_id,local_date) do update set gross_revenue_minor=excluded.gross_revenue_minor,collected_minor=excluded.collected_minor,refunds_minor=excluded.refunds_minor,expenses_minor=excluded.expenses_minor,operating_expenses_minor=excluded.operating_expenses_minor,payment_processing_fees_minor=excluded.payment_processing_fees_minor,barber_commissions_minor=excluded.barber_commissions_minor,paid_checkouts=excluded.paid_checkouts,unknown_fees=excluded.unknown_fees,unknown_commissions=excluded.unknown_commissions;

 insert into public.daily_payment_method_metrics(organization_id,branch_id,payment_method_id,local_date,gross_received_minor,refunds_minor,expenses_minor,fee_minor,unknown_fees)
 select p_org,p_branch,m.id,p_date,
 coalesce((select sum(amount_minor) from public.payments where organization_id=p_org and branch_id=p_branch and payment_method_id=m.id and direction=1 and occurred_at>=lo and occurred_at<hi),0),
 coalesce((select sum(amount_minor) from public.payments where organization_id=p_org and branch_id=p_branch and payment_method_id=m.id and direction=-1 and occurred_at>=lo and occurred_at<hi),0),
 coalesce((select sum(amount_minor) from public.expenses where organization_id=p_org and branch_id=p_branch and payment_method_id=m.id and occurred_at>=lo and occurred_at<hi),0)-coalesce((select sum(amount_minor) from public.expenses where organization_id=p_org and branch_id=p_branch and payment_method_id=m.id and reversed_at>=lo and reversed_at<hi),0),
 coalesce((select sum(fee_minor) from public.payments where organization_id=p_org and branch_id=p_branch and payment_method_id=m.id and occurred_at>=lo and occurred_at<hi),0),
 (select count(*) from public.payments where organization_id=p_org and branch_id=p_branch and payment_method_id=m.id and direction=1 and fee_status='unknown' and occurred_at>=lo and occurred_at<hi)
 from public.payment_methods m where m.organization_id=p_org
 on conflict(organization_id,branch_id,payment_method_id,local_date) do update set gross_received_minor=excluded.gross_received_minor,refunds_minor=excluded.refunds_minor,expenses_minor=excluded.expenses_minor,fee_minor=excluded.fee_minor,unknown_fees=excluded.unknown_fees;

 insert into public.daily_staff_financial_metrics(organization_id,branch_id,staff_id,local_date,gross_production_minor,paid_checkouts,commission_accrued_minor,advances_minor,commission_paid_minor,salary_payments_minor,unknown_commissions)
 select p_org,p_branch,s.id,p_date,
 coalesce((select sum(l.amount_minor) from public.checkout_lines l join public.checkouts c on c.organization_id=l.organization_id and c.id=l.checkout_id where l.organization_id=p_org and l.branch_id=p_branch and l.staff_id=s.id and c.posted_at>=lo and c.posted_at<hi),0)-coalesce((select sum(l.amount_minor) from public.checkout_lines l join public.checkouts c on c.organization_id=l.organization_id and c.id=l.checkout_id where l.organization_id=p_org and l.branch_id=p_branch and l.staff_id=s.id and c.posted_at is not null and c.reversed_at>=lo and c.reversed_at<hi),0),
 (select count(distinct c.id) from public.checkouts c join public.checkout_lines l on l.organization_id=c.organization_id and l.checkout_id=c.id where c.organization_id=p_org and c.branch_id=p_branch and l.staff_id=s.id and c.posted_at>=lo and c.posted_at<hi),
 coalesce((select sum(amount_minor*direction) from public.commission_entries where organization_id=p_org and branch_id=p_branch and staff_id=s.id and occurred_at>=lo and occurred_at<hi),0),
 coalesce((select sum(amount_minor) from public.expenses where organization_id=p_org and branch_id=p_branch and staff_id=s.id and category_kind_snapshot='advance' and occurred_at>=lo and occurred_at<hi),0)-coalesce((select sum(amount_minor) from public.expenses where organization_id=p_org and branch_id=p_branch and staff_id=s.id and category_kind_snapshot='advance' and reversed_at>=lo and reversed_at<hi),0),
 coalesce((select sum(amount_minor) from public.expenses where organization_id=p_org and branch_id=p_branch and staff_id=s.id and category_kind_snapshot='commission_payment' and occurred_at>=lo and occurred_at<hi),0),
 coalesce((select sum(amount_minor) from public.expenses where organization_id=p_org and branch_id=p_branch and staff_id=s.id and category_kind_snapshot='salary' and occurred_at>=lo and occurred_at<hi),0)-coalesce((select sum(amount_minor) from public.expenses where organization_id=p_org and branch_id=p_branch and staff_id=s.id and category_kind_snapshot='salary' and reversed_at>=lo and reversed_at<hi),0),
 (select count(*) from public.commission_entries where organization_id=p_org and branch_id=p_branch and staff_id=s.id and calculation_status='unknown' and occurred_at>=lo and occurred_at<hi)
 from public.staff s where s.organization_id=p_org and exists(select 1 from public.staff_branch_assignments where organization_id=p_org and branch_id=p_branch and staff_id=s.id)
 on conflict(organization_id,branch_id,staff_id,local_date) do update set gross_production_minor=excluded.gross_production_minor,paid_checkouts=excluded.paid_checkouts,commission_accrued_minor=excluded.commission_accrued_minor,advances_minor=excluded.advances_minor,commission_paid_minor=excluded.commission_paid_minor,salary_payments_minor=excluded.salary_payments_minor,unknown_commissions=excluded.unknown_commissions;
end $$;

create function app_private.finance_create_checkout(p_org uuid,p_branch uuid,d jsonb,p_import boolean default false,p_when timestamptz default now()) returns uuid language plpgsql set search_path='' as $$
declare a public.appointments; c uuid; r record; l jsonb; q integer; price bigint; v_staff uuid; nm text; kind text; service uuid; item uuid; currency text;begin
 select o.currency into currency from public.organizations o where o.id=p_org;
 if not exists(select 1 from public.branches where organization_id=p_org and id=p_branch and active) then raise exception 'active_branch_required' using errcode='23514';end if;
 if d->>'appointment_id' is not null then
 select * into a from public.appointments where organization_id=p_org and branch_id=p_branch and id=(d->>'appointment_id')::uuid for update;
 if a.id is null or a.status<>'completed' or p_import then raise exception 'completed_appointment_required' using errcode='23514';end if;
 if exists(select 1 from public.checkouts where organization_id=p_org and appointment_id=a.id and status in ('draft','posted')) then raise exception 'checkout_already_exists' using errcode='23514';end if;
 if exists(select 1 from public.appointment_services where organization_id=p_org and appointment_id=a.id and price_minor is null) then raise exception 'service_price_required' using errcode='23514';end if;
 currency:=a.currency;
 end if;
 if d->>'customer_id' is not null and not exists(select 1 from public.customers where organization_id=p_org and id=(d->>'customer_id')::uuid and archived_at is null) then raise exception 'invalid_customer' using errcode='23503';end if;
 if d->>'replacement_for_id' is not null and not exists(select 1 from public.checkouts where organization_id=p_org and branch_id=p_branch and id=(d->>'replacement_for_id')::uuid and status='reversed' and appointment_id is not distinct from a.id) then raise exception 'invalid_replacement' using errcode='23514';end if;
 insert into public.checkouts(organization_id,branch_id,appointment_id,customer_id,staff_id,currency,occurred_at,imported,description,replacement_for_id)
 values(p_org,p_branch,a.id,coalesce(a.customer_id,(d->>'customer_id')::uuid),a.staff_id,currency,p_when,p_import,left(d->>'description',500),(d->>'replacement_for_id')::uuid) returning id into c;
 if a.id is not null then
 insert into public.checkout_lines(organization_id,branch_id,checkout_id,service_id,staff_id,kind,name_snapshot,staff_name_snapshot,quantity,unit_price_minor,amount_minor,currency,metadata)
 select p_org,p_branch,c,aps.service_id,a.staff_id,'service',aps.name_snapshot,s.name,1,aps.price_minor,aps.price_minor,currency,jsonb_build_object('appointment_service_id',aps.id,'duration_minutes',aps.duration_minutes,'composition_mode',aps.composition_mode)
 from public.appointment_services aps join public.staff s on s.id=a.staff_id and s.organization_id=p_org where aps.organization_id=p_org and aps.appointment_id=a.id;
 else
 if jsonb_typeof(d->'lines') is distinct from 'array' or jsonb_array_length(d->'lines') not between 1 and 50 then raise exception 'checkout_lines_required' using errcode='22023';end if;
 for l in select value from jsonb_array_elements(d->'lines') loop
 v_staff:=(l->>'staff_id')::uuid;service:=(l->>'service_id')::uuid;item:=(l->>'item_id')::uuid;q:=coalesce((l->>'quantity')::integer,1);
 if v_staff is not null and not exists(select 1 from public.staff s join public.staff_branch_assignments x on x.organization_id=s.organization_id and x.staff_id=s.id where s.organization_id=p_org and s.id=v_staff and s.active and x.branch_id=p_branch and x.active) then raise exception 'invalid_staff' using errcode='23503';end if;
 price:=null;nm:=null;kind:=null;
 if service is not null then
 select s.name,bs.price_minor,'service' into nm,price,kind from public.services s join public.branch_services bs on bs.organization_id=s.organization_id and bs.service_id=s.id where s.organization_id=p_org and s.id=service and bs.branch_id=p_branch and s.active and bs.active;
 if not p_import and (v_staff is null or not exists(select 1 from public.staff_service_capabilities where organization_id=p_org and staff_id=v_staff and service_id=service)) then raise exception 'staff_capability_required' using errcode='23514';end if;
 elsif item is not null then select name,price_minor,i.kind into nm,price,kind from public.finance_items i where organization_id=p_org and id=item and active;
 else
 if not app_private.finance_access(p_org,p_branch,'report') or length(coalesce(l->>'reason',''))<3 then raise exception 'authorized_adjustment_required' using errcode='42501';end if;
 nm:=l->>'name';kind:='adjustment';end if;
 if p_import or price is null then
 if not p_import and (not app_private.finance_access(p_org,p_branch,'report') or length(coalesce(l->>'reason',''))<3) then raise exception 'authorized_price_required' using errcode='42501';end if;
 price:=app_private.finance_amount(coalesce(l->'unit_price_minor',l->'price_minor'));end if;
 if nm is null then raise exception 'catalog_item_required' using errcode='23503';end if;
 insert into public.checkout_lines(organization_id,branch_id,checkout_id,service_id,item_id,staff_id,kind,name_snapshot,staff_name_snapshot,quantity,unit_price_minor,amount_minor,currency,metadata)
 values(p_org,p_branch,c,service,item,v_staff,kind,nm,(select name from public.staff where organization_id=p_org and id=v_staff),q,price,price*q,currency,jsonb_build_object('reason',l->>'reason','historical_person_label',case when p_import then left(l->>'historical_person_label',120) else null end));
 end loop;end if;
 update public.checkouts set total_minor=(select sum(amount_minor) from public.checkout_lines where organization_id=p_org and checkout_id=c) where organization_id=p_org and id=c;
 return c;end $$;

create function app_private.finance_record_payment(p_org uuid,p_branch uuid,d jsonb,p_import boolean default false,p_when timestamptz default now()) returns uuid language plpgsql set search_path='' as $$
declare c public.checkouts;m public.payment_methods;f public.payment_method_fee_rules;amt bigint;fee bigint;session uuid;v uuid;begin
 select * into c from public.checkouts where organization_id=p_org and branch_id=p_branch and id=(d->>'checkout_id')::uuid for update;
 if c.id is null or c.status<>'draft' then raise exception 'draft_checkout_required' using errcode='23514';end if;
 amt:=app_private.finance_amount(d->'amount_minor');if amt<=0 then raise exception 'positive_payment_required' using errcode='23514';end if;
 if coalesce((select sum(amount_minor*direction) from public.payments where organization_id=p_org and checkout_id=c.id),0)+amt>c.total_minor then raise exception 'payment_exceeds_total' using errcode='23514';end if;
 select * into m from public.payment_methods where organization_id=p_org and id=(d->>'payment_method_id')::uuid and active;
 if m.id is null then raise exception 'invalid_payment_method' using errcode='23503';end if;
 select * into f from public.payment_method_fee_rules where organization_id=p_org and payment_method_id=m.id and active and effective_from<=p_when and (effective_to is null or effective_to>p_when);
 if f.id is null and not p_import then raise exception 'fee_rule_required' using errcode='23514';end if;
 if f.id is not null then fee:=app_private.finance_round(amt,f.percentage_bps,f.fixed_amount_minor);end if;
 if not p_import and m.type='cash' then session:=app_private.finance_session(p_org,p_branch,(d->>'cash_session_id')::uuid);
 elsif not p_import and d->>'cash_session_id' is not null then session:=app_private.finance_session(p_org,p_branch,(d->>'cash_session_id')::uuid);end if;
 insert into public.payments(organization_id,branch_id,checkout_id,payment_method_id,amount_minor,fee_minor,fee_rule_id,percentage_bps,fixed_amount_minor,fee_status,method_name_snapshot,method_type_snapshot,cash_session_id,occurred_at,reference)
 values(p_org,p_branch,c.id,m.id,amt,fee,f.id,f.percentage_bps,f.fixed_amount_minor,case when f.id is null then 'unknown' else 'known' end,m.name,m.type,session,p_when,d->>'reference') returning id into v;
 if m.type='cash' and not p_import then insert into public.cash_movements(organization_id,branch_id,cash_session_id,kind,amount_minor,payment_id,occurred_at) values(p_org,p_branch,session,'payment',amt,v,p_when);end if;
 return v;end $$;

create function app_private.finance_post_checkout(p_org uuid,p_branch uuid,p_id uuid,p_when timestamptz default now()) returns uuid language plpgsql set search_path='' as $$
declare c public.checkouts;r public.commission_rules;l public.checkout_lines;begin
 select * into c from public.checkouts where organization_id=p_org and branch_id=p_branch and id=p_id for update;
 if c.id is null or c.status<>'draft' then raise exception 'draft_checkout_required' using errcode='23514';end if;
 if coalesce((select sum(amount_minor*direction) from public.payments where organization_id=p_org and checkout_id=c.id),0)<>c.total_minor then raise exception 'checkout_not_fully_paid' using errcode='23514';end if;
 if c.appointment_id is not null and not exists(select 1 from public.appointments where organization_id=p_org and id=c.appointment_id and status='completed') then raise exception 'completed_appointment_required' using errcode='23514';end if;
 for l in select * from public.checkout_lines where organization_id=p_org and checkout_id=c.id and staff_id is not null loop
 r:=null;
 if l.service_id is not null then select * into r from public.commission_rules where organization_id=p_org and staff_id=l.staff_id and service_id=l.service_id and (branch_id is null or branch_id=p_branch) and active and effective_from<=p_when and (effective_to is null or effective_to>p_when) order by (branch_id is not null) desc limit 1;end if;
 insert into public.commission_entries(organization_id,branch_id,staff_id,service_id,checkout_id,checkout_line_id,rule_id,eligible_amount_minor,rate_bps,amount_minor,calculation_status,occurred_at,snapshot)
 values(p_org,p_branch,l.staff_id,l.service_id,c.id,l.id,r.id,l.amount_minor,r.rate_bps,case when r.id is null then null else app_private.finance_round(l.amount_minor,r.rate_bps) end,case when r.id is null then 'unknown' else 'known' end,p_when,jsonb_build_object('service_name',l.name_snapshot,'staff_name',l.staff_name_snapshot,'currency',c.currency,'rule',case when r.id is null then null else to_jsonb(r) end));
 end loop;
 update public.checkouts set status='posted',posted_at=p_when where organization_id=p_org and id=p_id;return p_id;end $$;

create function app_private.finance_create_expense(p_org uuid,p_branch uuid,d jsonb,p_kind text default 'operating',p_import boolean default false,p_when timestamptz default now()) returns uuid language plpgsql set search_path='' as $$
declare m public.payment_methods;cat public.expense_categories;amt bigint;v_staff uuid;session uuid;v uuid;begin
 select * into cat from public.expense_categories where organization_id=p_org and id=(d->>'category_id')::uuid and active and kind=p_kind;
 select * into m from public.payment_methods where organization_id=p_org and id=(d->>'payment_method_id')::uuid and active;
 if cat.id is null or m.id is null then raise exception 'invalid_financial_catalog' using errcode='23503';end if;
 v_staff:=(d->>'staff_id')::uuid;
 if (p_kind<>'operating' and v_staff is null) or (v_staff is not null and not exists(select 1 from public.staff s join public.staff_branch_assignments a on a.organization_id=s.organization_id and a.staff_id=s.id where s.organization_id=p_org and s.id=v_staff and s.active and a.branch_id=p_branch and a.active)) then raise exception 'invalid_staff' using errcode='23503';end if;
 amt:=app_private.finance_amount(d->'amount_minor');
 if not p_import and (m.type='cash' or d->>'cash_session_id' is not null) then session:=app_private.finance_session(p_org,p_branch,(d->>'cash_session_id')::uuid);end if;
 if m.type='cash' and not p_import and app_private.finance_expected(p_org,session)<amt then raise exception 'insufficient_cash' using errcode='23514';end if;
 insert into public.expenses(organization_id,branch_id,category_id,category_kind_snapshot,staff_id,vendor,description,amount_minor,payment_method_id,method_name_snapshot,method_type_snapshot,cash_session_id,currency,occurred_at,receipt_reference,imported)
 values(p_org,p_branch,cat.id,p_kind,v_staff,d->>'vendor',d->>'description',amt,m.id,m.name,m.type,session,(select currency from public.organizations where id=p_org),p_when,d->>'receipt_reference',p_import) returning id into v;
 if m.type='cash' and not p_import then insert into public.cash_movements(organization_id,branch_id,cash_session_id,kind,amount_minor,expense_id,occurred_at) values(p_org,p_branch,session,'expense',-amt,v,p_when);end if;
 if p_kind='advance' then insert into public.staff_advances(organization_id,branch_id,staff_id,expense_id,deductible,amount_minor,occurred_at) values(p_org,p_branch,v_staff,v,coalesce((d->>'deductible')::boolean,(select advances_deductible from public.finance_settings where organization_id=p_org),false),amt,p_when);
 elsif p_kind='salary' then insert into public.salary_payments(organization_id,branch_id,staff_id,expense_id,amount_minor,occurred_at) values(p_org,p_branch,v_staff,v,amt,p_when);end if;
 return v;end $$;

create function app_private.finance_reverse_payment(p_org uuid,p_branch uuid,p_id uuid,p_session uuid,p_reason text) returns uuid language plpgsql set search_path='' as $$
declare p public.payments;v uuid;s uuid;begin
 select * into p from public.payments where organization_id=p_org and branch_id=p_branch and id=p_id and direction=1;
 if p.id is null or exists(select 1 from public.payments where organization_id=p_org and reversal_of_id=p_id) then raise exception 'payment_already_reversed' using errcode='23514';end if;
 if p.method_type_snapshot='cash' then s:=app_private.finance_session(p_org,p_branch,p_session);if app_private.finance_expected(p_org,s)<p.amount_minor then raise exception 'insufficient_cash_for_refund' using errcode='23514';end if;end if;
 -- Processor fees are not assumed refundable. Original processing cost remains.
 insert into public.payments(organization_id,branch_id,checkout_id,payment_method_id,amount_minor,fee_minor,percentage_bps,fixed_amount_minor,fee_status,method_name_snapshot,method_type_snapshot,direction,reversal_of_id,cash_session_id,reference)
 values(p_org,p_branch,p.checkout_id,p.payment_method_id,p.amount_minor,0,0,0,'known',p.method_name_snapshot,p.method_type_snapshot,-1,p_id,s,left(p_reason,120)) returning id into v;
 if s is not null then insert into public.cash_movements(organization_id,branch_id,cash_session_id,kind,amount_minor,payment_id,reason) values(p_org,p_branch,s,'refund',-p.amount_minor,v,p_reason);end if;return v;end $$;

create function app_private.finance_command(p_org uuid,p_branch uuid,p_action text,p_data jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb:=p_data;v uuid;reply jsonb;before_data jsonb;after_data jsonb;actor uuid;req uuid:=app_private.request_id();t text;currency text;tz text;day date;amt bigint;expected bigint;actual bigint;rule_from timestamptz;v_staff uuid;c public.checkouts;s public.cash_sessions;e public.expenses;sett public.staff_settlements;r record;l record;left_advance bigint;accrued bigint;applied bigint:=0;adjustments bigint:=0;paid bigint;remaining bigint;session_id uuid;begin
 actor:=app_private.current_profile();
 if actor is null or not app_private.is_org_member(p_org) then raise exception 'forbidden' using errcode='42501';end if;
 if jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>65536 then raise exception 'invalid_payload' using errcode='22023';end if;
 if p_action in ('configure','configure_settings') then
 if not app_private.has_org_role(p_org,array['organization_owner','finance']) then raise exception 'forbidden' using errcode='42501';end if;
 else
 if not app_private.finance_access(p_org,p_branch,case when p_action in ('create_checkout','record_payment','post_checkout','open_cash_session','close_cash_session','create_expense') then 'operate' else 'report' end) then raise exception 'forbidden' using errcode='42501';end if;
 if not exists(select 1 from public.branches where organization_id=p_org and id=p_branch and active) then raise exception 'active_branch_required' using errcode='23514';end if;
 end if;
 perform app_private.lock_organization(p_org);
 reply:=app_private.idempotency_begin(p_org,actor::text,'finance.'||p_action,p_key,jsonb_build_object('branch',p_branch,'data',d));if reply is not null then return reply;end if;
 select o.currency,o.timezone into currency,tz from public.organizations o where o.id=p_org;
 if p_branch is not null then select b.timezone into tz from public.branches b where b.organization_id=p_org and b.id=p_branch;end if;day:=(now() at time zone tz)::date;

 case p_action
 when 'configure_settings' then
 insert into public.finance_settings(organization_id,advances_deductible) values(p_org,(d->>'advances_deductible')::boolean) on conflict(organization_id) do update set advances_deductible=excluded.advances_deductible returning id,to_jsonb(finance_settings.*) into v,after_data;
 when 'configure' then
 t:=d->>'entity';
 if t not in ('payment_methods','payment_method_fee_rules','commission_rules','finance_items','expense_categories') or t is null then raise exception 'invalid_finance_entity' using errcode='22023';end if;
 if d->>'id' is not null then
 if t in ('commission_rules','payment_method_fee_rules') then raise exception 'rules_are_versioned_create_new' using errcode='23514';end if;
 execute format('select to_jsonb(x) from public.%I x where organization_id=$1 and id=$2 for update',t) into before_data using p_org,(d->>'id')::uuid;
 if before_data is null then raise exception 'not_found' using errcode='P0002';end if;
 execute format('update public.%I set active=$1 where organization_id=$2 and id=$3 returning id,to_jsonb(%I.*)',t,t) into v,after_data using (d->>'active')::boolean,p_org,(d->>'id')::uuid;
 elsif t='payment_methods' then
 insert into public.payment_methods(organization_id,name,code,type) values(p_org,d->>'name',d->>'code',d->>'type') returning id,to_jsonb(payment_methods.*) into v,after_data;
 elsif t='finance_items' then
 insert into public.finance_items(organization_id,name,kind,price_minor) values(p_org,d->>'name',d->>'kind',case when d->'price_minor' is null or d->'price_minor'='null'::jsonb then null else app_private.finance_amount(d->'price_minor') end) returning id,to_jsonb(finance_items.*) into v,after_data;
 elsif t='expense_categories' then
 insert into public.expense_categories(organization_id,name,code,kind) values(p_org,d->>'name',d->>'code',d->>'kind') returning id,to_jsonb(expense_categories.*) into v,after_data;
 else
 rule_from:=coalesce((d->>'effective_from')::timestamptz,now());
 if rule_from<now()-interval '5 seconds' and length(coalesce(d->>'evidence_reference',''))<5 then raise exception 'historical_rule_requires_evidence' using errcode='23514';end if;
 if t='payment_method_fee_rules' then
 update public.payment_method_fee_rules set effective_to=rule_from where organization_id=p_org and payment_method_id=(d->>'payment_method_id')::uuid and active and effective_from<rule_from and (effective_to is null or effective_to>rule_from);
 insert into public.payment_method_fee_rules(organization_id,payment_method_id,percentage_bps,fixed_amount_minor,effective_from,effective_to,evidence_reference) values(p_org,(d->>'payment_method_id')::uuid,app_private.finance_amount(d->'percentage_bps')::integer,coalesce(app_private.finance_amount(coalesce(d->'fixed_amount_minor','0'::jsonb)),0),rule_from,(d->>'effective_to')::timestamptz,d->>'evidence_reference') returning id,to_jsonb(payment_method_fee_rules.*) into v,after_data;
 else
 update public.commission_rules set effective_to=rule_from where organization_id=p_org and staff_id=(d->>'staff_id')::uuid and service_id=(d->>'service_id')::uuid and branch_id is not distinct from p_branch and active and effective_from<rule_from and (effective_to is null or effective_to>rule_from);
 insert into public.commission_rules(organization_id,staff_id,service_id,branch_id,rate_bps,effective_from,effective_to,evidence_reference) values(p_org,(d->>'staff_id')::uuid,(d->>'service_id')::uuid,p_branch,app_private.finance_amount(d->'rate_bps')::integer,rule_from,(d->>'effective_to')::timestamptz,d->>'evidence_reference') returning id,to_jsonb(commission_rules.*) into v,after_data;
 end if;end if;
 when 'create_checkout' then v:=app_private.finance_create_checkout(p_org,p_branch,d);
 when 'record_payment' then v:=app_private.finance_record_payment(p_org,p_branch,d);
 when 'post_checkout' then
 if d?'payments' then
 if jsonb_typeof(d->'payments')<>'array' or jsonb_array_length(d->'payments')>20 then raise exception 'invalid_payments' using errcode='22023';end if;
 for l in select value as payload from jsonb_array_elements(d->'payments') loop perform app_private.finance_record_payment(p_org,p_branch,l.payload||jsonb_build_object('checkout_id',d->>'id'));end loop;
 end if;
 v:=app_private.finance_post_checkout(p_org,p_branch,(d->>'id')::uuid);
 when 'create_expense' then v:=app_private.finance_create_expense(p_org,p_branch,d);
 when 'record_staff_advance' then v:=app_private.finance_create_expense(p_org,p_branch,d,'advance');
 when 'record_salary_payment' then v:=app_private.finance_create_expense(p_org,p_branch,d,'salary');
 when 'open_cash_session','reopen_cash_session' then
 amt:=app_private.finance_amount(d->'opening_amount_minor');
 if p_action='reopen_cash_session' then
 select * into s from public.cash_sessions where organization_id=p_org and branch_id=p_branch and id=(d->>'id')::uuid and status='closed';
 if s.id is null or length(coalesce(d->>'reason',''))<3 or amt<>s.actual_cash_minor or s.local_date<>day then raise exception 'invalid_cash_reopening' using errcode='23514';end if;before_data:=to_jsonb(s);end if;
 insert into public.cash_sessions(organization_id,branch_id,register_code,local_date,currency,opening_amount_minor,reopened_from_id,reason)
 values(p_org,p_branch,coalesce(s.register_code,d->>'register_code','principal'),day,currency,amt,s.id,d->>'reason') returning id,to_jsonb(cash_sessions.*) into v,after_data;
 when 'record_cash_movement' then
 v:=app_private.finance_session(p_org,p_branch,(d->>'cash_session_id')::uuid);amt:=app_private.finance_amount(d->'amount_minor',true);
 if length(coalesce(d->>'reason',''))<3 or app_private.finance_expected(p_org,v)+amt<0 then raise exception 'invalid_cash_adjustment' using errcode='23514';end if;
 insert into public.cash_movements(organization_id,branch_id,cash_session_id,kind,amount_minor,reason) values(p_org,p_branch,v,'adjustment',amt,d->>'reason') returning id into v;
 when 'close_cash_session' then
 v:=app_private.finance_session(p_org,p_branch,(d->>'id')::uuid);select * into s from public.cash_sessions where organization_id=p_org and id=v;before_data:=to_jsonb(s);
 expected:=app_private.finance_expected(p_org,v);actual:=app_private.finance_amount(d->'actual_cash_minor');
 if expected<>actual and length(coalesce(d->>'reason',''))<3 then raise exception 'cash_difference_reason_required' using errcode='23514';end if;
 perform app_private.finance_rebuild_day(p_org,p_branch,s.local_date);
 after_data:=jsonb_build_object('financial',(select to_jsonb(m) from public.daily_financial_metrics m where organization_id=p_org and branch_id=p_branch and local_date=s.local_date),'payment_methods',(select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) from public.daily_payment_method_metrics m where organization_id=p_org and branch_id=p_branch and local_date=s.local_date),'expected_cash_minor',expected,'actual_cash_minor',actual,'difference_minor',actual-expected);
 update public.cash_sessions set status='closed',closed_at=now(),closed_by=actor,expected_cash_minor=expected,actual_cash_minor=actual,difference_minor=actual-expected,reason=d->>'reason',snapshot=after_data-'financial' where organization_id=p_org and id=v;
 insert into public.daily_closures(organization_id,branch_id,local_date,revision,cash_session_id,snapshot) values(p_org,p_branch,s.local_date,coalesce((select max(revision) from public.daily_closures where organization_id=p_org and branch_id=p_branch and local_date=s.local_date),0)+1,v,after_data);
 when 'create_staff_settlement' then
 v_staff:=(d->>'staff_id')::uuid;
 if not exists(select 1 from public.staff_branch_assignments where organization_id=p_org and branch_id=p_branch and staff_id=v_staff and active) or (d->>'period_end')::date<(d->>'period_start')::date or (d->>'period_end')::date>day then raise exception 'invalid_settlement_period' using errcode='23514';end if;
 if exists(select 1 from public.commission_entries ce where ce.organization_id=p_org and ce.branch_id=p_branch and ce.staff_id=v_staff and (ce.occurred_at at time zone tz)::date between (d->>'period_start')::date and (d->>'period_end')::date and ce.calculation_status='unknown' and not exists(select 1 from public.settlement_commission_entries where organization_id=p_org and commission_entry_id=ce.id)) then raise exception 'unknown_commission_cannot_be_settled' using errcode='23514';end if;
 select coalesce(sum(ce.amount_minor*ce.direction),0) into accrued from public.commission_entries ce where ce.organization_id=p_org and ce.branch_id=p_branch and ce.staff_id=v_staff and (ce.occurred_at at time zone tz)::date between (d->>'period_start')::date and (d->>'period_end')::date and not exists(select 1 from public.settlement_commission_entries where organization_id=p_org and commission_entry_id=ce.id);
 select coalesce(sum(amount_minor),0) into adjustments from public.financial_adjustments where organization_id=p_org and branch_id=p_branch and staff_id=v_staff and not exists(select 1 from public.settlement_adjustments sa where sa.organization_id=p_org and sa.adjustment_id=financial_adjustments.id) and (occurred_at at time zone tz)::date<=(d->>'period_end')::date;
 insert into public.staff_settlements(organization_id,branch_id,staff_id,period_start,period_end,commission_accrued_minor,adjustments_minor,remaining_balance_minor) values(p_org,p_branch,v_staff,(d->>'period_start')::date,(d->>'period_end')::date,accrued,adjustments,accrued+adjustments) returning id into v;
 insert into public.settlement_commission_entries(organization_id,branch_id,staff_id,settlement_id,commission_entry_id)
 select p_org,p_branch,v_staff,v,ce.id from public.commission_entries ce where ce.organization_id=p_org and ce.branch_id=p_branch and ce.staff_id=v_staff and (ce.occurred_at at time zone tz)::date between (d->>'period_start')::date and (d->>'period_end')::date and not exists(select 1 from public.settlement_commission_entries where organization_id=p_org and commission_entry_id=ce.id);
 insert into public.settlement_adjustments(organization_id,branch_id,staff_id,settlement_id,adjustment_id)
 select p_org,p_branch,v_staff,v,fa.id from public.financial_adjustments fa where fa.organization_id=p_org and fa.branch_id=p_branch and fa.staff_id=v_staff and (fa.occurred_at at time zone tz)::date<=(d->>'period_end')::date and not exists(select 1 from public.settlement_adjustments sa where sa.organization_id=p_org and sa.adjustment_id=fa.id);
 -- Allocations reserve an advance once, including drafts, so concurrent settlements cannot consume it twice.
 for r in select a.id,a.amount_minor-coalesce((select sum(amount_minor) from public.settlement_advances where organization_id=p_org and advance_id=a.id),0) available from public.staff_advances a join public.expenses ex on ex.organization_id=a.organization_id and ex.id=a.expense_id where a.organization_id=p_org and a.branch_id=p_branch and a.staff_id=v_staff and a.deductible and ex.status='posted' and (a.occurred_at at time zone tz)::date<=(d->>'period_end')::date order by a.occurred_at,a.id loop
 left_advance:=least(r.available,greatest(accrued+adjustments-applied,0));if left_advance>0 then insert into public.settlement_advances(organization_id,branch_id,staff_id,settlement_id,advance_id,amount_minor) values(p_org,p_branch,v_staff,v,r.id,left_advance);applied:=applied+left_advance;end if;end loop;
 update public.staff_settlements set advances_applied_minor=applied,remaining_balance_minor=accrued+adjustments-applied where organization_id=p_org and id=v;
 when 'review_staff_settlement','pay_staff_settlement','close_staff_settlement' then
 select * into sett from public.staff_settlements where organization_id=p_org and branch_id=p_branch and id=(d->>'id')::uuid for update;
 if sett.id is null then raise exception 'not_found' using errcode='P0002';end if;v:=sett.id;before_data:=to_jsonb(sett);
 if p_action='review_staff_settlement' and sett.status='draft' then update public.staff_settlements set status='reviewed',reviewed_at=now() where id=v;
 elsif p_action='pay_staff_settlement' and sett.status='reviewed' and sett.remaining_balance_minor>=0 then
 paid:=sett.remaining_balance_minor;
 if paid>0 then
 d:=d||jsonb_build_object('staff_id',sett.staff_id,'amount_minor',paid,'description','Liquidación de comisión '||sett.id);
 v:=app_private.finance_create_expense(p_org,p_branch,d,'commission_payment');end if;
 update public.staff_settlements set status='paid',paid_at=now(),commission_paid_minor=paid,remaining_balance_minor=0,expense_id=case when paid>0 then v else null end where id=sett.id;v:=sett.id;
 elsif p_action='close_staff_settlement' and sett.status='paid' then update public.staff_settlements set status='closed',closed_at=now() where id=v;
 else raise exception 'invalid_settlement_transition' using errcode='23514';end if;
 when 'record_financial_adjustment' then
 v_staff:=(d->>'staff_id')::uuid;amt:=app_private.finance_amount(d->'amount_minor',true);
 if not exists(select 1 from public.staff_branch_assignments where organization_id=p_org and branch_id=p_branch and staff_id=v_staff) then raise exception 'invalid_staff' using errcode='23503';end if;
 insert into public.financial_adjustments(organization_id,branch_id,staff_id,amount_minor,reason) values(p_org,p_branch,v_staff,amt,d->>'reason') returning id into v;
 when 'reverse_financial_transaction' then
 t:=d->>'entity_type';v:=(d->>'id')::uuid;
 if length(coalesce(d->>'reason',''))<3 then raise exception 'reversal_reason_required' using errcode='22023';end if;
 if t='checkout' then
 select * into c from public.checkouts where organization_id=p_org and branch_id=p_branch and id=v for update;
 if c.id is null or c.status not in ('draft','posted') then raise exception 'invalid_reversal' using errcode='23514';end if;before_data:=to_jsonb(c);
 for r in select id from public.payments p where organization_id=p_org and checkout_id=c.id and direction=1 and not exists(select 1 from public.payments where organization_id=p_org and reversal_of_id=p.id) order by id loop perform app_private.finance_reverse_payment(p_org,p_branch,r.id,(d->>'cash_session_id')::uuid,d->>'reason');end loop;
 if c.status='posted' then
 insert into public.commission_entries(organization_id,branch_id,staff_id,service_id,checkout_id,checkout_line_id,rule_id,eligible_amount_minor,rate_bps,amount_minor,calculation_status,direction,reversal_of_id,occurred_at,snapshot)
 select organization_id,branch_id,staff_id,service_id,checkout_id,checkout_line_id,rule_id,eligible_amount_minor,rate_bps,amount_minor,calculation_status,-1,id,now(),snapshot||jsonb_build_object('reason',d->>'reason') from public.commission_entries where organization_id=p_org and checkout_id=c.id and direction=1;
 update public.checkouts set status='reversed',reversed_at=now() where id=v;
 else update public.checkouts set status='voided' where id=v;end if;
 elsif t='payment' then
 if not exists(select 1 from public.payments p join public.checkouts x on x.organization_id=p.organization_id and x.id=p.checkout_id where p.organization_id=p_org and p.branch_id=p_branch and p.id=v and x.status='draft') then raise exception 'posted_payment_requires_checkout_reversal' using errcode='23514';end if;
 perform app_private.finance_reverse_payment(p_org,p_branch,v,(d->>'cash_session_id')::uuid,d->>'reason');
 elsif t='expense' then
 select * into e from public.expenses where organization_id=p_org and branch_id=p_branch and id=v and status='posted' for update;
 if e.id is null or e.category_kind_snapshot='commission_payment' then raise exception 'settlement_requires_audited_adjustment' using errcode='23514';end if;
 if exists(select 1 from public.staff_advances a join public.settlement_advances x on x.organization_id=a.organization_id and x.advance_id=a.id where a.organization_id=p_org and a.expense_id=v) then raise exception 'allocated_advance_requires_adjustment' using errcode='23514';end if;
 before_data:=to_jsonb(e);update public.expenses set status='reversed',reversed_at=now() where id=v;
 if e.method_type_snapshot='cash' then
 session_id:=app_private.finance_session(p_org,p_branch,(d->>'cash_session_id')::uuid);
 insert into public.cash_movements(organization_id,branch_id,cash_session_id,kind,amount_minor,expense_id,reason) values(p_org,p_branch,session_id,'expense_reversal',e.amount_minor,v,d->>'reason');end if;
 else raise exception 'invalid_reversal_type' using errcode='22023';end if;
 insert into public.financial_reversals(organization_id,branch_id,entity_type,entity_id,reason) values(p_org,p_branch,t,v,d->>'reason');
 else raise exception 'unknown_finance_action' using errcode='22023';end case;

 if p_branch is not null then perform app_private.finance_rebuild_day(p_org,p_branch,day);end if;
 reply:=jsonb_build_object('id',v,'action',p_action);
 if p_action='close_cash_session' then reply:=reply||(after_data-'financial');end if;
 perform app_private.record_audit(p_org,p_branch,'finance.'||p_action,coalesce(t,p_action),v,jsonb_build_object('before',before_data,'after',coalesce(after_data,reply),'reason',d->>'reason'),req);
 -- Sensitive finance events do not enqueue notifications for reception or unrelated barbers.
 insert into public.domain_events(organization_id,branch_id,entity_id,event_type,payload,request_id) values(p_org,p_branch,v,'finance.'||p_action,jsonb_build_object('action',p_action),req);
 return app_private.idempotency_finish(p_org,actor::text,'finance.'||p_action,p_key,reply);
end $$;

create function public.finance_command(p_org uuid,p_branch uuid,p_action text,p_data jsonb,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.finance_command($1,$2,$3,$4,$5) $$;
revoke all on function public.finance_command(uuid,uuid,text,jsonb,uuid),app_private.finance_command(uuid,uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.finance_command(uuid,uuid,text,jsonb,uuid),app_private.finance_command(uuid,uuid,text,jsonb,uuid) to authenticated;
do $$declare action text;begin
 foreach action in array array['create_checkout','record_payment','post_checkout','create_expense','open_cash_session','close_cash_session','reopen_cash_session','record_cash_movement','record_staff_advance','record_salary_payment','create_staff_settlement','review_staff_settlement','pay_staff_settlement','close_staff_settlement','record_financial_adjustment','reverse_financial_transaction'] loop
 execute format('create function public.%I(p_org uuid,p_branch uuid,p_data jsonb,p_key uuid) returns jsonb language sql security invoker set search_path='''' as $body$ select app_private.finance_command($1,$2,%L,$3,$4) $body$',action,action);
 execute format('revoke all on function public.%I(uuid,uuid,jsonb,uuid) from public,anon,authenticated',action);
 execute format('grant execute on function public.%I(uuid,uuid,jsonb,uuid) to authenticated',action);end loop;end $$;
revoke all on function app_private.finance_amount(jsonb,boolean),app_private.finance_round(bigint,integer,bigint),app_private.finance_session(uuid,uuid,uuid),app_private.finance_expected(uuid,uuid),app_private.finance_rebuild_day(uuid,uuid,date),app_private.finance_create_checkout(uuid,uuid,jsonb,boolean,timestamptz),app_private.finance_record_payment(uuid,uuid,jsonb,boolean,timestamptz),app_private.finance_post_checkout(uuid,uuid,uuid,timestamptz),app_private.finance_create_expense(uuid,uuid,jsonb,text,boolean,timestamptz),app_private.finance_reverse_payment(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
