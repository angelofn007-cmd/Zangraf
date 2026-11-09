// ========================================
// EDITOR DO ÁLBUM
// ========================================

const albumContent = document.getElementById("albumContent");
const layoutOptions = document.querySelectorAll(".layout-option");
const formatOptions = document.querySelectorAll(".format-option");
const photoInput = document.getElementById("photoInput");

let selectedPhotoSlot = null;


// ========================================
// CRIAR LÂMINA
// ========================================

function createLayout(numberOfPhotos) {

    albumContent.innerHTML = "";

    const photoGrid = document.createElement("div");

    photoGrid.classList.add(
        "photo-grid",
        `photos-${numberOfPhotos}`
    );


    for (let i = 0; i < numberOfPhotos; i++) {

        const photoSlot = document.createElement("div");

        photoSlot.classList.add("photo-slot");

        photoSlot.innerHTML = `
            <span>+</span>
            <p>Adicionar foto</p>
        `;


        photoSlot.addEventListener("click", function () {

            selectedPhotoSlot = photoSlot;

            photoInput.click();

        });


        photoGrid.appendChild(photoSlot);

    }


    albumContent.appendChild(photoGrid);


    const title = document.createElement("div");

    title.classList.add("album-title");

    title.textContent = "Formandos 2026";

    albumContent.appendChild(title);

}


// ========================================
// ADICIONAR FOTO
// ========================================

photoInput.addEventListener("change", function (event) {

    const file = event.target.files[0];

    if (!file || !selectedPhotoSlot) {
        return;
    }


    const imageURL = URL.createObjectURL(file);


    selectedPhotoSlot.innerHTML = `
        <img src="${imageURL}" alt="Foto do álbum">
    `;


    selectedPhotoSlot.classList.add("has-photo");


    selectedPhotoSlot = null;

    photoInput.value = "";

});


// ========================================
// ESCOLHER LAYOUT
// ========================================

layoutOptions.forEach(function (button) {

    button.addEventListener("click", function () {

        layoutOptions.forEach(function (item) {
            item.classList.remove("active");
        });


        button.classList.add("active");


        const numberOfPhotos =
            Number(button.dataset.layout);


        createLayout(numberOfPhotos);

    });

});


// ========================================
// ESCOLHER FORMATO
// ========================================

formatOptions.forEach(function (button) {

    button.addEventListener("click", function () {

        formatOptions.forEach(function (item) {
            item.classList.remove("active");
        });


        button.classList.add("active");


        const format = button.dataset.format;

        albumContent.dataset.format = format;

    });

});


// ========================================
// INICIAR
// ========================================

createLayout(1);