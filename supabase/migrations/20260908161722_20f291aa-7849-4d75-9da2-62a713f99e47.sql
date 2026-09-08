ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS document_status TEXT NOT NULL DEFAULT 'NOT_GENERATED'
    CHECK (document_status IN ('NOT_GENERATED','GENERATED','GENERATION_FAILED')),
  ADD COLUMN IF NOT EXISTS document_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_path TEXT,
  ADD COLUMN IF NOT EXISTS document_error TEXT,
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'NOT_SENT'
    CHECK (email_status IN ('NOT_SENT','SENT','SEND_FAILED')),
  ADD COLUMN IF NOT EXISTS email_recipient TEXT,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_error TEXT,
  ADD COLUMN IF NOT EXISTS email_attempts INTEGER NOT NULL DEFAULT 0 CHECK (email_attempts >= 0),
  ADD COLUMN IF NOT EXISTS auto_delivery_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vouchers.auto_delivery_at IS 'Set once when automatic delivery after payment confirmation has been attempted. Guards against duplicate automatic emails on payment replay; Admin resend does not use it.';

INSERT INTO public.settings (key, value, value_type, description) VALUES
  ('business_name', 'Cimaja Boardriders', 'string', 'Business name shown on customer documents and emails.'),
  ('contact_email', '', 'string', 'Customer-facing email address. Also receives a copy of every voucher email. Required before vouchers can be emailed.'),
  ('contact_whatsapp', '', 'string', 'Customer-facing WhatsApp/phone number shown on vouchers. Required before vouchers can be emailed.'),
  ('contact_location', 'Cimaja, West Java, Indonesia', 'string', 'Customer-facing location shown on vouchers.')
ON CONFLICT (key) DO NOTHING;