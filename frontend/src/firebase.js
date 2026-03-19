import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBqzPWx7dqy-fTxbHCN4MuGSSvcZ-7i4u4",
  authDomain: "notemicpro.firebaseapp.com",
  projectId: "notemicpro",
  storageBucket: "notemicpro.firebasestorage.app",
  messagingSenderId: "570072823126",
  appId: "1:570072823126:web:a3739a02309c2897c452f7",
  measurementId: "G-BZBGDHRLH5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const analytics = getAnalytics(app);
