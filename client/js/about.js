//counter 1
const counters = document.querySelectorAll(".counter");

counters.forEach(counter => {
    const target = +counter.dataset.target;
    let count = 0;

    const interval = setInterval(() => {
        count++;

        counter.textContent = count + "+";

        if (count >= target) {
            clearInterval(interval);
        }
    }, 10);
});
//counter 2
const counters1 = document.querySelectorAll(".counter1");

counters1.forEach(counter => {
    const target = +counter.dataset.target;
    let count = 0;

    const interval = setInterval(() => {
        count++;

        counter.textContent = count + "+";

        if (count >= target) {
            clearInterval(interval);
        }
    }, 10);
});
//counter 3
const counters2 = document.querySelectorAll(".counter2");

counters2.forEach(counter => {
    const target = +counter.dataset.target;
    let count = 0;

    const interval = setInterval(() => {
        count++;

        counter.textContent = count + "+";

        if (count >= target) {
            clearInterval(interval);
        }
    }, 10);
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