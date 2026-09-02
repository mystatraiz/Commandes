-- ============================================================
-- Forge — base personnelle (jeûne, poids, sport)
-- À coller dans Supabase : menu « SQL Editor », puis « Run ».
--
-- Conçu pour s'installer dans le projet Supabase déjà utilisé par le grill :
-- la table est préfixée pour éviter toute collision, et chaque ligne
-- n'est visible que par le compte qui l'a créée. Le compte du restaurant
-- ne voit donc rien ici, et réciproquement.
-- ============================================================

create table if not exists public.forge_entrees (
  id        text primary key,                       -- généré sur l'appareil
  user_id   uuid not null default auth.uid(),       -- posé par la base, jamais par l'appareil
  type      text not null,                          -- poids | jeune | sport | reglages
  jour      date,                                   -- journée de rattachement (poids, sport)
  debut     timestamptz,                            -- jeûne / session : début
  fin       timestamptz,                            -- jeûne / session : fin (null tant qu'en cours)
  donnees   jsonb not null default '{}'::jsonb,     -- le détail propre à chaque type
  supprime  boolean not null default false,         -- suppression logique, pour qu'elle se propage
  maj_a     timestamptz not null default now(),     -- arbitre les modifications concurrentes
  constraint forge_type_valide check (type in ('poids', 'jeune', 'sport', 'reglages'))
);

create index if not exists forge_entrees_user_maj_idx on public.forge_entrees (user_id, maj_a);
create index if not exists forge_entrees_user_type_idx on public.forge_entrees (user_id, type, jour);

-- maj_a et user_id sont posés par la base : une horloge déréglée ou une
-- requête bricolée ne peuvent ni fausser l'arbitrage ni écrire pour autrui.
create or replace function public.forge_touch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.maj_a := now();
  if tg_op = 'INSERT' then
    new.user_id := coalesce(auth.uid(), new.user_id);
  else
    new.user_id := old.user_id;
  end if;
  return new;
end $$;

drop trigger if exists forge_entrees_touch on public.forge_entrees;
create trigger forge_entrees_touch
  before insert or update on public.forge_entrees
  for each row execute function public.forge_touch();

-- ------------------------------------------------------------
-- Chacun ne voit que ses propres entrées.
-- ------------------------------------------------------------
alter table public.forge_entrees enable row level security;

drop policy if exists forge_entrees_acces on public.forge_entrees;
create policy forge_entrees_acces on public.forge_entrees
  for all
  to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- Temps réel : un poids saisi sur le téléphone apparaît sur la tablette.
-- ------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.forge_entrees;
exception
  when duplicate_object then null;
end $$;

alter table public.forge_entrees replica identity full;
