import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Star, Trash2, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET, moveItem, type AccommodationPhoto } from "@/lib/accommodation";
import { addPhoto, deletePhoto, reorderPhotos, setPrimaryPhoto } from "@/lib/accommodation.functions";
import { Button } from "@/components/ui/button";

type Owner = { accommodationId: string } | { roomId: string };

export function PhotoManager({ owner, canEdit }: { owner: Owner; canEdit: boolean }) {
  const column = "accommodationId" in owner ? "accommodation_id" : "room_id";
  const value = "accommodationId" in owner ? owner.accommodationId : owner.roomId;

  const add = useServerFn(addPhoto);
  const remove = useServerFn(deletePhoto);
  const makePrimary = useServerFn(setPrimaryPhoto);
  const reorder = useServerFn(reorderPhotos);

  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const photos = useQuery({
    queryKey: ["accommodation-photos", column, value],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accommodation_photos")
        .select("*")
        .eq(column, value)
        .order("sort_order");
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as AccommodationPhoto[];
      const signed = await Promise.all(
        rows.map(async (p) => {
          const { data: url } = await supabase.storage
            .from(PHOTO_BUCKET)
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, url: url?.signedUrl ?? null };
        }),
      );
      return signed;
    },
  });

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-");
        const path = `${column}/${value}/${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file);
        if (error) throw new Error(error.message);
        await add({
          data:
            column === "accommodation_id"
              ? { accommodation_id: value, storage_path: path }
              : { room_id: value, storage_path: path },
        });
      }
      toast.success("Photos added.");
      void photos.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The photo could not be uploaded.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const rows = photos.data ?? [];
    const next = moveItem(rows, index, direction);
    if (next === rows) return;
    try {
      await reorder({ data: { orderedIds: next.map((p) => p.id) } });
      void photos.refetch();
    } catch {
      toast.error("The photos could not be reordered.");
    }
  }

  const rows = photos.data ?? [];

  return (
    <div className="space-y-3">
      {canEdit && (
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void upload(e.target.files)}
          />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {busy ? "Uploading..." : "Add photos"}
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rows.map((photo, index) => (
            <div key={photo.id} className="overflow-hidden rounded-md border">
              {photo.url ? (
                <img
                  src={photo.url}
                  alt={photo.alt_text ?? "Accommodation photo"}
                  className="h-28 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-28 items-center justify-center text-xs text-muted-foreground">
                  Preview unavailable
                </div>
              )}
              <div className="flex items-center justify-between gap-1 p-1.5">
                <span className="text-[11px] text-muted-foreground">
                  {photo.is_primary ? "Primary" : `#${index + 1}`}
                </span>
                {canEdit && (
                  <div className="flex items-center gap-0.5">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => void move(index, -1)}>
                      <ArrowLeft className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => void move(index, 1)}>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={async () => {
                        await makePrimary({ data: { id: photo.id } });
                        void photos.refetch();
                      }}
                    >
                      <Star className={`h-3 w-3 ${photo.is_primary ? "fill-current" : ""}`} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={async () => {
                        if (!confirm("Remove this photo?")) return;
                        await remove({ data: { id: photo.id } });
                        void photos.refetch();
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
