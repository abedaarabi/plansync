-- Align _prisma_migrations.checksum with current migration.sql files (no DELETE — removing a
-- migration row makes Prisma think that migration never ran, which causes drift vs a DB that
-- already has those columns/indexes).
--
-- Run via: npm run db:repair-migration-drift -w backend
-- (the script also runs `migrate resolve --applied` for baselined migrations when needed)

UPDATE "_prisma_migrations"
SET checksum = '5ecdecf7e197bf3af32a8dd71183c1617bce5895a010503d4afefb4fbe32b188'
WHERE migration_name = '20260407120000_issue_bim_anchor';

UPDATE "_prisma_migrations"
SET checksum = '453eabfc58a3ced8b633f9cf63b7a81155c1b9c5169c40dce0cc14e65322a795'
WHERE migration_name = '20260411120000_permissions_roles';

UPDATE "_prisma_migrations"
SET checksum = '471572425dd704bbc01573ec1df691f780ec578e191b52baff2a79ee34d9aa15'
WHERE migration_name = '20260412120002_proposal_takeoff_source_fileversion_idx';
