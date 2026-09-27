import { describe, expect, it } from "vitest";

import { isSvgUpload, prepareImageForUpload, webpUploadName } from "@/lib/encode-upload-image";

describe("webp upload names", () => {
  it("keeps a readable stem and always ends in .webp", () => {
    expect(webpUploadName("surf photo!.jpg")).toBe("surf-photo.webp");
    expect(webpUploadName("hero.PNG")).toBe("hero.webp");
    expect(webpUploadName("already.webp")).toBe("already.webp");
  });

  it("flattens folders so Storage sees one object name", () => {
    expect(webpUploadName("../secret.jpg")).not.toContain("/");
    expect(webpUploadName("a/b/c.jpeg")).toBe("a-b-c.webp");
  });
});

describe("svg uploads", () => {
  it("detects SVG so Admin does not rasterize logos", () => {
    expect(isSvgUpload(new File([""], "mark.svg", { type: "image/svg+xml" }))).toBe(true);
    expect(isSvgUpload(new File([""], "wave.jpg", { type: "image/jpeg" }))).toBe(false);
  });

  it("refuses SVG before any conversion", async () => {
    await expect(
      prepareImageForUpload(new File(["<svg/>"], "mark.svg", { type: "image/svg+xml" })),
    ).rejects.toThrow(/SVG/);
  });
});
