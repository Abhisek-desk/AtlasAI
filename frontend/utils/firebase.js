// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "atlasai-8568d.firebaseapp.com",
  projectId: "atlasai-8568d",
  storageBucket: "atlasai-8568d.firebasestorage.app",
  messagingSenderId: "481188857417",
  appId: "1:481188857417:web:8efa9d6d9077d4bd2d6198",
  measurementId: "G-7VPJ7GX6MW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider=new GoogleAuthProvider()

