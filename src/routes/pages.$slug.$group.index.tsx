import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { PublicPage } from "@/components/public/SiteHeader";
import { WebsiteRenderer } from "@/components/public/WebsiteRenderer";

const groupRoute = getRouteApi("/pages/$slug/$group");

export const Route = createFileRoute("/pages/$slug/$group/")({
  component: CatalogueGroupIndexRoute,
});

function CatalogueGroupIndexRoute() {
  const { page, group } = groupRoute.useLoaderData();
  return (
    <PublicPage width="full">
      <WebsiteRenderer page={page} showHeading={false} groupKey={group} />
    </PublicPage>
  );
}
