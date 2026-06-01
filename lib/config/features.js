// lib/config/features.js

// This file is like a switchboard for Keenie.
// true  = show / enable the feature
// false = hide / disable the feature

export const FEATURES = {
  // Keenie Lite pilot mode
  LITE_MODE: true,

  // Advanced features hidden for now
  PAYOUTS: false,
  GUARANTEES: false,
  ADVANCED_REPORTS: false,
  OPERATION_LOCKING: false,
  FINANCIAL_CONTROLS: false,

  // Lite features we want to keep
  ONLINE_BOOKING: true,
  FRONT_DESK_GRID: true,
  WALK_INS: true,
  ROSTER: true,
  BASIC_REPORTS: true,
  CONFIRMATION_EMAILS: true,
};

export function isFeatureEnabled(featureName) {
  return FEATURES[featureName] === true;
}