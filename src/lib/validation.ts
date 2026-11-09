import { z } from "zod";
import { enquiryTypes } from "@/config/company";

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(120, "Name is too long."),
  organisation: z
    .string()
    .trim()
    .min(2, "Please enter your organisation.")
    .max(160, "Organisation name is too long."),
  email: z
    .string()
    .trim()
    .email("Please enter a valid work email address.")
    .max(200, "Email is too long."),
  phone: z
    .string()
    .trim()
    .max(40, "Phone number is too long.")
    .optional()
    .or(z.literal("")),
  enquiryType: z.enum(enquiryTypes, {
    message: "Please select an enquiry type.",
  }),
  message: z
    .string()
    .trim()
    .min(20, "Please provide a little more detail (at least 20 characters).")
    .max(5000, "Message is too long."),
  consent: z.literal(true, {
    message: "Please confirm you agree to be contacted about this enquiry.",
  }),
  /** Honeypot — bots that fill this are accepted silently by the API. */
  companyWebsite: z.string().max(200).optional().or(z.literal("")),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

export type ContactFormErrors = Partial<
  Record<keyof ContactFormInput | "form", string>
>;

export function formatZodErrors(
  error: z.ZodError,
): ContactFormErrors {
  const fieldErrors: ContactFormErrors = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key as keyof ContactFormInput]) {
      fieldErrors[key as keyof ContactFormInput] = issue.message;
    }
  }

  return fieldErrors;
}
