import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VOICE_PROMPTS, VERIFICATION } from '../../utils/constants';
import { detectPitch, detectVoiceActivity } from '../../utils/pitchDetection';
import { evaluateVoiceConfidence } from '../../utils/voiceVerification';

// ── Random prompt ─────────────────────────────────────────────────────────
function getRandomPrompt() {
  return VOICE_PROMPTS[Math.floor(Math.random() * VOICE_PROMPTS.length)];
}

// ── Lip movement check ───────────────────────────────────────────────────
// Measures std deviation of lip gap over the recording.
// A real speaking person varies lip gap significantly (stdDev > 0.003).
// A static photo or deepfake has near-zero variance.
function lipMovementStdDev(lipTimeline) {
  if (lipTimeline.length < 4) return 0;
  const gaps = lipTimeline.map(p => p.gap);
  const mean = gaps.reduce((s, v) => s + v, 0) / gaps.length;
  const variance = gaps.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / gaps.length;
  return Math.sqrt(variance); // typical range: 0 (static) → 0.02+ (active speech)
}

// ── STATUS constants ──────────────────────────────────────────────────────
const S = {
  INIT: 'init',           // before auto-start (very brief)
  LISTENING: 'listening', // mic + recognition + timer all running
  ANALYZING: 'analyzing', // recorder stopped, computing decision
  PASS: 'pass',
  FAIL: 'fail',
  MIC_ERROR: 'mic_error', // permission denied or mic unavailable
};

