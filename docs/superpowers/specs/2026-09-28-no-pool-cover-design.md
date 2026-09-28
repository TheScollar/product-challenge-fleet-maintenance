# No pool cover: every replacement is requested

Removes the pre-confirmed rentals R-1 and R-2 from every week, lets a held van carry a requested
replacement, and gives the depot named light days so rescheduling is still a real lever.

**Status.** Decided in a grilling session on 2026-09-25, written 2026-09-28.

**Supersedes.** Replacement cover spec §4.1 (cover merged "exactly like R-1 or R-2") and §5.4 (a
replacement belongs to a visit), and scenario spec §5.6 (the pre-confirmed rentals never enter the
total). Each carries a one-line pointer here.

**Reference convention.** `[RC §n]` points into `2026-09-24-replacement-cover-design.md`, `[SC §n]`
into `2026-09-24-scenario-and-cover-accounting-fixes-design.md`.

---

## 1. Why this exists

Commit `2c49e22` emptied `covers` and week 40's `coverIds`, so standard cover must be requested.
It left three problems:

1. Week 41 and `defaultCoverIds` still name `R-1`, a cover that no longer exists. It silently
   counts as zero.
2. V-012's release moved from 6 Oct to 5 Oct without a stated reason, which hid the week 41 Monday
   gap that removing R-1 opens.
3. The fleet has 38 standard vans against a standard demand of 38. R-1 was the depot's only slack.
   Without it, every visit on every day is a shortfall, moving a visit only moves the shortfall,
   and the band stops being a scheduling tool.

## 2. Decisions

| # | Decision |
|---|---|
| D1 | No pool cover anywhere: `covers`, week 40 and 41 `coverIds`, and `defaultCoverIds` are all empty. A fixture invariant test asserts every `coverId` resolves to an entry in `covers`. |
| D2 | V-012's `releaseRecordedOn` returns to `2026-10-06`. The hold carries into Monday of week 41 and has to be covered there by an explicit request. |
| D3 | A replacement belongs to an unavailability, not only to a visit. A booking is eligible when its vehicle has a draft visit in the week **or** is held on at least one day of the week. One predicate enforces this in the reducer and in every reader. |
| D4 | A held van with no item in the week is reached from its shortfall. The shortfall chip, and the band cell for that day, open a held-vehicle panel: hold reason, release date, and the existing `ReplacementBookingControl`. |
| D5 | `WeekFixture` gains an optional `demandByDay: Record<ISODate, Partial<Demand>>`. Days not listed use `week.demand`. Standard demand is 37 on Thursday 1 Oct (week 40) and on Wednesday 7 Oct and Thursday 8 Oct (week 41). |
| D6 | `CURRENT_VERSION` moves to 3. Stored v2 state resets to the seed with the existing older-build notice. No migration. |
| D7 | Docs: this spec supersedes, older specs get pointers, live copy is rewritten, history (past acceptance entries, plans, mockups) is left as written. |

### 2.1 Booking eligibility, precisely

`eligibleBookings(bookings, { fixture, weekId, visits })` replaces `bookingsForVisits`. A booking
survives when its `vehicleId` is in `visits` or `isHeldOn(vehicle, d)` holds for some day `d` of the
week. Nothing else changes: bookings stay keyed by vehicle, bounded to the active week, standard
only. Booked days are not required to match unavailable days; that was not enforced before and is
not introduced here.

A van that is both held and visiting (V-012 in week 40) still has one booking and counts once.

### 2.2 The held-vehicle panel

Selection widens from `ItemId | null` to `{ kind: 'item'; itemId } | { kind: 'held-vehicle';
vehicleId } | null`. A shortfall chip targets the first queued item among its contributors, as
today. When no contributor has an item this week but one is held, the chip targets that held
vehicle instead. The panel sits where `ItemDetail` does and shows no treatment controls: a hold
has no decision to take, only cover to request.

## 3. Capacity, derived by hand

Standard class only; specialist is unchanged. Figures read `own + cover / demand`. Standard owned
is 38. Day rate is EUR 140.

### 3.1 Week 40 (demand 38, 38, 38, **37**, 38)

