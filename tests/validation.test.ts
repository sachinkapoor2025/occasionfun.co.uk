import { describe, expect, it } from "vitest";
import { contactFormSchema, formatZodErrors } from "@/lib/validation";

const validPayload = {
  name: "Alex Example",
  organisation: "Example Council",
  email: "alex@example.gov.uk",
  phone: "",
  enquiryType: "Public-sector procurement",
  message: "We would like supplier information for an upcoming IT requirement.",
  consent: true as const,
  companyWebsite: "",
};

describe("contactFormSchema", () => {
  it("accepts a valid enquiry payload", () => {
    const result = contactFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects missing consent", () => {
    const result = contactFormSchema.safeParse({
      ...validPayload,
      consent: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      expect(errors.consent).toBeTruthy();
    }
  });

  it("rejects invalid email addresses", () => {
    const result = contactFormSchema.safeParse({
      ...validPayload,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("allows honeypot content through schema so the API can drop it silently", () => {
    const result = contactFormSchema.safeParse({
      ...validPayload,
      companyWebsite: "https://spam.example",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short messages", () => {
    const result = contactFormSchema.safeParse({
      ...validPayload,
      message: "Too short",
    });
    expect(result.success).toBe(false);
  });
});
