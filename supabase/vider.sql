-- ============================================================
-- Grill — remise à zéro des commandes
--
-- À coller dans Supabase : menu « SQL Editor », puis « Run ».
--
-- ATTENTION : efface TOUTES les commandes, en cours comme servies, et donc
-- aussi l'historique des statistiques. Sans retour possible.
--
-- La structure de la table, la règle d'accès et le compte du restaurant ne
-- sont pas touchés : l'application reste utilisable immédiatement après.
-- ============================================================

-- Combien de commandes vont être effacées (à lancer seul si vous voulez voir
-- avant d'agir) :
select count(*) filter (where statut = 'en_cours') as en_cours,
       count(*) filter (where statut = 'servie')   as servies,
       count(*)                                    as total
from public.grill_commandes;

-- L'effacement lui-même :
delete from public.grill_commandes;

-- Contrôle : doit renvoyer 0.
select count(*) as restantes from public.grill_commandes;
