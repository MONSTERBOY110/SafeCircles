import React, { useRef, useEffect, useState } from 'react';

// ── Yaw calculation ────────────────────────────────────────────────────────
// Self-normalising nose-offset, negated to match mirrored (selfie) display.
// Physical LEFT turn → nose.x rises in raw frame → rawOffset > 0 → yaw < 0 ✓
function computeYaw(lm) {
  const nose = lm[1], L = lm[234], R = lm[454];
  const mid = (L.x + R.x) / 2;
  const half = Math.abs(L.x - R.x) / 2;
  if (half < 0.01) return 0;
  return Math.max(-60, Math.min(60, -((nose.x - mid) / half) * 45));
}

// ── Smile score 0-1 ───────────────────────────────────────────────────────
function computeSmile(lm) {
  const lc = lm[61], rc = lm[291]; // mouth corners
  const ul = lm[13], ll = lm[14]; // lip midpoints
  const lCh = lm[234], rCh = lm[454]; // cheeks
  const mouthW = Math.abs(lc.x - rc.x);
  const faceW = Math.abs(lCh.x - rCh.x);
  const ratio = faceW > 0 ? mouthW / faceW : 0;
  const gap = Math.abs(ll.y - ul.y);
  const wScore = Math.min(1, Math.max(0, (ratio - 0.30) / 0.20));
  const gScore = Math.min(1, Math.max(0, gap / 0.04));
  return wScore * 0.6 + gScore * 0.4;
}

// ── Challenge definitions ─────────────────────────────────────────────────
const STEPS = [
  { id: 'left', emoji: '⬅️', label: 'Look LEFT', hint: 'Turn your head to the left', check: (y) => y < -15 },
  { id: 'right', emoji: '➡️', label: 'Look RIGHT', hint: 'Turn your head to the right', check: (y) => y > 15 },
  { id: 'smile', emoji: '😊', label: 'SMILE', hint: 'Smile naturally — show your teeth', check: (_, s) => s > 0.35 },
];
const HOLD_FRAMES = 10; // ~0.33 s at 30 fps

