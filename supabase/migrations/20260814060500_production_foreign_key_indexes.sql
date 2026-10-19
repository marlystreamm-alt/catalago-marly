create index if not exists directory_menu_requests_menu_business_idx on public.directory_menu_requests(menu_business_id);
create index if not exists menu_categories_parent_idx on public.menu_categories(parent_id);
create index if not exists menu_categories_space_idx on public.menu_categories(space_id, sort_index);
create index if not exists menu_items_space_idx on public.menu_items(space_id, sort_index);
