# PlanSync market research — pricing & features

Internal competitive snapshot (August 2026). PlanSync prices from `frontend/src/lib/productPricing.ts` / Stripe. Competitor figures from vendor sites and industry reports; quote-only vendors use midpoint estimates.

## PlanSync pricing

| Plan       | Price       | Included                                                  |
| ---------- | ----------- | --------------------------------------------------------- |
| Free       | $0          | Local PDF viewer (no signup)                              |
| Team       | **$99/mo**  | 5 seats; drawings, issues, RFIs, schedule (+$15/seat)     |
| Pro        | **$179/mo** | 5 seats; Team + takeoff, proposals, BIM/clash (+$19/seat) |
| Enterprise | **$299/mo** | 10 seats; Pro + O&M (+$25/seat)                           |

14-day Pro trial; cancel anytime. Source of truth: `frontend/src/lib/productPricing.ts` + Stripe resolvers.

---

## PlanSync vs Procore vs Dalux

| Dimension               | PlanSync                            | Procore                                           | Dalux                                  |
| ----------------------- | ----------------------------------- | ------------------------------------------------- | -------------------------------------- |
| Ideal buyer             | SMB GC/sub, owner→FM path           | Mid–large commercial GC / owner                   | BIM-heavy EU/Nordic field teams        |
| Pricing model           | $99 / $179 / $299 workspace + seats | Annual Construction Volume quote                  | Free Basic; paid Field quote           |
| 5-seat monthly (est.)   | $99 Team · $179 Pro · $299 Ent      | ~$750 small · $2,500+ mid                         | $0 Basic · ~$245 paid est.             |
| Buy motion              | Self-serve + Stripe                 | Demo / annual contract                            | Freemium → sales upgrade               |
| Primary strength        | Breadth + price + handover→O&M      | Full PM platform + ecosystem                      | Mobile BIM viewer + site QA            |
| When they beat PlanSync | —                                   | Enterprise financials, submittals, 100+ user orgs | AR/BIM field UX, huge federated models |

### Procore

- **Model:** Upfront annual fee on ACV + product mix; unlimited users/storage on contract. Field Productivity priced by FTE separately.
- **Reported bands (2026):** small GC ~$5k–$15k/yr; mid $15k–$50k; large $50k–$150k+. No public seat price.
- **Beats PlanSync on:** financials, submittals depth, owner/GC ecosystem, 400+ integrations, brand on RFPs.
- **PlanSync wins when:** team is under ~15 people, needs self-serve pricing, wants BIM clash + O&M without enterprise sales cycles.

### Dalux

- **Model:** Free Dalux BIM Viewer / Field Basic (punch + models); Field Standard/Pro and Box/FM via sales.
- **Paid Field:** often cited ~DKK 49–$49/user/mo on directories — treat as estimate until quoted.
- **Beats PlanSync on:** free unlimited BIM viewing, AR overlay, large-model field UX, EU-centric QA/safety.
- **PlanSync wins when:** team needs takeoff→proposals, published US pricing, clash in the same SKU, or post-handover O&M / tenant portal.

---

## 5-seat monthly TCO

| Product                 | ~$/mo for 5 | Notes                              |
| ----------------------- | ----------- | ---------------------------------- |
| **PlanSync Team**       | **$99**     | 5 seats included                   |
| **PlanSync Pro**        | **$179**    | 5 seats; takeoff + BIM             |
| **PlanSync Enterprise** | **$299**    | 10 seats; + O&M                    |
| Dalux Field Basic       | $0          | Punch + drawings/BIM               |
| BIMcollab Basic         | ~$68        | Coordination; clash via Zoom       |
| MaintainX Essential     | $100        | FM only                            |
| Bluebeam Core           | ~$138       | PDF only ($330/user/yr)            |
| Fieldwire Pro           | $195        | $39/user/mo annual                 |
| Dalux Field (paid)      | ~$245       | Est. $49/user; quote typical       |
| UpKeep Premium          | $275        | FM only                            |
| Fieldwire Business+     | $445        | RFIs / submittals / COs            |
| Autodesk Build          | ~$500       | List often ~$1,615/seat/yr         |
| PlanRadar Starter       | $595        | $119/user/mo                       |
| Buildertrend            | ~$700       | Volume quote; ~$8k–$10k/yr typical |
| **Procore (small GC)**  | **~$750**   | Est. $5k–$15k/yr · unlimited users |
| PlanRadar Pro           | $895        | $179/user/mo · 1 BIM/user          |
| **Procore (mid GC)**    | **~$2,500** | Est. $15k–$50k/yr                  |

Stack reference: Bluebeam Core + Fieldwire Business + MaintainX Premium ≈ **$780/mo** for 5 seats vs PlanSync Enterprise at **$299**.

---

## Feature matrix

