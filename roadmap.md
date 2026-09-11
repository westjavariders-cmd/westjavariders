# Cimaja Boardriders — Roadmap

Phase 0 — Architecture freeze: DONE (.lovable/plan/cimaja-boardriders-phase-0-architecture-frozen-2026-09-07.md)
Phase 1A — Database foundations + security: DONE (enums, money domains, settings, currencies, languages, markets, user_roles + role functions, admin_audit_log, RLS, seed data)
Phase 2 — Admin foundation: DONE (auth, first-admin setup, shell, settings/currencies/languages/markets, users & roles, audit view)

## Open phases (do not jump ahead without instruction)
- [ ] Phase 1B — Catalog core (products, translations, categories, placements)
- [ ] Phase 1C — Configurator schema (flows, steps, fields, options, dependencies)
- [ ] Phase 1D — Components + pricing schema, seasons, promos
- [ ] Phase 1E — Operations schema (hotels, rooms, transport, motorbikes, experiences, team, insurance plans)
- [ ] Phase 1F — Customers, carts, orders, payments, purchases, snapshots
- [ ] Phase 1G — FX + vouchers + legal/reviews/analytics
- [x] Phase 3 — Product + configurator builder (Admin: products, content, components, configurator, dependencies, preview, status)
- [x] Phase 4 — Pricing core (product_pricing, rules, tiers, formula versions, test lab; server-authoritative IDR)
- [x] Phase 5 — Season & promotion engine (per-product seasons, promo codes, non-stacking discounts)
- [x] Phase 6 — Accommodation catalogue (hotels, rooms, beach camping, characteristics, photos)
- [x] Phase 7 — Transport catalogue (predefined routes, other location, people/time pricing, calculator, duplication)

- [x] Phase 8 — Package + cart persistence (server-authoritative quotes, anonymous session cookie)
- [x] Phase 9 — Build Your Trip + package/cart public UI
- [x] Phase 10 — Global purchase + payment core (revalidation, purchase, immutable snapshot, payment requests, Xendit adapter, webhook idempotency)
- [ ] Phase 11 — Voucher, snapshot PDF, email delivery
- [ ] Phase 8 — Special modules
- [x] Website configuration foundation (pages, sections, blocks, media, CTAs, product references, navigation, multilingual)
- [ ] Phase 9 — Public website (final design & content on top of the website configuration foundation)
- [ ] Phase 10 — SEO, analytics, QA, launch

- [x] Option → Component links in the Configurator Option editor (reuse existing component_quantity pricing rules; extend atomic duplication)
- [x] Unlimited catalogues from the three existing templates (Admin Catalogues, per-catalogue items, configurator selects one concrete catalogue, legacy template-only fields keep working)

## Open decisions
- [ ] FX source, refresh frequency, safety margin (Phase 4)
- [x] Payment provider: Xendit adapter behind a provider-neutral interface; charged in IDR
- [ ] Xendit credentials (XENDIT_SECRET_KEY, XENDIT_CALLBACK_TOKEN) not yet supplied — payment links stay unissued until then
- [ ] Voucher PDF layout, branding, legal text (Phase 7)
- [ ] Insurance voucher content (Phase 7/8)
- [ ] Field marking "experience start" for balance collection (Phase 6/7)
- [ ] Whether refund/cancellation records are required in V1
