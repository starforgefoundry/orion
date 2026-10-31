DELETE FROM "visit"
WHERE "visit"."source" = 'kiosk'
	AND "visit"."outcome" = 'denied_no_waiver'
	AND EXISTS (
		SELECT 1 FROM "waiver"
		WHERE "waiver"."member_id" = "visit"."member_id"
			AND "waiver"."source" = 'kiosk'
			AND "waiver"."signed_date" BETWEEN "visit"."scanned_date" AND "visit"."scanned_date" + interval '1 hour'
	);