| Step | Mon 28 | Tue 29 | Wed 30 | Thu 1 | Fri 2 |
|---|---|---|---|---|---|
| Cold open (V-012 held) | 37/38 short 1 | 37/38 short 1 | 37/38 short 1 | 37/37 | 37/38 short 1 |
| V-012 visit Tue, cover Mon x5 | 37+1/38 | 37+1/38 | 37+1/38 | 37+1/37 spare 1 | 37+1/38 |
| Adopt V-103 and V-118 (Tue) | 37+1/38 | 35+1/38 short 2 | 37+1/38 | 37+1/37 spare 1 | 37+1/38 |
| Move V-118 to Thu | 37+1/38 | 36+1/38 short 1 | 37+1/38 | 36+1/37 | 37+1/38 |
| Cover V-103 Tue x1 | 37+1/38 | 36+2/38 | 37+1/38 | 36+1/37 | 37+1/38 |

The band is clear. V-041 on Thursday then breaks the specialist row, with no lever, and is
deferred. V-027 is watched. Garage bays hold: Tuesday uses 2 of 3, Thursday 2 of 2 if V-041 is
scheduled.

**Week 40 total:** service 480 + 620 + 340 = EUR 1,440, cover 700 + 140 = EUR 840, **EUR 2,280**
against EUR 3,000. This replaces EUR 2,420 everywhere.

The cold open now carries four shortfall blockers (Mon, Tue, Wed, Fri) beside the five undecided
items. That is deliberate: the depot is one van short before anything is planned.

### 3.2 Week 41 (demand 38, 38, **37**, **37**, 38)

| Step | Mon 5 | Tue 6 | Wed 7 | Thu 8 | Fri 9 |
|---|---|---|---|---|---|
| Cold open (V-012 held Mon) | 37/38 short 1 | 38/38 | 38/37 spare 1 | 38/37 spare 1 | 38/38 |
| Cover V-012 Mon x1 (held-vehicle panel) | 37+1/38 | 38/38 | 38/37 spare 1 | 38/37 spare 1 | 38/38 |
| Adopt V-024 and V-105 (Thu) | 37+1/38 | 38/38 | 38/37 spare 1 | 36/37 short 1 | 38/38 |
| Move V-105 to Wed (resolves) | 37+1/38 | 38/38 | 37/37 | 37/37 | 38/38 |
| or move V-105 to Mon (relocates) | 36+1/38 short 1 | 38/38 | 38/37 spare 1 | 37/37 | 38/38 |

**Week 41 total** with V-105 on Wednesday: service 240 + 120 = EUR 360, cover EUR 140, **EUR 500**,
plus EUR 180 if the resurfaced V-041 is scheduled.

### 3.3 Weeks 42 onward

The default template has no cover, flat demand of 38, and V-012 is released. Nothing is authored.

## 4. Tests

The table above is the source of truth. Existing failures are handled by kind:

1. **Numbers moved, intent unchanged:** update to the table.
2. **Intent was R-1 or R-2 itself** (for example "R-2 does not cover Wednesday"): replace with a
   test of the same mechanism using a requested booking.
3. **Cold-open assumptions** ("no shortfall because nothing is planned"): rewrite to state the
   new cold open explicitly.

New tests: the fixture invariant (D1), V-012 held all of week 40 and Monday of week 41 only (D2),
a hold-based booking accepted and a booking for a vehicle neither visiting nor held rejected (D3),
`demandByDay` fallback (D5), v2 state resetting under v3 (D6).

## 5. Live copy to rewrite

The cover note (`coverNoteContent.ts`), the band legend (`own + rental / demand` becomes
`own + replacement / demand`) and breakdown tooltip, comments in `capacity.ts` and `costs.ts`, the
README walkthrough and test count, and the speaker script, including removal of the readiness note
and the "being re-baselined" caveat once the suite is green.

## 6. Done

Full suite green with the count stated in the README; `tsc` and `npm run build` pass; every figure
in §3 is asserted by a test; the same week 40 total appears in README, speaker script, cover note
and tests; a live walkthrough pass is recorded in a new dated section of `docs/acceptance.md`. The
branch lands through a reviewed PR.
