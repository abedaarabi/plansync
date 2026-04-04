-- One SUPER_ADMIN per workspace (earliest former ADMIN by membership createdAt).
-- Separate migration so this runs after SUPER_ADMIN exists and the previous txn has committed.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY "workspaceId" ORDER BY "createdAt" ASC) AS rn
  FROM "WorkspaceMember"
  WHERE role::text = 'ADMIN'
)
UPDATE "WorkspaceMember" wm
SET role = 'SUPER_ADMIN'
FROM ranked r
WHERE wm.id = r.id AND r.rn = 1;
