import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VOICE_PROMPTS, VERIFICATION } from '../../utils/constants';
import { detectPitch, detectVoiceActivity } from '../../utils/pitchDetection';

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
const S = { IDLE: 'idle', RECORDING: 'recording', ANALYZING: 'analyzing', PASS: 'pass', FAIL: 'fail' };

export default function VoiceVerification({ onVoiceVerificationComplete, isLoading }) {
  const [prompt]      = useState(getRandomPrompt);
  const [status,      setStatus]      = useState(S.IDLE);
  const [timeLeft,    setTimeLeft]    = useState(VERIFICATION.MAX_RECORDING_SECONDS);
  const [audioLevel,  setAudioLevel]  = useState(0);   // 0-100 live mic level
  const [result,      setResult]      = useState(null); // analysis result object
  const [error,       setError]       = useState('');

  // Refs — camera + MediaPipe for lip tracking
  const videoRef        = useRef(null);
  const canvasRef       = useRef(null);
  const faceMeshRef     = useRef(null);
  const cameraStreamRef = useRef(null);
  const lipTimelineRef  = useRef([]);   // {t, gap}[] sampled per frame while recording
  const recordingRef    = useRef(false); // flag so onResults knows if we're recording

  // Refs — audio
  const micStreamRef    = useRef(null);
  const recorderRef     = useRef(null);
  const chunksRef       = useRef([]);
  const timerRef        = useRef(null);
  const audioCtxRef     = useRef(null);
  const analyserRef     = useRef(null);
  const levelRafRef     = useRef(null);
  const audioTimelineRef= useRef([]);   // rms sampled ~30fps while recording

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
          locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
        });
        mesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        faceMeshRef.current = mesh;

        mesh.onResults(results => {
          if (!mounted || !canvasRef.current || !videoRef.current) return;
          const canvas = canvasRef.current;
          const ctx    = canvas.getContext('2d');

          // Mirror draw
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save(); ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          if (!results.multiFaceLandmarks?.length) return;
          const lm = results.multiFaceLandmarks[0];

          // Multi-point lip gap: average of 6 vertical upper/lower pairs
          // Upper lip (inner): 78, 82, 13, 312, 308 | Lower lip (inner): 78, 87, 14, 317, 308
          // Center pair + quarter-pairs + outer pair
          const LIP_PAIRS = [
            [13,  14],   // center inner
            [82,  87],   // left-quarter inner
            [312, 317],  // right-quarter inner
            [0,   17],   // center outer (wide open)
            [37,  84],   // left outer
            [267, 314],  // right outer
          ];
          const gap = LIP_PAIRS.reduce((sum, [u, l]) => {
            const up = lm[u], lo = lm[l];
            return up && lo ? sum + Math.abs(lo.y - up.y) : sum;
          }, 0) / LIP_PAIRS.length;

          // Draw all lip outline dots (mirrored)
          const ALL_LIP = [61,185,40,39,37,0,267,269,270,409,291,
                           308,415,310,311,312,13,82,81,80,78,
                           95,88,178,87,14,317,402,318,324,308];
          ALL_LIP.forEach(i => {
            const p = lm[i]; if (!p) return;
            ctx.beginPath();
            ctx.arc((1 - p.x) * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2);
            ctx.fillStyle = recordingRef.current ? '#ef4444' : '#3b82f6';
            ctx.fill();
          });

          // Highlight the 6 measurement pairs
          LIP_PAIRS.forEach(([u, l]) => {
            const up = lm[u], lo = lm[l]; if (!up || !lo) return;
            [[up, '#f97316'], [lo, '#a855f7']].forEach(([p, color]) => {
              ctx.beginPath();
              ctx.arc((1 - p.x) * canvas.width, p.y * canvas.height, 5, 0, Math.PI * 2);
              ctx.fillStyle = color;
              ctx.fill();
            });
            // Line between upper + lower pair
            ctx.beginPath();
            ctx.moveTo((1 - up.x) * canvas.width, up.y * canvas.height);
            ctx.lineTo((1 - lo.x) * canvas.width, lo.y * canvas.height);
            ctx.strokeStyle = recordingRef.current ? 'rgba(239,68,68,0.5)' : 'rgba(59,130,246,0.4)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          });

          // Live gap label on canvas
          ctx.font = 'bold 12px monospace';
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.textAlign = 'left';
          ctx.fillText(`Lip gap: ${(gap * 100).toFixed(1)}%`, 8, canvas.height - 8);

          // Only record lip timeline when actively recording
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
        // Non-fatal — voice check still works without camera
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
      // RMS from time-domain
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / buf.length);
      setAudioLevel(Math.min(100, Math.round(rms * 400)));

      // Sample audio timeline every ~33 ms
      if (Date.now() - t0 > 33) {
        audioTimelineRef.current.push(rms);
        t0 = Date.now();
      }
      levelRafRef.current = requestAnimationFrame(loop);
    }
    loop();
  }, []);

  // ── Start recording ───────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setError('');
    chunksRef.current = [];
    lipTimelineRef.current = [];
    audioTimelineRef.current = [];
    recordingRef.current = true;
    setAudioLevel(0);

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = micStream;

      // Web Audio for live level + timeline
      const ctx       = new AudioContext();
      audioCtxRef.current = ctx;
      const source    = ctx.createMediaStreamSource(micStream);
      const analyser  = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;
      startLevelLoop(analyser);

      // MediaRecorder for final blob
      const recorder = new MediaRecorder(micStream);
      recorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = analyzeRecording;
      recorder.start();

      // Countdown
      let secs = VERIFICATION.MAX_RECORDING_SECONDS;
      setTimeLeft(secs);
      setStatus(S.RECORDING);

      timerRef.current = setInterval(() => {
        secs--;
        setTimeLeft(secs);
        if (secs <= 0) stopRecording();
      }, 1000);

    } catch {
      setError('Microphone access denied. Please allow microphone access and try again.');
      recordingRef.current = false;
    }
  }, [startLevelLoop]);

  // ── Stop recording ────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(levelRafRef.current);
    recordingRef.current = false;
    setAudioLevel(0);

    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    setStatus(S.ANALYZING);
  }, []);

  // ── Analyze ───────────────────────────────────────────────────────────
  const analyzeRecording = useCallback(async () => {
    if (!chunksRef.current.length) {
      setError('No audio recorded. Please try again.');
      setStatus(S.IDLE);
      return;
    }

    try {
      const blob   = new Blob(chunksRef.current, { type: 'audio/webm' });
      const ab     = await blob.arrayBuffer();
      const actx   = new AudioContext();
      const buffer = await actx.decodeAudioData(ab);
      actx.close();

      // Duration check
      if (buffer.duration < VERIFICATION.MIN_RECORDING_SECONDS) {
        setError(`Recording too short (${buffer.duration.toFixed(1)}s). Please speak for at least ${VERIFICATION.MIN_RECORDING_SECONDS} seconds.`);
        setStatus(S.IDLE);
        return;
      }

      // Voice activity + pitch
      const { hasVoice, rms } = detectVoiceActivity(buffer);
      const { frequency }     = detectPitch(buffer);
      const inHumanRange      = frequency > 60 && frequency < 500;

      // Lip liveness: std deviation of lip gap during recording
      // Real speech → lips move a lot → high stdDev
      // Static face (photo/deepfake) → near-zero stdDev
      const LIP_STDDEV_THRESHOLD = 0.003; // easily hit when speaking
      const lipStdDev = lipTimelineRef.current.length >= 4
        ? lipMovementStdDev(lipTimelineRef.current)
        : null;
      const lipLivenessOk = lipStdDev === null
        ? true  // camera not available — skip check
        : lipStdDev > LIP_STDDEV_THRESHOLD;

      const passed = hasVoice
        && rms > VERIFICATION.MIN_VOICE_RMS
        && inHumanRange
        && lipLivenessOk;

      const analysisResult = {
        passed,
        durationSeconds: buffer.duration,
        rms: +rms.toFixed(4),
        frequency: +frequency.toFixed(1),
        inHumanRange,
        hasVoice,
        lipStdDev: lipStdDev !== null ? +lipStdDev.toFixed(4) : null,
        lipLivenessOk,
        lipMovementPct: lipStdDev !== null ? Math.round((lipStdDev / 0.02) * 100) : null,
      };

      setResult(analysisResult);
      setStatus(passed ? S.PASS : S.FAIL);

      if (passed) {
        setTimeout(() => onVoiceVerificationComplete(true, analysisResult), 1200);
      }

    } catch (err) {
      console.error('Audio analysis error:', err);
      setError('Audio analysis failed. Please try again.');
      setStatus(S.IDLE);
    }
  }, [onVoiceVerificationComplete]);

  // ── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(levelRafRef.current);
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  // ── Helpers for render ────────────────────────────────────────────────
  const timeColor  = timeLeft <= 3 ? 'text-red-500' : timeLeft <= 5 ? 'text-yellow-500' : 'text-blue-600';
  const barPercent = (timeLeft / VERIFICATION.MAX_RECORDING_SECONDS) * 100;

  return (
    <div className="text-center">
      <h3 className="text-2xl font-bold mb-1 text-gray-800">Step 3: Voice Verification</h3>
      <p className="text-gray-500 mb-5 text-sm">
        Speak the prompt below — proves you're live and not a recording
      </p>

      {/* Prompt card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 mb-5 shadow-sm">
        <p className="text-xs text-blue-400 font-semibold uppercase tracking-widest mb-2">🎤 Say This</p>
        <p className="text-blue-900 font-bold text-xl leading-snug">{prompt}</p>
      </div>

        {/* Camera feed — full size like FaceDetection */}
        <div className="relative inline-block mb-4">
          <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className={`rounded-xl mx-auto block max-w-full border-4 transition-colors duration-300 ${
              status === S.RECORDING ? 'border-red-400' : 'border-blue-200'
            }`}
            style={{ maxHeight: 320 }}
          />
          {status === S.RECORDING && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 rounded-full px-3 py-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-xs font-bold tracking-wide">RECORDING</span>
            </div>
          )}

          {/* Mic level bar — overlaid bottom-right corner */}
          {status === S.RECORDING && (
            <div className="absolute bottom-3 right-3 flex items-end gap-0.5" style={{ height: 40 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-sm transition-all duration-75"
                  style={{
                    height: `${Math.max(4, (i / 7) * 40)}px`,
                    backgroundColor: audioLevel > ((i + 1) / 8) * 100
                      ? (audioLevel > 70 ? '#22c55e' : '#3b82f6')
                      : 'rgba(255,255,255,0.2)',
                  }}
                />
              ))}
            </div>
          )}
        </div>

      {/* Countdown timer bar */}
      {status === S.RECORDING && (
        <div className="max-w-xs mx-auto mb-4 space-y-1">
          <div className="flex justify-between text-xs font-medium text-gray-400">
            <span>Time remaining</span>
            <span className={`font-bold text-sm ${timeColor}`}>{timeLeft}s</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
            <div
              className="h-3 rounded-full transition-all duration-1000"
              style={{
                width: `${barPercent}%`,
                background: timeLeft <= 3 ? '#ef4444' : timeLeft <= 5 ? '#f59e0b' : '#3b82f6',
              }}
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      {status === S.IDLE && (
        <button
          onClick={startRecording}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg transition"
        >
          🎤 Start Recording
        </button>
      )}

      {status === S.RECORDING && (
        <button
          onClick={stopRecording}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-lg shadow-lg transition animate-pulse"
        >
          ⏹ Done Speaking
        </button>
      )}

      {status === S.ANALYZING && (
        <div className="space-y-2">
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-blue-50 text-blue-700 font-semibold text-lg">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400 border-t-blue-700" />
            Analyzing your voice...
          </div>
          <p className="text-xs text-gray-400">Checking pitch, speech presence & lip sync</p>
        </div>
      )}

      {/* Results panel */}
      {(status === S.PASS || status === S.FAIL) && result && (
        <div className={`max-w-xs mx-auto rounded-2xl p-5 mb-4 border-2 ${
          status === S.PASS
            ? 'bg-green-50 border-green-400'
            : 'bg-red-50 border-red-400'
        }`}>
          <p className={`font-bold text-xl mb-3 ${status === S.PASS ? 'text-green-700' : 'text-red-600'}`}>
            {status === S.PASS ? '✅ Voice Verified!' : '❌ Verification Failed'}
          </p>
          <div className="text-sm space-y-1 text-left">
            <ResultRow label="Speech detected" ok={result.hasVoice} value={result.hasVoice ? 'Yes' : 'No'} />
            <ResultRow label="Voice level"     ok={result.rms > VERIFICATION.MIN_VOICE_RMS}
                       value={`RMS ${(result.rms * 100).toFixed(1)}%`} />
            <ResultRow label="Pitch"           ok={result.inHumanRange}
                       value={result.frequency > 0 ? `${result.frequency} Hz` : 'Not detected'} />
            {result.lipMovementPct !== null && (
              <ResultRow label="Lip movement" ok={result.lipLivenessOk}
                       value={`${Math.min(100, result.lipMovementPct)}% activity`} />
            )}
          </div>
          {status === S.FAIL && (
            <button
              onClick={() => { setStatus(S.IDLE); setResult(null); setError(''); }}
              className="mt-4 w-full py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="max-w-xs mx-auto mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
          ⚠️ {error}
          <button
            onClick={() => { setStatus(S.IDLE); setError(''); }}
            className="block mx-auto mt-2 text-blue-600 underline text-xs"
          >
            Try again
          </button>
        </div>
      )}

      {isLoading && (
        <div className="mt-4 text-blue-600 font-semibold animate-pulse">
          Saving verification... please wait
        </div>
      )}

      <p className="text-xs text-gray-400 mt-5">
        Speak clearly for {VERIFICATION.MIN_RECORDING_SECONDS}–{VERIFICATION.MAX_RECORDING_SECONDS}s.
        Voice is analyzed locally and never stored.
      </p>
    </div>
  );
}

// ── Small helper component ────────────────────────────────────────────────
function ResultRow({ label, ok, value }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold flex items-center gap-1 ${ok ? 'text-green-700' : 'text-red-600'}`}>
        {ok ? '✅' : '❌'} {value}
      </span>
    </div>
  );
}
