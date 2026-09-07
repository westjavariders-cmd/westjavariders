import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cimaja Boardriders | Surf & Travel in West Java" },
      {
        name: "description",
        content:
          "Cimaja Boardriders — surf, travel and local experiences based in Cimaja, West Java, Indonesia. The public site is in preparation.",
      },
      { property: "og:title", content: "Cimaja Boardriders" },
      {
        property: "og:description",
        content:
          "Surf, travel and local experiences based in Cimaja, West Java, Indonesia. The public site is in preparation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Cimaja Boardriders</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Surf, travel and local experiences in Cimaja, West Java. The public site is in
          preparation.
        </p>
        <p className="mt-6 text-sm">
          <Link to="/admin" className="underline underline-offset-2">
            Staff sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
