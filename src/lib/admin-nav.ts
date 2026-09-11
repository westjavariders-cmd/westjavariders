export type AdminNavItem = {
  label: string;
  to: string;
  status: "available" | "planned";
  adminOnly?: boolean;
  children?: AdminNavItem[];
};

/** Navigation order is fixed by the platform architecture. */
export const ADMIN_NAV: AdminNavItem[] = [
  {
    label: "Products",
    to: "/admin/products",
    status: "available",
    children: [
      { label: "All Products", to: "/admin/products", status: "available" },
      { label: "Component Templates", to: "/admin/component-templates", status: "available" },
      { label: "Categories & Placements", to: "/admin/catalog-taxonomy", status: "available" },
    ],
  },
  { label: "Prices", to: "/admin/prices", status: "planned" },
  { label: "Packages / Orders", to: "/admin/orders", status: "available" },
  { label: "Vouchers", to: "/admin/vouchers", status: "available" },
  { label: "Customers", to: "/admin/customers", status: "available" },
  { label: "Hotels / Rooms", to: "/admin/hotels", status: "available" },
  { label: "Transport", to: "/admin/transport", status: "available" },
  { label: "Motorbikes", to: "/admin/motorbikes", status: "available" },
  { label: "Team / Collaborators", to: "/admin/team", status: "planned" },
  { label: "Experiences", to: "/admin/experiences", status: "planned" },
  { label: "Insurance", to: "/admin/insurance", status: "planned" },
  { label: "Promo Codes", to: "/admin/promo-codes", status: "available" },
  { label: "Reviews", to: "/admin/reviews", status: "planned" },
  {
    label: "Website",
    to: "/admin/website",
    status: "available",
    children: [
      { label: "Pages", to: "/admin/website", status: "available" },
      { label: "Entry / Landing", to: "/admin/website/landing", status: "available" },
      { label: "Navigation", to: "/admin/website/navigation", status: "available" },
    ],
  },
  {
    label: "Settings",
    to: "/admin/settings",
    status: "available",
    children: [
      { label: "General", to: "/admin/settings", status: "available", adminOnly: false },
      { label: "Currencies", to: "/admin/settings/currencies", status: "available" },
      { label: "Languages", to: "/admin/settings/languages", status: "available" },
      { label: "Markets", to: "/admin/settings/markets", status: "available" },
      { label: "Users & Roles", to: "/admin/settings/users", status: "available", adminOnly: true },
      { label: "Audit Log", to: "/admin/settings/audit", status: "available" },
    ],
  },
];
