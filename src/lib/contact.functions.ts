import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Contact us from the cart. Anonymous like the rest of the public flow: the
 * enquiry is stored and emailed to the business with the vouchers of the
 * current cart, and nothing commercial is created or changed.
 */
const contactSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(60).nullable().optional(),
  email: z.string().trim().email().max(320),
  message: z.string().trim().min(1).max(4000),
});

export const sendContactRequest = createServerFn({ method: "POST" })
  .inputValidator((data) => contactSchema.parse(data))
  .handler(async ({ data }) => {
    const { submitContactRequest } = await import("@/lib/contact.server");
    return submitContactRequest({
      full_name: data.full_name,
      phone: data.phone ?? null,
      email: data.email,
      message: data.message,
    });
  });
