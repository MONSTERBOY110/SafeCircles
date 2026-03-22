import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

/**
 * Save completed verification data and mark user as VERIFIED.
 */
export async function saveVerificationData(verificationData) {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');

  await updateDoc(doc(db, 'users', user.uid), {
    verification_status: 'VERIFIED',
    verification_timestamp: serverTimestamp(),
    verification_data: {
      faceDetected: verificationData.faceDetected || false,
      headMovementComplete: verificationData.headMovementComplete || false,
      voiceVerified: verificationData.voiceVerified || false,
      voiceAnalysis: verificationData.voiceAnalysis || null,
    },
  });
}

/**
 * Check if current user is verified.
 */
export async function checkVerificationStatus() {
  const user = auth.currentUser;
  if (!user) return false;

  const { getDoc } = await import('firebase/firestore');
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (!userDoc.exists()) return false;

  return userDoc.data().verification_status === 'VERIFIED';
}
