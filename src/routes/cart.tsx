import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  PublicPage,
  PUBLIC_CART_KEY,
  displayTotal,
  usePublicCart,
} from "@/components/public/SiteHeader";
import { formatIdr } from "@/lib/public-catalog";
import { discardDraftPackage, removeCartPackage } from "@/lib/cart.functions";
import { saveTrip } from "@/lib/saved-trip.functions";
import { confirmCheckout, getCheckoutSummary } from "@/lib/purchase.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendContactRequest } from "@/lib/contact.functions";
import { useUiStrings } from "@/hooks/use-ui-strings";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart | Cimaja Boardriders" },
      {
        name: "description",
        content:
          "Review the packages you have built for your Cimaja surf and travel trip before booking.",
      },
      { property: "og:title", content: "Your Cart — Cimaja Boardriders" },
      {
        property: "og:description",
        content: "Review the packages you have built for your Cimaja surf and travel trip.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const t = useUiStrings();
  const cart = usePublicCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remove = useServerFn(removeCartPackage);
  const discard = useServerFn(discardDraftPackage);
  const summaryFn = useServerFn(getCheckoutSummary);
  const pay = useServerFn(confirmCheckout);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [contact, setContact] = useState({ full_name: "", email: "", phone: "", country: "" });
  const [isGift, setIsGift] = useState(false);
  const [gift, setGift] = useState({ recipient: "", message: "" });
  const [riskAccepted, setRiskAccepted] = useState(false);

  // Server-authoritative amounts: what would be charged right now.
  const summary = useQuery({
    queryKey: ["cart-payment-summary"],
    queryFn: () => summaryFn({ data: undefined as never }),
    refetchOnWindowFocus: false,
  });
  const money = summary.data;
  const blockers = money?.blockers ?? [];

  async function payNow() {
    setBusy("pay");
    try {
      const result = await pay({
        data: {
          ...contact,
          is_gift: isGift,
          gift_recipient_name: isGift ? gift.recipient : undefined,
          gift_message: isGift ? gift.message : undefined,
          risk_accepted: riskAccepted,
        },
      });
      await queryClient.invalidateQueries({ queryKey: PUBLIC_CART_KEY });
      const id = result.purchase?.id;
      if (!id) throw new Error("This booking could not be created.");
      if (result.payment_url) {
        window.location.assign(result.payment_url);
        return;
      }
      navigate({ to: "/purchase/$purchaseId", params: { purchaseId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This payment could not be started.");
      await summary.refetch();
    } finally {
      setBusy(null);
    }
  }

  async function run(key: string, fn: () => Promise<unknown>, failure: string) {
    setBusy(key);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: PUBLIC_CART_KEY });
      await cart.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : failure);
    } finally {
      setBusy(null);
    }
  }

  const packages = cart.data?.packages ?? [];
  const draft = cart.data?.draft ?? null;

  return (
    <PublicPage>
      <h1 className="text-2xl font-semibold tracking-tight">{t("Your cart")}</h1>

      {cart.isPending && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}

      {!cart.isPending && packages.length === 0 && !draft && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">{t("Your cart is empty.")}</p>
          <Button onClick={() => navigate({ to: "/build-your-trip" })}>{t("Build your trip")}</Button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {packages.map((p) => (
          <Card key={p.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">
                  {p.product_id
                    ? `${p.product_title.toUpperCase()} — PACKAGE`
                    : p.product_title.toUpperCase()}
                </p>
                <p className="text-base font-semibold">{formatIdr(p.total_idr)}</p>
              </div>
              <button
                type="button"
                className="text-xs uppercase tracking-[0.14em] text-muted-foreground underline"
                onClick={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))}
              >
                {open[p.id] ? t("Hide details") : t("View details")}
              </button>
              {open[p.id] && (
                <dl className="space-y-1 border-t border-border pt-3 text-sm">
                  {p.summary.map((line) => (
                    <div key={line.label} className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{line.label}</dt>
                      <dd className="text-right">{line.value}</dd>
                    </div>
                  ))}
                  {p.promo_code && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{t("Promo code")}</dt>
                      <dd>{p.promo_code}</dd>
                    </div>
                  )}
                </dl>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={busy === p.id}
                onClick={() =>
                  run(
                    p.id,
                    () => remove({ data: { packageId: p.id } }),
                    "This package could not be removed.",
                  )
                }
              >
                {t("Remove")}
              </Button>
            </CardContent>
          </Card>
        ))}

        {draft && (
          <Card className="border-dashed">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">
                  {draft.product_title.toUpperCase()} — CURRENT PACKAGE
                </p>
                <p className="text-base font-semibold">{formatIdr(draft.total_idr)}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Not finished yet, so it is not part of your total.
              </p>
              <div className="flex flex-wrap gap-2">
                {draft.product_id && (
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate({
                        to: "/build-your-trip/$productId",
                        params: { productId: draft.product_id as string },
                      })
                    }
                  >
                    {t("Continue current package")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === "draft"}
                  onClick={() =>
                    run("draft", () => discard(), "This package could not be discarded.")
                  }
                >
                  {t("Discard")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {(packages.length > 0 || draft) && (
        <div className="mt-6 space-y-3 border-t border-border pt-4">
          {money && (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-sm">
                  {t("To pay now")} ({money.first_payment_percentage}%)
                </span>
                <span className="text-xl font-semibold">
                  {displayTotal(money.first_payment_idr, money.fx, money.customer_first_payment)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("Balance, settled with us before your trip")}
                </span>
                <span className="text-base">
                  {displayTotal(money.outstanding_idr, money.fx, money.customer_outstanding)}
                </span>
              </div>
              {money.fx.currency_code !== "IDR" && (
                <p className="text-xs text-muted-foreground">
                  Fixed when you pay. Payment is taken in Rupiah:{" "}
                  {formatIdr(money.first_payment_idr)} now, {formatIdr(money.outstanding_idr)} as the
                  balance.
                </p>
              )}
            </>
          )}

          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-sm uppercase tracking-[0.14em] text-muted-foreground">
              {t("Total price")}
            </span>
            <span className="text-2xl font-semibold">
              {displayTotal(
                money?.total_idr ?? cart.data?.payable_total_idr ?? 0,
                money?.fx ?? cart.data?.fx,
                money?.customer_total ?? cart.data?.payable_total_customer,
              )}
            </span>
          </div>


          {money?.existing_purchase_id && (
            <Button
              className="w-full"
              onClick={() =>
                navigate({
                  to: "/purchase/$purchaseId",
                  params: { purchaseId: money.existing_purchase_id! },
                })
              }
            >
              View your booking
            </Button>
          )}

          {!money?.existing_purchase_id && (
            <>
              {blockers.length > 0 && (
                <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  {blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}

              <div className="space-y-3 border-t border-border pt-4">
                <h2 className="text-sm uppercase tracking-[0.14em] text-muted-foreground">
                  Your contact details
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span>{t("Full name")}</span>
                    <Input
                      value={contact.full_name}
                      autoComplete="name"
                      onChange={(e) => setContact({ ...contact, full_name: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>{t("Email")}</span>
                    <Input
                      type="email"
                      value={contact.email}
                      autoComplete="email"
                      onChange={(e) => setContact({ ...contact, email: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>Phone / WhatsApp</span>
                    <Input
                      value={contact.phone}
                      autoComplete="tel"
                      onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>Country (optional)</span>
                    <Input
                      value={contact.country}
                      autoComplete="country-name"
                      onChange={(e) => setContact({ ...contact, country: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              <label className="flex items-start gap-3 border-t border-border pt-4 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={isGift}
                  onChange={(e) => setIsGift(e.target.checked)}
                />
                <span>
                  <span className="font-medium">{t("This is a gift")}</span>
                  <span className="block text-xs text-muted-foreground">
                    We send everything to you, so you can give it yourself. The price is never
                    shown on a gift.
                  </span>
                </span>
              </label>

              {isGift && (
                <div className="space-y-3">
                  <label className="block space-y-1 text-sm">
                    <span>Who is it for? (optional)</span>
                    <Input
                      value={gift.recipient}
                      onChange={(e) => setGift({ ...gift, recipient: e.target.value })}
                    />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span>Your message (optional)</span>
                    <textarea
                      className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      maxLength={200}
                      value={gift.message}
                      onChange={(e) => setGift({ ...gift, message: e.target.value })}
                    />
                    <span className="block text-xs text-muted-foreground">
                      {gift.message.length}/200 characters
                    </span>
                  </label>
                </div>
              )}

              <label className="flex items-start gap-3 border-t border-border pt-4 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={riskAccepted}
                  onChange={(e) => setRiskAccepted(e.target.checked)}
                />
                <span>
                  I understand that surfing and travel activities carry risks, and I accept the
                  booking conditions.
                </span>
              </label>

              <Button
                className="w-full"
                disabled={
                  packages.length === 0 ||
                  busy === "pay" ||
                  blockers.length > 0 ||
                  !riskAccepted ||
                  summary.isPending
                }
                onClick={payNow}
              >
                {busy === "pay" ? t("Opening payment…") : t("Pay now")}
              </Button>
            </>
          )}

          {packages.length > 0 && <ShareTrip />}
          <ContactUs />

          <Link
            to="/build-your-trip"
            className="block text-center text-sm underline underline-offset-2"
          >
            Continue shopping
          </Link>
        </div>
      )}
    </PublicPage>
  );
}

/** Shares the trip that already belongs to this cart. Creates nothing new. */
function ShareTrip() {
  const t = useUiStrings();
  const save = useServerFn(saveTrip);
  const [code, setCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const url = code && typeof window !== "undefined" ? `${window.location.origin}/trip/${code}` : "";

  async function onSave() {
    setSaving(true);
    try {
      const result = await save({ data: undefined as never });
      setCode(result.code);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This link could not be prepared.");
    } finally {
      setSaving(false);
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("This link could not be copied. Please select it and copy it manually.");
    }
  }

  async function onShare() {
    try {
      await navigator.share({ title: "My trip", url });
    } catch {
      /* The customer cancelled the share sheet. */
    }
  }

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  if (!code) {
    return (
      <div className="space-y-1 border-t border-border pt-4">
        <Button variant="outline" className="w-full" disabled={saving} onClick={onSave}>
          {saving ? t("Preparing link…") : t("SHARE YOUR TRIP")}
        </Button>
        <p className="text-xs text-muted-foreground">
          Share your trip with your travel companions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="text-sm uppercase tracking-[0.14em] text-muted-foreground">
        Share your trip
      </p>
      <p className="text-xs text-muted-foreground">Share this link with your travel companions:</p>
      <p className="break-all rounded-md border border-border p-2 text-sm">{url}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onCopy}>
          COPY LINK
        </Button>
        {canShare && (
          <Button variant="outline" size="sm" onClick={onShare}>
            SHARE
          </Button>
        )}
      </div>
    </div>
  );
}

/** A customer question, sent to the business with the vouchers of this cart. */
function ContactUs() {
  const t = useUiStrings();
  const send = useServerFn(sendContactRequest);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", message: "" });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    try {
      await send({
        data: {
          full_name: form.full_name,
          phone: form.phone || null,
          email: form.email,
          message: form.message,
        },
      });
      setSent(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This question could not be sent.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-1 border-t border-border pt-4">
        <p className="text-sm uppercase tracking-[0.14em] text-muted-foreground">{t("Thank you")}</p>
        <p className="text-xs text-muted-foreground">
          We have your question and the trip you were configuring. We will reply by email or
          WhatsApp as soon as possible.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="border-t border-border pt-4">
        <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
          DO YOU HAVE ANY QUESTIONS? CONTACT US
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 border-t border-border pt-4">
      <p className="text-sm uppercase tracking-[0.14em] text-muted-foreground">{t("Contact us")}</p>
      <Input
        placeholder={t("Full name")}
        value={form.full_name}
        maxLength={200}
        required
        onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
      />
      <Input
        placeholder={t("WhatsApp / phone")}
        value={form.phone}
        maxLength={60}
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
      />
      <Input
        type="email"
        placeholder={t("Email")}
        value={form.email}
        maxLength={320}
        required
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
      />
      <Textarea
        placeholder={t("Your question")}
        value={form.message}
        maxLength={4000}
        required
        rows={4}
        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={sending}>
          {sending ? t("Sending…") : t("SEND")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
          CANCEL
        </Button>
      </div>
    </form>
  );
}
