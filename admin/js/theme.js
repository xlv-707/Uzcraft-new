const themeToggle = document.getElementById("themeToggle");

// Saqlangan temani yuklash
const savedTheme = localStorage.getItem("theme");

if (savedTheme === "dark") {

    document.documentElement.setAttribute(
        "data-theme",
        "dark"
    );

    if (themeToggle) {
        themeToggle.querySelector("i").className =
        "fa-regular fa-sun";
    }
}

if (themeToggle) {

    themeToggle.addEventListener("click", () => {

        const isDark =
        document.documentElement.getAttribute(
            "data-theme"
        ) === "dark";

        if (isDark) {

            document.documentElement.removeAttribute(
                "data-theme"
            );

            localStorage.setItem(
                "theme",
                "light"
            );

            themeToggle.querySelector("i").className =
            "fa-regular fa-moon";

        } else {

            document.documentElement.setAttribute(
                "data-theme",
                "dark"
            );

            localStorage.setItem(
                "theme",
                "dark"
            );

            themeToggle.querySelector("i").className =
            "fa-regular fa-sun";
        }

    });

}