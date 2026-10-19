update public.menu_categories c
set space_id = i.space_id
from (
  select category_id, min(space_id::text)::uuid as space_id
  from public.menu_items
  where category_id is not null and space_id is not null
  group by category_id
  having count(distinct space_id)=1
) i
where c.id=i.category_id and c.space_id is null;

update public.menu_categories c
set space_id = s.id
from public.menu_spaces s
where c.space_id is null
  and c.business_id=s.business_id
  and s.kind='directory'
  and (select count(*) from public.menu_spaces sx where sx.business_id=c.business_id and sx.kind='directory')=1;
