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

const PRO_FEATURE_OVERRIDES = {
  LITE_MODE: false,
  PAYOUTS: true,
  GUARANTEES: true,
  ADVANCED_REPORTS: true,
  FINANCIAL_CONTROLS: true,
};

const LITE_FEATURE_OVERRIDES = {
  LITE_MODE: true,
  PAYOUTS: false,
  GUARANTEES: false,
  ADVANCED_REPORTS: false,
  FINANCIAL_CONTROLS: false,
};

function normalizeSubscriptionPlan(value) {
  const plan = String(value || "lite").toLowerCase().trim();

  if (plan === "pro" || plan === "enterprise") {
    return plan;
  }

  return "lite";
}

export function getStoreFeatures(store) {
  const subscriptionPlan = normalizeSubscriptionPlan(
    store?.subscription_plan
  );

  if (
    subscriptionPlan === "pro" ||
    subscriptionPlan === "enterprise"
  ) {
    return {
      ...FEATURES,
      ...PRO_FEATURE_OVERRIDES,
      subscriptionPlan,
    };
  }

  return {
    ...FEATURES,
    ...LITE_FEATURE_OVERRIDES,
    subscriptionPlan,
  };
}

export function isFeatureEnabled(featureName) {
  return FEATURES[featureName] === true;
}
