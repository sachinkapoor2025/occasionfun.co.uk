/**
 * Offline country lookup for aggregate measurement.
 * The only address used is API Gateway `requestContext.http.sourceIp`.
 * A missing database, a private address, or a failed lookup returns undefined.
 * The domain function then stores ZZ. The address is never logged.
 */

import { access } from "node:fs/promises";
import { isIP } from "node:net";

export type CountryLookup = {
  get(ip: string): { country?: { iso_code?: string } } | null;
};

const ISO_COUNTRY = /^[A-Za-z]{2}$/;

export function isNonPublicAddress(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  const address = trimmed.startsWith("::ffff:") ? trimmed.slice("::ffff:".length) : trimmed;
  const version = isIP(address);
  if (version === 4) return nonPublicV4(address);
  if (version === 6) return nonPublicV6(address);
  return true;
}

function nonPublicV4(ip: string): boolean {
  const [first, second] = ip.split(".").map((part) => Number(part));
  if (first === 0 || first === 10 || first === 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  if (first >= 224) return true;
  return false;
}

function nonPublicV6(ip: string): boolean {
  if (ip === "::" || ip === "::1") return true;
  const head = ip.split(":")[0] ?? "";
  const first = Number.parseInt(head, 16);
  if (!Number.isFinite(first)) return true;
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xff00) === 0xff00) return true;
  return false;
}

/**
 * Two-letter country, or undefined when the address cannot be classified.
 * Callers pass undefined through to the aggregate domain, which stores ZZ.
 */
export function countryFromIp(ip: string | undefined, reader: CountryLookup | null): string | undefined {
  if (!ip || isNonPublicAddress(ip) || !reader) return undefined;
  try {
    const code = reader.get(ip.trim())?.country?.iso_code;
    if (typeof code !== "string" || !ISO_COUNTRY.test(code)) return undefined;
    return code.toUpperCase();
  } catch {
    return undefined;
  }
}

/**
 * Opens a local GeoLite2-Country database. An empty path, a missing file,
 * or an unreadable file returns null. No network lookup is attempted.
 */
export async function openCountryReader(databasePath: string | undefined): Promise<CountryLookup | null> {
  const configured = databasePath?.trim();
  if (!configured) return null;
  try {
    await access(configured);
    const maxmind = (await import("maxmind")) as {
      open: (path: string) => Promise<CountryLookup>;
    };
    return await maxmind.open(configured);
  } catch {
    return null;
  }
}
