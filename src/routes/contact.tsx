import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PublicPage } from "@/components/public/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendWebsiteContact } from "@/lib/contact.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact us | West Java Riders" },
      {
        name: "description",
        content: "Send a message to the West Java Riders team in Cimaja.",
      },
    ],
  }),
  component: ContactRoute,
});

function ContactRoute() {
  const send = useServerFn(sendWebsiteContact);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    try {
      await send({ data: { email, message } });
      setSent(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <PublicPage>
      <div className="space-y-6 py-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Contact us</h1>
          <p className="text-sm text-muted-foreground">
            Leave your email and a message. We will reply as soon as we can.
          </p>
        </div>
        {sent ? (
          <p className="text-sm text-muted-foreground">Thank you. We will reply by email.</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="Your email"
              value={email}
              maxLength={320}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
            <Textarea
              name="message"
              placeholder="Your message"
              value={message}
              maxLength={4000}
              required
              rows={8}
              onChange={(e) => setMessage(e.target.value)}
            />
            <Button type="submit" disabled={sending}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </form>
        )}
      </div>
    </PublicPage>
  );
}
