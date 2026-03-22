/**
 * Lip-Sync Detection using Pearson Correlation
 * Correlates mouth movement (video) with audio energy to detect deepfakes.
 *
 * Score > 0.6 = Real video (synced)
 * Score < 0.3 = Desync (possible deepfake)
 */

/**
 * Calculate the Pearson Correlation Coefficient between two arrays.
 * @param {number[]} x
 * @param {number[]} y
 * @returns {number} Correlation in range [-1, 1]
 */
export function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

/**
 * Extract mouth openness from MediaPipe face landmarks.
 * Uses upper-lip (13) and lower-lip (14) landmarks.
 * @param {Array} landmarks - MediaPipe face landmarks
 * @returns {number} Mouth openness (0 = closed, 1 = wide open)
 */
export function getMouthOpenness(landmarks) {
  if (!landmarks || landmarks.length < 20) return 0;
  const upperLip = landmarks[13];
  const lowerLip = landmarks[14];
  return Math.abs(lowerLip.y - upperLip.y);
}

/**
 * Calculate lip-sync score from mouth movement and audio energy arrays.
 * @param {number[]} mouthMovements - Array of mouth openness values over time
 * @param {number[]} audioEnergies - Array of audio RMS energy values over time
 * @returns {{ score: number, isLipSynced: boolean }}
 */
export function calculateLipSyncScore(mouthMovements, audioEnergies) {
  const score = pearsonCorrelation(mouthMovements, audioEnergies);
  return {
    score,
    isLipSynced: score > 0.6,
    isPossibleDeepfake: score < 0.3,
  };
}
