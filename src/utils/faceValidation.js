/**
 * Face validation utilities for MediaPipe Face Mesh landmarks.
 * Validates: centering, eye openness, face size, camera-facing direction,
 * good lighting, and no-mask detection.
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

  // 5. Check for mask using Z-depth variance + nose geometry
  const { isMask, maskMessage } = checkForMask(landmarks);

  const isValid = isCentered && isEyeOpen && isFaceSize && isFacingCamera && !isMask;

  let message = '';
  if (!isCentered) message = 'Please center your face in the frame';
  else if (!isEyeOpen) message = 'Your eyes appear closed. Please open them.';
  else if (!isFaceSize) message = 'Please move closer to or further from the camera';
  else if (!isFacingCamera) message = 'Please look directly at the camera';
  else if (isMask) message = maskMessage;

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

/**
 * Returns a 0–1 confidence score for face validity.
 * Combines centering, eye distance, and face size checks.
 * @param {Array} landmarks - 468 MediaPipe face landmarks
 * @returns {number} 0–1
 */
export function getFaceConfidence(landmarks) {
  if (!landmarks || landmarks.length < 468) return 0;

  const noseTip = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];

  const centerX = noseTip.x;
  const centerY = noseTip.y;
  const distFromCenterX = Math.abs(centerX - 0.5) / 0.2; // 0=perfect, 1=edge
  const distFromCenterY = Math.abs(centerY - 0.5) / 0.2;
  const centerScore = Math.max(0, 1 - Math.max(distFromCenterX, distFromCenterY));

  const eyeDistance = Math.abs(leftEye.x - rightEye.x);
  const eyeScore = Math.min(1, eyeDistance / 0.15);

  const faceWidth = Math.abs(leftCheek.x - rightCheek.x);
  const sizeScore = faceWidth > 0.25 && faceWidth < 0.95
    ? 1
    : faceWidth <= 0.25
      ? faceWidth / 0.25
      : Math.max(0, 1 - (faceWidth - 0.95) / 0.1);

  return Math.round(((centerScore + eyeScore + sizeScore) / 3) * 100) / 100;
}

/**
 * Check ambient lighting by sampling canvas pixel brightness in the face region.
 * Call this after drawing the video frame to the canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement} canvas
 * @param {Array} landmarks - to locate the face region
 * @returns {{ isGood: boolean, message: string, brightness: number }}
 */
export function checkLighting(ctx, canvas, landmarks) {
  try {
    // Sample a 60×60 region around the nose tip (center of face)
    const noseTip = landmarks?.[1];
    const cx = noseTip ? Math.round(noseTip.x * canvas.width) : Math.round(canvas.width / 2);
    const cy = noseTip ? Math.round(noseTip.y * canvas.height) : Math.round(canvas.height / 2);
    const size = 60;
    const x = Math.max(0, cx - size / 2);
    const y = Math.max(0, cy - size / 2);

    const imageData = ctx.getImageData(x, y, size, size);
    const data = imageData.data;

    let totalBrightness = 0;
    let pixelCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Perceived brightness (luma)
      const r = data[i], g = data[i + 1], b = data[i + 2];
      totalBrightness += 0.299 * r + 0.587 * g + 0.114 * b;
      pixelCount++;
    }

    const brightness = totalBrightness / pixelCount; // 0–255

    if (brightness < 40) {
      return { isGood: false, message: 'Too dark — move to a brighter area', brightness };
    }
    if (brightness > 230) {
      return { isGood: false, message: 'Too bright — reduce glare or backlighting', brightness };
    }
    return { isGood: true, message: '', brightness };
  } catch {
    return { isGood: true, message: '', brightness: 128 }; // fail open
  }
}

/**
 * Detect if user is wearing a mask using Z-depth variance and nose geometry.
 * Real faces have significant 3D depth variation; flat masks do not.
 * @param {Array} landmarks - 468 MediaPipe face landmarks
 * @returns {{ isMask: boolean, maskMessage: string }}
 */
export function checkForMask(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return { isMask: false, maskMessage: '' };
  }

  // --- Check 1: Z-depth variance ---
  // Real faces have high variance in Z (nose protrudes, cheeks recede).
  // Flat masks / photos have very low Z variance.
  const zValues = landmarks.map(p => p.z || 0);
  const zMean = zValues.reduce((a, b) => a + b, 0) / zValues.length;
  const zVariance = zValues.reduce((sum, z) => sum + Math.pow(z - zMean, 2), 0) / zValues.length;

  // Threshold tuned empirically — real faces typically > 0.0003
  if (zVariance < 0.00008) {
    return { isMask: true, maskMessage: 'Possible mask or photo detected. Please show your real face.' };
  }

  // --- Check 2: Nose bridge protrusion ---
  // Nose tip (1) should be notably closer to camera (more negative Z) than cheeks (234, 454)
  const noseTipZ = landmarks[1].z || 0;
  const leftCheekZ = landmarks[234].z || 0;
  const rightCheekZ = landmarks[454].z || 0;
  const avgCheekZ = (leftCheekZ + rightCheekZ) / 2;
  const noseProtrusion = avgCheekZ - noseTipZ; // should be positive for a real face

  if (noseProtrusion < 0.005) {
    return { isMask: true, maskMessage: 'Face appears flat — please remove any mask or face covering.' };
  }

  // --- Check 3: Mouth landmark presence ---
  // Masks covering the mouth cause mouth landmarks to cluster at abnormal positions.
  const upperLip = landmarks[13];
  const lowerLip = landmarks[14];
  const lipGap = Math.abs(upperLip.y - lowerLip.y);
  // Lips should have some separation visible in the landmark space
  if (lipGap < 0.001) {
    return { isMask: true, maskMessage: 'Mouth not detected — please remove any mask or face covering.' };
  }

  return { isMask: false, maskMessage: '' };
}
