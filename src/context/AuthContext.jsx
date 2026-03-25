import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Set user immediately and mark loading as false - DON'T WAIT FOR FIRESTORE
        setUser(firebaseUser);
        setLoading(false);
        
        // Fetch Firestore data in BACKGROUND without blocking UI
        fetchUserDataAsync(firebaseUser.uid);
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Async Firestore fetch that doesn't block the UI
  const fetchUserDataAsync = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError(err.message);
    }
  };

  const signup = async (email, password, name) => {
    try {
      setError(null);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });

      // Create user document in Firestore
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
      setError(err.message);
      throw err;
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle setting user and loading state
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
    } catch (err) {
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
      isVerified: userData?.verification_status === 'VERIFIED'
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
