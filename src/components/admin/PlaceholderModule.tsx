import { PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";

export function PlaceholderModule({ title, note }: { title: string; note?: string }) {
  return (
    <>
      <PageHeader title={title} breadcrumb={["Admin", title]} />
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium">This module is not implemented yet.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {note ??
              "It is part of a later build phase. No data is available here yet."}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
