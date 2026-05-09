import { describe, it, expect } from 'vitest';
import { calculateRMS, detectVoiceActivity } from './pitchDetection';

/**
 * Build an AudioBuffer-like object from a synthesized sine wave at the given
 * frequency. Used only for the RMS / VAD helpers — the full `detectPitch`
 * pipeline (Silero VAD + CREPE) requires WebAssembly + TFJS at runtime and
 * is exercised via manual browser testing, not unit tests.
 */
function fakeBuffer(frequencyHz, durationSec = 1, sampleRate = 44100, amplitude = 0.5) {
  const length = Math.floor(durationSec * sampleRate);
  const data = new Float32Array(length);
  if (frequencyHz > 0) {
    for (let i = 0; i < length; i++) {
      data[i] = Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate) * amplitude;
    }
  }
  return {
    getChannelData: () => data,
    sampleRate,
    length,
    duration: durationSec,
  };
}

describe('calculateRMS', () => {
  it('returns ~0 for silence', () => {
    expect(calculateRMS(fakeBuffer(0))).toBeLessThan(0.001);
  });

  it('returns a positive RMS for a non-zero sine wave', () => {
    // Sine of amplitude 0.5 has RMS of 0.5 / sqrt(2) ≈ 0.354.
    const rms = calculateRMS(fakeBuffer(200, 1, 44100, 0.5));
    expect(rms).toBeGreaterThan(0.3);
    expect(rms).toBeLessThan(0.4);
  });
});

describe('detectVoiceActivity', () => {
  it('reports hasVoice true when RMS > threshold', () => {
    const r = detectVoiceActivity(fakeBuffer(200, 1, 44100, 0.5));
    expect(r.hasVoice).toBe(true);
  });

  it('reports hasVoice false on silence', () => {
    const r = detectVoiceActivity(fakeBuffer(0));
    expect(r.hasVoice).toBe(false);
  });
});
