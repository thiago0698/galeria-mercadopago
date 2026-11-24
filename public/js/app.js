let fotos = [];
let fotoSelecionadaId = null;
let intervaloVerificacao = null;

const originaisLiberados = JSON.parse(localStorage.getItem("originais_liberados") || "{}");

function formatarPreco(valor) {
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function carregarFotos() {
    const resp = await fetch("/api/fotos");
    fotos = await resp.json();
    renderizarGaleria();
}

function renderizarGaleria() {
    const galeria = document.getElementById("galeria");
    galeria.innerHTML = "";

    fotos.forEach(foto => {
        const urlOriginal = originaisLiberados[foto.id];
        const liberada = Boolean(urlOriginal);

        const card = document.createElement("div");
        card.className = `card ${liberada ? "liberado" : "bloqueado"}`;

        card.innerHTML = `
            <div class="imagem-box">
                <img src="${liberada ? urlOriginal : foto.previa}" alt="${foto.titulo}">
                ${!liberada ? `
                    <div class="aviso-bloqueio">
                        <span class="cadeado">🔒</span>
                        <span>Bloqueada</span>
                    </div>
                ` : `
                    <span class="selo-liberado">✓ Liberada</span>
                `}
            </div>
            <div class="card-info">
                <div class="linha-titulo">
                    <h3>${foto.titulo}</h3>
                    <span class="preco">${liberada ? "Paga" : formatarPreco(foto.preco)}</span>
                </div>
                ${!liberada ? `
                    <button class="btn-desbloquear" onclick="abrirPagamento(${foto.id})">
                        Desbloquear Foto
                    </button>
                ` : `
                    <a href="${urlOriginal}" target="_blank" download class="btn-baixar">
                        Abrir / Baixar Foto Original
                    </a>
                `}
            </div>
        `;

        galeria.appendChild(card);
    });
}

function abrirPagamento(id) {
    const foto = fotos.find(f => f.id === id);
    if (!foto) return;

    pararVerificacao();
    fotoSelecionadaId = id;
    document.getElementById("modal-titulo").textContent = foto.titulo;
    document.getElementById("modal-preco").textContent = formatarPreco(foto.preco);
    document.getElementById("area-pix").classList.add("hidden");
    document.getElementById("status-pagamento").textContent = "Aguardando pagamento...";
    document.getElementById("modal-pagamento").classList.remove("hidden");
}

function pararVerificacao() {
    if (intervaloVerificacao) {
        clearInterval(intervaloVerificacao);
        intervaloVerificacao = null;
    }
}

function fecharPagamento() {
    pararVerificacao();
    document.getElementById("modal-pagamento").classList.add("hidden");
    fotoSelecionadaId = null;
}

document.getElementById("fechar-modal").addEventListener("click", fecharPagamento);

document.getElementById("btn-gerar-pix").addEventListener("click", async () => {
    if (!fotoSelecionadaId) return;

    const btnGerar = document.getElementById("btn-gerar-pix");
    const email = document.getElementById("email-comprador").value.trim();

    btnGerar.disabled = true;
    btnGerar.textContent = "Gerando PIX...";

    try {
        const resp = await fetch("/api/criar-pix", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fotoId: fotoSelecionadaId, email })
        });

        const dados = await resp.json();
        if (!resp.ok) {
            alert(dados.erro || "Erro ao gerar PIX.");
            return;
        }

        const qrImg = document.getElementById("qr-imagem");
        if (dados.qrCodeBase64) {
            qrImg.src = `data:image/png;base64,${dados.qrCodeBase64}`;
            qrImg.classList.remove("hidden");
        } else {
            qrImg.classList.add("hidden");
        }

        document.getElementById("codigo-pix").value = dados.pixCopiaCola || "";
        document.getElementById("area-pix").classList.remove("hidden");
        document.getElementById("status-pagamento").textContent = "Aguardando confirmação do PIX...";

        iniciarVerificacao(dados.paymentId);
    } catch (e) {
        alert("Falha de conexão com o servidor.");
    } finally {
        btnGerar.disabled = false;
        btnGerar.textContent = "Gerar PIX";
    }
});

function iniciarVerificacao(paymentId) {
    pararVerificacao();

    intervaloVerificacao = setInterval(async () => {
        try {
            const resp = await fetch(`/api/verificar-pagamento/${paymentId}`);
            const dados = await resp.json();

            if (dados.aprovado && dados.original) {
                pararVerificacao();
                originaisLiberados[dados.fotoId] = dados.original;
                localStorage.setItem("originais_liberados", JSON.stringify(originaisLiberados));
                renderizarGaleria();
                fecharPagamento();
                alert("Pagamento aprovado! A foto foi liberada.");
            }
        } catch (err) {
            console.error("Erro na verificação:", err);
        }
    }, 3000);
}

document.getElementById("btn-copiar").addEventListener("click", () => {
    const input = document.getElementById("codigo-pix");
    input.select();
    navigator.clipboard.writeText(input.value);
    alert("Código PIX copiado!");
});

carregarFotos();