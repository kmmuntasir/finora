import type { UserPolicy } from "@jellyfin/sdk/lib/generated-client/models";

export type RestrictionDraft = Pick<
  UserPolicy,
  | "MaxParentalRating"
  | "MaxParentalSubRating"
  | "BlockUnratedItems"
  | "BlockedTags"
  | "AllowedTags"
  | "AccessSchedules"
  | "MaxActiveSessions"
  | "RemoteClientBitrateLimit"
>;

export const RESTRICTION_DEFAULTS: RestrictionDraft = {
  MaxParentalRating: null,
  MaxParentalSubRating: null,
  BlockUnratedItems: [],
  BlockedTags: [],
  AllowedTags: [],
  AccessSchedules: [],
  MaxActiveSessions: 0,
  RemoteClientBitrateLimit: 0,
};
