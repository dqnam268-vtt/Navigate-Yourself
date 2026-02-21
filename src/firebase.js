import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Lấy thông tin này trong Project Settings > General > Your apps trên Firebase Console
const firebaseConfig = { 
  apiKey : "AIzaSyBBdDIiPmKJOxfzCsKO2BRSS9wGtR0H_CA" , 
  authDomain : "navigate-yourself.firebaseapp.com" , 
  projectId : "navigate-yourself" , 
  storageBucket : "navigate-yourself.firebasestorage.app" , 
  messagingSenderId : "1070172959331" , 
  appId : "1:1070172959331:web:07e9e3e85a8e230d5efe56" , 
  measurementId : "G-8G6B1ZP9G9" 
};
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);