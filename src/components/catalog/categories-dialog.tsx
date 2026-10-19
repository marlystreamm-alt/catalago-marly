import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCatalogStore } from "@/lib/catalog/store";
import { ConfirmButton } from "./confirm-button";

export function CategoriesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { catalog, saveCategory, deleteCategory, saveSubsection, deleteSubsection, updateCatalogMeta } =
    useCatalogStore();
  const [newCategory, setNewCategory] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [newSub, setNewSub] = useState<Record<string, string>>({});
  const [newSection, setNewSection] = useState("");
  const [sectionEditing, setSectionEditing] = useState<Record<string, string>>({});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{catalog.spaceType === "catalog" ? "Secciones y categorías" : "Categorías"}</DialogTitle>
          <DialogDescription>Organiza las tarjetas de {catalog.name} sin salir de la vista por tarjetas.</DialogDescription>
        </DialogHeader>


        {catalog.spaceType === "catalog" ? (
          <section className="grid gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3">
            <div>
              <p className="text-sm font-semibold">Secciones del catálogo</p>
              <p className="text-xs text-muted-foreground">Estas son las pestañas superiores que verá el público.</p>
            </div>
            <div className="grid gap-2">
              {(catalog.sectionTabs ?? []).map((section) => {
                const editingName = sectionEditing[section.id];
                return (
                  <div key={section.id} className="flex items-center gap-2 rounded-xl border bg-card p-2">
                    {editingName !== undefined ? (
                      <>
                        <Input value={editingName} onChange={(e) => setSectionEditing({ ...sectionEditing, [section.id]: e.target.value })} />
                        <Button size="sm" onClick={() => {
                          const name = editingName.trim();
                          if (!name) return;
                          updateCatalogMeta(catalog.id, { sectionTabs: (catalog.sectionTabs ?? []).map((x) => x.id === section.id ? { ...x, name } : x) });
                          const next = { ...sectionEditing }; delete next[section.id]; setSectionEditing(next);
                        }}>Guardar</Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-medium">{section.name}</span>
                        <Button size="icon" variant="ghost" onClick={() => setSectionEditing({ ...sectionEditing, [section.id]: section.name })}><Pencil className="size-4" /></Button>
                        <Button size="icon" variant="ghost" disabled={(catalog.sectionTabs?.length ?? 0) <= 1} onClick={() => {
                          const next = (catalog.sectionTabs ?? []).filter((x) => x.id !== section.id);
                          updateCatalogMeta(catalog.id, { sectionTabs: next });
                        }}><Trash2 className="size-4 text-destructive" /></Button>
                      </>
                    )}
                  </div>
                );
              })}
              <div className="flex gap-2">
                <Input value={newSection} placeholder="Nueva sección" onChange={(e) => setNewSection(e.target.value)} />
                <Button onClick={() => {
                  const name = newSection.trim();
                  if (!name) return;
                  const id = `seccion-${Date.now()}`;
                  updateCatalogMeta(catalog.id, { sectionTabs: [...(catalog.sectionTabs ?? []), { id, name, hidden: false }] });
                  setNewSection("");
                }}><Plus className="size-4" />Agregar sección</Button>
              </div>
            </div>
          </section>
        ) : null}
        <div className="flex gap-2">
          <Input
            value={newCategory}
            placeholder="Nueva categoría"
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <Button
            onClick={() => {
              if (!newCategory.trim()) return;
              saveCategory({ name: newCategory.trim() });
              setNewCategory("");
            }}
          >
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>

        <div className="grid gap-3">
          {catalog.categories.map((c) => {
            const isEditing = editing[c.id] !== undefined;
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Input
                        value={editing[c.id]}
                        onChange={(e) => setEditing({ ...editing, [c.id]: e.target.value })}
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (editing[c.id].trim())
                            saveCategory({ id: c.id, name: editing[c.id].trim() });
                          const next = { ...editing };
                          delete next[c.id];
                          setEditing(next);
                        }}
                      >
                        Guardar
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-medium">{c.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar ${c.name}`}
                        onClick={() => setEditing({ ...editing, [c.id]: c.name })}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmButton
                        title={`¿Eliminar la categoría ${c.name}?`}
                        description="También se eliminarán los servicios de esta categoría."
                        onConfirm={() => deleteCategory(c.id)}
                      >
                        <Button size="icon" variant="ghost" aria-label={`Eliminar ${c.name}`}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </ConfirmButton>
                    </>
                  )}
                </div>

                <div className="mt-2 grid gap-1.5 pl-1">
                  {c.subsections.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 text-muted-foreground">• {s.name}</span>
                      <ConfirmButton
                        title={`¿Eliminar la subsección ${s.name}?`}
                        description="Los servicios quedarán sin subsección."
                        onConfirm={() => deleteSubsection(c.id, s.id)}
                      >
                        <Button size="icon" variant="ghost" aria-label={`Eliminar ${s.name}`}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </ConfirmButton>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      className="h-9"
                      placeholder="Nueva subsección"
                      value={newSub[c.id] ?? ""}
                      onChange={(e) => setNewSub({ ...newSub, [c.id]: e.target.value })}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const name = (newSub[c.id] ?? "").trim();
                        if (!name) return;
                        saveSubsection(c.id, { name });
                        setNewSub({ ...newSub, [c.id]: "" });
                      }}
                    >
                      Añadir
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
