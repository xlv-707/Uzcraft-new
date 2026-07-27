document.querySelectorAll(".category-card").forEach(card => {
    card.addEventListener("click", () => {
        window.location.href = card.dataset.link;
    });
});


window.onload = function() {
    document.getElementById("preloader").style.display = "none";
};



const menuToggle = document.getElementById("menuToggle");
const navLinks = document.querySelector(".nav-links");
const overlay = document.querySelector(".nav-overlay");

menuToggle.onclick = () => {

    menuToggle.classList.toggle("active");

    navLinks.classList.toggle("active");

    overlay.classList.toggle("active");

    document.body.classList.toggle("menu-open");

};

// Tashqariga bosilganda yopiladi

overlay.onclick = () => {

    menuToggle.classList.remove("active");

    navLinks.classList.remove("active");

    overlay.classList.remove("active");

    document.body.classList.remove("menu-open");

};

// Link bosilganda ham yopiladi

document.querySelectorAll(".nav-links a").forEach(link=>{

    link.onclick=()=>{

        menuToggle.classList.remove("active");

        navLinks.classList.remove("active");

        overlay.classList.remove("active");

        document.body.classList.remove("menu-open");

    }

});