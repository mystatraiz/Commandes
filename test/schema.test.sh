#!/usr/bin/env bash
# Vérifie supabase/schema.sql sur un vrai PostgreSQL : le script s'exécute, et
# surtout la règle d'accès isole bien les commandes des autres comptes du
# projet — c'est ce qui rend sûre l'installation dans un projet déjà utilisé.
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
PGPORT=${PGPORT:-55433}
SOCK=$(mktemp -d)
export PGPASSWORD=

nettoyer() {
  "$BIN/pg_ctl" -D "$PGDATA" -s -m immediate stop >/dev/null 2>&1
  rm -rf "$PGDATA" "$SOCK"
}
trap nettoyer EXIT

# initdb refuse de tourner en root : on passe par l'utilisateur postgres s'il existe.
COMME=""
if [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
  # mktemp crée des dossiers en 700 : postgres doit pouvoir les traverser.
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
verifier() { # verifier "libellé" "requête renvoyant t ou f"
  local resultat
  resultat=$($PSQL -tAc "$2" 2>&1 | tr -d '[:space:]')
  if [ "$resultat" = "t" ]; then echo "  OK   $1"; else echo "  ÉCHEC $1 (obtenu : $resultat)"; echecs=$((echecs+1)); fi
}

# --- Ce que Supabase fournit d'office, pour exécuter le script tel quel ---
$PSQL <<'SQL' >/dev/null 2>&1
create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
grant usage on schema public to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
SQL

echo
echo "== Le script s'exécute =="
if $PSQL -f supabase/schema.sql >/dev/null 2>/tmp/schema.err; then
  echo "  OK   supabase/schema.sql passe sans erreur"
else
  echo "  ÉCHEC supabase/schema.sql : $(tail -2 /tmp/schema.err)"; echecs=$((echecs+1))
fi
# Relancé une seconde fois : le script doit être rejouable.
if $PSQL -f supabase/schema.sql >/dev/null 2>&1; then
  echo "  OK   il peut être relancé sans erreur"
else
  echo "  ÉCHEC relancer le script provoque une erreur"; echecs=$((echecs+1))
fi

RESTO="set local role authenticated; set local request.jwt.claims = '{\"email\":\"service@grill.local\"}';"
AUTRE="set local role authenticated; set local request.jwt.claims = '{\"email\":\"client@autre-appli.fr\"}';"

echo
echo "== Le compte du restaurant travaille normalement =="
verifier "il peut enregistrer une commande" \
"begin; $RESTO insert into public.grill_commandes (id,num_table,lignes,creee_a,statut)
 values ('t1','12','[{\"grillade\":\"cote\",\"qte\":2}]',now(),'en_cours'); commit;
 begin; $RESTO select count(*)=1 from public.grill_commandes; commit;"

echo
echo "== Un autre compte du même projet est tenu à l'écart =="
verifier "il ne voit aucune commande" \
"begin; $AUTRE select count(*)=0 from public.grill_commandes; commit;"
verifier "il ne peut pas en ajouter" \
"select not exists (select 1 from public.grill_commandes where id='intrus');"
$PSQL -c "begin; $AUTRE insert into public.grill_commandes (id,num_table,lignes,creee_a,statut)
 values ('intrus','99','[]',now(),'en_cours'); commit;" >/dev/null 2>&1
verifier "son insertion a bien été refusée" \
"select count(*)=0 from public.grill_commandes where id='intrus';"

$PSQL -c "begin; $AUTRE delete from public.grill_commandes; update public.grill_commandes set num_table='666'; commit;" >/dev/null 2>&1
verifier "ses suppressions et modifications restent sans effet" \
"begin; $RESTO select count(*)=1 and max(num_table)='12' from public.grill_commandes; commit;"

echo
echo "== L'horodatage d'arbitrage vient de la base =="
verifier "maj_a ignore la valeur envoyée par le client" \
"begin; $RESTO insert into public.grill_commandes (id,num_table,lignes,creee_a,statut,maj_a)
 values ('t2','22','[]',now(),'en_cours','1999-01-01'); commit;
 begin; $RESTO select maj_a > now() - interval '1 minute' from public.grill_commandes where id='t2'; commit;"
verifier "maj_a avance à chaque modification" \
"begin; $RESTO
 create temp table avant as select maj_a from public.grill_commandes where id='t1';
 update public.grill_commandes set statut='servie', servie_a=now() where id='t1';
 select g.maj_a > a.maj_a from public.grill_commandes g, avant a where g.id='t1'; commit;"

echo
echo "== Garde-fous =="
$PSQL -c "begin; $RESTO insert into public.grill_commandes (id,num_table,lignes,creee_a,statut)
 values ('t3','5','[]',now(),'nimporte_quoi'); commit;" >/dev/null 2>&1
verifier "un statut inconnu est refusé" \
"select count(*)=0 from public.grill_commandes where id='t3';"
verifier "la table est bien diffusée en temps réel" \
"select exists (select 1 from pg_publication_tables
 where pubname='supabase_realtime' and tablename='grill_commandes');"

echo
if [ "$echecs" -gt 0 ]; then echo "$echecs ÉCHEC(S)"; exit 1; else echo "TOUT PASSE"; fi
