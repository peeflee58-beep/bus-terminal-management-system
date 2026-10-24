// =========================================================
// FIREBASE CONFIGURATION & INITIALIZATION (v10 Modular SDK)
// =========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCxyUMTEBTvOiC96xwLAcQl4F6zTHXAz4w",
  authDomain: "bus-terminal-f7394.firebaseapp.com",
  projectId: "bus-terminal-f7394",
  storageBucket: "bus-terminal-f7394.firebasestorage.app",
  messagingSenderId: "1051720808809",
  appId: "1:1051720808809:web:eb75e65aafd2681a1825f8",
  measurementId: "G-NPPWS0RC3M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);