"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import TypesList from "./_components/TypesList";
import TypesEditor from "./_components/TypesEditor";

type TypesState =
  | { status: "loading" }
  | { status: "ready"; types: ArchiveRecord[]; selectedTypeId: string | null }
  | { status: "error"; message: string };

export default function TypesPage() {
  const [state, setState] = useState<TypesState>({ status: "loading" });
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const api = createArchiveApiClient();

  useEffect(() => {
    async function loadTypes() {
      try {
        const response = await api.get("/types");
        if (response.ok) {
          setState({
            status: "ready",
            types: response.types || [],
            selectedTypeId: null,
          });
        } else {
          setState({
            status: "error",
            message: response.error || "Failed to load types",
          });
        }
      } catch (error) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    loadTypes();
  }, []);

  async function handleSaveType(typeData: ArchiveRecord) {
    try {
      const response = await api.post("/types", typeData);
      if (response.ok) {
        const listResponse = await api.get("/types");
        if (listResponse.ok) {
          setState({
            status: "ready",
            types: listResponse.types || [],
            selectedTypeId: typeData.id as string,
          });
        }
        setIsEditorOpen(false);
      }
    } catch (error) {
      console.error("Error saving type:", error);
    }
  }

  async function handleDeleteType(typeId: string) {
    if (!window.confirm("حذف هذا النوع؟")) return;

    try {
      const response = await api.delete(`/types/${typeId}`);
      if (response.ok) {
        const listResponse = await api.get("/types");
        if (listResponse.ok) {
          setState({
            status: "ready",
            types: listResponse.types || [],
            selectedTypeId: null,
          });
        }
      }
    } catch (error) {
      console.error("Error deleting type:", error);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <PageToolbar
          title="الأنواع"
          action={{
            label: "نوع جديد",
            onClick: () => setIsEditorOpen(true),
          }}
        />

        <div className="flex-1 overflow-y-auto p-6">
          {state.status === "loading" && (
            <div className="text-center py-12">جاري التحميل...</div>
          )}

          {state.status === "error" && (
            <div className="bg-red-50 text-red-700 p-4 rounded">
              {state.message}
            </div>
          )}

          {state.status === "ready" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <TypesList
                  types={state.types}
                  selectedTypeId={state.selectedTypeId}
                  onSelectType={(id) =>
                    setState((prev) =>
                      prev.status === "ready"
                        ? { ...prev, selectedTypeId: id }
                        : prev
                    )
                  }
                  onDeleteType={handleDeleteType}
                />
              </div>

              {isEditorOpen && (
                <TypesEditor
                  onSave={handleSaveType}
                  onCancel={() => setIsEditorOpen(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
