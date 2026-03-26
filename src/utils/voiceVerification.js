/**
 * STRICT Voice Verification Logic
 * 
 * Purpose: Reduce false positives by enforcing strict requirements
 * - Prevents male voices from passing
 * - Rejects invalid data (NaN, out of range)
 * - Requires all checks to pass
 */

export function performStrictVoiceVerification({
  frequency,           // Pitch in Hz
  rms,                 // Energy level
  speechRatio,         // Fraction of frames with speech > 0.02
  lipSyncScore,        // Lip sync correlation score (can be null or NaN)
  duration,            // Recording duration in seconds
  similarity,          // Text match similarity (0-1)
  hasVoice,            // Boolean: voice activity detected
  textMatchRequired,   // Boolean: whether speech recognition worked
}) {
  // Initialize detailed reasons
  const reasons = [];
  let allChecksPassed = true;

  // ─────────────────────────────────────────────────────────────────
  // 1. PITCH VALIDATION — Strict female-only range
  // ─────────────────────────────────────────────────────────────────
  const PITCH_MIN = 170;  // Hz - Filter out male voices (male typical: 85-180)
  const PITCH_MAX = 255;  // Hz - Female typical: 165-255
  
  if (frequency === null || frequency === undefined || isNaN(frequency)) {
    allChecksPassed = false;
    reasons.push('No vocal pitch detected');
  } else if (frequency < PITCH_MIN || frequency > PITCH_MAX) {
    allChecksPassed = false;
    reasons.push(`Pitch ${frequency.toFixed(0)}Hz out of range (170–255Hz). This may be a male voice or not natural speech.`);
  }

  // ─────────────────────────────────────────────────────────────────
  // 2. VOICE ACTIVITY — Must be detected
  // ─────────────────────────────────────────────────────────────────
  if (!hasVoice) {
    allChecksPassed = false;
    reasons.push('No voice activity detected');
  }

  // ─────────────────────────────────────────────────────────────────
  // 3. ENERGY LEVEL — RMS must be above threshold
  // ─────────────────────────────────────────────────────────────────
  const RMS_MIN = 0.02;  // Minimum energy threshold
  
  if (rms === null || rms === undefined || isNaN(rms)) {
    allChecksPassed = false;
    reasons.push('RMS energy calculation failed');
  } else if (rms < RMS_MIN) {
    allChecksPassed = false;
    reasons.push(`Audio volume too low (RMS: ${rms.toFixed(4)}). Please speak louder.`);
  }

  // ─────────────────────────────────────────────────────────────────
  // 4. DURATION — Must be between 2–8 seconds
  // ─────────────────────────────────────────────────────────────────
  const DURATION_MIN = 2;  // seconds
  const DURATION_MAX = 8;  // seconds
  
  if (duration === null || duration === undefined || isNaN(duration)) {
    allChecksPassed = false;
    reasons.push('Duration calculation failed');
  } else if (duration < DURATION_MIN || duration > DURATION_MAX) {
    allChecksPassed = false;
    reasons.push(`Recording duration ${duration.toFixed(1)}s invalid. Please record 2–8 seconds.`);
  }

  // ─────────────────────────────────────────────────────────────────
  // 5. SPEECH FRAMES — At least 40% of frames must have speech
  // ─────────────────────────────────────────────────────────────────
  const SPEECH_RATIO_MIN = 0.4;  // At least 40% of frames should have speech
  
  if (speechRatio === null || speechRatio === undefined || isNaN(speechRatio)) {
    allChecksPassed = false;
    reasons.push('Speech frame analysis failed');
  } else if (speechRatio < SPEECH_RATIO_MIN) {
    allChecksPassed = false;
    reasons.push(`Not enough active speech detected (${(speechRatio * 100).toFixed(0)}%). Please speak continuously.`);
  }

  // ─────────────────────────────────────────────────────────────────
  // 6. LIP SYNC — Strict validation with NaN protection
  // ─────────────────────────────────────────────────────────────────
  const LIP_SYNC_THRESHOLD = 0.5;  // Minimum correlation score
  let lipSyncOk = true;
  
  if (lipSyncScore === null || lipSyncScore === undefined) {
    // Camera not available — still allow verification if other checks pass
    // (lip sync is secondary to audio checks)
  } else if (isNaN(lipSyncScore)) {
    // NaN means calculation failed — FAIL immediately
    allChecksPassed = false;
    lipSyncOk = false;
    reasons.push('Lip sync calculation failed (NaN detected). Please try again with camera and good lighting.');
  } else if (lipSyncScore < LIP_SYNC_THRESHOLD) {
    allChecksPassed = false;
    lipSyncOk = false;
    reasons.push(`Lip movement insufficient (${lipSyncScore.toFixed(2)}). Speak clearly facing the camera.`);
  }

  // ─────────────────────────────────────────────────────────────────
  // 7. TEXT MATCH — If speech recognition worked, must match
  // ─────────────────────────────────────────────────────────────────
  const SIMILARITY_MIN = 0.8;  // 80% match required
  
  if (textMatchRequired) {
    if (similarity === null || similarity === undefined || isNaN(similarity)) {
      allChecksPassed = false;
      reasons.push('Text similarity calculation failed');
    } else if (similarity < SIMILARITY_MIN) {
      allChecksPassed = false;
      reasons.push(`Text match too low (${(similarity * 100).toFixed(0)}%). Please read the exact sentence shown.`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // FINAL DECISION
  // ─────────────────────────────────────────────────────────────────
  return {
    passed: allChecksPassed &&
            frequency >= PITCH_MIN &&
            frequency <= PITCH_MAX &&
            hasVoice &&
            rms >= RMS_MIN &&
            duration >= DURATION_MIN &&
            duration <= DURATION_MAX &&
            speechRatio >= SPEECH_RATIO_MIN &&
            lipSyncOk &&
            (textMatchRequired ? similarity >= SIMILARITY_MIN : true),
    
    details: {
      frequency: frequency !== null && !isNaN(frequency) ? frequency.toFixed(1) : 'N/A',
      rms: rms !== null && !isNaN(rms) ? rms.toFixed(4) : 'N/A',
      speechRatio: speechRatio !== null && !isNaN(speechRatio) ? (speechRatio * 100).toFixed(1) : 'N/A',
      duration: duration !== null && !isNaN(duration) ? duration.toFixed(1) : 'N/A',
      lipSyncScore: lipSyncScore !== null && !isNaN(lipSyncScore) ? lipSyncScore.toFixed(2) : 'N/A',
      similarity: textMatchRequired && similarity !== null && !isNaN(similarity) ? (similarity * 100).toFixed(0) : 'N/A',
    },

    // User-friendly failure reasons
    failureReasons: reasons.length > 0 ? reasons : ['Verification failed for unknown reason'],

    // Machine-readable checks
    checks: {
      pitchValid: frequency >= PITCH_MIN && frequency <= PITCH_MAX,
      voiceDetected: hasVoice,
      energyOk: rms >= RMS_MIN,
      durationValid: duration >= DURATION_MIN && duration <= DURATION_MAX,
      speechFramesOk: speechRatio >= SPEECH_RATIO_MIN,
      lipSyncOk,
      textMatchOk: !textMatchRequired || similarity >= SIMILARITY_MIN,
    },
  };
}
