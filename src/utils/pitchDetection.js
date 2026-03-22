/**
 * Pitch Detection using Autocorrelation (Yin Algorithm)
 * Detects voice fundamental frequency from an AudioBuffer.
 */

export function detectPitch(audioBuffer) {
  const data = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  const threshold = 0.1;
  const minPeriod = Math.floor(sampleRate / 400); // Max frequency: 400 Hz
  const maxPeriod = Math.floor(sampleRate / 60);  // Min frequency: 60 Hz

  const autocorrelate = (buffer) => {
    let bestOffset = -1;
    let bestCorrelation = 0;

    for (let offset = minPeriod; offset < maxPeriod; offset++) {
      let correlation = 0;
      for (let i = 0; i < maxPeriod; i++) {
        correlation += Math.abs(buffer[i] - buffer[i + offset]);
      }
      correlation = 1 - (correlation / maxPeriod);

      if (correlation > threshold && correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }

    return bestOffset > 0 ? sampleRate / bestOffset : -1;
  };

  const frequency = autocorrelate(data);

  return {
    frequency: frequency > 0 ? frequency : 0,
    // Female voice: 165–255 Hz, Male voice: 85–180 Hz
    isFemalePitch: frequency > 165 && frequency < 255,
    isMalePitch: frequency > 85 && frequency < 180,
    confidence: frequency > 0 ? 0.9 : 0.1,
  };
}

/**
 * Calculate RMS energy of an audio buffer.
 */
export function calculateRMS(audioBuffer) {
  const data = audioBuffer.getChannelData(0);
  const sumOfSquares = data.reduce((sum, val) => sum + val * val, 0);
  return Math.sqrt(sumOfSquares / data.length);
}

/**
 * Check if audio buffer contains speech (Voice Activity Detection).
 */
export function detectVoiceActivity(audioBuffer, threshold = 0.02) {
  const rms = calculateRMS(audioBuffer);
  return {
    hasVoice: rms > threshold,
    rms,
    energyLevel: rms,
  };
}
