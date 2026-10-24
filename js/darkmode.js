document.addEventListener("DOMContentLoaded", function () {

    const darkModeBtn =
        document.getElementById("darkModeBtn");

    const savedMode =
        localStorage.getItem("darkMode");


    /* Apply saved mode */

    if (savedMode === "enabled") {

        document.body.classList.add("dark-mode");

        if (darkModeBtn) {
            darkModeBtn.checked = true;
        }

    } else {

        document.body.classList.remove("dark-mode");

        if (darkModeBtn) {
            darkModeBtn.checked = false;
        }

    }


    /* Dark mode switch */

    if (darkModeBtn) {

        darkModeBtn.addEventListener("change", function () {

            if (darkModeBtn.checked) {

                document.body.classList.add("dark-mode");

                localStorage.setItem(
                    "darkMode",
                    "enabled"
                );

            } else {

                document.body.classList.remove("dark-mode");

                localStorage.setItem(
                    "darkMode",
                    "disabled"
                );

            }


            /* Redraw dashboard charts if they exist */

            if (typeof loadScheduleStatusChart === "function") {
                loadScheduleStatusChart();
            }

            if (typeof loadBookingStatusChart === "function") {
                loadBookingStatusChart();
            }

            if (typeof loadRevenueTrendChart === "function") {
                loadRevenueTrendChart();
            }

            if (typeof loadBusStatisticsChart === "function") {
                loadBusStatisticsChart();
            }

            if (typeof loadTopRoutesChart === "function") {
                loadTopRoutesChart();
            }

            if (typeof loadGenderChart === "function") {
                loadGenderChart();
            }

        });

    }

});