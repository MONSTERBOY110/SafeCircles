import React, { useRef, useEffect, useState, useCallback } from 'react';
import { validateFaceDetection, getFaceConfidence, checkLighting } from '../../utils/faceValidation';

const HOLD_FRAMES_REQUIRED = 60; // ~2 seconds at 30fps

export default function FaceDetection({ onFaceDetected }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const holdFramesRef = useRef(0);
  const detectedRef = useRef(false);

  const [status, setStatus] = useState('init');
  const [statusMessage, setStatusMessage] = useState('Starting camera...');
  const [confidence, setConfidence] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [lightingWarning, setLightingWarning] = useState('');

  // Start camera
  useEffect(() => {
    let stream;
    const setupCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setStatus('loading');
            setStatusMessage('Initializing MediaPipe face detection...');
          };
        }
      } catch {
        setStatus('error');
        setStatusMessage('Camera access denied. Please allow camera permissions and refresh.');
      }
    };
    setupCamera();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Run MediaPipe face mesh
  useEffect(() => {
    if (status !== 'loading') return;

    let animFrame;
    let faceMeshModel;

    const init = async () => {
      try {
        const { FaceMesh } = await import('@mediapipe/face_mesh');

        faceMeshModel = new FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });
        faceMeshModel.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMeshModel.onResults((results) => {
          if (!canvasRef.current || !videoRef.current) return;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

          if (results.multiFaceLandmarks?.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];

            // Lighting check (runs every frame from canvas pixels)
            const lighting = checkLighting(ctx, canvas, landmarks);
            setLightingWarning(lighting.isGood ? '' : lighting.message);

            const { isValid, message } = validateFaceDetection(landmarks);
            const conf = getFaceConfidence(landmarks);
            setConfidence(conf);

            if (isValid && !detectedRef.current) {
              holdFramesRef.current += 1;
              const progress = Math.round((holdFramesRef.current / HOLD_FRAMES_REQUIRED) * 100);
              setHoldProgress(progress);

              setStatus('scanning');
              setStatusMessage(
                holdFramesRef.current < HOLD_FRAMES_REQUIRED
                  ? '✅ Face detected! Hold still...'
                  : '✅ Face confirmed!'
              );

              // Draw green border while holding
              ctx.strokeStyle = '#22c55e';
              ctx.lineWidth = 4;
              ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

              if (holdFramesRef.current >= HOLD_FRAMES_REQUIRED) {
                detectedRef.current = true;
                setStatus('detected');
                setHoldProgress(100);
                setTimeout(() => onFaceDetected(), 800);
              }
            } else if (!isValid) {
              // Reset hold counter if face moves away
              holdFramesRef.current = 0;
              setHoldProgress(0);
              setStatus('scanning');
              setStatusMessage(message || 'Adjust your position');

              ctx.strokeStyle = '#3b82f6';
              ctx.lineWidth = 3;
              ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
            }

            // Draw landmark dots
            landmarks.forEach((pt) => {
              ctx.beginPath();
              ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 1.2, 0, 2 * Math.PI);
              ctx.fillStyle = isValid ? '#3b82f6' : 'rgba(234,224,200,0.45)';
              ctx.fill();
            });
          } else {
            holdFramesRef.current = 0;
            setHoldProgress(0);
            setConfidence(0);
            setLightingWarning('');
            setStatus('scanning');
            setStatusMessage('No face detected — center your face in the frame');

            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
          }
        });

        setStatus('scanning');
        setStatusMessage('Center your face in the frame');

        const tick = async () => {
          if (videoRef.current?.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
            await faceMeshModel.send({ image: videoRef.current });
          }
          animFrame = requestAnimationFrame(tick);
        };
        tick();
      } catch (err) {
        console.error('MediaPipe init error:', err);
        setStatus('error');
        setStatusMessage('Failed to load face detection. Check your internet connection.');
      }
    };

    init();
    return () => {
      cancelAnimationFrame(animFrame);
      faceMeshModel?.close?.();
    };
  }, [status === 'loading']);

  const statusColors = {
    init: 'border border-white/5 bg-[#111A3A] text-[#EAE0C8]/70',
    loading: 'border border-blue-500/20 bg-blue-500/10 text-blue-300',
    scanning: holdProgress > 0
      ? 'border border-green-500/20 bg-green-500/10 text-green-300'
      : 'border border-blue-500/20 bg-blue-500/10 text-blue-300',
    detected: 'border border-green-500/20 bg-green-500/10 text-green-300',
    error: 'border border-red-500/20 bg-red-500/10 text-red-300',
  };

  const borderColors = {
    init: 'border-white/5',
    loading: 'border-blue-300',
    scanning: holdProgress > 0 ? 'border-green-400' : 'border-blue-400',
    detected: 'border-green-500',
    error: 'border-red-400',
  };

  return (
    <div className="text-center">
      <h3 className="mb-1 text-2xl font-bold text-[#EAE0C8]">Step 1: Face Detection</h3>
      <p className="mb-5 text-sm text-[#EAE0C8]/60">
        MediaPipe tracks 468 facial landmarks to confirm you're a live person
      </p>

      {/* Camera / Canvas */}
      <div className="relative inline-block mb-4">
        <video ref={videoRef} style={{ display: 'none' }} width="640" height="480" muted playsInline />

        {status === 'loading' ? (
          <div className="flex w-full flex-col items-center justify-center rounded-xl border-4 border-blue-300 bg-[#0B132B]"
            style={{ width: 480, height: 320 }}>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-300 border-t-blue-600 mb-4" />
            <p className="text-blue-300 text-sm font-medium">Initializing MediaPipe...</p>
            <p className="mt-1 text-xs text-[#EAE0C8]/50">Loading AI model from CDN</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className={`border-4 rounded-xl mx-auto block max-w-full ${borderColors[status]} transition-colors duration-300`}
            style={{ maxHeight: 320 }}
          />
        )}
      </div>

      {/* Hold progress bar */}
      {(status === 'scanning' || status === 'detected') && (
        <div className="max-w-xs mx-auto mb-3">
          <div className="mb-1 flex justify-between text-xs text-[#EAE0C8]/50">
            <span>Hold still</span>
            <span>{holdProgress}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-[#111A3A]/70">
            <div
              className="h-2.5 rounded-full transition-all duration-100"
              style={{
                width: `${holdProgress}%`,
                backgroundColor: holdProgress === 100 ? '#22c55e' : '#3b82f6',
              }}
            />
          </div>
        </div>
      )}

      {/* Status banner */}
      {status !== 'loading' && (
        <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${statusColors[status]}`}>
          {status === 'error' && <span>⚠️</span>}
          {status === 'detected' && <span className="animate-pulse">✅</span>}
          {status === 'scanning' && holdProgress === 0 && <span>🔍</span>}
          {status === 'scanning' && holdProgress > 0 && <span>😊</span>}
          {statusMessage}
        </div>
      )}

      {/* Confidence score (debug info) */}
      {status === 'scanning' && confidence > 0 && (
        <p className="mt-2 text-xs text-[#EAE0C8]/50">
          Confidence: {Math.round(confidence * 100)}%
        </p>
      )}

      {/* Lighting warning */}
      {lightingWarning && (
        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300">
          💡 {lightingWarning}
        </div>
      )}

      {status === 'detected' && (
        <p className="mt-3 text-sm font-semibold text-green-400 animate-pulse">
          Moving to next step...
        </p>
      )}
    </div>
  );
}
