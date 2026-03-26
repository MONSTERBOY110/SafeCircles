/**
 * App-wide constants for SafeCircles.
 */

// Verification thresholds
export const VERIFICATION = {
  MIN_FEMALE_PITCH_HZ: 165,
  MAX_FEMALE_PITCH_HZ: 255,
  MIN_VOICE_RMS: 0.02,
  LIP_SYNC_THRESHOLD: 0.6,
  LIP_SYNC_DEEPFAKE_THRESHOLD: 0.3,
  MIN_RECORDING_SECONDS: 2,
  MAX_RECORDING_SECONDS: 8,
  FACE_CENTER_MIN: 0.3,
  FACE_CENTER_MAX: 0.7,
};

// Matching parameters
export const MATCHING = {
  TIME_WINDOW_MINUTES: 15,
  MAX_CIRCLE_SIZE: 5,
  MIN_CIRCLE_SIZE: 2,
  GEOHASH_PRECISION: 7,
  TRIP_TTL_MINUTES: 90,
};

// Walking speed and ETA
export const TRAVEL = {
  WALKING_SPEED_KMH: 5,
};

// Safety ping levels
export const SAFETY_PING_LEVELS = {
  SAFE: 'safe',
  MODERATE: 'moderate',
  AVOID: 'avoid',
};

// Circle types
export const CIRCLE_TYPES = {
  WOMEN_ONLY: 'women_only',
  MIXED: 'mixed',
};

// Emergency contacts (India defaults)
export const EMERGENCY_CONTACTS = {
  POLICE: '100',
  WOMENS_HELPLINE: '1090',
  AMBULANCE: '108',
  FIRE: '101',
};

// Verification prompts for voice step — plain sentences the user speaks aloud
export const VOICE_PROMPTS = [
  'I am walking safely with SafeCircles',
  'SafeCircles keeps me safe on every walk',
  'I am a real person using SafeCircles',
  'Safety first always and everywhere',
  'I am not using a pre recorded video',
  'My location is secure and I am safe',
  'SafeCircles is my trusted safety companion',
  'I verify that I am a live person today',
  'Walking with SafeCircles makes me feel safe',
  'I am speaking clearly to verify my identity',
];

// Reputation score thresholds
export const REPUTATION = {
  TRUSTED: 10,
  EXPERIENCED: 5,
  NEW: 0,
};
