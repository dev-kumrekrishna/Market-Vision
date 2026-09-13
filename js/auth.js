import { auth, db } from "./config.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// Sirf Admins ko Dashboard access dene ka logic
export function requireAdminAuth() {
  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists() || userDoc.data().role !== "admin") {
      alert("Access Denied: Admins only.");
      window.location.href = "index.html"; // Agar customer dashboard kholne ki koshish kare
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  
  if (form) {
    let isSignUp = false;
    const authTitle = document.getElementById("authTitle");
    const authSubtitle = document.getElementById("authSubtitle");
    const authSubmitBtn = document.getElementById("authSubmitBtn");
    const toggleAuth = document.getElementById("toggleAuth");
    const toggleText = document.getElementById("toggleText");
    const nameLabel = document.getElementById("nameLabel");
    const phoneLabel = document.getElementById("phoneLabel");
    const confirmPasswordLabel = document.getElementById("confirmPasswordLabel");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const errorBox = document.getElementById("loginError");
    const googleLoginBtn = document.getElementById("googleLoginBtn");

    // Toggle between Login and Sign Up UI
    toggleAuth?.addEventListener("click", (e) => {
      e.preventDefault();
      isSignUp = !isSignUp;
      errorBox.textContent = "";
      
      if (isSignUp) {
        authTitle.textContent = "Create Account";
        authSubtitle.textContent = "Join Market Vision today.";
        authSubmitBtn.textContent = "Sign Up";
        toggleText.textContent = "Already have an account?";
        toggleAuth.textContent = "Login";
        
        nameLabel.style.display = "block";
        phoneLabel.style.display = "block";
        confirmPasswordLabel.style.display = "block";
        confirmPasswordInput.setAttribute("required", "true");
      } else {
        authTitle.textContent = "Login";
        authSubtitle.textContent = "Welcome back! Sign in to your account.";
        authSubmitBtn.textContent = "Login";
        toggleText.textContent = "Don't have an account?";
        toggleAuth.textContent = "Sign Up";
        
        nameLabel.style.display = "none";
        phoneLabel.style.display = "none";
        confirmPasswordLabel.style.display = "none";
        confirmPasswordInput.removeAttribute("required");
      }
    });

    // Handle Form Submission (Email/Password)
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const name = document.getElementById("name") ? document.getElementById("name").value.trim() : "";
      const phone = document.getElementById("phone") ? document.getElementById("phone").value.trim() : "";
      
      errorBox.textContent = "";
      
      if (isSignUp) {
        const confirmPassword = confirmPasswordInput.value;
        if (password !== confirmPassword) {
            errorBox.textContent = "Passwords do not match.";
            return;
        }
      }
      
      authSubmitBtn.disabled = true;
      authSubmitBtn.textContent = "Please wait...";
      
      try {
        if (isSignUp) {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          // By default 'customer' role assign karna
          await setDoc(doc(db, "users", user.uid), {
            name: name,
            phone: phone,
            email: email,
            role: "customer"
          });
          window.location.href = "profile.html"; // Signup ke baad profile bhejein
        } else {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          const userDoc = await getDoc(doc(db, "users", user.uid));
          
          if (userDoc.exists() && userDoc.data().role === "admin") {
            window.location.href = "dashboard.html";
          } else {
            window.location.href = "index.html"; 
          }
        }
      } catch (error) {
        console.error(error);
        errorBox.textContent = error.message.replace("Firebase: ", "");
      } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = isSignUp ? "Sign Up" : "Login";
      }
    });

    // Handle Google Login
    googleLoginBtn?.addEventListener("click", async () => {
      const provider = new GoogleAuthProvider();
      try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          // Naya Google user hai, data save karein
          await setDoc(userDocRef, {
            name: user.displayName || "",
            email: user.email,
            phone: user.phoneNumber || "",
            pfp: user.photoURL || "", // Google PFP default set kardo
            role: "customer"
          });
          window.location.href = "index.html";
        } else {
          // Purana user
          if (userDoc.data().role === "admin") {
            window.location.href = "dashboard.html";
          } else {
            window.location.href = "index.html";
          }
        }
      } catch (error) {
        console.error(error);
        errorBox.textContent = error.message.replace("Firebase: ", "");
      }
    });
  }

  // Handle Navbar Logout
  document.getElementById("navLogout")?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      window.location.reload();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  });
});