/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Footer } from "../src/components/layout/Footer";

afterEach(() => {
  cleanup();
});

describe("public footer admin access", () => {
  it("links Admin Access to the admin login page", () => {
    render(<Footer />);

    const link = screen.getByRole("link", { name: "Admin Access" });
    expect(link.getAttribute("href")).toMatch(/^\/admin\/login\/?$/);
    expect(link).toBeVisible();
  });
});
