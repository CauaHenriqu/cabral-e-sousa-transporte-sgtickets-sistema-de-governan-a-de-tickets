import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RichText } from "./RichText";

describe("RichText", () => {
  it("renders plain text unchanged", () => {
    render(<RichText content="texto normal" />);
    expect(screen.getByText("texto normal")).toBeInTheDocument();
  });

  it("renders bold text inside ** markers as strong", () => {
    render(<RichText content="👤 **Cliente:** João" />);
    const strong = screen.getByText("Cliente:");
    expect(strong.tagName).toBe("STRONG");
  });

  it("renders multiple bold segments", () => {
    render(<RichText content="👤 **Cliente:** João\n🛣️ **Rota:** 50" />);
    expect(screen.getByText("Cliente:").tagName).toBe("STRONG");
    expect(screen.getByText("Rota:").tagName).toBe("STRONG");
  });

  it("does not render incomplete bold markers as strong", () => {
    render(<RichText content="**incomplete" />);
    expect(screen.getByText("**incomplete").tagName).not.toBe("STRONG");
  });
});

function brl(v: unknown): string {
  const n = Number(v);
  if (!isFinite(n)) return String(v ?? "—");
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const val = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s === "" ? "—" : s;
};

function formatPedidos(responseBody: string | null): string | null {
  if (!responseBody) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    return null;
  }
  const pedidos = parsed?.data?.pedidos ?? parsed?.pedidos ?? (Array.isArray(parsed?.data) ? parsed.data : null);
  if (!Array.isArray(pedidos) || pedidos.length === 0) return null;

  const blocos = pedidos.slice(0, 10).map((p: any) => {
    const rota = [val(p.ROTA), val(p.DESCRICAO_ROTA)].filter((x) => x !== "—").join(" - ") || "—";
    const linhas = [
      `👤 **Cliente:** ${val(p.NOME_CLIENTE ?? p.NOME_CLIENT ?? p.CLIENTE)}`,
      `🆔 **Cód. Cliente:** ${val(p.CODCLI)}`,
      `🛣️ **Rota:** ${rota}`,
      `🧾 **N.o da NF:** ${val(p.NUMNOTA)}`,
      `📦 **N.o do Pedido:** ${val(p.NUMPED)}`,
      `💰 **Total da NF R$:** ${brl(p.VLATEND)}`,
      `🚚 **Carga:** ${val(p.NUMCAR)}`,
    ];
    return linhas.join("\n");
  });

  return `📋 **Dados do Pedido**\n────────────────────────────\n${blocos.join("\n────────────────────────────\n")}`;
}

describe("formatPedidos", () => {
  it("formats labels with colons close to the word and bold markdown", () => {
    const payload = JSON.stringify({
      data: {
        pedidos: [
          {
            NOME_CLIENTE: "Cliente Teste",
            CODCLI: "12345",
            ROTA: "50",
            DESCRICAO_ROTA: "VIT. DA CONQUISTA",
            NUMNOTA: "409087",
            NUMPED: "2470365",
            VLATEND: 557.73,
            NUMCAR: "2583154",
          },
        ],
      },
    });

    const result = formatPedidos(payload);
    expect(result).not.toBeNull();
    expect(result).toContain("👤 **Cliente:** Cliente Teste");
    expect(result).toContain("🛣️ **Rota:** 50 - VIT. DA CONQUISTA");
    expect(result).toContain("🧾 **N.o da NF:** 409087");
    expect(result).toContain("📦 **N.o do Pedido:** 2470365");
    // toLocaleString('pt-BR') uses a non-breaking space between R$ and the value
    expect(result).toMatch(/💰 \*\*Total da NF R\$:\*\* R\$\s*557,73/);
    expect(result).toContain("🚚 **Carga:** 2583154");
    expect(result).not.toMatch(/Cliente\s+:/);
    expect(result).not.toMatch(/Rota\s+:/);
  });
});
