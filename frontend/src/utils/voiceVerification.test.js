import { describe, it, expect } from 'vitest';
import { evaluateVoiceConfidence } from './voiceVerification';

// Baseline of "everything else passing", so each test isolates one variable.
const goodSignalBase = {
  rms: 0.05,
  duration: 4,
  speechRatio: 0.6,
  lipSyncScore: 0.5,
  promptMatch: 0.9,
  hasTranscript: true,
  micError: false,
  pitchConfidence: 0.8,
};

describe('evaluateVoiceConfidence — pitch hard gate', () => {
  it('passes a strong female pitch (200 Hz) with good signals', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 200 });
    expect(r.passed).toBe(true);
    expect(r.checks.pitchOk).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it('rejects a typical male pitch (120 Hz) even when other signals are perfect', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 120 });
    expect(r.passed).toBe(false);
    expect(r.checks.pitchOk).toBe(false);
    expect(r.hardFail).toBe(true);
    expect(r.failureReasons.some((s) => /pitch/i.test(s))).toBe(true);
  });

  it('passes borderline-low female pitch (155 Hz)', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 155 });
    expect(r.passed).toBe(true);
    expect(r.checks.pitchOk).toBe(true);
  });

  it('passes borderline-high female pitch (275 Hz)', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 275 });
    expect(r.passed).toBe(true);
    expect(r.checks.pitchOk).toBe(true);
  });

  it('rejects pitch above the female range (300 Hz)', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 300 });
    expect(r.passed).toBe(false);
    expect(r.checks.pitchOk).toBe(false);
  });

  it('rejects when pitch is 0 (silence/no voiced sound detected)', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 0 });
    expect(r.passed).toBe(false);
    expect(r.checks.pitchOk).toBe(false);
  });

  it('rejects when pitch is null', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: null });
    expect(r.passed).toBe(false);
    expect(r.checks.pitchOk).toBe(false);
  });

  it('rejects when pitch is NaN', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: NaN });
    expect(r.passed).toBe(false);
    expect(r.checks.pitchOk).toBe(false);
  });

  it('awards more pitch points inside the strong range than the borderline', () => {
    const strong = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 200 });
    const borderlineLow = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 155 });
    expect(strong.score).toBeGreaterThan(borderlineLow.score);
  });
});

describe('evaluateVoiceConfidence — other hard gates remain', () => {
  it('rejects on mic error regardless of other signals', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 200, micError: true });
    expect(r.passed).toBe(false);
    expect(r.failureReasons[0]).toMatch(/microphone/i);
  });

  it('rejects on too-short duration', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 200, duration: 1 });
    expect(r.passed).toBe(false);
    expect(r.failureReasons.some((s) => /short/i.test(s))).toBe(true);
  });

  it('rejects on too-long duration', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 200, duration: 12 });
    expect(r.passed).toBe(false);
    expect(r.failureReasons.some((s) => /too long/i.test(s))).toBe(true);
  });

  it('rejects on low RMS (voice too quiet)', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 200, rms: 0.005 });
    expect(r.passed).toBe(false);
    expect(r.failureReasons.some((s) => /low/i.test(s))).toBe(true);
  });

  it('rejects on low prompt match', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 200, promptMatch: 0.3 });
    expect(r.passed).toBe(false);
    expect(r.failureReasons.some((s) => /sentence/i.test(s))).toBe(true);
  });

  it('still passes when SR is unavailable but everything else is good', () => {
    const r = evaluateVoiceConfidence({
      ...goodSignalBase,
      pitchHz: 200,
      hasTranscript: false,
      promptMatch: null,
    });
    expect(r.passed).toBe(true);
  });

  it('lists multiple reasons when multiple hard gates fail', () => {
    const r = evaluateVoiceConfidence({
      ...goodSignalBase,
      pitchHz: 100,
      duration: 1,
      rms: 0.005,
    });
    expect(r.passed).toBe(false);
    expect(r.failureReasons.length).toBeGreaterThanOrEqual(2);
  });
});

describe('evaluateVoiceConfidence — pitch confidence floor', () => {
  it('rejects when pitch confidence is too low (could not detect voice)', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 200, pitchConfidence: 0.1 });
    expect(r.passed).toBe(false);
    expect(r.failureReasons.some((s) => /detect voice/i.test(s))).toBe(true);
  });

  it('does NOT add the "outside range" reason when confidence is low', () => {
    // Even if pitch is "out of range", we should report "couldn't detect" — not "male voice".
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 50, pitchConfidence: 0.1 });
    expect(r.failureReasons.some((s) => /outside the expected range/i.test(s))).toBe(false);
  });

  it('rejects when pitchConfidence is null', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 200, pitchConfidence: null });
    expect(r.passed).toBe(false);
    expect(r.checks.pitchConfidenceOk).toBe(false);
  });

  it('rejects when pitchConfidence is NaN', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 200, pitchConfidence: NaN });
    expect(r.passed).toBe(false);
    expect(r.checks.pitchConfidenceOk).toBe(false);
  });

  it('passes a slightly-low female pitch (145 Hz) thanks to the lowered floor', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 145 });
    expect(r.passed).toBe(true);
    expect(r.checks.pitchOk).toBe(true);
  });
});

describe('evaluateVoiceConfidence — soft signals do NOT auto-fail', () => {
  it('passes when lip-sync is unavailable (null) but voice is female and other signals are good', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 200, lipSyncScore: null });
    expect(r.passed).toBe(true);
  });

  it('passes when lip-sync is NaN', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 200, lipSyncScore: NaN });
    expect(r.passed).toBe(true);
  });

  it('passes when lip-sync is low but pitch + speech + prompt match are strong', () => {
    const r = evaluateVoiceConfidence({ ...goodSignalBase, pitchHz: 200, lipSyncScore: 0.05 });
    expect(r.passed).toBe(true);
  });
});
