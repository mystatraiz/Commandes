-- ============================================================
-- Grill — schéma de la base partagée
-- À coller dans Supabase : menu « SQL Editor », puis « Run ».
-- ============================================================

create table if not exists public.commandes (
  id         text primary key,          -- généré sur le téléphone : deux appareils hors ligne ne peuvent pas entrer en collision
  num_table  text        not null,
  lignes     jsonb       not null,      -- [{ grillade, cuisson, qte }]
  creee_a    timestamptz not null,
  servie_a   timestamptz,
  statut     text        not null default 'en_cours',
  maj_a      timestamptz not null default now(),  -- arbitre les modifications concurrentes
  constraint statut_valide check (statut in ('en_cours', 'servie'))
);

-- Le tri de l'accueil et la synchronisation incrémentale passent par ces deux index.
create index if not exists commandes_creee_a_idx on public.commandes (creee_a);
create index if not exists commandes_maj_a_idx   on public.commandes (maj_a);

-- maj_a est posé par la base, jamais par le téléphone : c'est ce qui rend
-- l'arbitrage fiable même si l'horloge d'un appareil est déréglée.
create or replace function public.touch_maj_a()
returns trigger language plpgsql as $$
begin
  new.maj_a := now();
  return new;
end $$;

drop trigger if exists commandes_touch on public.commandes;
create trigger commandes_touch
  before insert or update on public.commandes
  for each row execute function public.touch_maj_a();

-- ------------------------------------------------------------
-- Accès : réservé aux appareils connectés avec le code du restaurant.
-- La clé publique (anon) seule ne donne accès à rien.
-- ------------------------------------------------------------
alter table public.commandes enable row level security;

drop policy if exists commandes_acces on public.commandes;
create policy commandes_acces on public.commandes
  for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- Diffusion en temps réel vers tous les téléphones connectés.
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.commandes;

-- Nécessaire pour que les événements de suppression et de modification
-- transportent la ligne complète.
alter table public.commandes replica identity full;
