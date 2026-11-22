-- =====================================================================
-- Item API: search function  (run THIRD, after schema.sql and seed.sql)
--
-- The search runs inside PostgreSQL instead of in Python. The text the user
-- types is passed in as a parameter, never pasted into the SQL, so the query
-- cannot be altered by what the user types (no SQL injection).
--
-- It searches the same fields the old in-memory API searched: name, price,
-- category, description and every stat.
-- =====================================================================

create or replace function public.search_items(q text)
returns setof public.items
language sql
stable
security invoker          -- runs as the caller, so Row Level Security still applies
set search_path = public
as $$
  select i.*
  from public.items i
  join public.categories c on c.id = i.category_id     -- the one-to-many relationship
  where concat_ws(' ',
          i.name,
          i.price::text,
          c.name,
          coalesce(i.description, ''),
          i.attack_damage::text,
          i.ability_power::text,
          i.attack_speed::text,
          i.health::text,
          i.mana::text,
          i.armor::text,
          i.magic_resist::text,
          i.crit_chance::text,
          i.ability_haste::text,
          i.movement_speed::text,
          i.life_steal::text,
          i.armor_penetration::text,
          i.magic_penetration::text,
          i.tenacity::text,
          i.omnivamp::text
        )
        -- % and _ are wildcards in ILIKE, so escape them in whatever the user typed
        ilike '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by i.id;
$$;

-- Least privilege: nobody may run it unless explicitly granted.
revoke all on function public.search_items(text) from public;
grant execute on function public.search_items(text) to anon, authenticated, service_role;