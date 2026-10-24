document.addEventListener("DOMContentLoaded", () => {

    const forgotPasswordForm = document.getElementById("forgotPasswordForm");

    forgotPasswordForm.addEventListener("submit", function (e) {
        e.preventDefault();

        const email = document.getElementById("forgotEmail").value.trim();

        const newPassword = document.getElementById("newPassword").value;

        const confirmPassword = document.getElementById("confirmPassword").value;

        if (newPassword === "" || confirmPassword === "") {
            alert("Please fill in all fields");
            return;
        }

        if(newPassword.length < 6){
            alert("Password must be at least six(6) characters long.");
            return;
        }

        if (newPassword !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        const users = JSON.parse(localStorage.getItem("users")) || [];

        const userIndex = users.findIndex(user => user.email === email);

        if (userIndex === -1) {
            alert("Email address not found.");
            return;
        }

        users[userIndex].password = newPassword;

        localStorage.setItem("users", JSON.stringify(users));

        alert("Password has been reset successfully.")

        window.location.href = "login.html";
    });
});