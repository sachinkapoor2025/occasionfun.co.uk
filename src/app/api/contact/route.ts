import { NextResponse } from "next/server";
import { company } from "@/config/company";
import { checkRateLimit } from "@/lib/rate-limit";
import { contactFormSchema, formatZodErrors } from "@/lib/validation";

export async function POST(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(`contact:${ip}`);

  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Too many enquiries from this network. Please wait before trying again.",
      },
      {
        status: 429,
        headers: rate.retryAfterSeconds
          ? { "Retry-After": String(rate.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = contactFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Please correct the highlighted fields.",
        errors: formatZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  // Honeypot filled → silently accept without processing.
  if (parsed.data.companyWebsite) {
    return NextResponse.json({
      ok: true,
      message: "Thank you. Your enquiry has been received.",
    });
  }

  const notifyTo = process.env.CONTACT_NOTIFY_EMAIL;
  const webhookUrl = process.env.CONTACT_WEBHOOK_URL;

  // Persist / notify through configured backends. Credentials never ship to the browser.
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: company.legalName,
          receivedAt: new Date().toISOString(),
          enquiry: {
            name: parsed.data.name,
            organisation: parsed.data.organisation,
            email: parsed.data.email,
            phone: parsed.data.phone || null,
            enquiryType: parsed.data.enquiryType,
            message: parsed.data.message,
          },
          notifyTo: notifyTo ?? null,
        }),
      });
    } catch (error) {
      console.error("Contact webhook failed", error);
      return NextResponse.json(
        {
          ok: false,
          message:
            "We could not deliver your enquiry just now. Please try again later.",
        },
        { status: 502 },
      );
    }
  } else if (process.env.NODE_ENV === "production") {
    console.warn(
      "CONTACT_WEBHOOK_URL is not configured. Enquiry validated but not forwarded.",
      {
        enquiryType: parsed.data.enquiryType,
        organisation: parsed.data.organisation,
      },
    );
  } else {
    console.info("Contact enquiry accepted (dev, no webhook configured)", {
      enquiryType: parsed.data.enquiryType,
      organisation: parsed.data.organisation,
      email: parsed.data.email,
    });
  }

  return NextResponse.json({
    ok: true,
    message:
      "Thank you. Your enquiry has been received and will be reviewed by our team.",
  });
}
