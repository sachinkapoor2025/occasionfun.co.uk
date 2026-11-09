"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { enquiryTypes, type EnquiryType } from "@/config/company";
import { Button } from "@/components/ui/Button";
import {
  contactFormSchema,
  formatZodErrors,
  type ContactFormErrors,
} from "@/lib/validation";

type FormState = {
  name: string;
  organisation: string;
  email: string;
  phone: string;
  enquiryType: EnquiryType | "";
  message: string;
  consent: boolean;
  companyWebsite: string;
};

const initialState: FormState = {
  name: "",
  organisation: "",
  email: "",
  phone: "",
  enquiryType: "",
  message: "",
  consent: false,
  companyWebsite: "",
};

export function ContactForm() {
  const searchParams = useSearchParams();
  const presetEnquiry = searchParams.get("enquiryType");

  const startingState = useMemo<FormState>(() => {
    if (
      presetEnquiry &&
      (enquiryTypes as readonly string[]).includes(presetEnquiry)
    ) {
      return { ...initialState, enquiryType: presetEnquiry as EnquiryType };
    }
    return initialState;
  }, [presetEnquiry]);

  const [form, setForm] = useState<FormState>(startingState);
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [statusMessage, setStatusMessage] = useState("");

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrors({});
    setStatusMessage("");

    const parsed = contactFormSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(formatZodErrors(parsed.error));
      setStatus("error");
      setStatusMessage("Please correct the highlighted fields.");
      return;
    }

    // Honeypot filled — pretend success without sending.
    if (parsed.data.companyWebsite) {
      setStatus("success");
      setStatusMessage("Thank you. Your enquiry has been received.");
      setForm(initialState);
      return;
    }

    const endpoint = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;

    try {
      if (endpoint) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          message?: string;
          errors?: ContactFormErrors;
        };
        if (!response.ok) {
          setErrors(payload.errors ?? {});
          setStatus("error");
          setStatusMessage(
            payload.message ??
              "We could not send your enquiry. Please try again.",
          );
          return;
        }
      } else {
        // Static S3 hosting has no server API — fall back to the visitor's mail client.
        const subject = encodeURIComponent(
          `OCCASIONFUN LTD enquiry: ${parsed.data.enquiryType}`,
        );
        const body = encodeURIComponent(
          [
            `Name: ${parsed.data.name}`,
            `Organisation: ${parsed.data.organisation}`,
            `Email: ${parsed.data.email}`,
            `Phone: ${parsed.data.phone || "—"}`,
            `Type: ${parsed.data.enquiryType}`,
            "",
            parsed.data.message,
          ].join("\n"),
        );
        window.location.href = `mailto:enquiries@occasionfun.co.uk?subject=${subject}&body=${body}`;
      }

      setStatus("success");
      setStatusMessage(
        endpoint
          ? "Thank you. Your enquiry has been received and will be reviewed."
          : "Thank you. Your email client should open with the enquiry details. If it does not, email enquiries@occasionfun.co.uk.",
      );
      setForm(initialState);
    } catch {
      setStatus("error");
      setStatusMessage(
        "A network error occurred. Please try again in a moment.",
      );
    }
  }

  const fieldClass =
    "mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-navy-900 shadow-sm placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-[var(--shadow-soft)]"
      aria-describedby="contact-form-status"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-sm font-semibold text-navy-900">
            Name <span className="text-error">*</span>
          </label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            required
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name ? (
            <p id="name-error" className="mt-1 text-sm text-error">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="organisation"
            className="text-sm font-semibold text-navy-900"
          >
            Organisation <span className="text-error">*</span>
          </label>
          <input
            id="organisation"
            name="organisation"
            autoComplete="organization"
            required
            value={form.organisation}
            onChange={(e) => updateField("organisation", e.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(errors.organisation)}
            aria-describedby={errors.organisation ? "organisation-error" : undefined}
          />
          {errors.organisation ? (
            <p id="organisation-error" className="mt-1 text-sm text-error">
              {errors.organisation}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="text-sm font-semibold text-navy-900">
            Work email <span className="text-error">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email ? (
            <p id="email-error" className="mt-1 text-sm text-error">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="phone" className="text-sm font-semibold text-navy-900">
            Phone <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "phone-error" : undefined}
          />
          {errors.phone ? (
            <p id="phone-error" className="mt-1 text-sm text-error">
              {errors.phone}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label
          htmlFor="enquiryType"
          className="text-sm font-semibold text-navy-900"
        >
          Enquiry type <span className="text-error">*</span>
        </label>
        <select
          id="enquiryType"
          name="enquiryType"
          required
          value={form.enquiryType}
          onChange={(e) =>
            updateField("enquiryType", e.target.value as EnquiryType | "")
          }
          className={fieldClass}
          aria-invalid={Boolean(errors.enquiryType)}
          aria-describedby={errors.enquiryType ? "enquiryType-error" : undefined}
        >
          <option value="">Select an option</option>
          {enquiryTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        {errors.enquiryType ? (
          <p id="enquiryType-error" className="mt-1 text-sm text-error">
            {errors.enquiryType}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="message" className="text-sm font-semibold text-navy-900">
          Message <span className="text-error">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          value={form.message}
          onChange={(e) => updateField("message", e.target.value)}
          className={fieldClass}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "message-error" : undefined}
        />
        {errors.message ? (
          <p id="message-error" className="mt-1 text-sm text-error">
            {errors.message}
          </p>
        ) : null}
      </div>

      {/* Honeypot field — hidden from assistive tech and sighted users */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="companyWebsite">Company website</label>
        <input
          id="companyWebsite"
          name="companyWebsite"
          tabIndex={-1}
          autoComplete="off"
          value={form.companyWebsite}
          onChange={(e) => updateField("companyWebsite", e.target.value)}
        />
      </div>

      <div className="flex items-start gap-3">
        <input
          id="consent"
          name="consent"
          type="checkbox"
          checked={form.consent}
          onChange={(e) => updateField("consent", e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
          aria-invalid={Boolean(errors.consent)}
          aria-describedby={errors.consent ? "consent-error" : undefined}
        />
        <label htmlFor="consent" className="text-sm leading-relaxed text-slate-600">
          I agree that OCCASIONFUN LTD may use the details I provide to respond
          to this enquiry, in line with the{" "}
          <a href="/privacy" className="font-semibold text-accent underline-offset-2 hover:underline">
            privacy notice
          </a>
          . <span className="text-error">*</span>
        </label>
      </div>
      {errors.consent ? (
        <p id="consent-error" className="text-sm text-error">
          {errors.consent}
        </p>
      ) : null}

      <div
        id="contact-form-status"
        role="status"
        aria-live="polite"
        className={
          status === "success"
            ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-success"
            : status === "error"
              ? "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error"
              : "sr-only"
        }
      >
        {statusMessage}
      </div>

      <Button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Send enquiry"}
      </Button>
    </form>
  );
}
