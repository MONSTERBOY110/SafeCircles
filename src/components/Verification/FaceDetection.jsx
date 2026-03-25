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

              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 3;
              ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
            }

            // Draw landmark dots
            landmarks.forEach((pt) => {
              ctx.beginPath();
              ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 1.2, 0, 2 * Math.PI);
              ctx.fillStyle = isValid ? '#3b82f6' : '#94a3b8';
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
    init: 'bg-gray-100 text-gray-600',
    loading: 'bg-blue-50 text-blue-700',
    scanning: holdProgress > 0 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700',
    detected: 'bg-green-100 text-green-800',
    error: 'bg-red-50 text-red-700',
  };

  const borderColors = {
    init: 'border-gray-200',
    loading: 'border-blue-300',
    scanning: holdProgress > 0 ? 'border-green-400' : 'border-yellow-400',
    detected: 'border-green-500',
    error: 'border-red-400',
  };

  return (
    <div className="text-center">
      <h3 className="text-2xl font-bold mb-1 text-gray-800">Step 1: Face Detection</h3>
      <p className="text-gray-500 mb-5 text-sm">
        MediaPipe tracks 468 facial landmarks to confirm you're a live person
      </p>

      {/* Camera / Canvas */}
      <div className="relative inline-block mb-4">
        <video ref={videoRef} style={{ display: 'none' }} width="640" height="480" muted playsInline />

        {status === 'loading' ? (
          <div className="w-full flex flex-col items-center justify-center border-4 border-blue-300 rounded-xl bg-gray-900"
            style={{ width: 480, height: 320 }}>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-300 border-t-blue-600 mb-4" />
            <p className="text-blue-300 text-sm font-medium">Initializing MediaPipe...</p>
            <p className="text-gray-500 text-xs mt-1">Loading AI model from CDN</p>
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
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Hold still</span>
            <span>{holdProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
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
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${statusColors[status]} transition-all duration-300`}>
          {status === 'error' && <span>⚠️</span>}
          {status === 'detected' && <span className="animate-pulse">✅</span>}
          {status === 'scanning' && holdProgress === 0 && <span>🔍</span>}
          {status === 'scanning' && holdProgress > 0 && <span>😊</span>}
          {statusMessage}
        </div>
      )}

      {/* Confidence score (debug info) */}
      {status === 'scanning' && confidence > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          Confidence: {Math.round(confidence * 100)}%
        </p>
      )}

      {/* Lighting warning */}
      {lightingWarning && (
        <div className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-orange-50 text-orange-700">
          💡 {lightingWarning}
        </div>
      )}

      {status === 'detected' && (
        <p className="text-green-600 mt-3 font-semibold animate-pulse text-sm">
          Moving to next step...
        </p>
      )}
    </div>
  );
}