| Capability                 | PlanSync          | Procore               | Dalux                    | Fieldwire            | Bluebeam      |
| -------------------------- | ----------------- | --------------------- | ------------------------ | -------------------- | ------------- |
| Free entry tier            | Local PDF forever | No                    | Field Basic + BIM viewer | 5 users / 3 projects | No            |
| Drawing markup / measure   | Yes               | Yes                   | Yes                      | Yes                  | Best-in-class |
| Issues / punch on drawings | Yes (Pro)         | Yes                   | Core strength            | Yes                  | Markups       |
| RFI / submittals           | RFI (Pro)         | Full suite            | Paid Field               | Business+            | No            |
| Quantity takeoff           | Yes (Pro)         | Module / partner      | Limited                  | No                   | Complete+     |
| Proposals / client portal  | Yes (Pro)         | Owner tools           | No                       | No                   | No            |
| BIM / IFC viewer           | Yes (Pro)         | Yes                   | Best-in-class free       | Business+            | 3D PDF        |
| Clash / model QA           | Clash in Pro      | Via BIM partners      | Viewer + QA workflows    | No                   | No            |
| AR on site                 | No                | Limited               | Yes (Field)              | No                   | No            |
| Financials / cost          | No                | Core strength         | No                       | Budget (Biz+)        | No            |
| Schedule / milestones      | Yes (Pro)         | Yes                   | Paid                     | Tasks                | No            |
| O&M / assets / work orders | Enterprise        | Limited / ops add-ons | FM modules (suite)       | No                   | No            |
| Tenant / occupant portal   | Enterprise        | No                    | No                       | No                   | No            |
| Unlimited users in price   | No (+$9/seat)     | Yes (ACV)             | Free viewer unlimited    | No                   | No            |
| Published self-serve price | Yes               | No (sales)            | Free only; paid quote    | Yes                  | Yes           |
| Integrations ecosystem     | Growing           | 400+ (leader)         | Revit / Navisworks etc.  | Hilti + apps         | Studio / CAD  |

---

## Other competitors (brief)

| Product        | Model          | List / notes                                                         |
| -------------- | -------------- | -------------------------------------------------------------------- |
| Fieldwire      | Per user       | Free Basic; Pro $39 · Business $64 · Business+ $89 /user/mo (annual) |
| Bluebeam       | Per user / yr  | Basics $260 · Core $330 · Complete $440 · Max ~$590                  |
| PlanRadar      | Per user       | Basic $35 (1 user); Starter $119; Pro $179 (≤10 self-serve)          |
| Autodesk Build | Per named user | ~$85–$135/user/mo reported; list ~$1,615/seat/yr                     |
| Buildertrend   | Volume quote   | Typical ~$8k–$10k/yr; unlimited users                                |
| MaintainX      | Per user       | Free Basic; Essential $20; Premium $65 (annual)                      |
| UpKeep         | Per user       | Essential $24; Premium $55; Professional+ custom                     |
| BIMcollab      | Per user       | Basic €12.50/user/mo annual; clash via Zoom                          |

---

## Wins / gaps

### Strengths

| Advantage                 | Evidence                                                     |
| ------------------------- | ------------------------------------------------------------ |
| Price transparency        | Self-serve $99 / $179 / $299 vs Procore ACV and Dalux quotes |
| Seat economics vs Procore | Small GC Procore ~$750/mo est. vs $179 Pro at 5 seats        |
| Breadth vs Dalux paid     | Takeoff + proposals + clash + O&M in one SKU                 |
| Handover story            | Neither Procore nor Dalux Field Basic owns tenant O&M        |
| Free entry                | Local PDF forever — different wedge than Dalux Basic         |

### Gaps

| Gap                                      | Who wins today                |
| ---------------------------------------- | ----------------------------- |
| Enterprise PM / financials / RFP default | Procore                       |
| Free BIM viewer + AR field UX            | Dalux                         |
| Jobsite mobile maturity at scale         | Dalux Field, Fieldwire        |
| Deep PDF / CAD markup automation         | Bluebeam Complete/Max         |
| Unlimited-user economics (50+ people)    | Procore ACV model             |
| Pure CMMS depth (parts, IoT, multi-site) | MaintainX Premium/Ent, UpKeep |

---

## Segment recommendations

| Buyer                     | Best PlanSync pitch                                 | Watch out for                                  |
| ------------------------- | --------------------------------------------------- | ---------------------------------------------- |
| GC / sub, 3–15 people     | Team $99 or Pro $179 vs Procore overkill            | Dalux Basic if they only need punch + BIM view |
| BIM-heavy field team (EU) | Compete on clash + takeoff + US pricing clarity     | Dalux free viewer loyalty / AR requirement     |
| Estimator / trade bidding | Takeoff → proposals on Pro                          | Bluebeam Quantity Link power users             |
| Owner / PMO with handover | Enterprise $299 — one system through O&M            | Owners who mandate Procore on the GC contract  |
| Mid–large commercial GC   | Satellite / specialty crew use; not rip-and-replace | Procore unlimited users + ecosystem lock-in    |

---

## Method & caveats

- Procore has no public rate card — monthly figures are midpoints of reported ACV spend, not official prices.
- Dalux paid Field (~$49/user) is from third-party directories; vendor emphasizes free Basic + custom quotes.
- ACC / Buildertrend figures are similarly estimated.
- Reconcile PlanSync storage marketing (20GB) vs backend default (10 GiB) before external sales use.
- Research date: **August 2026**.
