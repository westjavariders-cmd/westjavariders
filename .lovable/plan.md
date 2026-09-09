# Website Configuration Foundation

Goal: manage the public site's pages, sections, blocks, media, buttons and menu from Admin, without touching the existing commercial machinery (products, pricing, cart, checkout, payments, vouchers, currencies).

## What the audit found (reused, not rebuilt)

- Public pages already read data through server-side, customer-safe readers that strip internal costs and notes. The new website reader follows the same pattern.
- Products, categories and their public titles already resolve through the existing product reader — the website will only reference products by their stable identity.
- Languages already exist as a managed list with one master language. The website reuses that list and falls back to the master language.
- Admin already has a fixed navigation, a role model (Admin writes, Staff reads), an audit trail, list/editor/tab screens, and a private photo-upload pattern. All reused.
- Nothing existing can express page/section/block structure, so that part is genuinely new.

## Architecture

```text
Website Page  ->  Section  ->  Block  ->  content per language
                                      ->  one image or video
                                      ->  one button (CTA)
                                      ->  referenced products
```

- Pages, sections and blocks each have their own on/off switch and their own order. The public site renders only what is on, in the configured order.
- Blocks are of fixed, controlled kinds: Hero, Image + Text, Text, Product selection, Video, People/Team, and Door (the prominent Home entries). No free HTML, no drag-and-drop builder.
- Text lives in separate per-language rows (page title, section title/subtitle, block title/body, button label). Missing translations fall back to English.
- Buttons point only to safe destinations: another website page, an existing product, Build your trip, Book individually, or an explicitly entered external link.
- Product selection blocks store references to existing products only. Titles, prices and availability always come from the product system; a product that is not bookable is shown without a booking action.
- The four Home doors are ordinary Door blocks in a Home section, so they can be renamed, reordered, hidden, re-imaged and re-pointed from Admin.
- The menu is a separate short list of navigation items with the same destination rules and per-language labels.

## Database

New tables: `website_pages`, `website_page_translations`, `website_sections`, `website_section_translations`, `website_blocks`, `website_block_translations`, `website_block_products`, `website_nav_items`, `website_nav_item_translations`. One new block-kind and one destination-kind type.

Access rules mirror the existing ones: Admin manages everything, Staff reads, and the public never queries these tables directly — the site reads them server-side. Media goes into a new `website-media` bucket that only Admin can write to.

Seed content: the five pages (Home, Build your trip, Book individually, Explore West Java, Meet the Boardriders) with a Home section containing the four doors, in English.

## Admin

New "Website" area added after Reviews and before Settings, leaving the existing order untouched:

- Website / Pages — list, create, rename, slug, on/off, reorder.
- Page editor — sections and their blocks: add, edit, on/off, reorder, delete; per-block content, language switcher, image/video upload, button destination, product picker.
- Website / Navigation — menu items with label, destination, on/off, order.

## Public

- A new page renderer that resolves an active page, its active sections and blocks in order, the requested language with English fallback, media, and product references.
- Route `/pages/$slug` renders any configured page; Home renders the configured Home page when it is active and otherwise keeps today's page. Build your trip, cart, checkout, purchase and admin routes are untouched.
- The renderer never prices anything, never creates packages and never changes the cart; product buttons hand off to the existing flow.

## Verification

Focused tests for ordering, visibility, language fallback, product-reference and inactive-product handling, destination resolution, slug safety and public-safe output; plus the existing suite, typecheck and production build.

## Deliberately out of scope

Final visual design, copy and imagery; media library; automatic translation; SEO tooling; analytics; blog; availability. No change to product, configurator, pricing, season, promotions, catalogues, catalogue bridge, package, cart, checkout, customer, purchase, payment, voucher or currency logic.
