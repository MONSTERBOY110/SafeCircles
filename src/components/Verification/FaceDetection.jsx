import React, { useRef, useEffect, useState, useCallback } from 'react';
import { validateFaceDetection } from '../../utils/faceValidation';

export default function FaceDetection({ onFaceDetected }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const detectedRef = useRef(false);

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
            setCameraActive(true);
          };
        }
      } catch {
        setErrorMessage('Camera access denied. Please allow camera permissions and refresh.');
      }
    };
    setupCamera();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Run MediaPipe face mesh
  useEffect(() => {
    if (!cameraActive) return;

    let animFrame;
    let faceMeshModel;

    const init = async () => {
      // Dynamic import of mediapipe to avoid SSR issues
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
          const { isValid, message } = validateFaceDetection(landmarks);

          if (isValid && !detectedRef.current) {
            detectedRef.current = true;
            setFaceDetected(true);
            setErrorMessage('');
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 4;
            ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
            setTimeout(() => onFaceDetected(), 2000);
          } else if (!isValid) {
            setFaceDetected(false);
            setErrorMessage(message);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
          }

          // Draw landmarks
          ctx.fillStyle = '#3b82f6';
          landmarks.forEach((pt) => {
            ctx.beginPath();
            ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 1.5, 0, 2 * Math.PI);
            ctx.fill();
          });
        } else {
          setFaceDetected(false);
          setErrorMessage('No face detected — center your face in the frame');
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
        }
      });

      const tick = async () => {
        if (videoRef.current?.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
          await faceMeshModel.send({ image: videoRef.current });
        }
        animFrame = requestAnimationFrame(tick);
      };
      tick();
    };

    init();
    return () => {
      cancelAnimationFrame(animFrame);
      faceMeshModel?.close?.();
    };
  }, [cameraActive, onFaceDetected]);

  return (
    <div className="text-center">
      <h3 className="text-2xl font-bold mb-2 text-gray-800">Step 1: Face Detection</h3>
      <p className="text-gray-500 mb-6">Center your face and look directly at the camera</p>

      <video ref={videoRef} style={{ display: 'none' }} width="640" height="480" muted playsInline />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="border-4 rounded-xl mx-auto mb-4 max-w-full border-gray-200"
        style={{ maxHeight: 360 }}
      />

      {errorMessage && (
        <p className="text-red-500 mt-2 font-medium">⚠️ {errorMessage}</p>
      )}
      {faceDetected && (
        <p className="text-green-600 mt-2 font-semibold animate-pulse">✅ Face detected! Moving to next step...</p>
      )}
      {!cameraActive && !errorMessage && (
        <p className="text-gray-400 mt-2">Starting camera...</p>
      )}
    </div>
  );
}