export default function HeadMovement({ onHeadMovementComplete }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const stepRef = useRef(0);
  const completedRef = useRef([]);
  const holdRef = useRef(0);
  const doneRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [isDone, setIsDone] = useState(false);
  const [metrics, setMetrics] = useState({ yaw: 0, smile: 0, holdPct: 0, passing: false });

  // ── Camera ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let stream;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false })
      .then(s => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setCameraActive(true);
          };
        }
      })
      .catch(console.error);
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  // ── MediaPipe loop ───────────────────────────────────────────────────────
  // `mounted` flag prevents the StrictMode double-invoke from leaving a zombie listener.
  useEffect(() => {
    if (!cameraActive) return;
    let raf;
    let mesh;
    let mounted = true; // ← key: if cleanup runs before init finishes, flag stops it

    async function init() {
      const { FaceMesh } = await import('@mediapipe/face_mesh');
      if (!mounted) return; // cleanup already ran (StrictMode dev double-mount)

      mesh = new FaceMesh({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
      });
      mesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      mesh.onResults(results => {
        if (!mounted || !canvasRef.current || !videoRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Mirrored draw — selfie mode
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        if (doneRef.current) return;

        if (!results.multiFaceLandmarks?.length) {
          holdRef.current = 0;
          setMetrics(m => ({ ...m, holdPct: 0, passing: false }));
          // Red border — no face
          ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3;
          ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
          return;
        }

        const lm = results.multiFaceLandmarks[0];
        const yaw = computeYaw(lm);
        const smile = computeSmile(lm);

        const idx = stepRef.current;
        if (idx >= STEPS.length) return;
        const step = STEPS[idx];
        const passing = step.check(yaw, smile);

        // Live border
        ctx.strokeStyle = passing ? '#22c55e' : '#3b82f6';
        ctx.lineWidth = passing ? 4 : 2;
        ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

        // Landmark dots (mirrored X)
        ctx.fillStyle = passing ? '#22c55e' : '#60a5fa';
        [1, 33, 263, 234, 454, 61, 291, 13, 14].forEach(i => {
          const p = lm[i]; if (!p) return;
          ctx.beginPath();
          ctx.arc((1 - p.x) * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2);
          ctx.fill();
        });

        // Direction arrow on canvas
        if (step.id === 'left' || step.id === 'right') {
          ctx.font = 'bold 52px Arial';
          ctx.textAlign = 'center';
          ctx.fillStyle = passing ? '#22c55e' : 'rgba(255,255,255,0.8)';
          // In mirrored view: left arrow goes on canvas-right (high x = screen-left)
          const ax = step.id === 'left' ? canvas.width - 60 : 60;
          ctx.fillText(step.id === 'left' ? '◀' : '▶', ax, canvas.height / 2 + 18);
        }

        // Hold counter
        if (passing) {
          holdRef.current = Math.min(holdRef.current + 1, HOLD_FRAMES);
        } else {
          holdRef.current = Math.max(holdRef.current - 1, 0);
        }

        const holdPct = Math.round((holdRef.current / HOLD_FRAMES) * 100);
        setMetrics({ yaw, smile, holdPct, passing });

        if (holdRef.current >= HOLD_FRAMES) {
          // ✅ Step complete
          holdRef.current = 0;
          completedRef.current = [...completedRef.current, step.id];
          stepRef.current = idx + 1;
          setCompleted([...completedRef.current]);
          setCurrentStep(idx + 1);

          if (completedRef.current.length === STEPS.length) {
            doneRef.current = true;
            setIsDone(true);
            setTimeout(() => onHeadMovementComplete(), 1000);
          }
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
    }

    init().catch(console.error);
    return () => {
      mounted = false;          // stop any in-flight init from installing listeners
      cancelAnimationFrame(raf);
      mesh?.close?.();
    };
  }, [cameraActive, onHeadMovementComplete]);

  const activeStep = STEPS[Math.min(currentStep, STEPS.length - 1)];
  const { yaw, smile, holdPct, passing } = metrics;

  // Direction progress for left/right
  const dirProgress = activeStep.id === 'left'
    ? Math.min(100, Math.max(0, (-yaw / 15) * 100))
    : activeStep.id === 'right'
      ? Math.min(100, Math.max(0, (yaw / 15) * 100))
      : 0;

  return (
    <div className="text-center">
      <h3 className="text-2xl font-bold mb-1 text-gray-800">Step 2: Liveness Check</h3>
      <p className="text-gray-500 mb-4 text-sm">Follow the prompts to prove you're a live person</p>

      {/* Video + canvas */}
      <video ref={videoRef} style={{ display: 'none' }} width="640" height="480" muted playsInline />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="rounded-xl mx-auto mb-3 max-w-full border-4 border-blue-200"
        style={{ display: 'block', maxHeight: 300 }}
      />

      {/* Current challenge prompt */}
      {!isDone && (
        <div className="mb-4 space-y-2">
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-lg shadow-md transition-colors ${passing ? 'bg-green-500 text-white' : 'bg-blue-600 text-white animate-pulse'
            }`}>
            <span className="text-2xl">{activeStep.emoji}</span>
            {activeStep.label}
          </div>
          <p className="text-gray-400 text-sm">{activeStep.hint}</p>

          {/* Progress bar — direction for left/right, smile for smile */}
          <div className="max-w-xs mx-auto space-y-1">
            {(activeStep.id === 'left' || activeStep.id === 'right') && (
              <>
                <div className="flex justify-between text-xs text-gray-400 font-medium">
                  <span className={activeStep.id === 'left' ? 'text-blue-600' : ''}>← LEFT</span>
                  <span className="text-gray-400">Head Direction</span>
                  <span className={activeStep.id === 'right' ? 'text-blue-600' : ''}>RIGHT →</span>
                </div>
                <div className="relative h-3 bg-gray-100 rounded-full border border-gray-200 overflow-hidden">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400" />
                  {activeStep.id === 'left' ? (
                    <div className="absolute right-1/2 top-0 bottom-0 rounded-l-full transition-all duration-75"
                      style={{ width: `${dirProgress / 2}%`, background: dirProgress > 60 ? '#22c55e' : '#3b82f6' }} />
                  ) : (
                    <div className="absolute left-1/2 top-0 bottom-0 rounded-r-full transition-all duration-75"
                      style={{ width: `${dirProgress / 2}%`, background: dirProgress > 60 ? '#22c55e' : '#3b82f6' }} />
                  )}
                </div>
                <p className={`text-xs font-medium ${dirProgress >= 100 ? 'text-green-600' : dirProgress > 60 ? 'text-blue-600' : 'text-gray-500'}`}>
                  {dirProgress >= 100 ? '✅ Hold still...' : dirProgress > 60 ? 'Almost there! Keep turning' : `Turn ${activeStep.id} — ${Math.round(dirProgress)}% there`}
                </p>
              </>
            )}

            {activeStep.id === 'smile' && (
              <>
                <div className="flex justify-between text-xs text-gray-400 font-medium">
                  <span>Smile strength</span>
                  <span className={smile > 0.35 ? 'text-green-600' : 'text-blue-600'}>{Math.round(smile * 100)}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full border border-gray-200 overflow-hidden">
                  <div className="h-3 rounded-full transition-all duration-75"
                    style={{ width: `${Math.min(100, smile * 100)}%`, background: smile > 0.35 ? '#22c55e' : smile > 0.2 ? '#3b82f6' : '#94a3b8' }} />
                </div>
                <p className={`text-xs font-medium ${smile > 0.35 ? 'text-green-600' : smile > 0.2 ? 'text-blue-600' : 'text-gray-500'}`}>
                  {smile > 0.35 ? '✅ Hold that smile!' : smile > 0.2 ? 'Show more teeth!' : 'Smile naturally 😊'}
                </p>
              </>
            )}

            {/* Hold bar */}
            {holdPct > 0 && (
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-2 rounded-full transition-all duration-75"
                  style={{ width: `${holdPct}%`, background: holdPct === 100 ? '#22c55e' : '#6366f1' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step checklist */}
      <div className="flex justify-center gap-2 flex-wrap mb-3">
        {STEPS.map((s, i) => {
          const done = completed.includes(s.id);
          const active = !isDone && currentStep === i;
          return (
            <div key={s.id} className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${done ? 'bg-green-50 text-green-700 border-green-400' :
                active ? 'bg-blue-50 text-blue-700 border-blue-400' :
                  'bg-gray-50 text-gray-400 border-gray-200'
              }`}>
              {done ? '✅' : active ? s.emoji : '⏳'} {s.label}
            </div>
          );
        })}
      </div>

      {/* Live debug */}
      {!isDone && (
        <p className="text-xs text-gray-400">
          Yaw: <b className="text-gray-600">{Math.round(yaw)}°</b>
          {' · '}
          Smile: <b className="text-gray-600">{Math.round(smile * 100)}%</b>
        </p>
      )}

      {isDone && (
        <p className="text-green-600 font-bold text-lg mt-2 animate-bounce">
          ✅ Liveness confirmed! Moving to voice check...
        </p>
      )}
    </div>
  );
}
