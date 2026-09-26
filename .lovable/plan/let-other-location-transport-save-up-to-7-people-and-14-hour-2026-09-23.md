# Let "other location" transport save up to 7 people and 14 hours

## Cause (checked in your data)

The database still has the old limits: at most 4 people and 9 hours, for prices and for the minimum/maximum travel time. So when you fill in 5–7 people or 10–14 hours, the save fails or keeps only the first rows. That is why every "other location" option still stops at 4 and 9, and the configurator can't show more. The Admin screen already offers 7 and 14.

## What I'll do

1. Raise the database limits to 1–7 people and 1–14 hours, for price tables and for min/max travel time. Nothing already saved is lost.
2. Remove the temporary workaround that drops rows 5–7 and 10–14 with a warning, so everything you fill in is saved.
3. Fix the out-of-date text "Travel time from 1 to 9 hours" in the prices screen so it says 14.
4. Check: save 7 people and 14 hours on a test option, confirm it shows 1–7 and 1–14 in the configurator, then put it back as it was.

After that you fill in the prices for 5–7 and 10–14 in each option and press "Save prices".

## Technical details

- Migration: drop and recreate `transport_people_prices_people_range` (1–7), `transport_time_prices_hours_range` (1–14), `transports_min_hours_range` / `transports_max_hours_range` (1–14).
- `src/lib/transport.functions.ts`: remove the `LEGACY_MAX_*` fallback branches.
- `src/components/admin/transport/TransportPricing.tsx`: update the help text.
