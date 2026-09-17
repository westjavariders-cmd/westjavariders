# Cimaja Boardriders Platform

We are going to build a production-oriented web application and booking platform called:

CIMAJA BOARDRIDERS

This is NOT just a surf school website.

It is a surf, travel and local-experience platform based in Cimaja, West Java, Indonesia, with Cimaja as the operational base and West Java as the wider destination.

The project must be designed from the beginning as a scalable commercial platform with:

- a simple and intuitive public website;

- configurable surf and travel products;

- real-time pricing;

- configurable product flows;

- an internal Admin system;

- packages;

- cart;

- checkout;

- payments;

- purchases;

- vouchers;

- customer communications;

- accommodation;

- transport;

- motorbike rental;

- insurance;

- experiences;

- multilingual content;

- multiple currencies.

IMPORTANT:

Do NOT attempt to build the entire application now.

This first step is an architectural planning step.

Before writing implementation code, analyse the requirements below and produce a clear technical implementation plan for the project.

Do not invent business rules that are not specified.

If something is genuinely ambiguous, identify it as an architectural question instead of silently deciding.

==================================================

1. CORE BUSINESS CONCEPT

   ==================================================

Cimaja Boardriders allows customers to:

- learn to surf;

- improve their surfing;

- discover surf spots in West Java;

- book surf trips;

- discover West Java;

- book accommodation;

- arrange transportation;

- rent motorbikes;

- add video, photography and video analysis;

- buy experiences;

- buy insurance;

- build customized trips;

- purchase gift vouchers.

The central philosophy is:

SELECT → CONFIGURE → SEE THE PRICE → BOOK → SURF / ENJOY

The customer experience must be simple.

The complexity must exist behind the interface, inside the Admin and business engine.

==================================================

2. PRIMARY USERS

There are two main user groups.

CUSTOMERS

Customers should be able to use the public website without creating an account.

There is NO customer login.

There is NO customer password.

There is NO customer portal.

There is NO "MY VOUCHERS" section.

Customer recovery is primarily based on email and Cimaja WhatsApp/email support.

ADMIN / STAFF

Internal users manage the business through an Admin system.

Initial roles:

- ADMIN

- STAFF

The architecture must allow additional roles in the future.

==================================================

3. IMPORTANT ARCHITECTURAL PRINCIPLE

The system must clearly separate:

PRODUCT

PACKAGE

ORDER

PAYMENT

PURCHASE

PURCHASE SNAPSHOT

VOUCHER

These concepts must never be treated as the same entity.

Definitions:

PRODUCT

A commercial offering configured by the business.

PACKAGE

A concrete customer-configured instance of a Product.

ORDER

The commercial checkout/order containing one or more Packages.

PAYMENT

A payment attempt or confirmed payment associated with an Order.

PURCHASE

The confirmed commercial transaction created after successful payment.

PURCHASE SNAPSHOT

The immutable historical commercial state used to preserve exactly what the customer bought.

VOUCHER

The customer-facing document representing a confirmed purchase/package.

Historical purchases must never depend on mutable Product configuration.

==================================================

4. PRODUCT PRINCIPLE

A Product must be configurable from Admin without requiring code changes for normal commercial changes.

Each Product may have its own:

- content;

- images;

- translations;

- steps;

- fields;

- options;

- dependencies;

- required fields;

- quantities;

- components;

- prices;

- internal costs;

- customer prices;

- rules;

- formulas;

- discounts;

- season configuration;

- promo eligibility;

- website placements.

Products must be independent from each other.

Changing the configuration, formula, price or component of one Product must not unintentionally modify another Product.

Reusable Component Templates may exist.

When a Component Template is used in a Product, the current configuration is copied into an independent Product Component.

After copying, the Product Component is independent.

==================================================

5. CONFIGURATOR ENGINE

The platform needs a reusable configurator engine.

A Product can contain a configurable flow:

PRODUCT

→ CONFIGURATION FLOW

→ STEPS

→ FIELDS

→ OPTIONS

→ DEPENDENCIES

→ COMPONENTS

→ RULES

