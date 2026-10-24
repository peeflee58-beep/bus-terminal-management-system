// =========================================================
// FIREBASE REGISTRATION
// =========================================================
import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const fullName = document.getElementById("fullName").value.trim();
        const email = document.getElementById("email").value.trim();
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (password.length < 6) {
            alert("Password must be at least six (6) characters long.");
            return;
        }

        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        try {
            // Create user in Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save additional user profile fields in Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                fullName,
                email,
                username,
                role: "user",
                createdAt: new Date().toLocaleString()
            });

            alert("Account created successfully!");
            registerForm.reset();
            window.location.href = "login.html";

        } catch (error) {
            console.error("Registration error:", error);
            alert("Registration failed: " + error.message);
        }
    });
}