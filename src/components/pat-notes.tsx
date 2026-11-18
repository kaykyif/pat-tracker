import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getNote, setNote } from "@/lib/notes-store";
import { toast } from "sonner";
import { Save, StickyNote } from "lucide-react";

export function PatNotes({ patId }: { patId: string }) {
  const [text, setText] = useState("");
  const [initial, setInitial] = useState("");

  useEffect(() => {
    const v = getNote(patId);
    setText(v);
    setInitial(v);
  }, [patId]);

  const save = () => {
    setNote(patId, text);
    setInitial(text);
    toast.success("Anotação salva");
  };

  const dirty = text !== initial;

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <StickyNote className="h-4 w-4 text-warning" />
        Anotações
        <span className="text-xs font-normal text-muted-foreground">(persistem entre análises)</span>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Adicione observações pessoais sobre este PAT..."
        rows={4}
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty}>
          <Save className="mr-1.5 h-3.5 w-3.5" />
          Salvar
        </Button>
      </div>
    </div>
  );
}