# Walkthrough

A guided path through the prototype, with the figures you should see at each step. Run the app first (see the [README](../README.md#for-engineers)).

1. The app opens on **Fleet today**: 45 vans at a glance, one already off the road and four needing
   a decision. With no pre-confirmed rental cover, the depot is one standard van short today.
2. Switch to the week plan. Week 40 opens with five decisions and none taken. The band counts own
   vans plus explicitly requested replacement cover, and the standard row starts one short on every
   day but Thursday, where demand is one lower, because `V-012` is held for the week.
3. Open `V-012`, click **Use proposal**, then **Apply to draft**. Request replacement cover from
   Monday for five days. The band clears except Thursday, which shows one spare, and the
   Consequence tile shows EUR 700.
4. Apply the proposals for `V-103` and `V-118`, both Tuesday visits. Tuesday goes two short. Move
   `V-118` to Thursday, where the spare van absorbs it at no cost, and request a one-day Tuesday
   replacement for `V-103`. The band clears and the weekly total reaches EUR 2,280 against a
   EUR 3,000 budget.
5. Schedule `V-041` on Thursday. The specialist row breaks while standard capacity remains covered;
   no lever closes it because standard replacement cover cannot serve a specialist van. Defer it with
   a reason, review date, and trigger.
6. Apply the proposal for `V-027`: watch until its 2 November service, with the rationale and trigger
   already filled in. Nothing is left to decide.
7. Look at `V-012`. Bundle and watch are disabled, with the UVV reason shown rather than hidden.
8. Commit. The summary carries the visits, forward availability, requested cover, the absence of
   specialist cover, the EUR 2,280 total, and the deferred follow-ups. On the fleet dashboard,
   `V-012`'s card reads `Replacement on site · day 1 of 5`.
9. Advance the clock to the next review date. `V-041` returns with its rationale intact, and week 41
   opens one standard van short on Monday, because `V-012`'s hold runs until 6 Oct. Its shortfall
   chip opens the held van, where one day of cover closes it. The two new standard cases both
   propose Thursday; adopting both leaves Thursday one short, and moving `V-105` to Wednesday
   clears it. Reset.
