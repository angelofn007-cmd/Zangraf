// ========================================
// CARRINHO
// ========================================

let cart = JSON.parse(localStorage.getItem("cart")) || [];


// Adicionar produto

function addToCart(name, price) {

    const existingProduct = cart.find(
        product => product.name === name
    );


    if (existingProduct) {

        alert("Este produto já está no seu carrinho.");

        return;
    }


    cart.push({
        name: name,
        price: price
    });


    saveCart();

    alert("Produto adicionado ao carrinho!");

    window.location.href = "carrinho.html";
}


// Salvar carrinho

function saveCart() {

    localStorage.setItem(
        "cart",
        JSON.stringify(cart)
    );

}


// Mostrar carrinho

function renderCart() {

    const cartItems = document.getElementById("cartItems");

    if (!cartItems) {
        return;
    }


    cartItems.innerHTML = "";


    if (cart.length === 0) {

        cartItems.innerHTML = `

            <div class="empty-cart">

                <h2>
                    Seu carrinho está vazio.
                </h2>

                <p>
                    Escolha um álbum para começar.
                </p>

                <a
                    href="produtos.html"
                    class="button-primary"
                >
                    Ver álbuns
                </a>

            </div>

        `;

        updateTotal();

        return;
    }


    cart.forEach((product, index) => {

        const item = document.createElement("div");

        item.classList.add("cart-item");


        item.innerHTML = `

            <div class="cart-item-info">

                <h3>
                    ${product.name}
                </h3>

                <p>
                    Álbum de Formatura • ADS 2026
                </p>

            </div>


            <div class="cart-item-price">

                <strong>
                    ${formatPrice(product.price)}
                </strong>

                <button
                    class="remove-item"
                    onclick="removeFromCart(${index})"
                >
                    Remover
                </button>

            </div>

        `;


        cartItems.appendChild(item);

    });


    updateTotal();

}


// Remover produto

function removeFromCart(index) {

    cart.splice(index, 1);

    saveCart();

    renderCart();

}


// Atualizar total

function updateTotal() {

    const subtotal = cart.reduce(
        (total, product) => total + product.price,
        0
    );


    const subtotalElement =
        document.getElementById("cartSubtotal");


    const totalElement =
        document.getElementById("cartTotal");


    if (subtotalElement) {

        subtotalElement.textContent =
            formatPrice(subtotal);

    }


    if (totalElement) {

        totalElement.textContent =
            formatPrice(subtotal);

    }

}


// Formatar dinheiro

function formatPrice(value) {

    return value.toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );

}


// ========================================
// BOTÃO DE PAGAMENTO
// ========================================

const checkoutButton =
    document.getElementById("checkoutButton");


if (checkoutButton) {

    checkoutButton.addEventListener(
        "click",
        () => {

            if (cart.length === 0) {

                alert(
                    "Seu carrinho está vazio."
                );

                return;
            }


            alert(
                "O pagamento será configurado na próxima etapa."
            );

        }
    );

}


// ========================================
// GALERIA
// ========================================

const filters =
    document.querySelectorAll(".filter");

const photos =
    document.querySelectorAll(".gallery-item");


filters.forEach((filter) => {

    filter.addEventListener("click", () => {

        filters.forEach((button) => {

            button.classList.remove("active");

        });


        filter.classList.add("active");


        const category =
            filter.textContent.trim();


        photos.forEach((photo) => {

            const photoCategory =
                photo
                    .querySelector(".photo-overlay span")
                    .textContent
                    .trim();


            if (
                category === "Todas" ||
                category === photoCategory
            ) {

                photo.style.display = "block";

            } else {

                photo.style.display = "none";

            }

        });

    });

});


// ========================================
// LIGHTBOX
// ========================================

const lightbox =
    document.getElementById("lightbox");

const lightboxImage =
    document.getElementById("lightboxImage");

const lightboxClose =
    document.getElementById("lightboxClose");


if (lightbox) {

    photos.forEach((photo) => {

        photo.addEventListener("click", () => {

            const image =
                photo.querySelector("img");


            lightboxImage.src =
                image.src;


            lightbox.classList.add("show");


            document.body.style.overflow =
                "hidden";

        });

    });


    lightboxClose.addEventListener(
        "click",
        () => {

            lightbox.classList.remove("show");

            document.body.style.overflow =
                "auto";

        }
    );


    lightbox.addEventListener(
        "click",
        (event) => {

            if (event.target === lightbox) {

                lightbox.classList.remove("show");

                document.body.style.overflow =
                    "auto";

            }

        }
    );

}


// ========================================
// CARRINHO AO ABRIR A PÁGINA
// ========================================