→ FORMULA

→ DISCOUNTS

→ FINAL PRICE

Supported field types should include:

- Single Select

- Multi Select

- Quantity

- Number

- Text

- Date

- Date Range

- Boolean

- Information / Display Block

Fields can have:

- internal name;

- customer label;

- variable name;

- type;

- required;

- default value;

- order;

- active/inactive.

Dependencies/actions may include:

- SHOW

- HIDE

- REQUIRE

- ENABLE

- DISABLE

- SET VALUE

- SET MINIMUM

- SET MAXIMUM

- RESET / REMOVE

Mutually exclusive options must support:

- square checkbox style;

- selected state with tick;

- last selected option wins;

- previous option is automatically deselected;

- no warning.

Required options:

- clearly marked;

- red;

- bold;

- "(REQUIRED)";

- preset or automatically selected where appropriate;

- cannot be deselected.

Avoid unnecessary required fields.

==================================================

6. PRICING ENGINE

The pricing engine is one of the most important parts of the system.

Internal base currency:

IDR

Admin enters internal costs and customer prices in IDR.

Internal cost and customer price are independent.

Changing internal cost must NOT automatically change customer price unless an explicit pricing relationship has been configured.

The pricing engine must support:

- fixed prices;

- quantity multiplication;

- people;

- days;

- nights;

- sessions;

- combinations;

- tiers;

- conditions;

- configurable variables;

- component prices;

- manual discounts;

- season discounts;

- promo codes;

- eligibility;

- custom formulas.

Each Product may have its own formula.

Do not create one global pricing formula for all Products.

The system should support both:

1. simple visual pricing rules for common products;

2. safe configurable formulas for advanced products.

Do NOT allow arbitrary code execution as a pricing formula.

Formulas must be validated before activation.

Admin must be able to test a formula with sample values.

Formula errors must prevent activation.

The final customer price can never be negative.

==================================================

7. DISCOUNTS

Season is Product-specific.

Each Product can choose whether it uses the season system.

Insurance does not use season.

Motorbike Rental does not use season.

Transport by Car does not use season.

Promo codes use percentage discounts.

Maximum one promo code per purchase.

Insurance is never promo eligible.

If Season and Promo both apply to the same eligible amount:

- calculate both;

- use only the greater monetary discount.

Do not stack both discounts on the same amount.

If they apply to different eligible amounts, they may coexist.

Discount calculation happens before currency conversion.

==================================================

8. CURRENCY

Internal currency:

IDR.

Initial customer currencies:

- USD

- AUD

- NZD

- EUR

Architecture must allow more currencies later.

Exchange rates are dynamic during configuration.

At payment confirmation:

- exchange rate is frozen;

- exact exchange rate is stored;

- converted customer amount is stored;

- date/time is stored.

Historical purchases must never change because of future exchange-rate changes.

Customer-facing prices are whole numbers.

Do not round individual components.

Calculate the final exact amount first.

Then:

IDR

→ customer currency

→ round UP to the next whole currency unit

The rounded amount is the customer-facing/payment amount.

==================================================

9. PACKAGE / CART

Each completed configurator creates one Package.

One Package receives one Voucher after successful payment.

A Cart can contain:

- completed Packages;

- one current unfinished Package.

Different Packages are independent.

Editing one Package must not modify another.

Multiple Packages may be purchased in one checkout.

Example:

3 completed Packages

→ 1 Order

→ 1 Payment flow

→ 3 Purchases / Packages

→ 3 Vouchers

An unfinished current Package must not be accidentally paid.

==================================================

10. CHECKOUT / PAYMENT

Normal purchase:

40% NOW

60% LATER

Gift purchase:

100% NOW

Customer checkout information:

- Name + Surname

- WhatsApp / Phone

- Email

- Country optional

- Is this a gift?

- Personalized gift message if applicable

- Terms & Conditions acceptance

The voucher holder and purchaser must be separate concepts because gifts exist.

Payment states must support:

- PAYMENT PENDING

- PARTIALLY PAID

- FULLY PAID

- PAYMENT FAILED

- PAYMENT UNKNOWN

Payment processing must be idempotent.

Duplicate payment provider notifications must never create duplicate purchases or vouchers.

If payment status is unknown:

- do not charge again;

- reconcile the payment;

- only confirm the purchase after provider confirmation.

==================================================

11. PURCHASE SNAPSHOT

When payment is confirmed, create a self-contained immutable purchase snapshot.

It must preserve at minimum:

- Product;

- Product configuration used;

- selected options;

- variables;

- quantities;

- component prices;

- formula;

- pricing rules;

- discount calculations;

- season calculation;

- promo calculation;

- exact IDR amount;

- customer currency;

- FX rate;

- converted amount;

- rounded customer price;

- paid amount;

- pending amount;

- customer data;

- purchaser;

- voucher holder/recipient where applicable.

Later Product changes must never change the historical purchase.

==================================================

12. VOUCHERS

Global voucher numbering:

CBR-2026-001

CBR-2026-002

CBR-2026-003

One global sequence.

All vouchers have:

8 MONTHS VALIDITY FROM PURCHASE DATE

Voucher statuses:

- ACTIVE

- USED

- EXPIRED

- CANCELLED

Admin may manually correct/reactivate status where necessary.

Voucher deletion must not delete the Purchase or historical transaction.

Voucher regeneration keeps the same voucher number.

==================================================

13. WEBSITE

The public navigation is:

1. BUILD YOUR TRIP

2. CIMAJA AREA — ONE DAY

3. SURF TRIPS — 2–7 DAYS

4. DISCOVER WEST JAVA

5. ACCOMMODATION

6. MOTORBIKE RENTAL / TRANSPORT BY CAR

7. MEET THE BOARDRIDERS

The public website is mobile-first.

The interface must feel:

- simple;

- premium;

- local;

- adventurous;

- clear;

- fast;

- intuitive.

Avoid unnecessary animations and complexity.

==================================================

14. HOME PAGE

Home structure:

1. HERO

2. BUILD YOUR TRIP

3. WHAT IS CIMAJA BOARDRIDERS?

4. DISCOVER WEST JAVA

5. ACCOMMODATION

6. TRANSPORT

7. WHAT OUR GUESTS SAY

Hero:

Fullscreen video.

Title:

CIMAJA BOARDRIDERS

CTA:

DISCOVER WEST JAVA WITH CIMAJA BOARDRIDERS

The CTA should enter the Home content at BUILD YOUR TRIP.

==================================================

15. LANGUAGES

Initial public languages:

- English

- Chinese

- Japanese

- Bahasa Indonesia

- Filipino

- Thai

- Spanish

- Portuguese (Brazil)

English is the master language.

Automatic translation can be used as a starting point.

Translations must remain editable.

Missing translations fall back to English.

The architecture must allow adding languages later without rebuilding the application.

ADMIN IS ENGLISH ONLY.

==================================================

16. MARKETS

Language and market are separate concepts.

Initial market rules:

USA → USD / English

Australia → AUD / English

New Zealand → NZD / English

Other supported European markets → EUR fallback

IP detection may suggest the market.

Customer can manually change market/currency/language.

==================================================

17. SPECIAL MODULES

The architecture must support independent modules for:

- Accommodation

- Hotels

- Rooms

- Transport by Car

- Motorbike Rental

- Experiences

- Insurance

- Team / Collaborators

- Reviews

- Promo Codes

- Legal / Terms

Insurance is NOT a Package.

Insurance does NOT use Cart.

Insurance does NOT use Season.

Insurance does NOT use Promo Codes.

==================================================

18. ADMIN

Admin sections should ultimately include:

1. PRODUCTS

2. PRICES

3. PACKAGES / ORDERS

4. VOUCHERS

5. CUSTOMERS

6. HOTELS / ROOMS

7. TRANSPORT

8. MOTORBIKES

9. TEAM / COLLABORATORS

10. EXPERIENCES

11. INSURANCE

12. PROMO CODES

13. REVIEWS

14. SETTINGS

Admin must be simple enough for a non-programmer business operator.

The architecture should favor:

