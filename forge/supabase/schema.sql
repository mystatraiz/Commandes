-- ============================================================
-- Gros Sac — base
-- À coller dans Supabase : menu « SQL Editor », puis « Run ».
--
-- Conçu pour cohabiter avec le projet du grill : tout est préfixé « gs_ ».
--
-- Deux principes tiennent tout le reste :
--
--   1. Les données personnelles (pesées, jeûnes, sessions) ne sortent jamais
--      du compte qui les a écrites. Aucun participant, aucun créateur de défi
--      ne peut les lire.
--   2. Un classement se lit uniquement par la fonction gs_classement(), qui
--      masque ce que chacun a choisi de ne pas montrer. La table des
--      participations, elle, n'est lisible que par son propriétaire — donc on
--      ne peut pas contourner l'affichage en interrogeant la base directement.
--
-- C'est ce que vérifie test/schema.test.sh sur un vrai PostgreSQL.
-- ============================================================

-- Reprise d'une installation « Forge » antérieure, s'il y en a une.
do $$
begin
  if to_regclass('public.forge_entrees') is not null and to_regclass('public.gs_entrees') is null then
    alter table public.forge_entrees rename to gs_entrees;
  end if;
end $$;

-- ------------------------------------------------------------
-- Profil : ce qu'on montre de soi. Le pseudo est recopié dans chaque
-- participation, pour qu'afficher un classement n'oblige jamais à lire la
-- fiche des autres.
-- ------------------------------------------------------------
create table if not exists public.gs_profils (
  id      uuid primary key references auth.users on delete cascade,
  pseudo  text not null,
  emoji   text not null default '💪',
  maj_a   timestamptz not null default now(),
  constraint gs_pseudo_non_vide check (length(trim(pseudo)) between 1 and 24)
);

-- ------------------------------------------------------------
-- Entrées personnelles : pesées, jeûnes, sessions, réglages.
-- Strictement privées.
-- ------------------------------------------------------------
create table if not exists public.gs_entrees (
  id        text primary key,
  user_id   uuid not null default auth.uid(),
  type      text not null,
  jour      date,
  debut     timestamptz,
  fin       timestamptz,
  donnees   jsonb not null default '{}'::jsonb,
  supprime  boolean not null default false,
  maj_a     timestamptz not null default now(),
  constraint gs_type_valide check (type in ('poids', 'jeune', 'sport', 'reglages'))
);

create index if not exists gs_entrees_user_maj_idx  on public.gs_entrees (user_id, maj_a);
create index if not exists gs_entrees_user_type_idx on public.gs_entrees (user_id, type, jour);

-- ------------------------------------------------------------
-- Défis.
-- ------------------------------------------------------------
create table if not exists public.gs_defis (
  id        text primary key,
  createur  uuid not null default auth.uid(),
  nom       text not null,
  code      text not null unique,
  mesure    text not null default 'pourcentage',
  debut     date not null,
  fin       date not null,
  gage      text,                                  -- « le dernier paie la tournée » : une phrase, jamais de l'argent
  clos      boolean not null default false,
  maj_a     timestamptz not null default now(),
  constraint gs_mesure_valide check (mesure in ('pourcentage', 'kilos')),
  constraint gs_periode_valide check (fin >= debut),
  constraint gs_nom_non_vide check (length(trim(nom)) between 1 and 60)
);

create index if not exists gs_defis_code_idx on public.gs_defis (code);

-- ------------------------------------------------------------
-- Participations : l'adhésion à un défi, le réglage de visibilité, et la
-- progression publiée.
--
-- `valeur` sert au classement, donc elle est toujours renseignée ; ce sont
-- gs_classement() et la règle d'accès qui décident qui a le droit de la voir.
-- `pct` et `kg` sont ce que le participant accepte d'afficher : l'appareil
-- n'envoie que ce que son réglage autorise.
--
-- Le poids, lui, n'a aucune colonne ici. Il ne quitte pas gs_entrees.
-- ------------------------------------------------------------
create table if not exists public.gs_participations (
  defi_id     text not null references public.gs_defis (id) on delete cascade,
  user_id     uuid not null default auth.uid(),
  pseudo      text not null,
  emoji       text not null default '💪',
  visibilite  text not null default 'pourcentage',
  valeur      numeric,
  pct         numeric,
  kg          numeric,
  rejoint_a   timestamptz not null default now(),
  maj_a       timestamptz not null default now(),
  primary key (defi_id, user_id),
  constraint gs_visibilite_valide check (visibilite in ('rang', 'pourcentage', 'kilos'))
);

