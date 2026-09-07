# Cimaja Boardriders — Roadmap

Phase 0 — Architecture freeze: DONE (.lovable/plan/cimaja-boardriders-phase-0-architecture-frozen-2026-09-07.md)
Phase 1A — Database foundations + security: DONE
Phase 2 — Admin foundation: DONE (auth, first-admin setup, shell, settings/currencies/languages/markets, users & roles, audit view) (enums, money domains, settings, currencies, languages, markets, user_roles + role functions, admin_audit_log, RLS, seed data)

## Open phases (do not jump ahead without instruction)
- [ ] Phase 1B — Catalog core (products, translations, categories, placements)
- [ ] Phase 1C — Configurator schema (flows, steps, fields, options, dependencies)
- [ ] Phase 1D — Components + pricing schema, seasons, promos
- [ ] Phase 1E — Operations schema (hotels, rooms, transport, motorbikes, experiences, team, insurance plans)
- [ ] Phase 1F — Customers, carts, orders, payments, purchases, snapshots
- [ ] Phase 1G — FX + vouchers + legal/reviews/analytics
- [ ] Phase 3 — Product + configurator builder
- [ ] Phase 4 — Pricing engine
- [ ] Phase 5 — Customer configurator + cart
- [ ] Phase 6 — Checkout + payments
- [ ] Phase 7 — Purchase, snapshot, voucher PDF, email
- [ ] Phase 8 — Special modules
- [ ] Phase 9 — Public website
- [ ] Phase 10 — SEO, analytics, QA, launch

## Open decisions
- [ ] FX source, refresh frequency, safety margin (Phase 4)
- [ ] Payment provider + charge currency (Phase 6)
- [ ] Voucher PDF layout, branding, legal text (Phase 7)
- [ ] Insurance voucher content (Phase 7/8)
- [ ] Field marking "experience start" for balance collection (Phase 6/7)
- [ ] Whether refund/cancellation records are required in V1