CREATE

→ CONFIGURE

→ PRICE

→ TEST

→ PREVIEW

→ VALIDATE

→ ACTIVATE

==================================================

19. DATABASE PRINCIPLES

The application should use a robust relational backend.

Prefer PostgreSQL / Supabase architecture if appropriate.

Core entities should be normalized.

Expected groups include:

CATALOG

- Products

- Categories

- Placements

- Configuration Flows

- Steps

- Fields

- Options

- Component Templates

- Product Components

- Rules

- Formulas

OPERATIONS

- Hotels

- Rooms

- Transport Routes

- Motorbike Types

- Experiences

- Team

- Insurance

CUSTOMER

- Customers

COMMERCE

- Carts

- Packages

- Orders

- Payments

- Purchases

- Purchase Snapshots

VOUCHERS

- Vouchers

MARKETING

- Promo Codes

- Reviews

- Analytics Events

LEGAL

- Terms

- Acceptance Records

Do not flatten the entire business into one generic Products table.

==================================================

20. SECURITY

Security must be considered from the beginning.

Admin data must never be publicly writable.

Customers must not be able to modify historical purchases.

Historical purchase data must be protected.

Payment secrets/API keys must never be exposed in client-side code.

Use secure server-side mechanisms / Edge Functions where necessary.

Use appropriate authentication and authorization for Admin/Staff.

==================================================

21. WHAT WE ARE NOT BUILDING

Do NOT build:

- CRM;

- ERP;

- loyalty system;

- marketplace;

- AI recommendations;

- complex inventory management;

- real-time hotel availability;

- complex voucher redemption tracking;

- complex accounting;

- advanced dashboards;

- unnecessary automation.

The architecture should allow future expansion, but V1 must remain focused.

==================================================

22. DEVELOPMENT PRINCIPLE

Do NOT build the entire application in one step.

We will develop the system in controlled phases.

Expected high-level order:

PHASE 0

Architecture / planning

PHASE 1

Database + core backend

PHASE 2

Admin foundation

PHASE 3

Product + Configurator Builder

PHASE 4

Pricing Engine

PHASE 5

Customer Configurator + Cart

PHASE 6

Checkout + Payment

PHASE 7

Purchase + Voucher + Email

PHASE 8

Special Business Modules

PHASE 9

Public Website

PHASE 10

SEO + Analytics + QA + Launch

Each phase will be divided into smaller implementation blocks.

Do not jump ahead unless explicitly instructed.

==================================================

23. VERY IMPORTANT DEVELOPMENT RULE

Before implementing a new feature, check whether it affects:

- Product;

- Package;

- Order;

- Payment;

- Purchase;

- Purchase Snapshot;

- Voucher;

- Pricing;

- Configurator;

- Admin;

- customer UX.

Do not introduce duplicated business logic.

Commercial logic should live in reusable backend/domain services rather than being hardcoded independently into multiple pages.

The public website should consume the same underlying product/configuration/pricing engine used by Admin.

==================================================

24. DESIGN PRINCIPLE

The customer should never need to understand our internal complexity.

The internal system may be sophisticated.

The customer experience must be simple.

Target feeling:

"I choose what I want, I can see how much it costs, and Cimaja Boardriders takes care of the rest."

==================================================

25. FIRST TASK

DO NOT build the full application yet.

First:

1. Analyse the architecture above.

2. Identify any contradictions or dangerous architectural assumptions.

3. Propose the recommended technical architecture.

4. Propose the core database/entity relationships.

5. Propose the development phases and dependencies.

6. Identify what must be decided before database implementation.

7. Identify what can safely remain configurable for later.

8. Explain any important technical risks.

9. Do NOT invent missing business rules.

10. Do NOT create the public website yet.

11. Do NOT create the full Admin UI yet.

12. Do NOT create payment integration yet.

We will review your architectural plan before allowing implementation.

Ask focused clarification questions only where they are genuinely necessary.

Do not ask questions whose answers can safely be handled later through configuration.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://westjavariders.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/091d4d50-b5e5-4363-96b7-68f753c90564).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
