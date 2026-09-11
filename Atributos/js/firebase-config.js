import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCTLUOX5mMDIuoMEJqvjEjfwMqAicak7Ao",
  authDomain: "historias-marsesan.firebaseapp.com",
  projectId: "historias-marsesan",
  storageBucket: "historias-marsesan.firebasestorage.app",
  messagingSenderId: "1001621619052",
  appId: "1:1001621619052:web:b0627ce0fcf367b37ff349"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);