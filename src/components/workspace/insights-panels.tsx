import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { stockAdminList, stockAdminSave } from "@/lib/stock/stock.functions";
import { getSavedCode } from "@/lib/notify/client";
import type { StockItem } from "@/lib/stock/types";
import { money, phoneNumber, type OpsRecord } from "@/lib/workspace/model";
import { EmptyState, errorText, exportRows } from "./resource-panel";
import { BusinessTools } from "@/components/catalog/business-tools";
import { menusList } from "@/lib/menus/menus.functions";
import type { MenuBusiness } from "@/lib/menus/types";
export function StockInsights({ sales = false }: { sales?: boolean }) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [query, setQuery] = useState("");
  const [days, setDays] = useState("7");
  const load = async () => {
    setBusy(true);
    setError("");
    try {
      setItems(await stockAdminList({ data: { code: getSavedCode() } }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Monterrey",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const parents = new Set(items.map((i) => i.parentStockId));
  const rows = items
    .filter(
      (r) =>
        !parents.has(r.id) &&
        r.status !== "available" &&
        `${r.platform} ${r.clientName} ${r.clientWhatsapp}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .filter((r) => {
      if (sales) return Boolean(r.deliveredOn);
      if (!r.expiresOn) return days === "unassigned";
      const delta = Math.round(
        (Date.parse(r.expiresOn + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86400000,
      );
      return days === "expired"
        ? delta < 0
        : days === "notified"
          ? Boolean(r.renewalNotifiedAt)
          : days !== "unassigned" && delta >= 0 && delta <= Number(days);
    });
  return (
    <div className="space-y-4">
      <div className="seller-actions">
        <Button variant="outline" disabled={busy} onClick={() => void load()}>
          Actualizar
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            exportRows(
              rows.map((r) => ({
                Plataforma: r.platform,
                Cliente: r.clientName,
                Entrega: r.deliveredOn,
                Vence: r.expiresOn,
                Precio: r.salePrice,
                Costo: r.parentStockId ? "Costo compartido" : r.cost,
                Avisado: r.renewalNotifiedAt,
              })),
              sales ? "ventas" : "vencimientos",
            )
          }
        >
          Exportar CSV
        </Button>
      </div>
      {error ? <div className="seller-error">{error}</div> : null}
      <Input
        aria-label="Buscar ventas o vencimientos"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar plataforma, cliente o WhatsApp…"
      />
      {!sales ? (
        <div className="seller-tabs">
          {[
            ["expired", "⛔ Ya vencieron"],
            ["3", "Hoy a 3 días"],
            ["7", "7 días"],
            ["15", "15 días"],
            ["30", "30 días"],
            ["notified", "✅ Ya avisados"],
            ["unassigned", "Sin fecha"],
          ].map(([v, l]) => (
            <button key={v} className={days === v ? "active" : ""} onClick={() => setDays(v)}>
              {l}
            </button>
          ))}
        </div>
      ) : (
        <div className="seller-grid">
          <article className="seller-card">
            <p>Ventas registradas</p>
            <strong className="text-3xl">{rows.length}</strong>
          </article>
          <article className="seller-card">
            <p>Ingresos registrados</p>
            <strong className="text-3xl">{money(rows.reduce((s, r) => s + r.salePrice, 0))}</strong>
            <p className="text-xs text-muted-foreground">
              {rows.filter((r) => !r.salePrice).length} ventas sin precio.
            </p>
          </article>
        </div>
      )}
      {busy ? (
        <p role="status">Cargando registros…</p>
      ) : !rows.length ? (
        <EmptyState
          icon={sales ? "🧾" : "🎉"}
          title={sales ? "Sin ventas para esta búsqueda" : "Nada por vencer aquí"}
          description="Cambia el filtro para consultar otros registros."
        />
      ) : (
        <div className="seller-record-grid">
          {rows.map((r) => (
            <article className="seller-card" key={r.id}>
              <div className="flex justify-between gap-2">
                <h3 className="font-bold">{r.platform}</h3>
                <span className="seller-badge">{r.expiresOn || "Sin fecha"}</span>
              </div>
              <p className="text-sm">{r.clientName || "Sin nombre de cliente"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {sales
                  ? `Entrega: ${r.deliveredOn} · ${money(r.salePrice)}`
                  : `Vencimiento: ${r.expiresOn || "Sin asignar"}`}
              </p>
              <div className="seller-actions mt-3">
                {r.clientWhatsapp ? (
                  <Button asChild size="sm">
                    <a
                      href={`https://wa.me/${phoneNumber(r.clientWhatsapp)}?text=${encodeURIComponent(`Hola ${r.clientName}, tu servicio de ${r.platform} vence el ${r.expiresOn || "día indicado"}. ¿Deseas renovar?`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </a>
                  </Button>
                ) : null}
                {!sales ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await stockAdminSave({
                          data: {
                            code: getSavedCode(),
                            item: { ...r, renewalNotifiedAt: new Date().toISOString() },
                          },
                        });
                        await load();
                        toast.success("Marcado como avisado");
                      } catch (e) {
                        toast.error(errorText(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Marcar avisado
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
export function HelpersPanel() {
  const [businesses, setBusinesses] = useState<MenuBusiness[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const load = async () => {
    setBusy(true);
    try {
      setBusinesses(await menusList({ data: { code: getSavedCode() } }));
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const business = businesses.find((b) => b.id === selected);
  return (
    <div className="space-y-4">
      <div className="seller-card space-y-3">
        <h3 className="font-bold">Equipo de cada catálogo</h3>
        <p className="text-sm text-muted-foreground">
          Selecciona el negocio para administrar sus ayudantes y accesos existentes.
        </p>
        <select
          aria-label="Seleccionar negocio del equipo"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Elegir negocio</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {busy ? <p role="status">Cargando negocios…</p> : null}
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <Button onClick={() => void load()}>Reintentar</Button>
          </div>
        ) : null}
      </div>
      {business ? (
        <BusinessTools
          key={business.id}
          code={getSavedCode()}
          business={business}
          section="administradores"
          onBusinessChange={(next) =>
            setBusinesses((all) => all.map((b) => (b.id === next.id ? next : b)))
          }
        />
      ) : null}
    </div>
  );
}
export function BusinessAssistant({ records }: { records: OpsRecord[] }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = async (q: string) => {
    setQuestion(q);
    setBusy(true);
    try {
      const stock = await stockAdminList({ data: { code: getSavedCode() } });
      const parents = new Set(stock.map((i) => i.parentStockId));
      const units = stock.filter((i) => !parents.has(i.id));
      const normalized = q.toLowerCase();
      if (/ganancia|venta|vendid/.test(normalized)) {
        const sales = units.filter((i) => i.deliveredOn && i.status !== "available");
        const eligible = sales.filter((i) => i.cost > 0 && i.salePrice > 0 && !i.parentStockId);
        setAnswer(
          `Hay ${sales.length} entregas registradas. Ingresos con precio capturado: ${money(sales.reduce((s, r) => s + r.salePrice, 0))}. Margen estimado: ${money(eligible.reduce((s, r) => s + r.salePrice - r.cost, 0))} en ${eligible.length} ventas con costo individual válido. No incluye gastos ni ventas eliminadas.`,
        );
      } else if (/pendiente|duda|reporte/.test(normalized)) {
        const pending = records.filter(
          (r) =>
            ["reports", "questions", "requests"].includes(r.module) &&
            ["pending", "in_progress"].includes(r.status),
        );
        setAnswer(
          pending.length
            ? pending
                .map(
                  (r) =>
                    `• ${r.title} (${r.module === "reports" ? "reporte" : r.module === "questions" ? "consulta" : "pedido"})`,
                )
                .join("\n")
            : "No hay consultas, reportes ni encargos pendientes en el panel.",
        );
      } else {
        const matches = units.filter(
          (i) =>
            `${i.platform} ${i.status}`.toLowerCase().includes(normalized) ||
            /stock|disponible|vencer/.test(normalized),
        );
        const available = matches.filter(
          (i) =>
            i.status === "available" &&
            (!i.expiresOn || i.expiresOn >= new Date().toISOString().slice(0, 10)),
        );
        const platforms = [...new Set(matches.map((i) => i.platform))];
        setAnswer(
          platforms.length
            ? platforms
                .map(
                  (p) => `• ${p}: ${available.filter((i) => i.platform === p).length} disponibles`,
                )
                .join("\n")
            : "No encontré esa plataforma. Prueba con su nombre, «stock», «ganancias» o «pendientes».",
        );
      }
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="seller-card space-y-4">
      <h3 className="font-bold">Consulta rápida de tu negocio</h3>
      <p className="text-sm text-muted-foreground">
        Este asistente consulta tus registros mediante búsquedas y cálculos. La conversación con IA
        generativa requiere conectar un proveedor de IA.
      </p>
      <div className="seller-tabs">
        {["Stock disponible", "Ganancias y ventas", "Pendientes"].map((q) => (
          <button key={q} disabled={busy} onClick={() => void ask(q)}>
            {q}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <Input
          required
          value={question}
          maxLength={150}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Stock, plataforma, ganancias o pendientes"
        />
        <Button disabled={busy}>{busy ? "Consultando…" : "Consultar"}</Button>
      </form>
      {answer ? (
        <div className="rounded-xl bg-muted/40 p-4 text-sm whitespace-pre-wrap" role="status">
          {answer}
        </div>
      ) : null}
    </div>
  );
}
export function GamesPanel({ memory = false }: { memory?: boolean }) {
  const [cells, setCells] = useState<string[]>(Array(9).fill(""));
  const [turn, setTurn] = useState("✕");
  const [cards, setCards] = useState(() =>
    ["🍿", "🎬", "🎵", "🎮", "🍿", "🎬", "🎵", "🎮"].sort(() => Math.random() - 0.5),
  );
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const winner = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ]
    .map((line) => line.map((i) => cells[i]))
    .find((line) => line[0] && line.every((v) => v === line[0]))?.[0];
  useEffect(() => {
    if (flipped.length !== 2) return;
    setLocked(true);
    const [a, b] = flipped;
    const same = cards[a] === cards[b];
    const timer = setTimeout(() => {
      if (same) setMatched((m) => [...m, a, b]);
      setFlipped([]);
      setLocked(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [flipped, cards]);
  return (
    <div className="seller-card mx-auto max-w-md space-y-4 text-center">
      <h3 className="text-xl font-bold">{memory ? "Memoria MA²" : "Tres en raya"}</h3>
      <p>
        {memory
          ? matched.length === 8
            ? `¡Completaste el juego en ${moves} intentos!`
            : `Intentos: ${moves}`
          : winner
            ? `Ganó ${winner}`
            : cells.every(Boolean)
              ? "Empate"
              : `Turno de ${turn}`}
      </p>
      <div className={memory ? "grid grid-cols-4 gap-2" : "grid grid-cols-3 gap-2"}>
        {(memory ? cards : cells).map((value, i) => (
          <button
            key={i}
            className="aspect-square rounded-2xl bg-primary/10 text-3xl font-bold transition hover:bg-primary/20 disabled:opacity-60"
            aria-label={memory ? `Tarjeta ${i + 1}` : `Casilla ${i + 1}`}
            disabled={
              memory
                ? locked || matched.includes(i) || flipped.includes(i)
                : Boolean(value || winner)
            }
            onClick={() => {
              if (memory) {
                setFlipped((a) => [...a, i]);
                if (flipped.length === 1) setMoves((m) => m + 1);
              } else {
                setCells((a) => a.map((v, j) => (i === j ? turn : v)));
                setTurn((t) => (t === "✕" ? "○" : "✕"));
              }
            }}
          >
            {memory ? (matched.includes(i) || flipped.includes(i) ? value : "?") : value}
          </button>
        ))}
      </div>
      <Button
        variant="outline"
        onClick={() => {
          setCells(Array(9).fill(""));
          setTurn("✕");
          setCards(
            ["🍿", "🎬", "🎵", "🎮", "🍿", "🎬", "🎵", "🎮"].sort(() => Math.random() - 0.5),
          );
          setFlipped([]);
          setMatched([]);
          setMoves(0);
          setLocked(false);
        }}
      >
        Volver a jugar
      </Button>
    </div>
  );
}
