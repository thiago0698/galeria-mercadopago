require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { MercadoPagoConfig, Payment } = require("mercadopago");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});
const paymentClient = new Payment(client);

const CATALOGO = {
    1: {
        id: 1,
        titulo: "Ensaio Luz Dourada",
        preco: 11.50,
        previa: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=40",
        original: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=95"
    },
    2: {
        id: 2,
        titulo: "Noite Urbana",
        preco: 11.50,
        previa: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=400&q=40",
        original: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=95"
    },
    3: {
        id: 3,
        titulo: "Retrato Exclusivo #01",
        preco: 21.90,
        previa: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=40",
        original: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1600&q=95"
    },
    4: {
        id: 4,
        titulo: "Aurora Polar",
        preco: 11.50,
        previa: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=400&q=40",
        original: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1600&q=95"
    },
    5: {
        id: 5,
        titulo: "Floresta Mística",
        preco: 11.50,
        previa: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=400&q=40",
        original: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=95"
    }
};

const pagamentosCriados = new Map();

app.get("/api/fotos", (req, res) => {
    const lista = Object.values(CATALOGO).map(({ id, titulo, preco, previa }) => ({
        id,
        titulo,
        preco,
        previa
    }));
    res.json(lista);
});

app.post("/api/criar-pix", async (req, res) => {
    try {
        const { fotoId, email } = req.body;
        const foto = CATALOGO[Number(fotoId)];

        if (!foto) {
            return res.status(404).json({ erro: "Foto não encontrada." });
        }

        const idempotencyKey = crypto.randomUUID();

        const resultado = await paymentClient.create({
            body: {
                transaction_amount: Number(foto.preco.toFixed(2)),
                description: `Foto: ${foto.titulo}`,
                payment_method_id: "pix",
                payer: {
                    email: email || "comprador@exemplo.com"
                }
            },
            requestOptions: { idempotencyKey }
        });

        const txData = resultado.point_of_interaction?.transaction_data || {};
        pagamentosCriados.set(String(resultado.id), foto.id);

        res.json({
            paymentId: resultado.id,
            status: resultado.status,
            qrCodeBase64: txData.qr_code_base64 || null,
            pixCopiaCola: txData.qr_code || ""
        });
    } catch (err) {
        console.error("Erro ao criar PIX:", err);
        res.status(500).json({ erro: "Falha ao gerar cobrança no Mercado Pago." });
    }
});

app.get("/api/verificar-pagamento/:paymentId", async (req, res) => {
    try {
        const { paymentId } = req.params;
        const fotoId = pagamentosCriados.get(String(paymentId));

        if (!fotoId || !CATALOGO[fotoId]) {
            return res.status(404).json({ erro: "Cobrança não encontrada." });
        }

        const pagamento = await paymentClient.get({ id: paymentId });
        const aprovado = pagamento.status === "approved";

        if (aprovado) {
            return res.json({
                aprovado: true,
                status: pagamento.status,
                fotoId,
                original: CATALOGO[fotoId].original
            });
        }

        res.json({
            aprovado: false,
            status: pagamento.status
        });
    } catch (err) {
        console.error("Erro ao verificar pagamento:", err);
        res.status(500).json({ erro: "Erro ao consultar status do pagamento." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});