export default function VoiceVerification({ onVoiceVerificationComplete, isLoading }) {
  const [prompt, setPrompt] = useState(getRandomPrompt);
  const [status, setStatus] = useState(S.INIT);
  const [timeLeft, setTimeLeft] = useState(VERIFICATION.MAX_RECORDING_SECONDS);
  const [audioLevel, setAudioLevel] = useState(0);
  const [result, setResult] = useState(null);
  const [failureReasons, setFailureReasons] = useState([]);
  const [spokenText, setSpokenText] = useState('');

  // Refs — camera + MediaPipe for lip tracking
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceMeshRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const lipTimelineRef = useRef([]);
  const recordingRef = useRef(false);

  // Refs — audio
  const micStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const levelRafRef = useRef(null);
  const audioTimelineRef = useRef([]);

  // Refs — speech matching
  const recognitionRef = useRef(null);
  const spokenTextRef = useRef('');
  const srAvailableRef = useRef(true);

  // Session-token sentinel — closure-captured so a session that's torn down
  // mid-getUserMedia bails out instead of writing into a dead component's refs.
  // This is the load-bearing StrictMode safeguard; no separate "did we already
  // auto-start" ref is needed (the effect's empty deps already guarantee one
  // fire per real mount in production).
  const currentSessionTokenRef = useRef(null);

  // ── Camera + MediaPipe setup (runs once on mount) ─────────────────────
  useEffect(() => {
    let mounted = true;
    let raf;

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const { FaceMesh } = await import('@mediapipe/face_mesh');
        if (!mounted) return;

        const mesh = new FaceMesh({
          // Self-hosted from public/mediapipe/face_mesh — the jsdelivr SIMD
          // WASM bundle's .data file load fails inside Emscripten on some
          // browser/version combos. Same-origin sidesteps that.
          locateFile: f => `/mediapipe/face_mesh/${f}`,
        });
        mesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        faceMeshRef.current = mesh;

        mesh.onResults(results => {
          if (!mounted || !canvasRef.current || !videoRef.current) return;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save(); ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          if (!results.multiFaceLandmarks?.length) return;
          const lm = results.multiFaceLandmarks[0];

          const LIP_PAIRS = [
            [13, 14],
            [82, 87],
            [312, 317],
            [0, 17],
            [37, 84],
            [267, 314],
          ];
          const gap = LIP_PAIRS.reduce((sum, [u, l]) => {
            const up = lm[u], lo = lm[l];
            return up && lo ? sum + Math.abs(lo.y - up.y) : sum;
          }, 0) / LIP_PAIRS.length;

          const ALL_LIP = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
            308, 415, 310, 311, 312, 13, 82, 81, 80, 78,
            95, 88, 178, 87, 14, 317, 402, 318, 324, 308];
          ALL_LIP.forEach(i => {
            const p = lm[i]; if (!p) return;
            ctx.beginPath();
            ctx.arc((1 - p.x) * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2);
            ctx.fillStyle = recordingRef.current ? '#ef4444' : '#3b82f6';
            ctx.fill();
          });

          LIP_PAIRS.forEach(([u, l]) => {
            const up = lm[u], lo = lm[l]; if (!up || !lo) return;
            [[up, '#f97316'], [lo, '#a855f7']].forEach(([p, color]) => {
              ctx.beginPath();
              ctx.arc((1 - p.x) * canvas.width, p.y * canvas.height, 5, 0, Math.PI * 2);
              ctx.fillStyle = color;
              ctx.fill();
            });
            ctx.beginPath();
            ctx.moveTo((1 - up.x) * canvas.width, up.y * canvas.height);
            ctx.lineTo((1 - lo.x) * canvas.width, lo.y * canvas.height);
            ctx.strokeStyle = recordingRef.current ? 'rgba(239,68,68,0.5)' : 'rgba(59,130,246,0.4)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          });

          ctx.font = 'bold 12px monospace';
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.textAlign = 'left';
          ctx.fillText(`Lip gap: ${(gap * 100).toFixed(1)}%`, 8, canvas.height - 8);

          if (recordingRef.current) {
            lipTimelineRef.current.push({ t: Date.now(), gap });
          }
        });

        async function tick() {
          if (!mounted) return;
          if (videoRef.current?.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
            await mesh.send({ image: videoRef.current });
          }
          raf = requestAnimationFrame(tick);
        }
        tick();
      } catch (e) {
        console.warn('Camera not available for lip sync:', e);
      }
    }

    initCamera();
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      faceMeshRef.current?.close?.();
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Mic level loop (runs while recording) ─────────────────────────────
  const startLevelLoop = useCallback((analyser) => {
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let t0 = Date.now();

    function loop() {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / buf.length);
      setAudioLevel(Math.min(100, Math.round(rms * 400)));

      if (Date.now() - t0 > 33) {
        audioTimelineRef.current.push(rms);
        t0 = Date.now();
      }
      levelRafRef.current = requestAnimationFrame(loop);
    }
    loop();
  }, []);

  // ── Stop active session — used by timer expiry, Submit Now, retries ───
  const stopAndAnalyze = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(levelRafRef.current);
    recordingRef.current = false;
    setAudioLevel(0);

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
    }

    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop(); // triggers analyzeRecording via onstop
    }
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    setStatus(S.ANALYZING);
  }, []);

  // ── Tear down any running session without triggering analysis ─────────
  const teardownSession = useCallback(() => {
    // Mark the active session (if any) cancelled so an in-flight getUserMedia
    // bail-out can detect it via closure capture even after refs are reset.
    if (currentSessionTokenRef.current) {
      currentSessionTokenRef.current.cancelled = true;
      currentSessionTokenRef.current = null;
    }
    clearInterval(timerRef.current);
    cancelAnimationFrame(levelRafRef.current);
    recordingRef.current = false;
    setAudioLevel(0);
    if (recognitionRef.current) {
      // Detach handlers BEFORE stop() — Web Speech API can fire a final
      // onresult after stop, which would overwrite spokenTextRef with stale
      // data on the next session.
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      // Detach the onstop handler so the in-flight analyzer doesn't fire on a torn-down session.
      recorderRef.current.onstop = null;
      try { recorderRef.current.stop(); } catch (e) { /* ignore */ }
    }
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  // ── Analyze ───────────────────────────────────────────────────────────
  // Defined before startVerificationSession so the latter can list it as a dep.
  const analyzeRecording = useCallback(async () => {
    if (!chunksRef.current.length) {
      setStatus(S.FAIL);
      setFailureReasons(['No audio recorded. Please try again.']);
      return;
    }

    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const ab = await blob.arrayBuffer();
      const actx = new AudioContext();
      const buffer = await actx.decodeAudioData(ab);
      actx.close();

      const srWorked = srAvailableRef.current && spokenTextRef.current.length > 0;

      const normalize = (t) => (t || '')
        .toLowerCase()
        .replace(/safecircles/g, 'safe circles')
        .replace(/[^\w\s]|_/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const wordsRequired = normalize(prompt).split(' ').filter(Boolean);
      const wordsSpoken = normalize(spokenTextRef.current).split(' ').filter(Boolean);
      const matchCount = wordsRequired.filter(w => wordsSpoken.includes(w)).length;
      const similarity = wordsRequired.length === 0
        ? 0
        : matchCount / Math.max(wordsRequired.length, wordsSpoken.length);

      const { hasVoice, rms } = detectVoiceActivity(buffer);
      // detectPitch is now async (Silero VAD + CREPE inference both run async).
      const { frequency, confidence: pitchConfidence } = await detectPitch(buffer);

      const activeFrames = audioTimelineRef.current.filter(val => val > 0.02).length;
      const speechRatio = audioTimelineRef.current.length
        ? activeFrames / audioTimelineRef.current.length
        : 0;

      const lipStdDev = lipTimelineRef.current.length >= 4 ? lipMovementStdDev(lipTimelineRef.current) : null;
      const lipSyncScore = lipStdDev !== null ? Math.min(2.0, lipStdDev * 100) : null;

      const decision = evaluateVoiceConfidence({
        pitchHz: frequency,
        pitchConfidence,
        rms,
        duration: buffer.duration,
        speechRatio,
        lipSyncScore,
        promptMatch: similarity,
        hasTranscript: srWorked,
        micError: false,
      });

      setResult({
        passed: decision.passed,
        score: decision.score,
        durationSeconds: buffer.duration,
        rms,
        frequency,
        speechRatio,
        lipSyncScore,
        similarity: srWorked ? similarity : null,
        hasVoice,
      });

      if (decision.passed) {
        setStatus(S.PASS);
        setFailureReasons([]);
        setTimeout(() => onVoiceVerificationComplete(true, decision), 1200);
      } else {
        setStatus(S.FAIL);
        setFailureReasons(decision.failureReasons.length
          ? decision.failureReasons
          : ['Verification failed. Please try again.']);
        setPrompt(getRandomPrompt());
      }
    } catch (err) {
      console.error('Audio analysis error:', err);
      setStatus(S.FAIL);
      setFailureReasons(['Audio analysis failed. Please try again.']);
      setPrompt(getRandomPrompt());
    }
  }, [prompt, onVoiceVerificationComplete]);

  // ── Start / restart a verification session ────────────────────────────
  const startVerificationSession = useCallback(async () => {
    // Always tear down any previous session before starting a new one.
    teardownSession();

    // Closure-local cancellation flag. Survives StrictMode unmount because it's
    // captured here, not stored on a ref that can be replaced by remount.
    const sessionToken = { cancelled: false };
    currentSessionTokenRef.current = sessionToken;

    chunksRef.current = [];
    lipTimelineRef.current = [];
    audioTimelineRef.current = [];
    spokenTextRef.current = '';
    setSpokenText('');
    setResult(null);
    setFailureReasons([]);
    recordingRef.current = true;
    setAudioLevel(0);
    setTimeLeft(VERIFICATION.MAX_RECORDING_SECONDS);

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // If teardown ran during the await, abort cleanly — don't write to refs
      // that may belong to a previous mount instance.
      if (sessionToken.cancelled) {
        micStream.getTracks().forEach(t => t.stop());
        return;
      }
      micStreamRef.current = micStream;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      srAvailableRef.current = !!SpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (event) => {
          let accumulated = '';
          for (let i = 0; i < event.results.length; ++i) {
            accumulated += event.results[i][0].transcript + ' ';
          }
          spokenTextRef.current = accumulated.trim();
          setSpokenText(accumulated.trim());
        };
        recognition.onerror = (e) => {
          console.warn('SpeechRecognition error:', e.error);
          if (e.error === 'network' || e.error === 'service-not-allowed' || e.error === 'not-allowed') {
            srAvailableRef.current = false;
            setSpokenText('(voice recognition unavailable — audio checks only)');
          }
        };
        try { recognition.start(); } catch (e) { console.warn('SR start failed', e); srAvailableRef.current = false; }
        recognitionRef.current = recognition;
      } else {
        console.warn('[VoiceVerification] SpeechRecognition unavailable, using audio-only fallback');
      }

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(micStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;
      startLevelLoop(analyser);

      const recorder = new MediaRecorder(micStream);
      recorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = analyzeRecording;
      recorder.start();

      let secs = VERIFICATION.MAX_RECORDING_SECONDS;
      setStatus(S.LISTENING);

      timerRef.current = setInterval(() => {
        secs--;
        setTimeLeft(secs);
        if (secs <= 0) stopAndAnalyze();
      }, 1000);
    } catch (e) {
      console.warn('Microphone access failed:', e);
      if (sessionToken.cancelled) return;
      teardownSession();
      setStatus(S.MIC_ERROR);
    }
  }, [startLevelLoop, stopAndAnalyze, teardownSession, analyzeRecording]);

  // ── Auto-start on mount (StrictMode-safe via session token) ──────────
  useEffect(() => {
    startVerificationSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Final cleanup on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      teardownSession();
    };
  }, [teardownSession]);

  // ── Helpers for render ────────────────────────────────────────────────
  const timeColor = timeLeft <= 3 ? 'text-red-400' : 'text-blue-300';
  const barPercent = (timeLeft / VERIFICATION.MAX_RECORDING_SECONDS) * 100;

  return (
    <div className="text-center">
      <h3 className="mb-1 text-2xl font-bold text-[#EAE0C8]">Step 3: Voice Verification</h3>
      <p className="mb-5 text-sm text-[#EAE0C8]/60">
        Speak the prompt below — proves you're live and not a recording
      </p>

      {/* Prompt card */}
      <div className="mb-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-300">Say This Exact Sentence</p>
        <p className="text-xl font-bold leading-snug text-[#EAE0C8]">"{prompt}"</p>
      </div>

      {/* SR fallback notice */}
      {spokenText.includes('unavailable') && (
        <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium text-blue-300">
          Speech-to-text unavailable in this environment — verifying by voice audio and lip movement only.
        </div>
      )}

      {/* Live transcript display during recording */}
      {status === S.LISTENING && spokenText && !spokenText.includes('unavailable') && (
        <div className="mb-3 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-300">
          Heard: "{spokenText}"
        </div>
      )}

      {/* Camera feed */}
      <div className="relative inline-block mb-4">
        <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className={`mx-auto block max-w-full rounded-xl border-4 transition-colors duration-300 ${status === S.LISTENING ? 'border-blue-400' : 'border-blue-200'
            }`}
          style={{ maxHeight: 320 }}
        />
        {status === S.LISTENING && (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-[#0B132B]/80 px-3 py-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs font-bold tracking-wide text-[#EAE0C8]">LISTENING</span>
          </div>
        )}

        {/* Mic level bar */}
        {status === S.LISTENING && (
          <div className="absolute bottom-3 right-3 flex items-end gap-0.5" style={{ height: 40 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 rounded-sm transition-all duration-75"
                style={{
                  height: `${Math.max(4, (i / 7) * 40)}px`,
                  backgroundColor: audioLevel > ((i + 1) / 8) * 100
                    ? (audioLevel > 70 ? '#22c55e' : '#3b82f6')
                    : 'rgba(234,224,200,0.18)',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Countdown timer bar */}
      {status === S.LISTENING && (
        <div className="max-w-xs mx-auto mb-4 space-y-1">
          <div className="flex justify-between text-xs font-medium text-[#EAE0C8]/50">
            <span>Time remaining</span>
            <span className={`font-bold text-sm ${timeColor}`}>{timeLeft}s</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full border border-white/5 bg-[#111A3A]">
            <div
              className="h-3 rounded-full transition-all duration-1000"
              style={{
                width: `${barPercent}%`,
                background: timeLeft <= 3 ? '#ef4444' : '#3b82f6',
              }}
            />
          </div>
        </div>
      )}

      {/* Status labels */}
      {status === S.INIT && (
        <p className="text-blue-300 font-semibold animate-pulse">Initializing...</p>
      )}
      {status === S.LISTENING && (
        <p className="text-blue-300 font-semibold mb-3">Listening...</p>
      )}
      {status === S.ANALYZING && (
        <div className="inline-flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-8 py-4 text-lg font-bold text-blue-300">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400 border-t-blue-700" />
          Analyzing...
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex justify-center gap-3 flex-wrap">
        {status === S.LISTENING && (
          <button
            onClick={stopAndAnalyze}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-base font-bold text-[#EAE0C8] shadow-lg transition hover:bg-blue-500 disabled:opacity-50"
          >
            Submit Now
          </button>
        )}
        {(status === S.FAIL || status === S.MIC_ERROR) && (
          <button
            onClick={startVerificationSession}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-base font-bold text-[#EAE0C8] shadow-lg transition hover:bg-blue-500 disabled:opacity-50"
          >
            Try Again
          </button>
        )}
        {status === S.LISTENING && (
          <button
            onClick={startVerificationSession}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0B132B]/60 px-6 py-3 text-base font-medium text-[#EAE0C8] transition hover:bg-[#0B132B] disabled:opacity-50"
          >
            Restart Voice Check
          </button>
        )}
      </div>

      {/* Mic-error panel */}
      {status === S.MIC_ERROR && (
        <div className="max-w-sm mx-auto mt-4 rounded-2xl border-2 border-red-400 bg-red-500/10 p-5 text-left">
          <p className="font-bold text-lg mb-2 text-red-300">Microphone Unavailable</p>
          <p className="text-sm text-[#EAE0C8]/80">
            Microphone permission is required for verification. Please grant access in your browser settings and try again.
          </p>
        </div>
      )}

      {/* Result panel */}
      {(status === S.PASS || status === S.FAIL) && (
        <div className={`max-w-sm mx-auto rounded-2xl p-5 mt-4 mb-2 border-2 text-left ${status === S.PASS
            ? 'bg-green-500/10 border-green-400'
            : 'bg-red-500/10 border-red-400'
          }`}>
          <p className={`font-bold text-xl mb-3 text-center ${status === S.PASS ? 'text-green-300' : 'text-red-300'}`}>
            {status === S.PASS ? 'Verification Successful' : 'Verification Failed'}
          </p>
          {status === S.FAIL && failureReasons.length > 0 && (
            <ul className="text-sm text-[#EAE0C8]/85 space-y-1 list-disc pl-5 mb-3">
              {failureReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          {result && status === S.PASS && (
            <p className="text-xs text-[#EAE0C8]/60 text-center">
              Confidence score: {result.score}/100
            </p>
          )}
        </div>
      )}

      {isLoading && (
        <div className="mt-4 text-blue-300 font-semibold animate-pulse">
          Saving verification... please wait
        </div>
      )}

      <p className="mt-5 text-xs text-[#EAE0C8]/50">
        Speak clearly for {VERIFICATION.MIN_RECORDING_SECONDS}–{VERIFICATION.MAX_RECORDING_SECONDS}s.
        Voice is analyzed locally and never stored.
      </p>
    </div>
  );
}
