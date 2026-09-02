-- ============================================================
-- Forge — remise à zéro
-- ATTENTION : efface TOUTES vos entrées (poids, jeûnes, sessions, réglages).
-- Sans retour possible. La table et la règle d'accès restent en place.
-- ============================================================
select type, count(*) from public.forge_entrees group by type;
delete from public.forge_entrees;
select count(*) as restantes from public.forge_entrees;
