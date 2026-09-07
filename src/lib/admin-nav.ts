export type AdminNavItem = {
  label: string;
  to: string;
  status: "available" | "planned";
  adminOnly?: boolean;
  children?: AdminNavItem[];
};

/** Navigation order is fixed by the platform architecture. */
export const ADMIN_NAV: AdminNavItem[] = [
  { label: "Products", to: "/admin/products", status: "planned" },
  { label: "Prices", to: "/admin/prices", status: "planned" },
  { label: "Packages / Orders", to: "/admin/orders", status: "planned" },
  { label: "Vouchers", to: "/admin/vouchers", status: "planned" },
  { label: "Customers", to: "/admin/customers", status: "planned" },
  { label: "Hotels / Rooms", to: "/admin/hotels", status: "planned" },
  { label: "Transport", to: "/admin/transport", status: "planned" },
  { label: "Motorbikes", to: "/admin/motorbikes", status: "planned" },
  { label: "Team / Collaborators", to: "/admin/team", status: "planned" },
  { label: "Experiences", to: "/admin/experiences", status: "planned" },
  { label: "Insurance", to: "/admin/insurance", status: "planned" },
  { label: "Promo Codes", to: "/admin/promo-codes", status: "planned" },
  { label: "Reviews", to: "/admin/reviews", status: "planned" },
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
