import { describe, expect, it } from "vitest";

import { MOTORBIKE_PHOTO_BUCKET, motorbikeMargin, motorbikePhotoPath, validateMotorbike } from "@/lib/motorbike";
import { parseIdr } from "@/lib/transport";

const base = { internal_name: "Honda Vario 125", supplier_cost_idr: 60000, customer_price_idr: 100000 };

describe("motorbike validation", () => {
  it("accepts a valid motorbike and requires a name", () => {
    expect(validateMotorbike(base)).toEqual([]);
    expect(validateMotorbike({ ...base, internal_name: "  " })).toHaveLength(1);
  });

  it("allows zero prices", () => {
    expect(validateMotorbike({ ...base, supplier_cost_idr: 0, customer_price_idr: 0 })).toEqual([]);
  });

  it("rejects negative prices", () => {
    expect(validateMotorbike({ ...base, supplier_cost_idr: -1 })).toHaveLength(1);
    expect(validateMotorbike({ ...base, customer_price_idr: -100 })).toHaveLength(1);
  });

  it("rejects fractional Rupiah so money stays whole", () => {
    expect(validateMotorbike({ ...base, supplier_cost_idr: 60000.5 })).toHaveLength(1);
    expect(validateMotorbike({ ...base, customer_price_idr: 100000.25 })).toHaveLength(1);
    expect(parseIdr("100.000")).toBe(100000);
  });
});

describe("motorbike margin", () => {
  it("reports informational margin and percentage", () => {
    expect(motorbikeMargin(60000, 100000)).toEqual({ amount: 40000, percentage: 40 });
    expect(motorbikeMargin(0, 0)).toEqual({ amount: 0, percentage: 0 });
    expect(motorbikeMargin(150000, 100000)).toEqual({ amount: -50000, percentage: -50 });
  });
});

describe("motorbike photo storage", () => {
  it("uses the private bucket and an unguessable path", () => {
    expect(MOTORBIKE_PHOTO_BUCKET).toBe("motorbike-photos");
    const id = "11111111-1111-1111-1111-111111111111";
    const a = motorbikePhotoPath(id, "my photo!.jpg");
    const b = motorbikePhotoPath(id, "my photo!.jpg");
    expect(a).not.toBe(b);
    expect(a.startsWith(`${id}/`)).toBe(true);
    expect(a).toMatch(/my-photo-\.jpg$/);
  });
});