create index if not exists gs_participations_user_idx on public.gs_participations (user_id);

-- ------------------------------------------------------------
-- maj_a posé par la base, jamais par l'appareil : une horloge déréglée ne
-- peut pas fausser l'arbitrage des modifications concurrentes. user_id de
-- même : on n'écrit jamais pour autrui.
-- ------------------------------------------------------------
create or replace function public.gs_touch()
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

drop trigger if exists gs_entrees_touch on public.gs_entrees;
create trigger gs_entrees_touch before insert or update on public.gs_entrees
  for each row execute function public.gs_touch();

drop trigger if exists gs_participations_touch on public.gs_participations;
create trigger gs_participations_touch before insert or update on public.gs_participations
  for each row execute function public.gs_touch();

create or replace function public.gs_touch_defi()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.maj_a := now();
  if tg_op = 'INSERT' then
    new.createur := coalesce(auth.uid(), new.createur);
  else
    new.createur := old.createur;
    new.code := old.code;        -- le code circule dans les groupes : il ne change plus
  end if;
  return new;
end $$;

drop trigger if exists gs_defis_touch on public.gs_defis;
create trigger gs_defis_touch before insert or update on public.gs_defis
  for each row execute function public.gs_touch_defi();

create or replace function public.gs_touch_profil()
returns trigger language plpgsql as $$
begin new.maj_a := now(); return new; end $$;

drop trigger if exists gs_profils_touch on public.gs_profils;
create trigger gs_profils_touch before insert or update on public.gs_profils
  for each row execute function public.gs_touch_profil();

-- ------------------------------------------------------------
-- Règles d'accès.
-- ------------------------------------------------------------
alter table public.gs_profils        enable row level security;
alter table public.gs_entrees        enable row level security;
alter table public.gs_defis          enable row level security;
alter table public.gs_participations enable row level security;

drop policy if exists gs_profils_acces on public.gs_profils;
create policy gs_profils_acces on public.gs_profils
  for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists gs_entrees_acces on public.gs_entrees;
create policy gs_entrees_acces on public.gs_entrees
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Un défi se lit quand on y participe. On le rejoint par son code, à travers
-- gs_rejoindre() : connaître l'identifiant d'un défi ne donne aucun accès.
drop policy if exists gs_defis_lecture on public.gs_defis;
create policy gs_defis_lecture on public.gs_defis
  for select to authenticated
  using (exists (select 1 from public.gs_participations p
                 where p.defi_id = gs_defis.id and p.user_id = auth.uid()));

drop policy if exists gs_defis_creation on public.gs_defis;
create policy gs_defis_creation on public.gs_defis
  for insert to authenticated with check (createur = auth.uid());

drop policy if exists gs_defis_gestion on public.gs_defis;
create policy gs_defis_gestion on public.gs_defis
  for update to authenticated
  using (createur = auth.uid()) with check (createur = auth.uid());

drop policy if exists gs_defis_suppression on public.gs_defis;
create policy gs_defis_suppression on public.gs_defis
  for delete to authenticated using (createur = auth.uid());

-- Savoir si l'on a créé un défi, sans passer par la règle de lecture : au
-- moment où le créateur s'inscrit sur son propre défi, il n'y participe pas
-- encore et ne peut donc pas le lire.
create or replace function public.gs_est_createur(p_defi text)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.gs_defis d where d.id = p_defi and d.createur = auth.uid())
$$;

-- Chacun ne voit que sa propre ligne de participation : c'est ce qui empêche
-- de lire les chiffres bruts des autres en interrogeant la base directement.
-- Le classement passe obligatoirement par gs_classement().
drop policy if exists gs_participations_acces on public.gs_participations;
drop policy if exists gs_participations_lecture on public.gs_participations;
drop policy if exists gs_participations_inscription on public.gs_participations;
drop policy if exists gs_participations_maj on public.gs_participations;
drop policy if exists gs_participations_depart on public.gs_participations;

create policy gs_participations_lecture on public.gs_participations
  for select to authenticated using (user_id = auth.uid());

