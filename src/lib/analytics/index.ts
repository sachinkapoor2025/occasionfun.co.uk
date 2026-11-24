/**
 * Visitors & Activity domain logic.
 * Storage and HTTP stay outside these functions.
 */

export {
  MAX_REPORT_DAYS,
  RETENTION_SECONDS,
  addLondonDays,
  eventSortInJourney,
  expiresAtFromInstant,
  formatUtcTimestamp,
  isIsoTimestamp,
  isLondonDate,
  isRetentionPartial,
  journeyBounds,
  londonDate,
  londonDatesInclusive,
  londonMidnightUtc,
  reportingWindow,
  retentionInstant,
  validateReportRange,
} from "./dates";

export {
  allowedPagePaths,
  normalisePagePath,
  normaliseReferrer,
  payloadHash,
  validateEvent,
} from "./event";

export {
  campaignLabel,
  isNewVisitor,
  mergeDay,
  mergeProfile,
  planDayCorrections,
  profileFromEvent,
  resolveFirstSeenDay,
  visitorNeedsProfile,
} from "./visitor";

export {
  eventMatchesGuard,
  guardFor,
  guardMatches,
  ingestPageView,
  newGuardRejection,
} from "./recovery";

export { aggregateReport, selectJourneyPage } from "./report";