renderCart();
// ========================================
// CADASTRO
// ========================================

const registerForm =
    document.getElementById("registerForm");

if (registerForm) {

    registerForm.addEventListener("submit", (event) => {

        event.preventDefault();

        const name =
            document.getElementById("name").value.trim();

        const email =
            document.getElementById("email").value.trim();

        const password =
            document.getElementById("password").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;


        // Verifica se as senhas são iguais

        if (password !== confirmPassword) {

            alert("As senhas não são iguais.");

            return;
        }


        // Verifica se já existe um usuário

        const existingUser =
            JSON.parse(
                localStorage.getItem("user")
            );


        if (
            existingUser &&
            existingUser.email === email
        ) {

            alert("Este e-mail já está cadastrado.");

            return;
        }


        // Cria o usuário

        const user = {

            name: name,
            email: email,
            password: password

        };


        // Salva no navegador

        localStorage.setItem(
            "user",
            JSON.stringify(user)
        );


        alert("Conta criada com sucesso!");


        // Vai para o login

        window.location.href = "login.html";

    });

}
// ========================================
// LOGIN
// ========================================

const loginForm =
    document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", (event) => {

        event.preventDefault();

        const email =
            document.getElementById("email").value.trim();

        const password =
            document.getElementById("password").value;


        // Busca o usuário cadastrado

        const user =
            JSON.parse(
                localStorage.getItem("user")
            );


        // Verifica se existe usuário

        if (!user) {

            alert("Nenhuma conta cadastrada.");

            return;
        }


        // Verifica e-mail e senha

        if (
            email !== user.email ||
            password !== user.password
        ) {

            alert("E-mail ou senha incorretos.");

            return;
        }


        // Salva o login

        localStorage.setItem(
            "loggedIn",
            "true"
        );


        alert(
            `Bem-vindo, ${user.name}!`
        );


        // Volta para a página inicial

        window.location.href = "index.html";

    });

}
// ========================================
// USUÁRIO LOGADO
// ========================================

const loggedIn =
    localStorage.getItem("loggedIn");

const savedUser =
    JSON.parse(
        localStorage.getItem("user")
    );

const loginLink =
    document.querySelector('a[href="login.html"]');

if (loggedIn === "true" && savedUser && loginLink) {

    loginLink.textContent =
        `Olá, ${savedUser.name.split(" ")[0]}`;

    loginLink.href =
        "#";

    loginLink.addEventListener("click", (event) => {

        event.preventDefault();

        const logout =
            confirm("Deseja sair da sua conta?");

        if (logout) {

            localStorage.removeItem("loggedIn");

            window.location.reload();

        }

    });

}
// ========================================
// EDITOR DO ÁLBUM
// ========================================

const albumContent =
    document.getElementById("albumContent");

const layoutOptions =
    document.querySelectorAll(".layout-option");

const formatOptions =
    document.querySelectorAll(".format-option");

const currentPage =
    document.getElementById("currentPage");


// ========================================
// MODELOS DE LÂMINA
// ========================================

function createLayout(numberOfPhotos) {

    albumContent.innerHTML = "";

    const photoGrid =
        document.createElement("div");

    photoGrid.classList.add(
        "photo-grid",
        `photos-${numberOfPhotos}`
    );


    for (let i = 0; i < numberOfPhotos; i++) {

        const photoSlot =
            document.createElement("div");

        photoSlot.classList.add(
            "photo-slot"
        );

        photoSlot.dataset.position =
            i + 1;

        photoSlot.innerHTML = `
            <span>+</span>
            <p>Adicionar foto</p>
        `;

        photoGrid.appendChild(photoSlot);
    }


    albumContent.appendChild(photoGrid);


    // Mantém o título

    const title =
        document.createElement("div");

    title.classList.add("album-title");

    title.textContent =
        "Formandos 2026";

    albumContent.appendChild(title);
}


// ========================================
// CLICAR NOS MODELOS
// ========================================

layoutOptions.forEach((button) => {

    button.addEventListener("click", () => {

        layoutOptions.forEach((item) => {

            item.classList.remove("active");

        });


        button.classList.add("active");


        const numberOfPhotos =
            Number(
                button.dataset.layout
            );


        createLayout(numberOfPhotos);

    });

});


// ========================================
// FORMATOS
// ========================================

formatOptions.forEach((button) => {

    button.addEventListener("click", () => {

        formatOptions.forEach((item) => {

            item.classList.remove("active");

        });


        button.classList.add("active");


        const format =
            button.dataset.format;

        albumContent.dataset.format =
            format;

    });

});


// ========================================
// PÁGINA INICIAL
// ========================================

createLayout(1);

