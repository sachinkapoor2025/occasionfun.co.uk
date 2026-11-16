"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
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

type SubmissionStatus =
  | "idle"
  | "submitting"
  | "success"
  | "processing"
  | "pending"
  | "error";

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

function fieldClass(invalid: boolean) {
  return [
    "mt-2 w-full rounded-md border bg-white px-3 py-2.5 text-sm text-navy-900 shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30",
    invalid ? "border-error" : "border-slate-200",
  ].join(" ");
}

export function ContactForm() {
  const searchParams = useSearchParams();
  const presetEnquiry = searchParams.get("enquiryType");
  const statusRef = useRef<HTMLDivElement>(null);

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
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [suppressLive, setSuppressLive] = useState(false);

  useEffect(() => {
    if (!suppressLive) return;
    if (status === "idle" || status === "submitting") return;
    statusRef.current?.focus();
    const frame = window.requestAnimationFrame(() => setSuppressLive(false));
    return () => window.cancelAnimationFrame(frame);
  }, [suppressLive, status]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reportStatus(next: Exclude<SubmissionStatus, "idle" | "submitting">, message: string) {
    setSuppressLive(true);
    setStatus(next);
    setStatusMessage(message);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuppressLive(false);
    setStatus("submitting");
    setErrors({});
    setStatusMessage("");

    const parsed = contactFormSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(formatZodErrors(parsed.error));
      reportStatus("error", "Please correct the highlighted fields.");
      return;
    }

    // Honeypot filled — pretend success without sending.
    if (parsed.data.companyWebsite) {
      setForm(initialState);
      reportStatus("success", "Thank you. Your enquiry has been received.");
      return;
    }

    const endpoint = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;
    if (!endpoint) {
      reportStatus(
        "error",
        "The contact service is not configured. Your enquiry was not sent.",
      );
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        saved?: boolean;
        notification?: string;
        message?: string;
        errors?: ContactFormErrors;
      };
      const saved = payload.saved === true;
      const delivered =
        response.ok === true &&
        payload.ok === true &&
        payload.saved === true &&
        payload.notification === "sent";

      if (!saved) {
        setErrors(payload.errors ?? {});
        reportStatus(
          "error",
          payload.message ?? "We could not save your enquiry. Please try again.",
        );
        return;
      }

      if (delivered) {
        setForm(initialState);
        reportStatus(
          "success",
          payload.message ??
            "Thank you. Your enquiry has been received and will be reviewed.",
        );
        return;
      }

      if (payload.notification === "sending") {
        reportStatus(
          "processing",
          payload.message ??
            "Your enquiry was saved. Notification is already being processed.",
        );
        return;
      }

      reportStatus(
        "pending",
        payload.message ??
          "Your enquiry was saved. The notification email is delayed and will be retried.",
      );
    } catch {
      reportStatus(
        "error",
        "A network error occurred. Please try again in a moment.",
      );
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
      aria-describedby="contact-form-status"
      aria-busy={status === "submitting" || status === "processing"}
    >
      <div>
        <h2 className="text-xl text-navy-900">Send an enquiry</h2>
        <p className="mt-2 text-sm text-slate-600">
          Fields marked * are required. Phone is optional.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
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
            className={fieldClass(Boolean(errors.name))}
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
            className={fieldClass(Boolean(errors.organisation))}
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

      <div className="grid gap-6 sm:grid-cols-2">
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
            className={fieldClass(Boolean(errors.email))}
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
            className={fieldClass(Boolean(errors.phone))}
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
          className={fieldClass(Boolean(errors.enquiryType))}
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
          className={fieldClass(Boolean(errors.message))}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={
            errors.message ? "message-hint message-error" : "message-hint"
          }
        />
        <p id="message-hint" className="mt-2 text-sm leading-relaxed text-slate-600">
          Include the requirement and any deadline or procurement context you
          already have.
        </p>
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

      <div>
        <label
          htmlFor="consent"
          className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-3 -mx-3"
        >
          <input
            id="consent"
            name="consent"
            type="checkbox"
            checked={form.consent}
            onChange={(e) => updateField("consent", e.target.checked)}
            className={`mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-accent focus:outline-none focus:ring-2 focus:ring-accent ${
              errors.consent ? "border-error ring-1 ring-error" : ""
            }`}
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? "consent-error" : undefined}
          />
          <span className="text-sm leading-relaxed text-slate-600">
            I agree that OCCASIONFUN LTD may use the details I provide to
            respond to this enquiry, in line with the privacy notice.{" "}
            <span className="text-error">*</span>
          </span>
        </label>
        {errors.consent ? (
          <p id="consent-error" className="mt-1 text-sm text-error">
            {errors.consent}
          </p>
        ) : null}
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          <Link
            href="/privacy"
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            Privacy notice
          </Link>
        </p>
      </div>

      <div
        ref={statusRef}
        id="contact-form-status"
        tabIndex={-1}
        role="status"
        aria-live={suppressLive ? "off" : "polite"}
        aria-atomic="true"
        data-state={status}
        className={`scroll-mt-28 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent ${
          status === "success"
            ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-success"
            : status === "error"
              ? "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error"
              : status === "processing" || status === "pending"
                ? "rounded-md border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-navy-900"
                : "sr-only"
        }`}
      >
        {statusMessage}
      </div>

      <Button type="submit" disabled={status === "submitting"} className="w-full">
        {status === "submitting" ? "Sending…" : "Send enquiry"}
      </Button>
      <p className="text-sm leading-relaxed text-slate-600">
        OccasionFun reviews the enquiry. A saved enquiry is not shown as failed
        if the notification is still being sent.
      </p>
    </form>
  );
}
