/**
 * Device and browser categories for aggregate measurement.
 * These match the exported collector helpers. The measure Lambda imports
 * this module so it does not load the consent collector.
 */

import type { BrowserCategory, DeviceCategory } from "./event-core";

export function deviceCategoryFromUserAgent(userAgent: string): DeviceCategory {
  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad") || ua.includes("tablet") || (ua.includes("android") && !ua.includes("mobile"))) {
    return "tablet";
  }
  if (ua.includes("mobi") || ua.includes("iphone") || ua.includes("ipod")) return "mobile";
  if (!ua.trim()) return "other";
  return "desktop";
}

export function browserCategoryFromUserAgent(userAgent: string): BrowserCategory {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("firefox/") || ua.includes("fxios/")) return "firefox";
  if (ua.includes("chrome/") || ua.includes("crios/")) return "chrome";
  if (ua.includes("safari/")) return "safari";
  return "other";
}
