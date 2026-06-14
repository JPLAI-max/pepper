import React, { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDocuments, useCreateDocument, useUpdateDocument, useDeleteDocument, useRequestUploadUrl,
  getListDocumentsQueryKey, getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import {
  DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, FileText, Trash2, GripVertical, Loader2, Upload, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { motion } from "framer-motion";

type DocStatus = "needed" | "in_progress" | "complete";

interface Doc {
  id: number;
  name: string;
  category: string;
  status: string;
  orderIndex: number;
  fileUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

const formatSize = (bytes?: number | null) => {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const SortableDocumentItem = ({ doc, onDelete }: { doc: Doc, onDelete: (id: number) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: doc.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className={`mb-4 border-white/5 bg-card/80 backdrop-blur-xl transition-all rounded-2xl group ${isDragging ? 'shadow-[0_0_30px_rgba(232,93,63,0.3)] ring-1 ring-primary scale-105' : 'shadow-lg hover:bg-card hover:shadow-xl'}`}>
      <CardContent className="p-4 flex items-center gap-4">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing hover:text-primary p-2 -ml-2 text-muted-foreground transition-colors rounded-lg hover:bg-white/5">
          <GripVertical className="w-5 h-5" />
        </div>
        <div className="w-12 h-12 rounded-xl bg-secondary border border-white/5 flex items-center justify-center text-foreground shadow-inner shrink-0 group-hover:text-primary transition-colors">
          <FileText className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-serif text-lg tracking-tight truncate text-foreground mb-0.5">{doc.name}</h4>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            {doc.category}{doc.fileUrl ? ` • ${formatSize(doc.sizeBytes) ?? "File"}` : ""}
          </p>
        </div>
        {doc.fileUrl && (
          <a
            href={`/api/storage${doc.fileUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 shrink-0 transition-all rounded-full p-2 text-muted-foreground hover:text-primary hover:bg-primary/10"
            title="View / download"
          >
            <Download className="w-4 h-4" />
          </a>
        )}
        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 transition-all rounded-full" onClick={() => onDelete(doc.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

const DroppableColumn = ({ id, title, docs, onDelete }: { id: DocStatus, title: string, docs: Doc[], onDelete: (id: number) => void }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className={`bg-card/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 min-h-[500px] flex flex-col transition-all duration-300 relative overflow-hidden ${isOver ? 'ring-2 ring-primary bg-primary/5 shadow-[inset_0_0_50px_rgba(232,93,63,0.1)]' : 'shadow-lg'}`}>
      {isOver && <div className="absolute inset-0 bg-primary/5 blur-[20px] pointer-events-none" />}
      <div className="flex items-center justify-between mb-6 px-2 relative z-10">
        <h3 className="font-serif text-xl tracking-tight text-foreground">{title}</h3>
        <span className="text-xs font-bold bg-secondary border border-white/10 text-foreground px-3 py-1 rounded-full shadow-inner">{docs.length}</span>
      </div>
      <SortableContext items={docs.map(d => d.id.toString())} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex-1 relative z-10">
          {docs.map(doc => (
            <SortableDocumentItem key={doc.id} doc={doc} onDelete={onDelete} />
          ))}
          {docs.length === 0 && (
            <div className="h-32 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center text-sm font-medium text-muted-foreground/50 bg-secondary/20">
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
  const requestUploadUrl = useRequestUploadUrl();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: "", category: "Income", status: "needed" });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploadError(null);
    setUploading(true);
    try {
      let nextIndex = (docs || []).filter((d) => d.status === "complete").length;
      for (const file of list) {
        const contentType = file.type || "application/octet-stream";
        const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
          data: { name: file.name, size: file.size, contentType },
        });
        const putRes = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": contentType },
        });
        if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
        await createDoc.mutateAsync({
          data: {
            name: file.name,
            category: "Other" as any,
            status: "complete" as any,
            fileUrl: objectPath,
            mimeType: contentType,
            sizeBytes: file.size,
            orderIndex: nextIndex++,
          },
        });
      }
      invalidateQueries();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
    e.target.value = "";
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-[100px] w-1/3 rounded-2xl bg-secondary/50" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
          <Skeleton className="h-[600px] rounded-3xl bg-secondary/50" />
          <Skeleton className="h-[600px] rounded-3xl bg-secondary/50" />
          <Skeleton className="h-[600px] rounded-3xl bg-secondary/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-4xl md:text-5xl font-serif mb-3 tracking-tight text-foreground">Document Vault</h1>
          <p className="text-muted-foreground text-lg max-w-2xl font-light">
            A secure place to collect and organize your financial documents for lending and verification.
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="flex gap-3">
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(232,93,63,0.4)] transition-all h-11 px-6">
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploading ? "Uploading..." : "Upload File"}
          </Button>
          <Button variant="outline" onClick={() => { setNewDoc({ name: "", category: "Income", status: "needed" }); setIsDialogOpen(true); }} className="rounded-full border-white/10 bg-secondary/50 hover:bg-secondary text-foreground transition-all h-11 px-6">
            <Plus className="w-4 h-4 mr-2" /> Add Requirement
          </Button>
        </motion.div>
      </div>

      {uploadError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive px-5 py-3 text-sm">
          {uploadError}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start"
        >
          {COLUMNS.map(col => {
            const columnDocs = (docs || [])
              .filter(d => d.status === col.id)
              .sort((a, b) => a.orderIndex - b.orderIndex);
            return (
              <DroppableColumn key={col.id} id={col.id} title={col.title} docs={columnDocs} onDelete={handleDelete} />
            );
          })}
        </motion.div>
      </DndContext>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[450px] bg-card/95 backdrop-blur-xl border-white/10 shadow-2xl rounded-3xl">
          <DialogHeader className="pb-4 border-b border-white/5">
            <DialogTitle className="text-2xl font-serif tracking-tight">Add Requirement</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="space-y-3">
              <Label htmlFor="name" className="text-muted-foreground uppercase tracking-wider text-xs font-semibold">Document Name</Label>
              <Input id="name" className="bg-secondary/50 border-white/5 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl h-12" value={newDoc.name} onChange={e => setNewDoc({...newDoc, name: e.target.value})} placeholder="e.g. 2023 W2 Form" />
            </div>
            <div className="space-y-3">
              <Label htmlFor="category" className="text-muted-foreground uppercase tracking-wider text-xs font-semibold">Category</Label>
              <Select value={newDoc.category} onValueChange={(val) => setNewDoc({...newDoc, category: val})}>
                <SelectTrigger className="bg-secondary/50 border-white/5 rounded-xl h-12"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-white/10 rounded-xl">
                  <SelectItem value="Income">Income</SelectItem>
                  <SelectItem value="Assets">Assets</SelectItem>
                  <SelectItem value="Identity">Identity</SelectItem>
                  <SelectItem value="Property">Property</SelectItem>
                  <SelectItem value="Credit">Credit</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="status" className="text-muted-foreground uppercase tracking-wider text-xs font-semibold">Initial Status</Label>
              <Select value={newDoc.status} onValueChange={(val) => setNewDoc({...newDoc, status: val})}>
                <SelectTrigger className="bg-secondary/50 border-white/5 rounded-xl h-12"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-white/10 rounded-xl">
                  <SelectItem value="needed">Action Needed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t border-white/5">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-full px-6">Cancel</Button>
            <Button onClick={handleSave} disabled={createDoc.isPending || !newDoc.name} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-8">
              {createDoc.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
