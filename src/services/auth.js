import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

/**
 * Register a new user with Firebase Auth and create their Firestore profile.
 */
export async function registerUser(email, password, name) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName: name });

  await setDoc(doc(db, 'users', result.user.uid), {
    uid: result.user.uid,
    name,
    email,
    verification_status: 'PENDING',
    reputation_score: 0,
    successful_trips: 0,
    created_at: serverTimestamp(),
    last_active: serverTimestamp(),
  });

  return result.user;
}

/**
 * Sign in an existing user.
 */
export async function loginUser(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

/**
 * Sign out the current user.
 */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * Send a password reset email.
 */
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}
