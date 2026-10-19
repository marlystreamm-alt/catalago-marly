-- v20.45 Mercadito
alter table public.menu_items add column if not exists item_condition text not null default 'new';
alter table public.menu_items drop constraint if exists menu_items_item_condition_check;
alter table public.menu_items add constraint menu_items_item_condition_check check (item_condition in ('new','used'));
-- menu_spaces.kind is text in current schema; no destructive change required.
