#!/usr/bin/env bash
# Vérifie supabase/schema.sql sur un vrai PostgreSQL, avec plusieurs comptes.
#
# Ce que ce test protège :
#   - les pesées d'un compte ne sont lisibles par personne d'autre ;
#   - un défi n'existe pas pour qui n'y participe pas ;
#   - le classement ne se lit que par gs_classement(), qui applique le réglage
#     de visibilité — et on ne peut pas le contourner en lisant la table ;
#   - le compte du grill, hébergé dans le même projet, ne voit rien de tout ça.
#
#   bash test/schema.test.sh
#
# Nécessite un PostgreSQL local. Sans lui, le test s'annonce ignoré.

set -uo pipefail
cd "$(dirname "$0")/.."

BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)
if [ -z "$BIN" ] || [ ! -x "$BIN/initdb" ]; then
  echo "  IGNORÉ  PostgreSQL local absent — test du schéma non exécuté"
  exit 0
fi

PGDATA=$(mktemp -d)/data
PGPORT=${PGPORT:-55434}
SOCK=$(mktemp -d)
export PGPASSWORD=

nettoyer() {
  "$BIN/pg_ctl" -D "$PGDATA" -s -m immediate stop >/dev/null 2>&1
  rm -rf "$PGDATA" "$SOCK"
}
trap nettoyer EXIT

