// Centralized, defensible tunable constants for the simulation engine.
// Keeping these in one place makes the model auditable and easy to reason
// about — nothing here is randomly generated per-frame.

export const FIXED_DT = 1 / 60; // physics integration step (s)
export const PLANNER_HZ = 10;
export const REFLEX_HZ = 50;
export const PLANNER_DT = 1 / PLANNER_HZ;
export const REFLEX_DT = 1 / REFLEX_HZ;
export const UI_PUBLISH_HZ = 10;

export const MS_PER_KMH = 1 / 3.6;

// Vehicle dynamics
export const CRUISE_ACCEL = 1.4; // m/s^2 comfortable acceleration
export const COMFORT_DECEL = 2.2; // m/s^2 planner controlled deceleration
export const EMERGENCY_DECEL = 7.5; // m/s^2 safety-reflex emergency braking
export const BASELINE_EMERGENCY_DECEL = 6.2; // baseline reflex is weaker/slower
export const REACTION_DELAY_S = 0.35; // driver/system reaction distance assumption
export const LATERAL_RATE = 1.6; // m/s lateral maneuver rate

// Risk thresholds
export const RISK_SAFE_MAX = 35;
export const RISK_CAUTION_MAX = 70;

// TTC thresholds (seconds)
export const TTC_COMFORT = 6.0;
export const TTC_CAUTION = 3.5;
export const TTC_CRITICAL_ALIENX = 1.8;
export const TTC_CRITICAL_BASELINE = 1.1; // baseline reacts later

// Perception
export const DETECTION_RANGE = 55; // meters
export const PREDICTION_HORIZON_S = 3.0;
export const PREDICTION_STEPS = 10;

export const WORLD_VIEW_METERS = 70; // meters visible across canvas width nominal
