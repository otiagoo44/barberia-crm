-- New organizations inherit the product identity. Existing custom brands stay intact.
-- Metadata-only default change: no row rewrite, grants, policies or financial changes.
alter table public.organizations alter column brand_color set default '#D7B56D';
