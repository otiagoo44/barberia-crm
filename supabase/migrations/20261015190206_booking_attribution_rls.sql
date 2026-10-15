-- Internal idempotency ledger: gateway helpers run as its owner; browser roles
-- remain denied by schema/table grants and now also by deny-by-default RLS.
alter table app_private.booking_attributions enable row level security;
