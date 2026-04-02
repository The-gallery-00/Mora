"use client";

import { useMemo, useState } from "react";
import StorageDrawer from "@/components/dashboard/storage/StorageDrawer";
import StorageGrid from "@/components/dashboard/storage/StorageGrid";
import { mockTickets } from "@/lib/storage-mock-data";
import type { BaseItem } from "@/types/storage";

const stripTypeSuffix = (value: string) =>
  value.replace(/\s*(명함|티켓|포스터|영수증)\s*$/, "");

export default function StorageTicketsPage() {
  const [items, setItems] = useState<BaseItem[]>(mockTickets);
  const [selectedItem, setSelectedItem] = useState<BaseItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      ),
    [items],
  );

  const handleOpenDetail = (item: BaseItem) => {
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
        { label: "제목", value: stripTypeSuffix(selectedItem.title) },
        { label: "분류", value: "티켓" },
        {
          label: "생성일",
          value: new Date(selectedItem.createdAt).toLocaleDateString("ko-KR"),
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-[1120px] pb-12">
      <div>
        <h1 className="mb-4 text-2xl font-bold text-white">티켓</h1>
      </div>

      <section className="mt-20">
        <div className="mb-8">
          <StorageGrid
            items={sortedItems}
            emptyMessage="아직 저장된 티켓이 없습니다"
            deleteTargetId={deleteTargetId}
            getMeta={(item) => new Date(item.createdAt).toLocaleDateString("ko-KR")}
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
        title="티켓 상세"
        fields={drawerFields}
      />
    </div>
  );
}
