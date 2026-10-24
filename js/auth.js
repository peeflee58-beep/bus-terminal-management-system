// =========================================================
// FIREBASE AUTH GUARD & ACCESS CONTROL
// =========================================================
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const adminPages = ["dashboard.html"];
const managerPages = [
    "bookinghistory.html", "buses.html", "platform.html", 
    "staff.html", "ticket.html", "routes.html", "schedules.html", "reports.html"
];
const terminalOfficerPages = ["bookinghistory.html", "buses.html", "platform.html", "ticket.html", "routes.html", "schedules.html"];
const cashierPages = ["bookinghistory.html", "ticket.html"];
const securityPages = ["platform.html", "ticket.html"];

const currentPage = window.location.pathname.split("/").pop();

// Protect routes via Firebase Observer
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            window.location.href = "login.html";
            return;
        }

        const currentUser = userDoc.data();
        
        // Execute your existing role checks
        enforceAccessControl(currentUser);

    } catch (err) {
        console.error("Auth guard error:", err);
    }
});

function getDefaultPage(user) {
    if (user.role === "admin") return "dashboard.html";
    if (user.role === "staff") {
        const jobPosition = String(user.jobPosition || "").trim().toLowerCase();
        if (jobPosition === "manager" || jobPosition === "terminal officer") return "schedules.html";
        if (jobPosition === "cashier") return "bookinghistory.html";
        if (jobPosition === "security") return "platform.html";
    }
    return "available-schedules.html";
}

function enforceAccessControl(currentUser) {
    const isManagementPage = managerPages.includes(currentPage) ||
        terminalOfficerPages.includes(currentPage) ||
        cashierPages.includes(currentPage) ||
        securityPages.includes(currentPage);

    if (adminPages.includes(currentPage) && currentUser.role !== "admin") {
        alert("Access Denied! This page is restricted to administrators.");
        window.location.href = getDefaultPage(currentUser);
    } else if (isManagementPage) {
        if (currentUser.role === "admin") return;

        if (currentUser.role === "staff") {
            const jobPosition = String(currentUser.jobPosition || "").trim().toLowerCase();
            const allowed = 
                (managerPages.includes(currentPage) && jobPosition === "manager") ||
                (terminalOfficerPages.includes(currentPage) && jobPosition === "terminal officer") ||
                (cashierPages.includes(currentPage) && jobPosition === "cashier") ||
                (securityPages.includes(currentPage) && jobPosition === "security");

            if (!allowed) {
                alert("Access Denied! You do not have permission to access this page.");
                window.location.href = getDefaultPage(currentUser);
            }
        } else {
            alert("Access Denied! Management access is restricted.");
            window.location.href = getDefaultPage(currentUser);
        }
    }
}

// Global logout helper implementation
window.logout = async function() {
    if (confirm("Are you sure you want to logout?")) {
        await signOut(auth);
        localStorage.removeItem("currentUser");
        window.location.href = "login.html";
    }
};