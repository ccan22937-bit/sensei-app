import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  User 
} from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfigData) : getApp();
export const auth = getAuth(app);

// Initialize Firestore with the specific databaseId as specified by Firebase Integration Guidelines
export const db = getFirestore(app, firebaseConfigData.firestoreDatabaseId);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Google ile Giriş Yapma (Google Popup Sign-In)
 */
export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Google sign-in popup error:", error);
    // If popup was blocked by browser or iframe constraints, try redirect
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
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
