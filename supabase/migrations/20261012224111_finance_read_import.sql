create function app_private.finance_read(p_org uuid,p_branch uuid,p_view text,p_from date,p_to date,p_limit integer default 50,p_offset integer default 0,p_query text default '',p_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;tz text;lo timestamptz;hi timestamptz;own uuid;report boolean;op boolean;begin
 if p_branch is null or not app_private.is_org_member(p_org) or p_limit not between 1 and 100 or p_offset not between 0 and 100000 or p_to<p_from or p_to-p_from>3660 or length(p_query)>80 then raise exception 'invalid_finance_query' using errcode='22023';end if;
 report:=app_private.finance_access(p_org,p_branch,'report');op:=app_private.finance_access(p_org,p_branch,'operate');own:=app_private.current_staff_id(p_org);
 if not report and not op and (own is null or not app_private.can_access_branch(p_org,p_branch)) then raise exception 'forbidden' using errcode='42501';end if;
 select timezone into tz from public.branches where organization_id=p_org and id=p_branch;
 lo:=p_from::timestamp at time zone tz;hi:=(p_to+1)::timestamp at time zone tz;
 case p_view
 when 'catalog' then
 return jsonb_build_object('payment_methods',(select coalesce(jsonb_agg(to_jsonb(m) order by m.name),'[]') from public.payment_methods m where organization_id=p_org and active),
 'items',(select coalesce(jsonb_agg(to_jsonb(m) order by m.name),'[]') from public.finance_items m where organization_id=p_org and active),
 'categories',(select coalesce(jsonb_agg(to_jsonb(m) order by m.name),'[]') from public.expense_categories m where organization_id=p_org and active and (report or kind='operating')),
 'staff',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name),'[]') from public.staff s join public.staff_branch_assignments a on a.organization_id=s.organization_id and a.staff_id=s.id where s.organization_id=p_org and a.branch_id=p_branch and a.active and s.active and (op or s.id=own)),
 'services',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'price_minor',b.price_minor) order by s.name),'[]') from public.services s join public.branch_services b on b.organization_id=s.organization_id and b.service_id=s.id where s.organization_id=p_org and b.branch_id=p_branch and b.active and s.active),
 'fee_rules',case when app_private.has_org_role(p_org,array['organization_owner','finance']) then (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.payment_method_fee_rules r where organization_id=p_org and (effective_to is null or effective_to>now())) else '[]'::jsonb end,
 'commission_rules',case when report then (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.commission_rules r where organization_id=p_org and (branch_id is null or branch_id=p_branch) and (effective_to is null or effective_to>now()) and (app_private.has_org_role(p_org,array['organization_owner','finance']) or exists(select 1 from public.staff_branch_assignments a where a.organization_id=p_org and a.branch_id=p_branch and a.staff_id=r.staff_id and a.active))) else '[]'::jsonb end,
 'settings',case when app_private.has_org_role(p_org,array['organization_owner','finance']) then (select to_jsonb(r) from public.finance_settings r where organization_id=p_org) else null end);
 when 'checkout' then
 if not op then raise exception 'forbidden' using errcode='42501';end if;
 return (select to_jsonb(c)||jsonb_build_object('lines',(select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at,l.id),'[]') from public.checkout_lines l where organization_id=p_org and checkout_id=c.id),'payments',(select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at,p.id),'[]') from public.payments p where organization_id=p_org and checkout_id=c.id),'paid_minor',(select coalesce(sum(amount_minor*direction),0) from public.payments where organization_id=p_org and checkout_id=c.id)) from public.checkouts c where c.organization_id=p_org and c.branch_id=p_branch and (c.id=p_id or c.appointment_id=p_id) order by c.created_at desc limit 1);
 when 'cash' then
 if not op then raise exception 'forbidden' using errcode='42501';end if;
 return jsonb_build_object('session',(select to_jsonb(s)||jsonb_build_object('expected_cash_minor',case when status='closed' then expected_cash_minor else app_private.finance_expected(p_org,s.id) end,'opened_by',(select full_name from public.profiles where id=s.created_by)) from public.cash_sessions s where organization_id=p_org and branch_id=p_branch order by opened_at desc limit 1),
 'methods',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'gross_minor',coalesce((select sum(amount_minor*direction) from public.payments p where p.organization_id=p_org and p.branch_id=p_branch and p.payment_method_id=m.id and p.occurred_at>=lo and p.occurred_at<hi),0),'fee_minor',coalesce((select sum(fee_minor) from public.payments p where p.organization_id=p_org and p.branch_id=p_branch and p.payment_method_id=m.id and p.occurred_at>=lo and p.occurred_at<hi),0)) order by m.name),'[]') from public.payment_methods m where organization_id=p_org),
 'expenses_minor',coalesce((select sum(amount_minor) from public.expenses where organization_id=p_org and branch_id=p_branch and status='posted' and occurred_at>=lo and occurred_at<hi),0),
 'pending',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select c.id,c.appointment_id,c.total_minor,c.description,c.occurred_at,c.customer_id,(select name from public.customers where organization_id=p_org and id=c.customer_id) customer_name from public.checkouts c where c.organization_id=p_org and c.branch_id=p_branch and c.status='draft' order by c.occurred_at desc limit 50)x));
 when 'summary' then
 if not report and own is null then raise exception 'forbidden' using errcode='42501';end if;
 if not report then return jsonb_build_object('staff_only',true,'staff',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.daily_staff_financial_metrics m where organization_id=p_org and branch_id=p_branch and staff_id=own and local_date between p_from and p_to));end if;
 with sums as(select coalesce(sum(gross_revenue_minor),0) gross_revenue_minor,coalesce(sum(collected_minor),0) collected_minor,coalesce(sum(refunds_minor),0) refunds_minor,coalesce(sum(expenses_minor),0) expenses_minor,coalesce(sum(operating_expenses_minor),0) operating_expenses_minor,coalesce(sum(payment_processing_fees_minor),0) payment_processing_fees_minor,coalesce(sum(barber_commissions_minor),0) barber_commissions_minor,coalesce(sum(paid_checkouts),0) paid_checkouts,coalesce(sum(unknown_fees),0) unknown_fees,coalesce(sum(unknown_commissions),0) unknown_commissions from public.daily_financial_metrics where organization_id=p_org and branch_id=p_branch and local_date between p_from and p_to)
 select to_jsonb(s)||jsonb_build_object('net_revenue_minor',gross_revenue_minor-payment_processing_fees_minor,'operating_result_minor',case when unknown_fees+unknown_commissions=0 then gross_revenue_minor-payment_processing_fees_minor-operating_expenses_minor-barber_commissions_minor else null end,'average_ticket_minor',case when paid_checkouts=0 then null else gross_revenue_minor/paid_checkouts end) into result from sums s;
 return jsonb_build_object('totals',result||jsonb_build_object('unique_customers',(select count(distinct customer_id) from public.checkouts where organization_id=p_org and branch_id=p_branch and posted_at>=lo and posted_at<hi),
 'average_customers_per_day',(select round(coalesce(sum(count_customers),0)::numeric/(p_to-p_from+1),2) from(select count(distinct customer_id) count_customers from public.appointments where organization_id=p_org and branch_id=p_branch and status='completed' and starts_at>=lo and starts_at<hi group by (starts_at at time zone tz)::date)x),
 'top_payment_method',(select pm.name from public.daily_payment_method_metrics m join public.payment_methods pm on pm.organization_id=m.organization_id and pm.id=m.payment_method_id where m.organization_id=p_org and m.branch_id=p_branch and m.local_date between p_from and p_to group by pm.id,pm.name having sum(m.gross_received_minor)>0 order by sum(m.gross_received_minor) desc,pm.name limit 1),
 'completed_visits',(select count(*) from public.appointments where organization_id=p_org and branch_id=p_branch and status='completed' and starts_at>=lo and starts_at<hi),
 'production_minor',(select coalesce(sum(price_minor),0) from public.appointments where organization_id=p_org and branch_id=p_branch and status='completed' and starts_at>=lo and starts_at<hi),
 'pending_minor',(select coalesce(sum(greatest(c.total_minor-coalesce((select sum(amount_minor*direction) from public.payments where organization_id=p_org and checkout_id=c.id),0),0)),0) from public.checkouts c where organization_id=p_org and branch_id=p_branch and status='draft')+(select coalesce(sum(a.price_minor),0) from public.appointments a where a.organization_id=p_org and a.branch_id=p_branch and a.status='completed' and not exists(select 1 from public.checkouts where organization_id=p_org and appointment_id=a.id and status in ('draft','posted')))),
 'methods',(select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('name',(select name from public.payment_methods where organization_id=p_org and id=m.payment_method_id))),'[]') from public.daily_payment_method_metrics m where organization_id=p_org and branch_id=p_branch and local_date between p_from and p_to),
 'staff',(select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('name',(select name from public.staff where organization_id=p_org and id=m.staff_id))),'[]') from public.daily_staff_financial_metrics m where organization_id=p_org and branch_id=p_branch and local_date between p_from and p_to),
 'service_mix',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select l.service_id,l.name_snapshot,sum(l.quantity) quantity,sum(l.amount_minor) gross_minor from public.checkout_lines l join public.checkouts c on c.organization_id=l.organization_id and c.id=l.checkout_id where l.organization_id=p_org and l.branch_id=p_branch and c.status='posted' and c.posted_at>=lo and c.posted_at<hi group by l.service_id,l.name_snapshot order by sum(l.amount_minor) desc limit 50)x));
 when 'movements','expenses','settlements','closures','staff' then
 if p_view='staff' then
 if not report and p_id is distinct from own then raise exception 'forbidden' using errcode='42501';end if;
 return jsonb_build_object('staff_id',p_id,'commission_minor',(select coalesce(sum(amount_minor*direction),0) from public.commission_entries where organization_id=p_org and branch_id=p_branch and staff_id=p_id),
 'advances_minor',(select coalesce(sum(a.amount_minor),0) from public.staff_advances a join public.expenses e on e.organization_id=a.organization_id and e.id=a.expense_id where a.organization_id=p_org and a.branch_id=p_branch and a.staff_id=p_id and e.status='posted'),
 'applied_advances_minor',(select coalesce(sum(amount_minor),0) from public.settlement_advances where organization_id=p_org and branch_id=p_branch and staff_id=p_id),
 'paid_commission_minor',(select coalesce(sum(commission_paid_minor),0) from public.staff_settlements where organization_id=p_org and branch_id=p_branch and staff_id=p_id),
 'salary_minor',(select coalesce(sum(s.amount_minor),0) from public.salary_payments s join public.expenses e on e.organization_id=s.organization_id and e.id=s.expense_id where s.organization_id=p_org and s.branch_id=p_branch and s.staff_id=p_id and e.status='posted'),
 'adjustments_minor',(select coalesce(sum(amount_minor),0) from public.financial_adjustments where organization_id=p_org and branch_id=p_branch and staff_id=p_id),
 'pending_commission_minor',(select coalesce(sum(amount_minor*direction),0) from public.commission_entries where organization_id=p_org and branch_id=p_branch and staff_id=p_id)-(select coalesce(sum(amount_minor),0) from public.settlement_advances where organization_id=p_org and branch_id=p_branch and staff_id=p_id)-(select coalesce(sum(commission_paid_minor),0) from public.staff_settlements where organization_id=p_org and branch_id=p_branch and staff_id=p_id)+(select coalesce(sum(amount_minor),0) from public.financial_adjustments where organization_id=p_org and branch_id=p_branch and staff_id=p_id),
 'unknown_commissions',(select count(*) from public.commission_entries where organization_id=p_org and branch_id=p_branch and staff_id=p_id and calculation_status='unknown'),
 'items',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select * from public.commission_entries where organization_id=p_org and branch_id=p_branch and staff_id=p_id order by occurred_at desc,id desc limit p_limit offset p_offset)x));end if;
 if not report then raise exception 'forbidden' using errcode='42501';end if;
 if p_view='movements' then
 return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(
 select * from(
 select c.id,c.posted_at occurred_at,'sale' kind,c.description,c.status,c.total_minor gross_minor,c.customer_id,null::text vendor,
 (select name from public.customers where organization_id=p_org and id=c.customer_id) person,
 (select string_agg(name_snapshot,' + ') from public.checkout_lines where organization_id=p_org and checkout_id=c.id) concept,
 (select coalesce(sum(fee_minor),0) from public.payments where organization_id=p_org and checkout_id=c.id) fee_minor,
 (select sum(amount_minor*direction) from public.commission_entries where organization_id=p_org and checkout_id=c.id) commission_minor,
 (select string_agg(distinct method_name_snapshot,', ') from public.payments where organization_id=p_org and checkout_id=c.id) payment_method
 from public.checkouts c where organization_id=p_org and branch_id=p_branch and posted_at>=lo and posted_at<hi
 union all select e.id,e.occurred_at,e.category_kind_snapshot,e.description,e.status,-e.amount_minor,null,e.vendor,e.vendor,e.description,0,0,e.method_name_snapshot from public.expenses e where organization_id=p_org and branch_id=p_branch and occurred_at>=lo and occurred_at<hi
 ) rows where p_query='' or strpos(lower(coalesce(person,'')||' '||coalesce(concept,'')||' '||coalesce(description,'')),lower(p_query))>0 order by occurred_at desc,id desc limit p_limit offset p_offset)x),'offset',p_offset,'limit',p_limit);
 elsif p_view='expenses' then select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from(select * from public.expenses where organization_id=p_org and branch_id=p_branch and occurred_at>=lo and occurred_at<hi and (p_query='' or strpos(lower(description||' '||coalesce(vendor,'')),lower(p_query))>0) order by occurred_at desc,id desc limit p_limit offset p_offset)x;
 elsif p_view='settlements' then select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from(select s.*,(select name from public.staff where organization_id=p_org and id=s.staff_id) staff_name from public.staff_settlements s where organization_id=p_org and branch_id=p_branch and period_end>=p_from and period_start<=p_to order by created_at desc,id desc limit p_limit offset p_offset)x;
 else select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from(select * from public.daily_closures where organization_id=p_org and branch_id=p_branch and local_date between p_from and p_to order by local_date desc,revision desc limit p_limit offset p_offset)x;end if;
 return jsonb_build_object('items',result,'offset',p_offset,'limit',p_limit);
 else raise exception 'unknown_finance_view' using errcode='22023';end case;
