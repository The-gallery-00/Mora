"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getMyTickets, deleteTicket, updateTicket, getDocumentImageUrl } from "@/lib/api";
import type { TicketResponse } from "@/types";

// parsedJson에서 imageUrl 추출
function getImageUrl(ticket: TicketResponse): string {
  if (ticket.imageUrl) return ticket.imageUrl;
  try {
    const parsed = JSON.parse(ticket.parsedJson || "{}");
    return parsed.imageUrl || "";
  } catch {
    return "";
  }
}

// rawJson에서 블록 추출
function getRawBlocks(
  ticket: TicketResponse,
): Array<{ text: string; confidence: number; bbox?: number[][] }> {
  try {
    return JSON.parse(ticket.rawJson || "[]");
  } catch {
    return [];
  }
}

export default function StorageTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketResponse | null>(
    null,
  );
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [selectedBlockIdx, setSelectedBlockIdx] = useState<number | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<TicketResponse | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  type TKey =
    | "transportType"
    | "departureLocation"
    | "departureDate"
    | "departureTime"
    | "arrivalLocation"
    | "arrivalDate"
    | "arrivalTime";
  const EDITABLE_KEYS: TKey[] = [
    "transportType",
    "departureLocation",
    "departureDate",
    "departureTime",
    "arrivalLocation",
    "arrivalDate",
    "arrivalTime",
  ];

  function openDrawer(t: TicketResponse | null) {
    setSelectedTicket(t);
    setSelectedBlockIdx(null);
    setIsEditing(false);
    setEditDraft(null);
    setEditError(null);
  }

  function startEdit() {
    if (!selectedTicket) return;
    setEditDraft({ ...selectedTicket });
    setIsEditing(true);
    setEditError(null);
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditDraft(null);
    setEditError(null);
  }

  async function saveEdit() {
    if (!editDraft?.id) return;
    setIsSaving(true);
    setEditError(null);
    const body: Record<string, unknown> = {};
    for (const k of EDITABLE_KEYS) body[k] = editDraft[k];
    const res = await updateTicket(editDraft.id, body);
    setIsSaving(false);
    if (!res.success) {
      setEditError(res.error || "수정 실패");
      return;
    }
    const updated = res.data!;
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTicket(updated);
    setIsEditing(false);
    setEditDraft(null);
  }

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const res = await getMyTickets(0, 100);
      if (res.success) setTickets(res.data);
      setIsLoading(false);
    }
    load();
  }, []);

  async function handleDelete(id: string) {
    const res = await deleteTicket(id);
    if (res.success) {
      setTickets((prev) => prev.filter((t) => t.id !== id));
      if (selectedTicket?.id === id) openDrawer(null);
    }
    setDeleteTargetId(null);
  }

  function renderBbox() {
    if (selectedBlockIdx === null || !selectedTicket) return null;
    const blocks = getRawBlocks(selectedTicket);
    const block = blocks[selectedBlockIdx];
    if (!block?.bbox || !imgRef.current) return null;
    const img = imgRef.current.querySelector("img");
    if (!img) return null;
    const dw = img.clientWidth,
      dh = img.clientHeight;
    const nw = img.naturalWidth,
      nh = img.naturalHeight;
    const sx = dw / nw,
      sy = dh / nh;
    const xs = block.bbox.map((p) => p[0] * sx);
    const ys = block.bbox.map((p) => p[1] * sy);
    const left = Math.min(...xs),
      top = Math.min(...ys);
    return (
      <>
        <div
          style={{
            position: "absolute",
            left,
            top,
            width: Math.max(...xs) - left,
            height: Math.max(...ys) - top,
            border: "2px solid #6746AF",
            background: "rgba(103,70,175,0.12)",
            borderRadius: 4,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            left,
            top: Math.max(top - 22, 0),
            background: "#6746AF",
            color: "#FFF",
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 4,
            whiteSpace: "nowrap",
          }}
        >
          {block.text} — {(block.confidence * 100).toFixed(1)}%
        </div>
      </>
    );
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#15293D" }}>
          티켓 ({tickets.length})
        </h1>
        <button
          onClick={() => router.push("/dashboard/upload")}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "none",
            background: "#0077B6",
            color: "#FFF",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          등록하기
        </button>
      </div>

      {isLoading && (
        <p
          style={{
            color: "#999",
            fontSize: 14,
            textAlign: "center",
            padding: "60px 0",
          }}
        >
          불러오는 중...
        </p>
      )}

      {!isLoading && tickets.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "80px 0",
            borderRadius: 12,
            border: "1px solid #CBD5E1",
          }}
        >
          <p style={{ fontSize: 14, color: "#999" }}>
            아직 저장된 티켓이 없습니다
          </p>
        </div>
      )}

      {!isLoading && tickets.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tickets.map((t) => {
            const imgUrl = getDocumentImageUrl(getImageUrl(t));
            return (
              <div
                key={t.id}
                onClick={() =>
                  openDrawer(selectedTicket?.id === t.id ? null : t)
                }
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr 1fr 1fr 1fr auto",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 20px",
                  borderRadius: 12,
                  border:
                    selectedTicket?.id === t.id
                      ? "1px solid #6746AF"
                      : "1px solid #CBD5E1",
                  background:
                    selectedTicket?.id === t.id ? "#F5F3FF" : "#FFFFFF",
                  cursor: "pointer",
                  transition: "all 0.1s",
                }}
              >
                {/* 썸네일 */}
                <div
                  style={{
                    width: 72,
                    height: 48,
                    borderRadius: 6,
                    background: "#F1F5F9",
                    overflow: "hidden",
                    border: "1px solid #E2E8F0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt="티켓"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 20, color: "#CBD5E1" }}>🎫</span>
                  )}
                </div>

                <div>
                  <p style={{ fontSize: 11, color: "#999" }}>교통수단</p>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#15293D",
                      marginTop: 2,
                    }}
                  >
                    {t.transportType || "-"}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#999" }}>출발</p>
                  <p style={{ fontSize: 14, color: "#333", marginTop: 2 }}>
                    {t.departureLocation || "-"}
                  </p>
                  <p style={{ fontSize: 12, color: "#999" }}>
                    {t.departureDate} {t.departureTime}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#999" }}>도착</p>
                  <p style={{ fontSize: 14, color: "#333", marginTop: 2 }}>
                    {t.arrivalLocation || "-"}
                  </p>
                  <p style={{ fontSize: 12, color: "#999" }}>
                    {t.arrivalDate} {t.arrivalTime}
                  </p>
                </div>
                <p style={{ fontSize: 12, color: "#999" }}>
                  {t.createdAt
                    ? new Date(t.createdAt).toLocaleDateString("ko-KR")
                    : ""}
                </p>

                {deleteTargetId === t.id ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: "flex", gap: 4 }}
                  >
                    <button
                      onClick={() => handleDelete(t.id)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: "none",
                        background: "#DC2626",
                        color: "#FFF",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      삭제
                    </button>
                    <button
                      onClick={() => setDeleteTargetId(null)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: "1px solid #CBD5E1",
                        background: "#FFF",
                        color: "#505050",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTargetId(t.id);
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: "1px solid #E2E8F0",
                      background: "#FFF",
                      color: "#999",
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 상세 서랍 */}
      {selectedTicket && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            onClick={() => openDrawer(null)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.3)",
            }}
          />
          <div
            style={{
              position: "relative",
              width: 440,
              height: "100%",
              background: "#FFF",
              borderLeft: "1px solid #CBD5E1",
              padding: 28,
              overflowY: "auto",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div
              style={{
                position: "sticky",
                top: -28,
                marginTop: -28,
                marginLeft: -28,
                marginRight: -28,
                background: "#FFFFFF",
                padding: "20px 28px",
                borderBottom: "1px solid #F1F5F9",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "#15293D" }}>
                  {isEditing ? "티켓 수정" : "티켓 상세"}
                </h2>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {!isEditing && (
                    <button
                      onClick={startEdit}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 6,
                        border: "none",
                        background: "#0077B6",
                        color: "#FFF",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      수정
                    </button>
                  )}
                  <button
                    onClick={() => openDrawer(null)}
                    title="닫기"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: "1px solid #CBD5E1",
                      background: "#FFF",
                      cursor: "pointer",
                      fontSize: 14,
                      color: "#999",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {/* 이미지 + bbox overlay */}
            {(() => {
              const imgUrl = getDocumentImageUrl(getImageUrl(selectedTicket));
              if (!imgUrl) return null;
              return (
                <div
                  ref={imgRef}
                  style={{
                    position: "relative",
                    borderRadius: 12,
                    marginBottom: 20,
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <img
                    src={imgUrl}
                    alt="티켓 원본"
                    style={{ width: "100%", display: "block" }}
                  />
                  {renderBbox()}
                </div>
              );
            })()}

            {/* 필드 */}
            {(() => {
              const view = isEditing && editDraft ? editDraft : selectedTicket;
              const fields: Array<{ key: TKey; label: string }> = [
                { key: "transportType", label: "교통수단" },
                { key: "departureLocation", label: "출발지" },
                { key: "departureDate", label: "출발일" },
                { key: "departureTime", label: "출발 시간" },
                { key: "arrivalLocation", label: "도착지" },
                { key: "arrivalDate", label: "도착일" },
                { key: "arrivalTime", label: "도착 시간" },
              ];
              return (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: isEditing ? 14 : 0,
                  }}
                >
                  {fields.map((f) => {
                    const raw = view[f.key] as string | undefined;
                    return (
                      <div
                        key={f.label}
                        style={{
                          padding: isEditing ? 0 : "12px 0",
                          borderBottom: isEditing
                            ? "none"
                            : "1px solid #F1F5F9",
                        }}
                      >
                        <p
                          style={{
                            fontSize: 11,
                            color: "#999",
                            marginBottom: isEditing ? 6 : 4,
                          }}
                        >
                          {f.label}
                        </p>
                        {isEditing ? (
                          <input
                            value={raw || ""}
                            onChange={(e) =>
                              setEditDraft(
                                (d) =>
                                  d &&
                                  ({
                                    ...d,
                                    [f.key]: e.target.value,
                                  } as TicketResponse),
                              )
                            }
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              borderRadius: 6,
                              border: "1px solid #CBD5E1",
                              background: "#FAFBFC",
                              fontSize: 14,
                              color: "#333",
                              outline: "none",
                            }}
                          />
                        ) : (
                          <p style={{ fontSize: 14, color: "#333" }}>
                            {raw || "-"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {isEditing && (
              <>
                {editError && (
                  <p style={{ fontSize: 12, color: "#DC2626" }}>{editError}</p>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <button
                    onClick={cancelEdit}
                    disabled={isSaving}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 6,
                      border: "1px solid #CBD5E1",
                      background: "#FFF",
                      color: "#333",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: isSaving ? "not-allowed" : "pointer",
                    }}
                  >
                    취소
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={isSaving}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 6,
                      border: "none",
                      background: "#0077B6",
                      color: "#FFF",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: isSaving ? "not-allowed" : "pointer",
                      opacity: isSaving ? 0.6 : 1,
                    }}
                  >
                    {isSaving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </>
            )}

            {/* Raw OCR 블록 — 클릭 시 bbox */}
            {(() => {
              const blocks = getRawBlocks(selectedTicket);
              if (blocks.length === 0) return null;
              return (
                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: "1px solid #E2E8F0",
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#999",
                      marginBottom: 10,
                    }}
                  >
                    OCR 원문{" "}
                    <span style={{ fontSize: 11, fontWeight: 400 }}>
                      (클릭 시 위치 표시)
                    </span>
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {blocks.map((b, i) => {
                      const isSelected = selectedBlockIdx === i;
                      return (
                        <span
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBlockIdx(isSelected ? null : i);
                            if (!isSelected)
                              imgRef.current?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                          }}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 6,
                            cursor: "pointer",
                            background: isSelected ? "#F5F3FF" : "#F8FAFC",
                            border: isSelected
                              ? "1px solid #6746AF"
                              : "1px solid #E2E8F0",
                            fontSize: 12,
                            fontFamily: "monospace",
                            color: isSelected ? "#6746AF" : "#505050",
                            fontWeight: isSelected ? 600 : 400,
                            transition: "all 0.15s",
                          }}
                        >
                          {b.text}
                          <span
                            style={{
                              marginLeft: 4,
                              fontSize: 10,
                              color: isSelected ? "#6746AF" : "#999",
                            }}
                          >
                            {(b.confidence * 100).toFixed(0)}%
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
