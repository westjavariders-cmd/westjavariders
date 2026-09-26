/**
 * Voucher PDF rendering. Server-only.
 *
 * The PDF is drawn from the already-built document model: no price, season,
 * promotion, deposit or configurator value is recalculated here.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { DocumentModel } from "@/lib/voucher-delivery";

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const TEAL = rgb(0.06, 0.46, 0.43);
const INK = rgb(0.12, 0.16, 0.22);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.88, 0.9, 0.92);

/** Renders one voucher PDF and returns the bytes. */
export async function renderVoucherPdf(model: DocumentModel): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${model.title} ${model.voucher_code}`);
  pdf.setProducer(model.business_name);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let page = pdf.addPage([A4.width, A4.height]);
  let y = A4.height - MARGIN;
  const right = A4.width - MARGIN;

  function ensure(space: number) {
    if (y - space < MARGIN) {
      page = pdf.addPage([A4.width, A4.height]);
      y = A4.height - MARGIN;
    }
  }

  function wrap(text: string, font: typeof regular, size: number, width: number): string[] {
    const words = String(text).split(/\s+/).filter(Boolean);
    const rows: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && current) {
        rows.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) rows.push(current);
    return rows.length > 0 ? rows : [""];
  }

  function paragraph(text: string, opts?: { size?: number; font?: typeof regular; color?: typeof INK; gap?: number }) {
    const size = opts?.size ?? 10.5;
    const font = opts?.font ?? regular;
    for (const row of wrap(text, font, size, right - MARGIN)) {
      ensure(size + 4);
      page.drawText(row, { x: MARGIN, y: y - size, size, font, color: opts?.color ?? INK });
      y -= size + 4;
    }
    y -= opts?.gap ?? 4;
  }

  function heading(text: string) {
    ensure(28);
    y -= 8;
    page.drawText(text.toUpperCase(), { x: MARGIN, y: y - 9, size: 9, font: bold, color: TEAL });
    y -= 16;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 0.75, color: LINE });
    y -= 12;
  }

  function row(label: string, valueText: string) {
    const size = 10.5;
    const labelWidth = 150;
    const rows = wrap(valueText, regular, size, right - MARGIN - labelWidth - 12);
    ensure(rows.length * (size + 3) + 4);
    page.drawText(label, { x: MARGIN, y: y - size, size, font: regular, color: MUTED });
    rows.forEach((line, i) => {
      page.drawText(line, { x: MARGIN + labelWidth, y: y - size - i * (size + 3), size, font: bold, color: INK });
    });
    y -= rows.length * (size + 3) + 4;
  }

  // Brand header
  page.drawRectangle({ x: 0, y: A4.height - 92, width: A4.width, height: 92, color: TEAL });
  page.drawText(model.business_name.toUpperCase(), {
    x: MARGIN,
    y: A4.height - 46,
    size: 12,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(model.title, { x: MARGIN, y: A4.height - 72, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText(model.type_label, {
    x: right - regular.widthOfTextAtSize(model.type_label, 10),
    y: A4.height - 46,
    size: 10,
    font: regular,
    color: rgb(0.9, 0.97, 0.96),
  });
  y = A4.height - 92 - 28;

  // Voucher number
  page.drawRectangle({ x: MARGIN, y: y - 44, width: right - MARGIN, height: 52, color: rgb(0.97, 0.98, 0.98) });
  page.drawText("Voucher number", { x: MARGIN + 14, y: y - 6, size: 9, font: regular, color: MUTED });
  page.drawText(model.voucher_code, { x: MARGIN + 14, y: y - 32, size: 20, font: bold, color: INK });
  y -= 68;

  heading("Your experience");
  paragraph(model.experience.package_title, { size: 13, font: bold, gap: 10 });
  for (const item of model.experience.items) {
    if (item.product_title !== model.experience.package_title) {
      paragraph(item.product_title, { size: 11, font: bold, gap: 6 });
    }
    if (item.options.length > 0) {
      paragraph("Your answers", { size: 9, font: bold, color: TEAL, gap: 6 });
      for (const option of item.options) {
        paragraph(option.label, { size: 9, color: MUTED, gap: 0 });
        paragraph(option.value, { size: 11, font: bold, gap: 8 });
      }
    }
    if (item.base_price) paragraph(`Base price: ${item.base_price}`, { size: 10, color: MUTED, gap: 0 });
    for (const b of item.breakdown) paragraph(`${b.label}: ${b.value}`, { size: 10, color: MUTED, gap: 0 });
    if (item.total) paragraph(`Package total: ${item.total}`, { size: 10.5, font: bold, gap: 0 });
    if (item.people != null) paragraph(`People: ${item.people}`, { size: 10, color: MUTED, gap: 0 });
    if (item.quantity != null) paragraph(`Quantity: ${item.quantity}`, { size: 10, color: MUTED, gap: 0 });
    y -= 4;
  }


  if (model.gift) {
    heading("Your gift");
    if (model.gift.recipient_name) row("For", model.gift.recipient_name);
    if (model.gift.message) {
      for (const line of wrap(model.gift.message, italic, 11, right - MARGIN - 16)) {
        ensure(16);
        page.drawText(line, { x: MARGIN + 8, y: y - 11, size: 11, font: italic, color: INK });
        y -= 15;
      }
      y -= 4;
    }
  } else if (model.holder_name) {
    heading("Voucher holder");
    row("Name", model.holder_name);
  }

  heading("Validity");
  for (const line of model.validity) row(line.label, line.value);

  if (model.commercial.length > 0) {
    heading("Booking");
    for (const line of model.commercial) row(line.label, line.value);
  }

  heading("How to use this voucher");
  for (const step of model.usage_instructions) paragraph(`- ${step}`, { size: 10.5, gap: 0 });

  heading("Contact");
  for (const line of model.contact) row(line.label, line.value);

  return await pdf.save();
}
