import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsubProfile = null;

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        // Tear down any previous profile listener when auth state changes
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }

        if (firebaseUser) {
          console.log('[Auth] Firebase Authentication session active:', {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
          });

          // Set user immediately and mark loading as false - DON'T WAIT FOR FIRESTORE
          setUser(firebaseUser);
          setLoading(false);

          // Subscribe to live profile updates so manual Firestore edits
          // (e.g. flipping isVerified) propagate without a re-login.
          unsubProfile = onSnapshot(
            doc(db, 'users', firebaseUser.uid),
            (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                console.log('[Auth] Firestore userData:', data);
                setUserData(data);
              } else {
                console.warn('[Auth] Firestore profile document not found:', {
                  uid: firebaseUser.uid,
                });
                setUserData(null);
              }
            },
            (err) => {
              console.warn('[Auth] Could not subscribe to Firestore profile:', {
                uid: firebaseUser.uid,
                code: err.code,
                message: err.message,
              });
            }
          );
        } else {
          console.log('[Auth] No Firebase Authentication session.');
          setUser(null);
          setUserData(null);
          setLoading(false);
        }
      },
      (err) => {
        console.error('[Auth] Firebase Authentication state listener failed:', {
          code: err.code,
          message: err.message,
        });
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      if (unsubProfile) unsubProfile();
      unsubscribe();
    };
  }, []);

  const signup = async (email, password, name) => {
    try {
      setError(null);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });

      // Create user document in Firestore.
      // Note: gender is intentionally NOT preset here — it's set by the
      // KYC step (`VerificationFlow.handleKycComplete`) once a real provider
      // returns the verified gender. Hardcoding it would be wrong for any
      // non-female user and would conflict with the locked-after-first-set
      // rule in firestore.rules.
      const userDocData = {
        uid: result.user.uid,
        name,
        email,
        verification_status: 'PENDING',
        reputation_score: 0,
        successful_trips: 0,
        created_at: serverTimestamp(),
        last_active: serverTimestamp(),
      };
      
      await setDoc(doc(db, 'users', result.user.uid), userDocData);
      
      // Immediately set user and userData in state - don't wait for onAuthStateChanged
      setUser(result.user);
      setUserData(userDocData);
      setLoading(false);

      return result.user;
    } catch (err) {
      console.error('[Auth] Firebase Authentication signup failed:', {
        email,
        code: err.code,
        message: err.message,
      });
      setError(err.message);
      throw err;
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      console.log('[Auth] Signing in with Firebase Authentication:', { email });
      const result = await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle setting user and loading state
      return result.user;
    } catch (err) {
      console.error('[Auth] Firebase Authentication login failed:', {
        email,
        code: err.code,
        message: err.message,
      });
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
    } catch (err) {
      console.error('[Auth] Firebase Authentication logout failed:', {
        code: err.code,
        message: err.message,
      });
      setError(err.message);
      throw err;
    }
  };

  const refreshUserData = async () => {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (err) {
      console.error('Error refreshing user data:', err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      userData,
      loading,
      error,
      signup,
      login,
      logout,
      refreshUserData,
      isVerified:
        userData?.isVerified === true ||
        userData?.verification_status === 'VERIFIED'
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
