/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactForm } from "../src/components/forms/ContactForm";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const successCopy = "Your enquiry has been received and will be reviewed.";
const endpoint = "https://api.example/contact";

async function fillValidEnquiry(includeConsent = true) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^Name/), "Ada Lovelace");
  await user.type(screen.getByLabelText(/^Organisation/), "Analytical Engines");
  await user.type(screen.getByLabelText(/^Work email/), "ada@example.com");
  await user.selectOptions(screen.getByLabelText(/^Enquiry type/), "Software development");
  await user.type(
    screen.getByLabelText(/^Message/),
    "We need a short discovery conversation about a public website.",
  );
  if (includeConsent) await user.click(screen.getByRole("checkbox"));
  return user;
}

function mockFetch(body: {
  ok: boolean;
  status: number;
  payload: Record<string, unknown>;
}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: body.ok,
    status: body.status,
    json: async () => body.payload,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ContactForm", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;
  });

  it("shows success only when the notification is sent", async () => {
    process.env.NEXT_PUBLIC_CONTACT_ENDPOINT = endpoint;
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      payload: {
        ok: true,
        saved: true,
        notification: "sent",
        message: successCopy,
      },
    });
    render(<ContactForm />);
    const user = await fillValidEnquiry();

    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    const status = screen.getByRole("status");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(status.getAttribute("data-state")).toBe("success");
    expect(status.textContent).toContain(successCopy);
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe("");
  });

  it("shows a neutral processing state for HTTP 202 while notification is sending", async () => {
    process.env.NEXT_PUBLIC_CONTACT_ENDPOINT = endpoint;
    mockFetch({
      ok: true,
      status: 202,
      payload: {
        ok: true,
        saved: true,
        notification: "sending",
        message:
          "Your enquiry was saved. Notification is already being processed.",
      },
    });
    render(<ContactForm />);
    const user = await fillValidEnquiry();

    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    const status = screen.getByRole("status");
    expect(status.getAttribute("data-state")).toBe("processing");
    expect(status.className).toContain("bg-slate-50");
    expect(status.className).not.toContain("bg-red-50");
    expect(status.textContent).toContain("already being processed");
    expect(status.textContent).not.toContain(successCopy);
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe("Ada Lovelace");
  });

  it("shows a neutral delayed state when the lead is saved and notification is pending", async () => {
    process.env.NEXT_PUBLIC_CONTACT_ENDPOINT = endpoint;
    mockFetch({
      ok: false,
      status: 502,
      payload: {
        ok: false,
        saved: true,
        notification: "pending",
        message:
          "Your enquiry was saved. The notification email is delayed and will be retried.",
      },
    });
    render(<ContactForm />);
    const user = await fillValidEnquiry();

    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    const status = screen.getByRole("status");
    expect(status.getAttribute("data-state")).toBe("pending");
    expect(status.className).toContain("bg-slate-50");
    expect(status.className).not.toContain("bg-red-50");
    expect(status.textContent).toContain("The notification email is delayed");
    expect(status.textContent).not.toContain(successCopy);
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe("Ada Lovelace");
  });

  it("shows an error when the lead is not saved", async () => {
    process.env.NEXT_PUBLIC_CONTACT_ENDPOINT = endpoint;
    mockFetch({
      ok: false,
      status: 503,
      payload: {
        ok: false,
        saved: false,
        notification: "none",
        message: "The enquiry could not be saved. Please try again later.",
      },
    });
    render(<ContactForm />);
    const user = await fillValidEnquiry();

    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    const status = screen.getByRole("status");
    expect(status.getAttribute("data-state")).toBe("error");
    expect(status.textContent).toContain("could not be saved");
    expect(status.textContent).not.toContain(successCopy);
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe("Ada Lovelace");
  });

  it("shows a configuration error when the API endpoint is missing", async () => {
    delete process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const location = window.location.href;
    render(<ContactForm />);
    const user = await fillValidEnquiry();

    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    const status = screen.getByRole("status");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.location.href).toBe(location);
    expect(status.getAttribute("data-state")).toBe("error");
    expect(status.textContent).toContain("The contact service is not configured");
    expect(status.textContent).not.toContain("Thank you");
  });

  it("shows a network error when the request fails", async () => {
    process.env.NEXT_PUBLIC_CONTACT_ENDPOINT = endpoint;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<ContactForm />);
    const user = await fillValidEnquiry();

    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    const status = screen.getByRole("status");
    expect(status.getAttribute("data-state")).toBe("error");
    expect(status.textContent).toContain("A network error occurred");
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe("Ada Lovelace");
  });

  it("shows validation errors and does not call the API", async () => {
    process.env.NEXT_PUBLIC_CONTACT_ENDPOINT = endpoint;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ContactForm />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain(
      "Please correct the highlighted fields.",
    );
    expect(screen.getByText("Please enter your name.")).toBeTruthy();
  });

  it("does not call the API when the honeypot is filled", async () => {
    process.env.NEXT_PUBLIC_CONTACT_ENDPOINT = endpoint;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ContactForm />);
    const user = await fillValidEnquiry();
    fireEvent.change(document.getElementById("companyWebsite") as HTMLInputElement, {
      target: { value: "https://spam.example" },
    });

    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain(
      "Thank you. Your enquiry has been received.",
    );
    expect(screen.getByRole("status").textContent).not.toContain(successCopy);
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe("");
  });

  it("requires consent before calling the API", async () => {
    process.env.NEXT_PUBLIC_CONTACT_ENDPOINT = endpoint;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ContactForm />);
    const user = await fillValidEnquiry(false);

    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("status").getAttribute("data-state")).toBe("error");
    expect(
      screen.getByText("Please confirm you agree to be contacted about this enquiry."),
    ).toBeTruthy();
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe("Ada Lovelace");
  });
});
