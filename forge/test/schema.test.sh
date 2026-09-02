#!/usr/bin/env bash
# Vérifie supabase/schema.sql sur un vrai PostgreSQL : le script s'exécute, se
# rejoue, et surtout chaque compte ne voit que ses propres entrées — y compris
# le compte du grill hébergé dans le même projet.
#
#   bash test/schema.test.sh
#
# Nécessite un PostgreSQL local (paquet postgresql). Sans lui, le test
# s'annonce ignoré plutôt que de faire échouer la suite.

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
verifier() {
  local resultat
  resultat=$($PSQL -tAc "$2" 2>&1 | tr -d '[:space:]')
  if [ "$resultat" = "t" ]; then echo "  OK   $1"; else echo "  ÉCHEC $1 (obtenu : $resultat)"; echecs=$((echecs+1)); fi
}

# --- Ce que Supabase fournit d'office ---
$PSQL <<'SQL' >/dev/null 2>&1
create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;
grant execute on all functions in schema auth to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
SQL

echo
echo "== Le script s'exécute =="
if $PSQL -f supabase/schema.sql >/dev/null 2>/tmp/forge-schema.err; then
  echo "  OK   supabase/schema.sql passe sans erreur"
else
  echo "  ÉCHEC supabase/schema.sql : $(tail -2 /tmp/forge-schema.err)"; echecs=$((echecs+1))
fi
if $PSQL -f supabase/schema.sql >/dev/null 2>&1; then
  echo "  OK   il peut être relancé sans erreur"
else
  echo "  ÉCHEC relancer le script provoque une erreur"; echecs=$((echecs+1))
fi

MOI="set local role authenticated; set local request.jwt.claims = '{\"sub\":\"11111111-1111-1111-1111-111111111111\",\"email\":\"moi@forge.local\"}';"
GRILL="set local role authenticated; set local request.jwt.claims = '{\"sub\":\"22222222-2222-2222-2222-222222222222\",\"email\":\"service@grill.local\"}';"

echo
echo "== Mon compte travaille normalement =="
verifier "il peut enregistrer une entrée" \
"begin; $MOI insert into public.forge_entrees (id,type,jour,donnees) values ('p1','poids','2026-09-02','{\"kg\":84.3}'); commit;
 begin; $MOI select count(*)=1 from public.forge_entrees; commit;"
verifier "user_id est posé par la base, pas par l'appareil" \
"begin; $MOI insert into public.forge_entrees (id,type,user_id,donnees) values ('p2','poids','99999999-9999-9999-9999-999999999999','{}'); commit;
 begin; $MOI select user_id = '11111111-1111-1111-1111-111111111111' from public.forge_entrees where id='p2'; commit;"

echo
echo "== Le compte du grill, dans le même projet, ne voit rien =="
verifier "il ne voit aucune entrée" \
"begin; $GRILL select count(*)=0 from public.forge_entrees; commit;"
$PSQL -c "begin; $GRILL update public.forge_entrees set donnees='{\"kg\":1}'; delete from public.forge_entrees; commit;" >/dev/null 2>&1
verifier "ses modifications et suppressions restent sans effet" \
"begin; $MOI select count(*)=2 and bool_and((donnees->>'kg') is distinct from '1') from public.forge_entrees; commit;"
verifier "ce qu'il écrit reste chez lui" \
"begin; $GRILL insert into public.forge_entrees (id,type,donnees) values ('g1','poids','{}'); commit;
 begin; $MOI select count(*)=0 from public.forge_entrees where id='g1'; commit;"

echo
echo "== L'horodatage d'arbitrage vient de la base =="
verifier "maj_a ignore la valeur envoyée" \
"begin; $MOI insert into public.forge_entrees (id,type,donnees,maj_a) values ('p3','poids','{}','1999-01-01'); commit;
 begin; $MOI select maj_a > now() - interval '1 minute' from public.forge_entrees where id='p3'; commit;"
verifier "maj_a avance à chaque modification" \
"begin; $MOI
 create temp table avant as select maj_a from public.forge_entrees where id='p1';
 update public.forge_entrees set supprime=true where id='p1';
 select g.maj_a > a.maj_a from public.forge_entrees g, avant a where g.id='p1'; commit;"

echo
echo "== Garde-fous =="
$PSQL -c "begin; $MOI insert into public.forge_entrees (id,type,donnees) values ('x','nimporte','{}'); commit;" >/dev/null 2>&1
verifier "un type inconnu est refusé" \
"select count(*)=0 from public.forge_entrees where id='x';"
verifier "la table est diffusée en temps réel" \
"select exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='forge_entrees');"

echo
if [ "$echecs" -gt 0 ]; then echo "$echecs ÉCHEC(S)"; exit 1; else echo "TOUT PASSE"; fi
