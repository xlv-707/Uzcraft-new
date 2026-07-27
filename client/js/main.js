const userIcon = document.getElementById("userIcon");
const userName = document.getElementById("userName");

const user = JSON.parse(localStorage.getItem("currentUser"));

if (user) {
    userName.textContent = user.username || user.name;
}

userIcon.addEventListener("click", () => {
    const user = JSON.parse(localStorage.getItem("currentUser"));

    if (!user) {
        window.location.href = "/login/html/index.html";
        return;
    }

    window.location.href = "../profile/profile.html";
});
userName.addEventListener("click", () => {
    window.location.href = "../profile/profile.html";
});


// maindan pasdagi katigoriya qismi

// 1-SLIDER

const slider1 = document.querySelector(".categories-div");
const nextBtn1 = document.querySelector(".next");
const prevBtn1 = document.querySelector(".prev");

nextBtn1.addEventListener("click", () => {
    slider1.scrollBy({
        left: 300,
        behavior: "smooth"
    });
});

prevBtn1.addEventListener("click", () => {
    slider1.scrollBy({
        left: -300,
        behavior: "smooth"
    });
});


// 2-SLIDER

const slider2 = document.querySelector(".craft-categories-container");
const nextBtn2 = document.querySelector(".craft-next");
const prevBtn2 = document.querySelector(".craft-prev");

nextBtn2.addEventListener("click", () => {
    slider2.scrollBy({
        left: 300,
        behavior: "smooth"
    });
});

prevBtn2.addEventListener("click", () => {
    slider2.scrollBy({
        left: -300,
        behavior: "smooth"
    });
});

// slayd

const track = document.querySelector(".promo-track");
const slides = document.querySelectorAll(".promo-slide");

const prevBtn = document.querySelector(".promo-prev");
const nextBtn = document.querySelector(".promo-next");

const dots = document.querySelectorAll(".promo-dot");

let current = 0;

// SLIDE UPDATE
function updateSlider() {

    track.style.transform = `translateX(-${current * 100}%)`;

    dots.forEach(dot => dot.classList.remove("active"));
    dots[current].classList.add("active");

    // desktop button control
    if (window.innerWidth > 768) {

        prevBtn.style.display = current === 0 ? "none" : "flex";
        nextBtn.style.display = current === slides.length - 1 ? "none" : "flex";

    } else {
        prevBtn.style.display = "none";
        nextBtn.style.display = "none";
    }
}

// NEXT
nextBtn.addEventListener("click", () => {
    if (current < slides.length - 1) {
        current++;
        updateSlider();
    }
});

// PREV
prevBtn.addEventListener("click", () => {
    if (current > 0) {
        current--;
        updateSlider();
    }
});

// DOT CLICK
dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
        current = index;
        updateSlider();
    });
});

// SWIPE MOBILE
let startX = 0;

track.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
});

track.addEventListener("touchend", (e) => {
    let endX = e.changedTouches[0].clientX;

    if (startX - endX > 50 && current < slides.length - 1) {
        current++;
    }

    if (endX - startX > 50 && current > 0) {
        current--;
    }

    updateSlider();
});

// AUTO PLAY
setInterval(() => {
    if (current < slides.length - 1) {
        current++;
    } else {
        current = 0;
    }
    updateSlider();
}, 5000);

// INIT
updateSlider();

document.querySelectorAll(".categories-div-1").forEach(card => {
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

