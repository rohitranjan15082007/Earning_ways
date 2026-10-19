-- One ROI row per investment and credited day.
--
-- ROI is credited by inserting these rows: the number of rows a call actually
-- inserts decides the wallet credit, so this key is what stops a retry or two
-- concurrent requests from paying the same day twice.
--
-- A database that already contains duplicate rows will refuse this index. Check
-- for them first and reconcile the wallet before deploying:
--
--   SELECT investmentId, creditedForDate, COUNT(*) AS rows
--   FROM ROIRecord
--   WHERE investmentId IS NOT NULL AND creditedForDate IS NOT NULL
--   GROUP BY investmentId, creditedForDate
--   HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX `ROIRecord_investmentId_creditedForDate_key`
  ON `ROIRecord`(`investmentId`, `creditedForDate`);