end $$;
create function public.finance_read(p_org uuid,p_branch uuid,p_view text,p_from date,p_to date,p_limit integer default 50,p_offset integer default 0,p_query text default '',p_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select app_private.finance_read($1,$2,$3,$4,$5,$6,$7,$8,$9) $$;
revoke all on function public.finance_read(uuid,uuid,text,date,date,integer,integer,text,uuid),app_private.finance_read(uuid,uuid,text,date,date,integer,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.finance_read(uuid,uuid,text,date,date,integer,integer,text,uuid),app_private.finance_read(uuid,uuid,text,date,date,integer,integer,text,uuid) to authenticated;

create function app_private.financial_export(p_org uuid,p_branch uuid,p_view text,p_from date,p_to date) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb:='[]';page jsonb;off integer:=0;begin
 if not app_private.has_org_role(p_org,array['organization_owner','finance']) or p_view not in ('movements','expenses','settlements','closures') then raise exception 'forbidden' using errcode='42501';end if;
 loop page:=app_private.finance_read(p_org,p_branch,p_view,p_from,p_to,100,off,'',null)->'items';result:=result||page;exit when jsonb_array_length(page)<100;off:=off+100;if off>=10000 then raise exception 'export_too_large_select_smaller_range' using errcode='22023';end if;end loop;
 perform app_private.record_audit(p_org,p_branch,'finance.export',p_view,null,jsonb_build_object('from',p_from,'to',p_to,'rows',jsonb_array_length(result)),app_private.request_id());return result;end $$;
create function public.financial_export(p_org uuid,p_branch uuid,p_view text,p_from date,p_to date) returns jsonb language sql security invoker set search_path='' as $$select app_private.financial_export($1,$2,$3,$4,$5)$$;
revoke all on function app_private.financial_export(uuid,uuid,text,date,date),public.financial_export(uuid,uuid,text,date,date) from public,anon,authenticated;
grant execute on function app_private.financial_export(uuid,uuid,text,date,date),public.financial_export(uuid,uuid,text,date,date) to authenticated;

create function app_private.finance_import(p_org uuid,p_branch uuid,p_action text,p_data jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=app_private.current_profile();reply jsonb;batch public.finance_import_batches;r public.finance_import_rows;row_data jsonb;v uuid;payment uuid;when_at timestamptz;tz text;hash text;count_rows integer:=0;days date[]:='{}';day date;begin
 if actor is null or not app_private.has_org_role(p_org,array['organization_owner','finance']) or not exists(select 1 from public.branches where organization_id=p_org and id=p_branch and active) then raise exception 'forbidden' using errcode='42501';end if;
 if p_action not in ('preview','confirm') then raise exception 'invalid_import_action' using errcode='22023';end if;
 perform app_private.lock_organization(p_org);
 reply:=app_private.idempotency_begin(p_org,actor::text,'finance.import.'||p_action,p_key,jsonb_build_object('branch',p_branch,'data',p_data));if reply is not null then return reply;end if;
 select timezone into tz from public.branches where organization_id=p_org and id=p_branch;
 if p_action='preview' then
 if jsonb_typeof(p_data->'rows')<>'array' or jsonb_array_length(p_data->'rows') not between 1 and 1500 or octet_length(p_data::text)>2000000 then raise exception 'invalid_import_size' using errcode='22023';end if;
 select * into batch from public.finance_import_batches where organization_id=p_org and source_sha256=p_data->>'source_sha256';
 if batch.status='imported' then raise exception 'source_already_imported' using errcode='23505';end if;
 hash:=encode(extensions.digest((p_data->'rows')::text,'sha256'),'hex');
 if batch.id is null then
 insert into public.finance_import_batches(organization_id,branch_id,source_file,source_sha256,mapping,preview_hash) values(p_org,p_branch,p_data->>'source_file',p_data->>'source_sha256',coalesce(p_data->'mapping','{}'),hash) returning * into batch;
 else
 if batch.branch_id<>p_branch then raise exception 'source_branch_mismatch' using errcode='23514';end if;
 update public.finance_import_batches set mapping=coalesce(p_data->'mapping','{}'),preview_hash=hash where id=batch.id;
 end if;
 for row_data in select value from jsonb_array_elements(p_data->'rows') loop
 if row_data->>'review_status' not in ('READY','NEEDS_REVIEW','EXCLUDED') then raise exception 'invalid_review_status' using errcode='22023';end if;
 insert into public.finance_import_rows(organization_id,branch_id,batch_id,source_sheet,source_row,raw_values,normalized,anomalies,review_status)
 values(p_org,p_branch,batch.id,row_data->>'source_sheet',(row_data->>'source_row')::integer,row_data->'raw_values',row_data->'normalized',row_data->'anomalies',row_data->>'review_status')
 on conflict(organization_id,batch_id,source_sheet,source_row) do update set raw_values=excluded.raw_values,normalized=excluded.normalized,anomalies=excluded.anomalies,review_status=excluded.review_status;
 end loop;
 reply:=jsonb_build_object('id',batch.id,'preview_hash',hash,'rows',(select jsonb_agg(to_jsonb(x) order by source_row) from public.finance_import_rows x where organization_id=p_org and batch_id=batch.id));
 else
 select * into batch from public.finance_import_batches where organization_id=p_org and branch_id=p_branch and id=(p_data->>'id')::uuid for update;
 if batch.id is null or batch.status<>'preview' or batch.preview_hash<>p_data->>'preview_hash' then raise exception 'preview_changed' using errcode='23514';end if;
 if exists(select 1 from public.finance_import_rows where organization_id=p_org and batch_id=batch.id and review_status='NEEDS_REVIEW') then raise exception 'unresolved_import_anomalies' using errcode='23514';end if;
 for r in select * from public.finance_import_rows where organization_id=p_org and batch_id=batch.id and review_status='READY' order by source_row loop
 when_at:=((r.normalized->>'date')::date+time '12:00') at time zone tz;
 if when_at>now() then raise exception 'future_historical_movement' using errcode='23514';end if;
 row_data:=r.normalized||jsonb_build_object('description',coalesce(nullif(r.normalized->>'concept',''),'Importación histórica'),'vendor',r.normalized->>'person_label','amount_minor',r.normalized->'amount_minor');
 if row_data->>'type'='income' then
 v:=app_private.finance_create_checkout(p_org,p_branch,jsonb_build_object('description',row_data->>'concept','lines',jsonb_build_array(jsonb_build_object('service_id',row_data->'service_id','item_id',row_data->'item_id','staff_id',row_data->'staff_id','price_minor',row_data->'amount_minor','historical_person_label',row_data->>'person_label','quantity',1))),true,when_at);
 payment:=app_private.finance_record_payment(p_org,p_branch,jsonb_build_object('checkout_id',v,'payment_method_id',row_data->'payment_method_id','amount_minor',row_data->'amount_minor','reference','import:'||batch.id),true,when_at);
 perform app_private.finance_post_checkout(p_org,p_branch,v,when_at);
 update public.finance_import_rows set review_status='IMPORTED',checkout_id=v where id=r.id;
 elsif row_data->>'type'='expense' then
 v:=app_private.finance_create_expense(p_org,p_branch,row_data,coalesce(row_data->>'category_kind','operating'),true,when_at);
 update public.finance_import_rows set review_status='IMPORTED',expense_id=v where id=r.id;
 else raise exception 'invalid_movement_type' using errcode='22023';end if;
 days:=array_append(days,(when_at at time zone tz)::date);count_rows:=count_rows+1;
 end loop;
 for day in select distinct unnest(days) loop perform app_private.finance_rebuild_day(p_org,p_branch,day);end loop;
 update public.finance_import_batches set status='imported',imported_at=now() where id=batch.id;
 reply:=jsonb_build_object('id',batch.id,'imported_rows',count_rows);
 end if;
 perform app_private.record_audit(p_org,p_branch,'finance.import.'||p_action,'finance_import_batches',batch.id,jsonb_build_object('source_sha256',batch.source_sha256,'rows',case when p_action='preview' then jsonb_array_length(p_data->'rows') else count_rows end),app_private.request_id());
 return app_private.idempotency_finish(p_org,actor::text,'finance.import.'||p_action,p_key,reply);
end $$;
create function public.finance_import(p_org uuid,p_branch uuid,p_action text,p_data jsonb,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select app_private.finance_import($1,$2,$3,$4,$5)$$;
revoke all on function public.finance_import(uuid,uuid,text,jsonb,uuid),app_private.finance_import(uuid,uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.finance_import(uuid,uuid,text,jsonb,uuid),app_private.finance_import(uuid,uuid,text,jsonb,uuid) to authenticated;
