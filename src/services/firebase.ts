import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  signOut, 
  User 
} from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import firebaseConfigData from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfigData) : getApp();
export const auth = getAuth(app);

// Initialize Firestore with the specific databaseId as specified by Firebase Integration Guidelines
export const db = getFirestore(app, firebaseConfigData.firestoreDatabaseId);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize GoogleAuth for native platform
let isGoogleAuthInitialized = false;
export const initGoogleAuth = async () => {
  if (isGoogleAuthInitialized) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await GoogleAuth.initialize({
        clientId: '476796648315.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
        grantOfflineAccess: false,
      });
      isGoogleAuthInitialized = true;
    }
  } catch (e) {
    console.warn("Native GoogleAuth initialization error:", e);
  }
};

// Check for redirect result on app boot
export const checkRedirectAuth = async (): Promise<User | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      return result.user;
    }
  } catch (e) {
    console.warn("getRedirectResult error:", e);
  }
  return null;
};

/**
 * Google ile Giriş Yapma (Capacitor Native + Web Compatible Sign-In)
 */
export const signInWithGoogle = async (): Promise<User | null> => {
  // 1. Native Mobile (Capacitor Android / iOS)
  if (Capacitor.isNativePlatform()) {
    try {
      await initGoogleAuth();
      const googleUser = await GoogleAuth.signIn();
      
      const idToken = googleUser?.authentication?.idToken || (googleUser as any)?.idToken;
      if (idToken) {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        return userCredential.user;
      }
      
      // If user object returned without idToken, check accessToken
      const accessToken = googleUser?.authentication?.accessToken || (googleUser as any)?.accessToken;
      if (accessToken) {
        const credential = GoogleAuthProvider.credential(null, accessToken);
        const userCredential = await signInWithCredential(auth, credential);
        return userCredential.user;
      }
    } catch (nativeErr: any) {
      console.warn("Native Google Sign-In attempt error:", nativeErr);
      // If user cancelled, don't throw secondary error
      if (nativeErr?.message?.includes('cancel') || nativeErr?.code === '12501' || nativeErr === 'user cancelled') {
        return null;
      }
    }
  }

  // 2. Web Browser & Fallback Flow
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Google sign-in popup error:", error);
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request' || error.code === 'auth/invalid-action') {
      try {
        await signInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirectErr) {
        console.error("Google sign-in redirect error:", redirectErr);
        throw redirectErr;
      }
    }
    throw error;
  }
};

/**
 * Check if the user is the app owner / admin
 * STRICT: Only ccan22937@gmail.com is the verified app owner.
 */
export function isUserAppOwner(user?: any): boolean {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  return email === 'ccan22937@gmail.com';
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Oturumu Kapatma (Google Logout)
 */
export const logout = async () => {
  try {
    localStorage.setItem('user_logged_out', 'true');
    localStorage.removeItem('local_tg_user_id');
    localStorage.removeItem('is_app_owner');
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out from Google Auth", error);
  }
};