-- S'inscrire soi-même n'est possible que sur un défi qu'on a créé ; pour tous
-- les autres, on passe par le code d'invitation et gs_rejoindre().
create policy gs_participations_inscription on public.gs_participations
  for insert to authenticated
  with check (user_id = auth.uid() and public.gs_est_createur(defi_id));

-- Publier sa progression et régler sa visibilité : chaque participant le fait
-- sur sa propre ligne, créateur ou non.
create policy gs_participations_maj on public.gs_participations
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Quitter un défi.
create policy gs_participations_depart on public.gs_participations
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
-- Aperçu d'un défi à partir de son code, avant de le rejoindre.
-- Ne révèle rien d'autre que ce qui est nécessaire pour décider.
-- ------------------------------------------------------------
create or replace function public.gs_apercu(p_code text)
returns table (id text, nom text, mesure text, debut date, fin date, gage text, participants bigint)
language sql security definer set search_path = public stable as $$
  select d.id, d.nom, d.mesure, d.debut, d.fin, d.gage,
         (select count(*) from public.gs_participations p where p.defi_id = d.id)
  from public.gs_defis d
  where d.code = upper(trim(p_code)) and not d.clos
$$;

-- ------------------------------------------------------------
-- Rejoindre par le code.
-- ------------------------------------------------------------
create or replace function public.gs_rejoindre(
  p_code text, p_pseudo text, p_emoji text default '💪', p_visibilite text default 'pourcentage')
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_defi public.gs_defis;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;

  select * into v_defi from public.gs_defis where code = upper(trim(p_code));
  if not found then raise exception 'code inconnu'; end if;
  if v_defi.clos then raise exception 'défi clos'; end if;
  if v_defi.fin < current_date then raise exception 'défi terminé'; end if;

  insert into public.gs_participations (defi_id, user_id, pseudo, emoji, visibilite)
  values (v_defi.id, auth.uid(), trim(p_pseudo), p_emoji, p_visibilite)
  on conflict (defi_id, user_id) do update
    set pseudo = excluded.pseudo, emoji = excluded.emoji, visibilite = excluded.visibilite;

  return v_defi.id;
end $$;

-- ------------------------------------------------------------
-- Le classement.
--
-- Seule porte d'entrée sur la progression des autres, et seul endroit où le
-- réglage de visibilité est appliqué. Les ex æquo partagent leur rang et le
-- suivant saute (1, 2, 2, 4) ; qui ne s'est pas encore pesé ferme la marche
-- sans rang plutôt que d'être compté dernier.
-- ------------------------------------------------------------
create or replace function public.gs_classement(p_defi text)
returns table (
  user_id uuid, pseudo text, emoji text, visibilite text,
  rang int, valeur numeric, pct numeric, kg numeric, maj_a timestamptz, moi boolean)
language plpgsql security definer set search_path = public stable as $$
begin
  if not exists (select 1 from public.gs_participations p
                 where p.defi_id = p_defi and p.user_id = auth.uid()) then
    raise exception 'non membre de ce défi';
  end if;

  return query
  with classe as (
    select p.*, rank() over (order by p.valeur desc nulls last) as r
    from public.gs_participations p
    where p.defi_id = p_defi
  )
  select
    c.user_id, c.pseudo, c.emoji, c.visibilite,
    case when c.valeur is null then null else c.r::int end,
    -- « Mon rang seul » : la valeur sert à classer, elle ne se montre pas.
    case when c.user_id = auth.uid() or c.visibilite <> 'rang' then c.valeur end,
    c.pct, c.kg, c.maj_a,
    c.user_id = auth.uid()
  from classe c
  order by c.valeur desc nulls last, c.pseudo;
end $$;

revoke all on function public.gs_est_createur(text) from public;
revoke all on function public.gs_apercu(text) from public;
revoke all on function public.gs_rejoindre(text, text, text, text) from public;
revoke all on function public.gs_classement(text) from public;
grant execute on function public.gs_est_createur(text) to authenticated;
grant execute on function public.gs_apercu(text) to authenticated;
grant execute on function public.gs_rejoindre(text, text, text, text) to authenticated;
grant execute on function public.gs_classement(text) to authenticated;

-- ------------------------------------------------------------
-- Temps réel : une pesée d'un adversaire fait bouger le classement tout seul.
-- ------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.gs_participations;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.gs_entrees;
exception when duplicate_object then null;
end $$;

alter table public.gs_participations replica identity full;
alter table public.gs_entrees replica identity full;
