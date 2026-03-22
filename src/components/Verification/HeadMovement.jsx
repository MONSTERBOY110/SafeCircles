import React, { useRef, useEffect, useState } from 'react';
import { estimateHeadPose } from '../../utils/faceValidation';

const CHALLENGES = [
  { id: 'left', label: 'Look LEFT ←', check: (yaw) => yaw < -15 },
  { id: 'right', label: 'Look RIGHT →', check: (yaw) => yaw > 15 },
  { id: 'smile', label: 'SMILE 😊', check: (_, mouthOpen) => mouthOpen > 0.05 },
];

export default function HeadMovement({ onHeadMovementComplete }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [completed, setCompleted] = useState([]);
  const completedRef = useRef([]);
  const challengeRef = useRef(0);

  useEffect(() => {
    let stream;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setCameraActive(true);
          };
        }
      });
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  useEffect(() => {
    if (!cameraActive) return;
    let animFrame;
    let faceMeshModel;

    const init = async () => {
      const { FaceMesh } = await import('@mediapipe/face_mesh');
      faceMeshModel = new FaceMesh({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
      });
      faceMeshModel.setOptions({ maxNumFaces: 1, minDetectionConfidence: 0.5 });

      faceMeshModel.onResults((results) => {
        if (!results.multiFaceLandmarks?.length) return;
        const landmarks = results.multiFaceLandmarks[0];
        const { yaw } = estimateHeadPose(landmarks);

        // Mouth open check for smile
        const upperLip = landmarks[13];
        const lowerLip = landmarks[14];
        const mouthOpen = Math.abs(lowerLip.y - upperLip.y);

        const idx = challengeRef.current;
        if (idx >= CHALLENGES.length) return;

        const challenge = CHALLENGES[idx];
        const passed = challenge.check(yaw, mouthOpen);

        if (passed && !completedRef.current.includes(challenge.id)) {
          completedRef.current = [...completedRef.current, challenge.id];
          setCompleted([...completedRef.current]);
          challengeRef.current = idx + 1;
          setCurrentChallenge(idx + 1);

          if (completedRef.current.length === CHALLENGES.length) {
            setTimeout(() => onHeadMovementComplete(), 1000);
          }
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
  }, [cameraActive, onHeadMovementComplete]);

  const isDone = completed.length === CHALLENGES.length;

  return (
    <div className="text-center">
      <h3 className="text-2xl font-bold mb-2 text-gray-800">Step 2: Liveness Check</h3>
      <p className="text-gray-500 mb-4">Follow the on-screen instructions to prove you're real</p>

      <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
      <canvas
        ref={canvasRef}
        width={480}
        height={360}
        className="border-4 rounded-xl mx-auto mb-4 max-w-full border-blue-200"
        style={{ display: 'block' }}
      />

      <div className="space-y-3 max-w-sm mx-auto">
        {CHALLENGES.map((c, i) => {
          const done = completed.includes(c.id);
          const active = currentChallenge === i && !isDone;
          return (
            <div
              key={c.id}
              className={`p-3 rounded-lg font-semibold transition text-sm ${
                done
                  ? 'bg-green-50 text-green-700 border border-green-300'
                  : active
                  ? 'bg-blue-50 text-blue-700 border-2 border-blue-400 animate-pulse'
                  : 'bg-gray-50 text-gray-400 border border-gray-200'
              }`}
            >
              {done ? '✅' : active ? '👉' : '⏳'} {c.label}
            </div>
          );
        })}
      </div>

      {isDone && (
        <p className="text-green-600 font-bold mt-4 animate-bounce">
          ✅ Liveness confirmed! Proceeding...
        </p>
      )}
    </div>
  );
}
