import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  formatIdr,
  moveItem,
  parseIdr,
  roomMargin,
  type AccommodationRoom,
  type RoomCharacteristic,
} from "@/lib/accommodation";
import {
  createRoom,
  deleteRoom,
  duplicateRoom,
  reorderRooms,
  setRoomActive,
  updateRoom,
} from "@/lib/accommodation.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { PhotoManager } from "./PhotoManager";

type Draft = {
  id: string | null;
  internal_name: string;
  public_name: string;
  internal_reference: string;
  description: string;
  internal_notes: string;
  max_guests: string;
  supplier_cost: string;
  customer_price: string;
  active: boolean;
  characteristics: { name: string; value: string }[];
};

const emptyDraft: Draft = {
  id: null,
  internal_name: "",
  public_name: "",
  internal_reference: "",
  description: "",
  internal_notes: "",
  max_guests: "2",
  supplier_cost: "0",
  customer_price: "0",
  active: false,
  characteristics: [],
};

type RoomRow = AccommodationRoom & {
  accommodation_room_characteristics: RoomCharacteristic[];
};

export function RoomsPanel({
  accommodationId,
  accommodationActive,
  isCamping,
  canEdit,
}: {
  accommodationId: string;
  accommodationActive: boolean;
  isCamping: boolean;
  canEdit: boolean;
}) {
  const create = useServerFn(createRoom);
  const update = useServerFn(updateRoom);
  const remove = useServerFn(deleteRoom);
  const duplicate = useServerFn(duplicateRoom);
  const setActive = useServerFn(setRoomActive);
  const reorder = useServerFn(reorderRooms);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [photosFor, setPhotosFor] = useState<string | null>(null);

  const label = isCamping ? "camping option" : "room";

  const rooms = useQuery({
    queryKey: ["accommodation-rooms", accommodationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accommodation_rooms")
        .select("*, accommodation_room_characteristics(*)")
        .eq("accommodation_id", accommodationId)
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as RoomRow[];
    },
  });

  function openEdit(room: RoomRow) {
    setDraft({
      id: room.id,
      internal_name: room.internal_name,
      public_name: room.public_name ?? "",
      internal_reference: room.internal_reference ?? "",
      description: room.description ?? "",
      internal_notes: room.internal_notes ?? "",
      max_guests: String(room.max_guests),
      supplier_cost: String(room.supplier_cost_per_night_idr),
      customer_price: String(room.customer_price_per_night_idr),
      active: room.active,
      characteristics: [...room.accommodation_room_characteristics]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => ({ name: c.name, value: c.value ?? "" })),
    });
  }

  async function submit() {
    if (!draft) return;
    const cost = parseIdr(draft.supplier_cost);
    const price = parseIdr(draft.customer_price);
    const guests = Number(draft.max_guests);
    if (cost === null || price === null) {
      toast.error("Amounts must be whole Rupiah numbers.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        accommodation_id: accommodationId,
        internal_name: draft.internal_name,
        public_name: draft.public_name,
        internal_reference: draft.internal_reference,
        description: draft.description,
        internal_notes: draft.internal_notes,
        max_guests: Number.isFinite(guests) ? Math.trunc(guests) : 0,
        supplier_cost_per_night_idr: cost,
        customer_price_per_night_idr: price,
        active: draft.active,
        characteristics: draft.characteristics,
      };
      if (draft.id) await update({ data: { ...payload, id: draft.id } });
      else await create({ data: payload });
      toast.success(`The ${label} was saved.`);
      setDraft(null);
      void rooms.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `This ${label} could not be saved.`);
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const rows = rooms.data ?? [];
    const next = moveItem(rows, index, direction);
    if (next === rows) return;
    try {
      await reorder({ data: { accommodation_id: accommodationId, orderedIds: next.map((r) => r.id) } });
      void rooms.refetch();
    } catch {
      toast.error("The order could not be saved.");
    }
  }

  const rows = rooms.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isCamping
            ? "Camping options are priced per night and multiplied by the number of nights."
            : "Rooms are priced per night. The customer price is set directly and is independent from the supplier cost."}
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setDraft({ ...emptyDraft })}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New {label}
          </Button>
        )}
      </div>

      {!accommodationActive && rows.some((r) => r.active) && (
        <p className="text-xs text-amber-600">
          This accommodation is inactive, so none of its {label}s can be selected commercially.
        </p>
      )}

      {draft && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-medium">
              {draft.id ? `Edit ${label}` : `New ${label}`}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Internal name</Label>
                <Input
                  className="h-8 text-xs"
                  value={draft.internal_name}
                  onChange={(e) => setDraft({ ...draft, internal_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Public name</Label>
                <Input
                  className="h-8 text-xs"
                  value={draft.public_name}
                  onChange={(e) => setDraft({ ...draft, public_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Internal reference</Label>
                <Input
                  className="h-8 text-xs"
                  value={draft.internal_reference}
                  onChange={(e) => setDraft({ ...draft, internal_reference: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Maximum guests</Label>
                <Input
                  className="h-8 text-xs"
                  value={draft.max_guests}
                  onChange={(e) => setDraft({ ...draft, max_guests: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Supplier cost per night (IDR)</Label>
                <Input
                  className="h-8 text-xs"
                  value={draft.supplier_cost}
                  onChange={(e) => setDraft({ ...draft, supplier_cost: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Customer price per night (IDR)</Label>
                <Input
                  className="h-8 text-xs"
                  value={draft.customer_price}
                  onChange={(e) => setDraft({ ...draft, customer_price: e.target.value })}
                />
              </div>
            </div>

            <MarginLine cost={draft.supplier_cost} price={draft.customer_price} />

            <div>
              <Label className="text-xs">Customer description</Label>
              <Textarea
                className="text-xs"
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs">Internal notes</Label>
              <Textarea
                className="text-xs"
                rows={2}
                value={draft.internal_notes}
                onChange={(e) => setDraft({ ...draft, internal_notes: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Characteristics</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      characteristics: [...draft.characteristics, { name: "", value: "" }],
                    })
                  }
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              </div>
              {draft.characteristics.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Add any characteristic you need, for example "Bathroom / Private" or "Beds / 2 singles".
                </p>
              )}
              {draft.characteristics.map((c, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    className="h-8 text-xs"
                    placeholder="Name"
                    value={c.name}
                    onChange={(e) => {
                      const next = draft.characteristics.slice();
                      next[index] = { ...c, name: e.target.value };
                      setDraft({ ...draft, characteristics: next });
                    }}
                  />
                  <Input
                    className="h-8 text-xs"
                    placeholder="Value"
                    value={c.value}
                    onChange={(e) => {
                      const next = draft.characteristics.slice();
                      next[index] = { ...c, value: e.target.value };
                      setDraft({ ...draft, characteristics: next });
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        characteristics: moveItem(draft.characteristics, index, -1),
                      })
                    }
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        characteristics: moveItem(draft.characteristics, index, 1),
                      })
                    }
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        characteristics: draft.characteristics.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={draft.active}
                onCheckedChange={(v) => setDraft({ ...draft, active: v })}
              />
              <Label className="text-xs">Active</Label>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={() => void submit()} disabled={busy}>
                {busy ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {label}s yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((room, index) => {
            const margin = roomMargin(
              room.supplier_cost_per_night_idr,
              room.customer_price_per_night_idr,
            );
            return (
              <Card key={room.id}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {room.internal_name}
                        {room.public_name ? ` — ${room.public_name}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Up to {room.max_guests} guests · cost{" "}
                        {formatIdr(room.supplier_cost_per_night_idr)} · price{" "}
                        {formatIdr(room.customer_price_per_night_idr)} · margin{" "}
                        {formatIdr(margin.amount)} ({margin.percentage.toFixed(1)}%)
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={room.active ? "default" : "secondary"}>
                        {room.active ? "Active" : "Inactive"}
                      </Badge>
                      {canEdit && (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void move(index, -1)}>
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void move(index, 1)}>
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(room)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await setActive({ data: { id: room.id, active: !room.active } });
                              void rooms.refetch();
                            }}
                          >
                            {room.active ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={async () => {
                              try {
                                await duplicate({ data: { id: room.id } });
                                toast.success(`The ${label} was duplicated.`);
                                void rooms.refetch();
                              } catch {
                                toast.error(`This ${label} could not be duplicated.`);
                              }
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={async () => {
                              if (!confirm(`Delete "${room.internal_name}"? This cannot be undone.`)) return;
                              await remove({ data: { id: room.id } });
                              toast.success(`The ${label} was deleted.`);
                              void rooms.refetch();
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => setPhotosFor(photosFor === room.id ? null : room.id)}
                  >
                    {photosFor === room.id ? "Hide photos" : "Photos"}
                  </Button>
                  {photosFor === room.id && (
                    <PhotoManager owner={{ roomId: room.id }} canEdit={canEdit} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MarginLine({ cost, price }: { cost: string; price: string }) {
  const c = parseIdr(cost);
  const p = parseIdr(price);
  if (c === null || p === null) return null;
  const margin = roomMargin(c, p);
  return (
    <p className="text-xs text-muted-foreground">
      Margin: {formatIdr(margin.amount)} ({margin.percentage.toFixed(1)}%) — informational only.
    </p>
  );
}
