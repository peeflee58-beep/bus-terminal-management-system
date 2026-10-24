// =========================================================
// FIREBASE LOGIN & ACCESS ROUTING
// =========================================================
import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        let inputVal = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;

        let email = inputVal;
        if (!email.includes("@")) {
            email = `${email}@atc.com`;
        }

        try {
            // 1. Authenticate with Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            // 2. Query Firestore 'staffs' collection by email
            const q = query(collection(db, "staffs"), where("email", "==", email));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                // Not found in staff database -> Regular Customer / Passenger
                localStorage.setItem("currentUser", JSON.stringify({
                    email: email,
                    role: "customer"
                }));
                window.location.href = "available-schedules.html";
            } else {
                // Found in staff database -> Staff / Admin / Manager
                const userDoc = querySnapshot.docs[0];
                const userData = userDoc.data();

                localStorage.setItem("currentUser", JSON.stringify(userData));

                const role = String(userData.role || "").trim().toLowerCase();

                if (role === "admin" || role === "manager") {
                    window.location.href = "dashboard.html";
                } else {
                    window.location.href = "available-schedules.html";
                }
            }

        } catch (error) {
            console.error("Login error:", error);
            alert("Invalid email or password.");
        }
    });
}