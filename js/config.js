import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBnpzuBjF0L12GTQWWl0t9oZqgKdHfuS3E",
  authDomain: "market-vision-c84c9.firebaseapp.com",
  projectId: "market-vision-c84c9",
  storageBucket: "market-vision-c84c9.firebasestorage.app",
  messagingSenderId: "83226342137",
  appId: "1:83226342137:web:064af07b7c09746d242828",
  measurementId: "G-Y3CQ3RV54G"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };