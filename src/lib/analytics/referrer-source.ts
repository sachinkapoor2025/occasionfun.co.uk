/**
 * Aggregate source classification from the Referer header.
 * UTM parameters are not read, so this path never stores campaign.
 * The consent collector is not imported.
 */

import { normaliseReferrer, type TrafficSource } from "./event-core";

/**
 * Same host rules as the collector, with campaign forced off.
 * `normaliseReferrer` keeps the hostname only.
 */
export function sourceFromReferrer(value: unknown): TrafficSource {
  const host = normaliseReferrer(value);
  if (host === "direct" || host === "internal") return host;
  if (/(^|\.)(google|bing|duckduckgo|yahoo|ecosia|baidu)\./.test(host)) return "search";
  if (
    host === "t.co" ||
    host === "x.com" ||
    /(^|\.)(facebook|instagram|linkedin|youtube|tiktok|pinterest|reddit)\./.test(host)
  ) {
    return "social";
  }
  return "referral";
}
