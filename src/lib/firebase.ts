import { initializeApp, getApp, getApps } from 'firebase/app';
import firebaseConfig from "../../firebase-applet-config.json";
import { 
  initializeFirestore, 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  writeBatch, 
  increment, 
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile as updateFbProfile 
} from 'firebase/auth';

let app;
try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch (e) {
  console.error("Firebase App initialization failed:", e);
  app = initializeApp(firebaseConfig);
}

let db: any;
try {
  // 1. Try to initialize Firestore with the custom database ID and long polling
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  console.warn("Failed to initializeFirestore with custom database ID, trying default database settings:", e);
  try {
    // 2. Fall back to initializing the default database with long polling
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true
    });
  } catch (e2) {
    console.warn("Failed to initializeFirestore with settings, falling back to standard getFirestore:", e2);
    try {
      // 3. Fall back to default getFirestore client
      db = getFirestore(app);
    } catch (e3) {
      console.error("Critical: Failed to initialize any Firestore instance:", e3);
      db = null as any;
    }
  }
}

let auth: any;
try {
  auth = getAuth(app);
} catch (e) {
  console.error("Failed to initialize Auth:", e);
  auth = null as any;
}

const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  GET = "GET",
  WRITE = "WRITE",
  DELETE = "DELETE",
}

export function handleFirestoreError(error: any, operation: OperationType, path: string) {
  console.error(`[Firestore Error] Operation: ${operation}, Path: ${path}`, error);
}

export { 
  db, 
  auth,
  googleProvider,
  signInWithPopup,
  fbSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateFbProfile,
  GoogleAuthProvider,
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  increment,
  serverTimestamp,
  arrayUnion,
  arrayRemove
};
