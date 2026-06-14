import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDocuments, useCreateDocument, useUpdateDocument, useDeleteDocument,
  getListDocumentsQueryKey, getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import {
  DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, FileText, Trash2, GripVertical, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type DocStatus = "needed" | "in_progress" | "complete";

interface Doc {
  id: number;
  name: string;
  category: string;
  status: string;
  orderIndex: number;
}

const SortableDocumentItem = ({ doc, onDelete }: { doc: Doc, onDelete: (id: number) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: doc.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className={`mb-3 ${isDragging ? 'shadow-lg border-primary/50' : 'shadow-sm border-border/50'} bg-card group`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div {...attributes} {...listeners} className="cursor-grab hover:text-primary p-1 text-muted-foreground">
          <GripVertical className="w-5 h-5" />
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate">{doc.name}</h4>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{doc.category}</p>
        </div>
        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0" onClick={() => onDelete(doc.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

const DroppableColumn = ({ id, title, docs, onDelete }: { id: DocStatus, title: string, docs: Doc[], onDelete: (id: number) => void }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className={`bg-muted/10 border rounded-2xl p-4 min-h-[500px] flex flex-col transition-colors ${isOver ? 'border-primary bg-primary/5' : 'border-border/50'}`}>
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="font-serif text-lg font-medium">{title}</h3>
        <span className="text-sm font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{docs.length}</span>
      </div>
      <SortableContext items={docs.map(d => d.id.toString())} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex-1">
          {docs.map(doc => (
            <SortableDocumentItem key={doc.id} doc={doc} onDelete={onDelete} />
          ))}
          {docs.length === 0 && (
            <div className="h-24 border-2 border-dashed border-border rounded-xl flex items-center justify-center text-sm text-muted-foreground">
              Drag documents here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

const COLUMNS: { id: DocStatus, title: string }[] = [
  { id: "needed", title: "Action Needed" },
  { id: "in_progress", title: "In Progress / Review" },
  { id: "complete", title: "Filed & Verified" },
];

export default function Documents() {
  const { data: docs, isLoading } = useListDocuments();
  const createDoc = useCreateDocument();
  const updateDoc = useUpdateDocument();
  const deleteDoc = useDeleteDocument();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: "", category: "Income", status: "needed" });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const resolveTargetColumn = (overId: string): DocStatus | null => {
    if (COLUMNS.some(c => c.id === overId)) return overId as DocStatus;
    const overDoc = (docs || []).find(d => d.id.toString() === overId);
    return overDoc ? (overDoc.status as DocStatus) : null;
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || !docs) return;

    const activeId = parseInt(active.id, 10);
    const activeItem = docs.find(d => d.id === activeId);
    if (!activeItem) return;

    const targetColumn = resolveTargetColumn(String(over.id));
    if (!targetColumn) return;

    // Build the target column's ordered list (excluding the active item), then
    // insert the active item at the drop position.
    const columnItems = docs
      .filter(d => d.status === targetColumn && d.id !== activeId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    let insertAt = columnItems.length;
    if (String(over.id) !== targetColumn) {
      const overIndex = columnItems.findIndex(d => d.id.toString() === String(over.id));
      if (overIndex !== -1) insertAt = overIndex;
    }

    const reordered = [...columnItems];
    reordered.splice(insertAt, 0, activeItem);

    // Persist any item whose status or orderIndex changed.
    const updates: { id: number; data: { status?: DocStatus; orderIndex?: number } }[] = [];
    reordered.forEach((doc, index) => {
      const statusChanged = doc.status !== targetColumn;
      const orderChanged = doc.orderIndex !== index;
      if (statusChanged || orderChanged) {
        updates.push({ id: doc.id, data: { ...(statusChanged ? { status: targetColumn } : {}), orderIndex: index } });
      }
    });

    if (updates.length === 0) return;

    Promise.all(
      updates.map(u => updateDoc.mutateAsync({ id: u.id, data: u.data as any }))
    )
      .then(invalidateQueries)
      .catch(invalidateQueries);
  };

  const handleSave = () => {
    if (!newDoc.name) return;
    const columnCount = (docs || []).filter(d => d.status === newDoc.status).length;
    createDoc.mutate({
      data: {
        name: newDoc.name,
        category: newDoc.category as any,
        status: newDoc.status as any,
        orderIndex: columnCount,
      }
    }, { onSuccess: () => { invalidateQueries(); setIsDialogOpen(false); } });
  };

  const handleDelete = (id: number) => {
    deleteDoc.mutate({ id }, { onSuccess: invalidateQueries });
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-[80px] w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-[500px]" />
          <Skeleton className="h-[500px]" />
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-serif mb-2">Document Vault</h1>
          <p className="text-muted-foreground max-w-2xl">
            A secure place to collect and organize your financial documents for lending and verification.
          </p>
        </div>
        <Button onClick={() => { setNewDoc({ name: "", category: "Income", status: "needed" }); setIsDialogOpen(true); }} className="rounded-full">
          <Plus className="w-4 h-4 mr-2" /> Add Document Requirement
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {COLUMNS.map(col => {
            const columnDocs = (docs || [])
              .filter(d => d.status === col.id)
              .sort((a, b) => a.orderIndex - b.orderIndex);
            return (
              <DroppableColumn key={col.id} id={col.id} title={col.title} docs={columnDocs} onDelete={handleDelete} />
            );
          })}
        </div>
      </DndContext>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Document Requirement</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Document Name</Label>
              <Input id="name" value={newDoc.name} onChange={e => setNewDoc({...newDoc, name: e.target.value})} placeholder="e.g. 2023 W2 Form" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={newDoc.category} onValueChange={(val) => setNewDoc({...newDoc, category: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Income">Income</SelectItem>
                  <SelectItem value="Assets">Assets</SelectItem>
                  <SelectItem value="Identity">Identity</SelectItem>
                  <SelectItem value="Property">Property</SelectItem>
                  <SelectItem value="Credit">Credit</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Initial Status</Label>
              <Select value={newDoc.status} onValueChange={(val) => setNewDoc({...newDoc, status: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="needed">Action Needed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createDoc.isPending || !newDoc.name}>
              {createDoc.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
