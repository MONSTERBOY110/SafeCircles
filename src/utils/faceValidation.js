/**
 * Face validation utilities for MediaPipe Face Mesh landmarks.
 * Validates: centering, eye openness, face size, and camera-facing direction.
 */

/**
 * Validate that detected face meets all requirements.
 * @param {Array} landmarks - 468 MediaPipe face landmarks
 * @returns {{ isValid: boolean, message: string }}
 */
export function validateFaceDetection(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return { isValid: false, message: 'Face not fully detected. Please adjust your position.' };
  }

  const noseTip = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];

  // 1. Check face is centered
  const centerX = noseTip.x;
  const centerY = noseTip.y;
  const isCentered = centerX > 0.3 && centerX < 0.7 && centerY > 0.3 && centerY < 0.7;

  // 2. Check eyes are visible/open
  const eyeDistance = Math.abs(leftEye.x - rightEye.x);
  const isEyeOpen = eyeDistance > 0.05;

  // 3. Check face size (not too far, not too close)
  const faceWidth = Math.abs(leftCheek.x - rightCheek.x);
  const isFaceSize = faceWidth > 0.25 && faceWidth < 0.95;

  // 4. Check facing camera (z-depth average)
  const avgZ = landmarks.reduce((sum, p) => sum + (p.z || 0), 0) / landmarks.length;
  const isFacingCamera = avgZ > -0.1;

  const isValid = isCentered && isEyeOpen && isFaceSize && isFacingCamera;

  let message = '';
  if (!isCentered) message = 'Please center your face in the frame';
  else if (!isEyeOpen) message = 'Your eyes appear closed. Please open them.';
  else if (!isFaceSize) message = 'Please move closer to or further from the camera';
  else if (!isFacingCamera) message = 'Please look directly at the camera';

  return { isValid, message };
}

/**
 * Check head pose from landmarks.
 * Returns yaw (left/right) and pitch (up/down) angles in degrees.
 */
export function estimateHeadPose(landmarks) {
  if (!landmarks || landmarks.length < 468) return { yaw: 0, pitch: 0 };

  const noseTip = landmarks[1];
  const leftEar = landmarks[234];
  const rightEar = landmarks[454];

  const yaw = (noseTip.x - 0.5) * 180; // Pos = right, Neg = left
  const pitch = (noseTip.y - 0.5) * 90;  // Pos = down, Neg = up

  return { yaw, pitch };
}
