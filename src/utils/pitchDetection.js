/**
 * Pitch Detection — production-grade Silero VAD + CREPE pipeline.
 *
 * Pipeline:
 *   1. Decode AudioBuffer → resample to 16 kHz mono (Silero VAD + CREPE both
 *      operate at 16 kHz).
 *   2. Silero VAD (via @ricky0123/vad-web, ONNX in browser) identifies
 *      speech-only segments. Background noise / silence / breath frames are
 *      discarded — they would otherwise corrupt pitch estimates.
 *   3. CREPE (TFJS, model files in public/crepe/) predicts pitch + activation
 *      per 1024-sample window, hopped every 160 samples (10 ms). Inference
 *      mirrors the official CREPE TFJS demo's algorithm verbatim:
 *        - normalize each window (zero mean, unit std)
 *        - 360-bin sigmoid activation per window
 *        - confidence = max activation; skip frame if < 0.5
 *        - weighted average of 9 bins around argmax → predicted cent
 *        - freq_hz = 10 * 2^(cent / 1200)
 *   4. Median + octave-correction over high-confidence frames.
 *   5. If CREPE model fails to load (e.g. 404 on the model files), fall back
 *      to Pitchy YIN on the same VAD-cleaned PCM. App still works at degraded
 *      accuracy.
 *
 * Returns: { frequency, confidence, frameCount, validFrames, vadFrames, model }
 *   model: 'crepe' | 'pitchy-fallback' | 'none'
 */

import { NonRealTimeVAD } from '@ricky0123/vad-web';
import * as tf from '@tensorflow/tfjs';
import { PitchDetector } from 'pitchy';

const VAD_ASSET_BASE = '/vad/';                  // self-hosted Silero ONNX + WASM
const CREPE_MODEL_URL = '/crepe/model.json';     // self-hosted CREPE TFJS model
const TARGET_SAMPLE_RATE = 16000;                // both VAD and CREPE expect 16 kHz mono

// CREPE bin → cents mapping (verbatim from the official marl/crepe TFJS demo).
// 360 bins span 0..7180 cents, offset by 1997.3794084376191 (≈ C1 → C7).
const CENT_MAPPING = (() => {
  const arr = new Float32Array(360);
  for (let i = 0; i < 360; i++) arr[i] = (7180 * i) / 359 + 1997.3794084376191;
  return arr;
})();

let crepeModelPromise = null;
function loadCrepeOnce() {
  if (!crepeModelPromise) {
    // CREPE was published as a Keras-layers model (the official demo uses
    // tf.loadModel — the now-renamed tf.loadLayersModel).
    crepeModelPromise = tf.loadLayersModel(CREPE_MODEL_URL).catch((err) => {
      console.warn('[pitchDetection] CREPE model unavailable; falling back to Pitchy.', err.message);
      return null;
    });
  }
  return crepeModelPromise;
}

let vadInstance = null;
async function getVad() {
  if (!vadInstance) {
    vadInstance = await NonRealTimeVAD.new({
      // Self-hosted Silero ONNX. Avoids CDN flake (same lesson as MediaPipe).
      modelURL: `${VAD_ASSET_BASE}silero_vad_legacy.onnx`,
      // Point ONNX Runtime Web at our self-hosted WASM bundle so it doesn't
      // try to fetch from the jsdelivr default.
      ortConfig: (ort) => {
        ort.env.wasm.wasmPaths = VAD_ASSET_BASE;
      },
    });
  }
  return vadInstance;
}

/**
 * Resample an AudioBuffer to 16 kHz mono, returning a Float32Array.
 * Uses OfflineAudioContext for proper anti-aliased resampling.
 */
async function resampleTo16kMono(audioBuffer) {
  const numFrames = Math.ceil(audioBuffer.duration * TARGET_SAMPLE_RATE);
  const ctx = new OfflineAudioContext(1, numFrames, TARGET_SAMPLE_RATE);
  const src = ctx.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(ctx.destination);
  src.start(0);
  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0);
}

export async function detectPitch(audioBuffer) {
  let pcm16k;
  try {
    pcm16k = await resampleTo16kMono(audioBuffer);
  } catch (err) {
    console.warn('[pitchDetection] Resampling failed:', err.message);
    return { frequency: 0, confidence: 0, frameCount: 0, validFrames: 0, vadFrames: 0, model: 'none' };
  }

  // 1. Silero VAD — collect speech-only PCM.
  let speechPcm;
  let vadFrames = 0;
  try {
    const vad = await getVad();
    const segments = [];
    for await (const { audio } of vad.run(pcm16k, TARGET_SAMPLE_RATE)) {
      segments.push(audio);
      vadFrames += audio.length;
    }
    if (vadFrames === 0) {
      // No speech detected at all.
      return { frequency: 0, confidence: 0, frameCount: 0, validFrames: 0, vadFrames: 0, model: 'none' };
    }
    speechPcm = new Float32Array(vadFrames);
    let cursor = 0;
    for (const seg of segments) {
      speechPcm.set(seg, cursor);
      cursor += seg.length;
    }
  } catch (err) {
    console.warn('[pitchDetection] VAD failed; using full audio:', err.message);
    speechPcm = pcm16k;
    vadFrames = pcm16k.length;
  }

  // 2. CREPE inference (or Pitchy fallback).
  const crepeModel = await loadCrepeOnce();
  if (crepeModel) {
    return runCrepe(crepeModel, speechPcm, vadFrames);
  }
  return runPitchyFallback(speechPcm, vadFrames);
}

