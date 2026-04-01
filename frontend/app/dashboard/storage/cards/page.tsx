"use client";

import { useMemo, useState } from "react";
import StorageDrawer from "@/components/dashboard/storage/StorageDrawer";
import StorageGrid from "@/components/dashboard/storage/StorageGrid";
import { mockBusinessCards } from "@/lib/storage-mock-data";
import type { BusinessCard } from "@/types/storage";

export default function StorageCardsPage() {
  const [items, setItems] = useState<BusinessCard[]>(mockBusinessCards);
  const [selectedItem, setSelectedItem] = useState<BusinessCard | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      ),
    [items],
  );

  const handleOpenDetail = (item: BusinessCard) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  const handleDelete = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    setDeleteTargetId(null);

    if (selectedItem?.id === itemId) {
      setSelectedItem(null);
      setIsDrawerOpen(false);
    }
  };

  const drawerFields = selectedItem
    ? [
        { label: "회사명", value: selectedItem.company },
        { label: "이름", value: selectedItem.name },
        { label: "직책", value: selectedItem.position },
        { label: "전화번호", value: selectedItem.phone },
        { label: "팩스번호", value: selectedItem.fax },
        { label: "이메일", value: selectedItem.email },
      ]
    : [];

  return (
    <div className="mx-auto max-w-[1120px] pb-12">
      <div>
        <h1 className="mb-10 text-2xl font-bold text-white">명함</h1>
      </div>

      <section className="mt-20">
        <div className="mb-8">
          <StorageGrid
            items={sortedItems}
            emptyMessage="아직 저장된 명함이 없습니다"
            deleteTargetId={deleteTargetId}
            getSubtitle={(item) => item.position}
            getMeta={(item) => [item.company, item.phone].filter(Boolean).join(" · ")}
            onOpenDetail={handleOpenDetail}
            onDeleteClick={setDeleteTargetId}
            onConfirmDelete={handleDelete}
            onCancelDelete={() => setDeleteTargetId(null)}
          />
        </div>
      </section>

      <StorageDrawer
        item={selectedItem}
        open={isDrawerOpen}
        onClose={handleCloseDrawer}
        title="명함 상세"
        fields={drawerFields}
      />
    </div>
  );
}
