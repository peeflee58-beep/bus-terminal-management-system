const changePasswordForm = document.getElementById("changePasswordForm");

if (changePasswordForm) {
    changePasswordForm.addEventListener("submit", function (e) {
        e.preventDefault();

        const currentPassword = document.getElementById("currentPassword").value;

        const newPassword = document.getElementById("newPassword").value;

        const confirmNewPassword = document.getElementById("confirmNewPassword").value;

        const currentUser = JSON.parse(localStorage.getItem("currentUser"));

        let users = JSON.parse(localStorage.getItem("users")) || [];

     

        if (currentUser.password !== currentPassword) {
            alert("Current password is incorrect!");
            return;
        }

             if(newPassword.length < 6){
            alert("Password must be at least six(6) characters long.");
            return;
        }

        if (newPassword !== confirmNewPassword) {
            alert("New passwords do not match!");
            return;
        }

        if(currentPassword === newPassword){
            alert("New password must be different from your current password");
            return;
        }

        const userIndex = users.findIndex(
            user => user.username === currentUser.username
        );

        users[userIndex].password = newPassword;

        currentUser.password = newPassword;

        localStorage.setItem("users", JSON.stringify(users));

        localStorage.setItem("currentUser", JSON.stringify(currentUser));

        alert("Password changed successfully!");

        changePasswordForm.reset();

        localStorage.removeItem("current");

        alert("password changed successfully! Please login again with your new password.");

        window.location.href = "login.html";
    })
}