async function runCrepe(model, pcm, vadFrames) {
  // CREPE expects 1024-sample windows at 16 kHz. Hop 160 samples (10 ms) per
  // frame for fine pitch resolution — standard CREPE inference setting.
  const WINDOW = 1024;
  const HOP = 160;
  const validHz = [];
  let totalFrames = 0;

  for (let start = 0; start + WINDOW <= pcm.length; start += HOP) {
    totalFrames += 1;

    // Per-frame inference, mirroring the official marl/crepe demo:
    //   1. zero-mean
    //   2. divide by standard deviation
    //   3. predict → 360-bin activation
    //   4. confidence = max activation; skip if < 0.5
    //   5. weighted average of 9 bins around argmax → predicted cent
    //   6. freq_hz = 10 * 2^(cent / 1200)
    const result = tf.tidy(() => {
      const frame = tf.tensor1d(pcm.subarray(start, start + WINDOW));
      const zeromean = tf.sub(frame, tf.mean(frame));
      const std = tf.tensor(tf.norm(zeromean).dataSync()[0] / Math.sqrt(WINDOW));
      const normalized = tf.div(zeromean, std);
      const input = normalized.reshape([1, WINDOW]);
      const activation = model.predict(input).reshape([360]);
      const data = activation.dataSync();
      const confidence = activation.max().dataSync()[0];
      const center = activation.argMax().dataSync()[0];
      return { data: Array.from(data), confidence, center };
    });

    if (result.confidence < 0.5) continue;

    // Weighted local average of bins [center-4 .. center+4] for sub-bin pitch.
    const lo = Math.max(0, result.center - 4);
    const hi = Math.min(360, result.center + 5);
    let weightSum = 0;
    let productSum = 0;
    for (let i = lo; i < hi; i++) {
      const w = result.data[i];
      weightSum += w;
      productSum += w * CENT_MAPPING[i];
    }
    if (weightSum <= 0) continue;
    const predictedCent = productSum / weightSum;
    const freq = 10 * Math.pow(2, predictedCent / 1200);

    if (freq >= 70 && freq <= 500) validHz.push(freq);
  }

  if (validHz.length === 0) {
    return { frequency: 0, confidence: 0, frameCount: totalFrames, validFrames: 0, vadFrames, model: 'crepe' };
  }
  return finalize(validHz, totalFrames, vadFrames, 'crepe');
}

function runPitchyFallback(pcm, vadFrames) {
  const WINDOW = 2048;
  const HOP = 1024;
  const detector = PitchDetector.forFloat32Array(WINDOW);
  const valid = [];
  let totalFrames = 0;

  for (let start = 0; start + WINDOW <= pcm.length; start += HOP) {
    const win = pcm.subarray(start, start + WINDOW);
    const [freq, clarity] = detector.findPitch(win, TARGET_SAMPLE_RATE);
    totalFrames += 1;
    if (Number.isFinite(freq) && freq >= 70 && freq <= 500 && clarity >= 0.85) {
      valid.push(freq);
    }
  }

  if (valid.length === 0) {
    return { frequency: 0, confidence: 0, frameCount: totalFrames, validFrames: 0, vadFrames, model: 'pitchy-fallback' };
  }
  return finalize(valid, totalFrames, vadFrames, 'pitchy-fallback');
}

function finalize(valid, totalFrames, vadFrames, model) {
  valid.sort((a, b) => a - b);
  const median = valid[Math.floor(valid.length / 2)];
  // Octave-error backstop: if 25%+ of frames cluster around 2× the median,
  // the median is likely a sub-harmonic — correct upward.
  const halvedCount = valid.filter((f) => f >= median * 1.8 && f <= median * 2.2).length;
  const correctedFrequency = halvedCount / valid.length >= 0.25 ? median * 2 : median;
  const confidence = valid.length / Math.max(totalFrames, 1);
  return {
    frequency: correctedFrequency,
    confidence,
    frameCount: totalFrames,
    validFrames: valid.length,
    vadFrames,
    model,
  };
}

// — unchanged helpers —
export function calculateRMS(audioBuffer) {
  const data = audioBuffer.getChannelData(0);
  let sumOfSquares = 0;
  for (let i = 0; i < data.length; i++) sumOfSquares += data[i] * data[i];
  return Math.sqrt(sumOfSquares / data.length);
}

export function detectVoiceActivity(audioBuffer, threshold = 0.02) {
  const rms = calculateRMS(audioBuffer);
  return { hasVoice: rms > threshold, rms, energyLevel: rms };
}