COMME=""
if [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
  mkdir -p "$PGDATA" "$SOCK"
  chmod 755 "$(dirname "$PGDATA")" "$SOCK"
  chown -R postgres "$PGDATA" "$SOCK"
  COMME="su postgres -c"
fi
lancer() { if [ -n "$COMME" ]; then su postgres -c "$1"; else eval "$1"; fi; }

lancer "$BIN/initdb -D $PGDATA -A trust -U postgres" >/dev/null 2>&1 || {
  echo "  IGNORÉ  initdb a échoué — test du schéma non exécuté"; exit 0; }
lancer "$BIN/pg_ctl -D $PGDATA -o '-p $PGPORT -k $SOCK' -w start" >/dev/null 2>&1 || {
  echo "  IGNORÉ  PostgreSQL n'a pas démarré — test du schéma non exécuté"; exit 0; }

PSQL="psql -h $SOCK -p $PGPORT -U postgres -X -q -v ON_ERROR_STOP=1"
echecs=0

verifier() {   # verifier "libellé" "requête renvoyant t ou f"
  local resultat
  resultat=$($PSQL -tAc "$2" 2>&1 | tr -d '[:space:]')
  if [ "$resultat" = "t" ]; then echo "  OK   $1"
  else echo "  ÉCHEC $1 (obtenu : $resultat)"; echecs=$((echecs+1)); fi
}

refuse() {     # refuse "libellé" "requête qui doit échouer"
  if $PSQL -c "$2" >/dev/null 2>&1; then
    echo "  ÉCHEC $1 (la requête a été acceptée)"; echecs=$((echecs+1))
  else echo "  OK   $1"; fi
}

# --- Ce que Supabase fournit d'office ---
$PSQL <<'SQL' >/dev/null 2>&1
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
grant usage on schema public, auth to authenticated, anon;
grant execute on all functions in schema auth to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444')
on conflict do nothing;
SQL

echo
echo "== Le script s'exécute =="
if $PSQL -f supabase/schema.sql >/dev/null 2>/tmp/gs-schema.err; then
  echo "  OK   supabase/schema.sql passe sans erreur"
else
  echo "  ÉCHEC supabase/schema.sql : $(tail -3 /tmp/gs-schema.err)"; echecs=$((echecs+1))
fi
if $PSQL -f supabase/schema.sql >/dev/null 2>&1; then
  echo "  OK   il peut être relancé sans erreur"
else
  echo "  ÉCHEC relancer le script provoque une erreur"; echecs=$((echecs+1))
fi
$PSQL -c "grant all on all tables in schema public to authenticated" >/dev/null 2>&1

ALICE="set local role authenticated; set local request.jwt.claims = '{\"sub\":\"11111111-1111-1111-1111-111111111111\"}';"
BOB="set local role authenticated;   set local request.jwt.claims = '{\"sub\":\"22222222-2222-2222-2222-222222222222\"}';"
CARLA="set local role authenticated; set local request.jwt.claims = '{\"sub\":\"33333333-3333-3333-3333-333333333333\"}';"
GRILL="set local role authenticated; set local request.jwt.claims = '{\"sub\":\"44444444-4444-4444-4444-444444444444\",\"email\":\"service@grill.local\"}';"

echo
echo "== Les pesées restent privées =="
$PSQL -c "begin; $ALICE insert into public.gs_entrees (id,type,jour,donnees)
  values ('p1','poids','2026-09-12','{\"kg\":110.4}'); commit;" >/dev/null 2>&1
verifier "chacun relit les siennes" \
"begin; $ALICE select count(*)=1 from public.gs_entrees; commit;"
verifier "un autre participant n'en voit aucune" \
"begin; $BOB select count(*)=0 from public.gs_entrees; commit;"
verifier "le compte du grill non plus" \
"begin; $GRILL select count(*)=0 from public.gs_entrees; commit;"
verifier "user_id est posé par la base, pas par l'appareil" \
"begin; $ALICE insert into public.gs_entrees (id,type,user_id,donnees)
   values ('p2','poids','99999999-9999-9999-9999-999999999999','{}');
 select user_id = '11111111-1111-1111-1111-111111111111' from public.gs_entrees where id='p2'; commit;"

echo
echo "== Créer un défi et le rejoindre par son code =="
$PSQL -c "begin; $ALICE
  insert into public.gs_defis (id,nom,code,mesure,debut,fin,gage)
  values ('d1','La Chasse au Gras','ABC234','pourcentage',current_date - 7, current_date + 21,'Le dernier paie la tournée');
  insert into public.gs_participations (defi_id,pseudo,emoji,visibilite) values ('d1','Alex','🔥','pourcentage');
  commit;" >/dev/null 2>&1
verifier "le créateur est inscrit sur son défi" \
"begin; $ALICE select count(*)=1 from public.gs_participations where defi_id='d1'; commit;"

verifier "un code inconnu ne révèle rien" \
"begin; $BOB select count(*)=0 from public.gs_apercu('ZZZZZZ'); commit;"
verifier "l'aperçu par le code montre l'essentiel avant de s'engager" \
"begin; $BOB select nom='La Chasse au Gras' and participants=1 from public.gs_apercu('abc234'); commit;"

$PSQL -c "begin; $BOB   select public.gs_rejoindre('abc234','Bob','🐻','pourcentage'); commit;" >/dev/null 2>&1
$PSQL -c "begin; $CARLA select public.gs_rejoindre('ABC234','Carla','🦊','rang'); commit;" >/dev/null 2>&1
verifier "deux invités ont rejoint (le code tolère la casse)" \
"begin; $ALICE select count(*)=3 from public.gs_classement('d1'); commit;"
refuse "un code inconnu est refusé" \
"begin; $BOB select public.gs_rejoindre('ZZZZZZ','Intrus'); commit;"

echo
echo "== Un défi n'existe pas pour qui n'y participe pas =="
verifier "le compte du grill ne voit aucun défi" \
"begin; $GRILL select count(*)=0 from public.gs_defis; commit;"
refuse "et le classement lui est refusé" \
"begin; $GRILL select * from public.gs_classement('d1'); commit;"
refuse "s'inscrire d'autorité sur le défi d'un autre est refusé" \
"begin; $GRILL insert into public.gs_participations (defi_id,pseudo) values ('d1','Intrus'); commit;"
verifier "les membres, eux, lisent le défi" \
"begin; $BOB select count(*)=1 from public.gs_defis where id='d1'; commit;"

echo
echo "== Classement =="
$PSQL -c "begin; $ALICE update public.gs_participations set valeur=4.5, pct=4.5 where defi_id='d1'; commit;" >/dev/null 2>&1
$PSQL -c "begin; $BOB   update public.gs_participations set valeur=3.2, pct=3.2 where defi_id='d1'; commit;" >/dev/null 2>&1
$PSQL -c "begin; $CARLA update public.gs_participations set valeur=3.2 where defi_id='d1'; commit;" >/dev/null 2>&1
verifier "le meilleur est premier" \
"begin; $BOB select pseudo='Alex' from public.gs_classement('d1') where rang=1; commit;"
verifier "deux ex æquo partagent le rang 2" \
"begin; $BOB select count(*)=2 from public.gs_classement('d1') where rang=2; commit;"
verifier "chacun se reconnaît dans le classement" \
"begin; $BOB select count(*)=1 from public.gs_classement('d1') where moi; commit;"

$PSQL -c "begin; $ALICE insert into public.gs_participations (defi_id,user_id,pseudo) values ('d1','44444444-4444-4444-4444-444444444444','Tardif'); commit;" >/dev/null 2>&1
verifier "qui ne s'est pas pesé n'a pas de rang" \
"begin; $ALICE select count(*)=0 from public.gs_classement('d1') where pseudo='Alex' and rang is null; commit;"

echo
echo "== « Mon rang seul » est tenu par la base, pas par l'écran =="
verifier "Carla a bien choisi de ne montrer que son rang" \
"begin; $BOB select visibilite='rang' from public.gs_classement('d1') where pseudo='Carla'; commit;"
verifier "les autres voient son rang mais pas son chiffre" \
"begin; $BOB select valeur is null and pct is null and kg is null
   from public.gs_classement('d1') where pseudo='Carla'; commit;"
verifier "elle-même continue de voir le sien" \
"begin; $CARLA select valeur=3.2 from public.gs_classement('d1') where moi; commit;"
verifier "qui montre son pourcentage le montre vraiment" \
"begin; $CARLA select pct=4.5 from public.gs_classement('d1') where pseudo='Alex'; commit;"
verifier "mais jamais ses kilos, non publiés" \
"begin; $CARLA select kg is null from public.gs_classement('d1') where pseudo='Alex'; commit;"

echo
echo "== On ne contourne pas l'affichage en lisant la table =="
verifier "un membre ne lit que sa propre participation" \
"begin; $BOB select count(*)=1 and bool_and(pseudo='Bob') from public.gs_participations; commit;"
$PSQL -c "begin; $BOB update public.gs_participations set valeur=99 where pseudo='Alex'; commit;" >/dev/null 2>&1
verifier "et ne peut pas trafiquer le score d'un autre" \
"begin; $ALICE select valeur=4.5 from public.gs_participations where defi_id='d1'; commit;"
verifier "aucune colonne ne contient le poids" \
"select count(*)=0 from information_schema.columns
 where table_name='gs_participations' and column_name in ('poids','poids_depart','kg_depart');"

echo
echo "== Garde-fous =="
refuse "un type d'entrée inconnu est refusé" \
"begin; $ALICE insert into public.gs_entrees (id,type,donnees) values ('x','nimporte','{}'); commit;"
refuse "une visibilité inconnue est refusée" \
"begin; $BOB update public.gs_participations set visibilite='tout' where defi_id='d1'; commit;"
refuse "une période à l'envers est refusée" \
"begin; $ALICE insert into public.gs_defis (id,nom,code,debut,fin)
   values ('d2','À l''envers','QQQ234',current_date, current_date - 1); commit;"
refuse "deux défis ne peuvent pas partager un code" \
"begin; $ALICE insert into public.gs_defis (id,nom,code,debut,fin)
   values ('d3','Doublon','ABC234',current_date, current_date + 1); commit;"
verifier "le code d'un défi ne change plus une fois distribué" \
"begin; $ALICE update public.gs_defis set code='NEUF22' where id='d1';
 select code='ABC234' from public.gs_defis where id='d1'; commit;"
verifier "les participations sont diffusées en temps réel" \
"select exists (select 1 from pg_publication_tables
 where pubname='supabase_realtime' and tablename='gs_participations');"

echo
if [ "$echecs" -gt 0 ]; then echo "$echecs ÉCHEC(S)"; exit 1; else echo "TOUT PASSE"; fi
