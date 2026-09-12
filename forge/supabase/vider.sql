-- ============================================================
-- Gros Sac — remise à zéro
-- ATTENTION : efface TOUTES vos entrées (poids, jeûnes, sessions, réglages).
-- Sans retour possible. La table et la règle d'accès restent en place.
-- ============================================================
select type, count(*) from public.gs_entrees group by type;
delete from public.gs_entrees;
select count(*) as restantes from public.gs_entrees;
