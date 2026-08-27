-- ============================================================
-- Grill — base partagée
-- À coller dans Supabase : menu « SQL Editor », puis « Run ».
--
-- Conçu pour cohabiter avec un projet Supabase déjà utilisé par autre chose :
-- la table est préfixée pour éviter toute collision, et l'accès est restreint
-- au seul compte du restaurant — pas à n'importe quel compte du projet.
-- ============================================================

create table if not exists public.grill_commandes (
  id         text primary key,          -- généré sur le téléphone : deux appareils hors ligne ne peuvent pas entrer en collision
  num_table  text        not null,
  lignes     jsonb       not null,      -- [{ grillade, cuisson, qte }]
  creee_a    timestamptz not null,
  servie_a   timestamptz,
  statut     text        not null default 'en_cours',
  maj_a      timestamptz not null default now(),  -- arbitre les modifications concurrentes
  constraint grill_statut_valide check (statut in ('en_cours', 'servie'))
);

-- Le tri de l'accueil et la synchronisation incrémentale passent par ces deux index.
create index if not exists grill_commandes_creee_a_idx on public.grill_commandes (creee_a);
create index if not exists grill_commandes_maj_a_idx   on public.grill_commandes (maj_a);

-- maj_a est posé par la base, jamais par le téléphone : c'est ce qui rend
-- l'arbitrage fiable même si l'horloge d'un appareil est déréglée.
create or replace function public.grill_touch_maj_a()
returns trigger language plpgsql as $$
begin
  new.maj_a := now();
  return new;
end $$;

drop trigger if exists grill_commandes_touch on public.grill_commandes;
create trigger grill_commandes_touch
  before insert or update on public.grill_commandes
  for each row execute function public.grill_touch_maj_a();

-- ------------------------------------------------------------
-- Accès réservé au seul compte du restaurant.
--
-- La restriction porte sur l'adresse du compte partagé, et non sur le simple
-- fait d'être connecté : dans un projet qui héberge déjà une autre
-- application, ses utilisateurs ne doivent pas pouvoir lire les commandes.
-- Si vous changez l'adresse du compte, changez-la aussi ici.
-- ------------------------------------------------------------
alter table public.grill_commandes enable row level security;

drop policy if exists grill_commandes_acces on public.grill_commandes;
create policy grill_commandes_acces on public.grill_commandes
  for all
  to authenticated
  using      ((auth.jwt() ->> 'email') = 'service@grill.local')
  with check ((auth.jwt() ->> 'email') = 'service@grill.local');

-- ------------------------------------------------------------
-- Diffusion en temps réel vers tous les téléphones connectés.
-- Le bloc tolère que la table soit déjà publiée, pour pouvoir relancer ce
-- script sans erreur.
-- ------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.grill_commandes;
exception
  when duplicate_object then null;
end $$;

-- Nécessaire pour que les évènements transportent la ligne complète.
alter table public.grill_commandes replica identity full;
