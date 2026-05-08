/**
 * Voice Verification Decision Model
 *
 * 100-point confidence score with hard gates and soft signals.
 *
 * Hard gates (any failure -> reject regardless of score):
 *   - Microphone error
 *   - Recording duration in [MIN_RECORDING_SECONDS, MAX_RECORDING_SECONDS]
 *   - Speech detected (RMS >= MIN_RMS_RELAXED AND speechRatio >= MIN_SPEECH_RATIO)
 *   - Prompt match >= PROMPT_MATCH_THRESHOLD when a transcript is available
 *   - Voice pitch in [BORDERLINE_FEMALE_PITCH_MIN, BORDERLINE_FEMALE_PITCH_MAX]
 *     (SafeCircles is a women-only safety service; male-range voices are rejected)
 *
 * Soft signals (contribute points but never auto-fail):
 *   - Pitch in strong female range -> 15 pts; borderline -> 7 pts (still inside the gate)
 *   - Lip-sync score > 0.35 -> 10 pts; > 0.15 -> 3 pts; NaN/null/undefined -> 0 pts (no penalty)
 *
 * Pass = all hard gates AND score >= 70.
 */

import { VERIFICATION } from './constants';

export function evaluateVoiceConfidence({
  pitchHz,           // number | null | undefined
  pitchConfidence,   // 0..1 — fraction of audio frames where pitch was confidently detected
  rms,               // number
  duration,          // seconds
  speechRatio,       // 0..1 — fraction of frames with voice activity
  lipSyncScore,      // number | NaN | null | undefined
  promptMatch,       // 0..1 — null/undefined when no transcript
  hasTranscript,     // boolean — whether SpeechRecognition produced any text
  micError,          // boolean
}) {
  const reasons = [];
  let score = 0;

  // Hard gate: microphone error trumps everything else.
  if (micError) {
    return {
      passed: false,
      score: 0,
      hardFail: true,
      failureReasons: ['Microphone error. Please grant permission and try again.'],
      checks: {},
    };
  }

  // Hard gate: duration window.
  const durationOk =
    typeof duration === 'number' &&
    Number.isFinite(duration) &&
    duration >= VERIFICATION.MIN_RECORDING_SECONDS &&
    duration <= VERIFICATION.MAX_RECORDING_SECONDS;
  if (!durationOk) {
    if (typeof duration === 'number' && duration < VERIFICATION.MIN_RECORDING_SECONDS) {
      reasons.push('Recording was too short — speak for at least 2 seconds.');
    } else {
      reasons.push('Recording was too long.');
    }
  } else {
    score += 15;
  }

  // Hard gate: speech detected (RMS + ratio combined).
  const rmsOk = typeof rms === 'number' && Number.isFinite(rms) && rms >= VERIFICATION.MIN_RMS_RELAXED;
  const speechRatioOk =
    typeof speechRatio === 'number' &&
    Number.isFinite(speechRatio) &&
    speechRatio >= VERIFICATION.MIN_SPEECH_RATIO;
  const speechDetected = rmsOk && speechRatioOk;
  if (!speechDetected) {
    if (!rmsOk) {
      reasons.push('Voice was too low — try a quieter location.');
    } else {
      reasons.push('Speech was not detected. Please speak clearly into the mic.');
    }
  } else {
    score += 20; // speech detected
    score += 15; // RMS valid (folded — both required for speechDetected)
  }

  // Hard gate (conditional): prompt text match. Only enforced when a transcript exists.
  let promptMatchOk = true;
  if (hasTranscript) {
    const matchValue = typeof promptMatch === 'number' && Number.isFinite(promptMatch) ? promptMatch : 0;
    if (matchValue >= VERIFICATION.PROMPT_MATCH_THRESHOLD) {
      score += 25;
    } else {
      promptMatchOk = false;
      reasons.push('Please read the exact sentence shown.');
    }
  } else {
    // SpeechRecognition unavailable / no transcript — partial credit so SR-blind
    // users can still pass on audio + duration + lip-sync alone.
    score += 15;
  }

  // Hard gate (1/2): pitch confidence floor. If we couldn't reliably detect a
  // pitch in enough frames (background noise, mumble, mic problem), we don't
  // trust ANY pitch verdict — reject with a clear reason rather than
  // misclassifying. The two pitch reasons are mutually exclusive on purpose.
  const pitchConfidenceOk =
    typeof pitchConfidence === 'number' &&
    Number.isFinite(pitchConfidence) &&
    pitchConfidence >= VERIFICATION.MIN_PITCH_CONFIDENCE;
  if (!pitchConfidenceOk) {
    reasons.push('Could not detect voice clearly — try a quieter location.');
  }

  // Hard gate (2/2): pitch must be in the female range. SafeCircles is a
  // women-only safety service. The BORDERLINE range is the gate so women with
  // naturally low or high voices aren't rejected; pitch *points* are tiered
  // (strong female -> 15, borderline-but-inside-gate -> 7).
  const pitchValid =
    typeof pitchHz === 'number' &&
    Number.isFinite(pitchHz) &&
    pitchHz >= VERIFICATION.BORDERLINE_FEMALE_PITCH_MIN &&
    pitchHz <= VERIFICATION.BORDERLINE_FEMALE_PITCH_MAX;
  const pitchOk = pitchConfidenceOk && pitchValid;
  if (pitchConfidenceOk && !pitchValid) {
    reasons.push('Voice pitch is outside the expected range for this women-only verification.');
  }
  if (pitchOk) {
    if (pitchHz >= VERIFICATION.MIN_FEMALE_PITCH_HZ && pitchHz <= VERIFICATION.MAX_FEMALE_PITCH_HZ) {
      score += 15;
    } else {
      score += 7;
    }
  }

  // Soft signal: lip-sync. NaN/null/undefined -> 0 pts, never blocks.
  const lipOk = typeof lipSyncScore === 'number' && Number.isFinite(lipSyncScore);
  if (lipOk) {
    if (lipSyncScore > 0.35) {
      score += 10;
    } else if (lipSyncScore > 0.15) {
      score += 3;
    } else {
      console.warn('[VoiceVerification] Lip movement low — please keep your face visible while speaking.');
    }
  } else if (lipSyncScore !== null && lipSyncScore !== undefined) {
    console.warn('[VoiceVerification] lipSyncScore invalid, scoring as 0');
  }

  // Decision
  const hardGatesPassed = durationOk && speechDetected && promptMatchOk && pitchOk;
  const passed = hardGatesPassed && score >= 70;

  return {
    passed,
    score,
    hardFail: !hardGatesPassed,
    failureReasons: reasons,
    checks: {
      durationOk,
      speechDetected,
      promptMatchOk,
      pitchOk,
      pitchConfidenceOk,
      pitchHz: typeof pitchHz === 'number' && Number.isFinite(pitchHz) ? pitchHz : null,
      pitchConfidence: typeof pitchConfidence === 'number' && Number.isFinite(pitchConfidence) ? pitchConfidence : null,
      lipSyncScore: lipOk ? lipSyncScore : null,
    },
  };
}

// Backwards-compat alias for any caller still using the old name.
// New callers should use evaluateVoiceConfidence directly.
export const performStrictVoiceVerification = evaluateVoiceConfidence;
