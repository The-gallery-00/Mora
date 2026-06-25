"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyPosters, deletePoster, updatePoster } from "@/lib/api";
import type { PosterResponse } from "@/types";

const IMAGE_BASE = process.env.NEXT_PUBLIC_OCR_URL || "http://localhost:8000";

function getImageUrl(poster: PosterResponse): string {
  if (poster.imageUrl) return poster.imageUrl;
  try {
    const parsed = JSON.parse(poster.parsedJson || "{}");
    return parsed.imageUrl || "";
  } catch {
    return "";
  }
}

function getFullImageUrl(imageUrl: string): string {
  if (!imageUrl) return "";
  return imageUrl.startsWith("http") ? imageUrl : `${IMAGE_BASE}${imageUrl}`;
}

type EditableKey =
  | "title"
  | "organizerName"
  | "eventStartDate"
  | "eventEndDate"
  | "contactPhone"
  | "contactEmail"
  | "location"
  | "fee"
  | "websiteUrl"
  | "description";

const EDITABLE_KEYS: EditableKey[] = [
  "title",
  "organizerName",
  "eventStartDate",
  "eventEndDate",
  "contactPhone",
  "contactEmail",
  "location",
  "fee",
  "websiteUrl",
  "description",
];

export default function StoragePostersPage() {
  const router = useRouter();
  const [posters, setPosters] = useState<PosterResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPoster, setSelectedPoster] = useState<PosterResponse | null>(
    null,
  );
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<PosterResponse | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      setIsLoading(true);
      const res = await getMyPosters(0, 100);
      if (res.success) setPosters(res.data);
      setIsLoading(false);
    }
    fetch();
  }, []);

  function openDrawer(p: PosterResponse | null) {
    setSelectedPoster(p);
    setIsEditing(false);
    setEditDraft(null);
    setEditError(null);
  }

  function startEdit() {
    if (!selectedPoster) return;
    setEditDraft({ ...selectedPoster });
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
    for (const k of EDITABLE_KEYS) {
      body[k] = editDraft[k];
    }
    const res = await updatePoster(editDraft.id, body);
    setIsSaving(false);
    if (!res.success) {
      setEditError(res.error || "수정 실패");
      return;
    }
    const updated = res.data!;
    setPosters((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedPoster(updated);
    setIsEditing(false);
    setEditDraft(null);
  }

  async function handleDelete(id: string) {
    const res = await deletePoster(id);
    if (res.success) {
      setPosters((prev) => prev.filter((p) => p.id !== id));
      if (selectedPoster?.id === id) openDrawer(null);
    }
    setDeleteTargetId(null);
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
          포스터 ({posters.length})
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

      {!isLoading && posters.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "80px 0",
            borderRadius: 12,
            border: "1px solid #CBD5E1",
          }}
        >
          <p style={{ fontSize: 14, color: "#999" }}>
            아직 저장된 포스터가 없습니다
          </p>
        </div>
      )}

      {!isLoading && posters.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {posters.map((p) => {
            const imgUrl = getFullImageUrl(getImageUrl(p));
            return (
              <div
                key={p.id}
                onClick={() =>
                  openDrawer(selectedPoster?.id === p.id ? null : p)
                }
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 2fr 1fr 1fr 1fr auto",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 20px",
                  borderRadius: 12,
                  border:
                    selectedPoster?.id === p.id
                      ? "1px solid #0077B6"
                      : "1px solid #CBD5E1",
                  background:
                    selectedPoster?.id === p.id ? "#F0F9FF" : "#FFFFFF",
                  cursor: "pointer",
                  transition: "all 0.1s",
                }}
              >
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
                      alt="Poster"
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
                    <span style={{ fontSize: 20, color: "#CBD5E1" }}>P</span>
                  )}
                </div>
                <div>
                  <p
                    style={{ fontSize: 14, fontWeight: 600, color: "#15293D" }}
                  >
                    {p.title || "-"}
                  </p>
                  <p style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
                    {p.organizerName || ""}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#999" }}>장소</p>
                  <p style={{ fontSize: 13, color: "#333", marginTop: 2 }}>
                    {p.location || "-"}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#999" }}>기간</p>
                  <p style={{ fontSize: 13, color: "#333", marginTop: 2 }}>
                    {p.eventStartDate || "-"} ~ {p.eventEndDate || ""}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: "#999" }}>
                    {p.createdAt
                      ? new Date(p.createdAt).toLocaleDateString("ko-KR")
                      : ""}
                  </p>
                </div>

                {deleteTargetId === p.id ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: "flex", gap: 4 }}
                  >
                    <button
                      onClick={() => handleDelete(p.id)}
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
                      setDeleteTargetId(p.id);
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

      {selectedPoster &&
        (() => {
          const view = isEditing && editDraft ? editDraft : selectedPoster;
          const selectedImageUrl = getFullImageUrl(getImageUrl(selectedPoster));
          const fields: Array<{
            key: EditableKey;
            label: string;
            multiline?: boolean;
          }> = [
            { key: "title", label: "제목" },
            { key: "organizerName", label: "주최자" },
            { key: "eventStartDate", label: "시작일" },
            { key: "eventEndDate", label: "종료일" },
            { key: "location", label: "장소" },
            { key: "contactPhone", label: "연락처" },
            { key: "contactEmail", label: "이메일" },
            { key: "fee", label: "참가비" },
            { key: "websiteUrl", label: "웹사이트" },
            { key: "description", label: "설명", multiline: true },
          ];
          return (
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
                  width: 400,
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
                    <h2
                      style={{
                        fontSize: 17,
                        fontWeight: 700,
                        color: "#15293D",
                      }}
                    >
                      {isEditing ? "포스터 수정" : "포스터 상세"}
                    </h2>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
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

                {selectedImageUrl && (
                  <div
                    style={{
                      borderRadius: 12,
                      marginBottom: 4,
                      border: "1px solid #E2E8F0",
                      background: "#F8FAFC",
                    }}
                  >
                    <img
                      src={selectedImageUrl}
                      alt="Poster original"
                      style={{ width: "100%", display: "block" }}
                    />
                  </div>
                )}

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
                        {isEditing && f.multiline ? (
                          <textarea
                            value={raw || ""}
                            onChange={(e) =>
                              setEditDraft(
                                (d) =>
                                  d &&
                                  ({
                                    ...d,
                                    [f.key]: e.target.value,
                                  } as PosterResponse),
                              )
                            }
                            rows={5}
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              borderRadius: 6,
                              border: "1px solid #CBD5E1",
                              background: "#FAFBFC",
                              fontSize: 14,
                              color: "#333",
                              outline: "none",
                              resize: "vertical",
                              fontFamily: "inherit",
                            }}
                          />
                        ) : isEditing ? (
                          <input
                            value={raw || ""}
                            onChange={(e) =>
                              setEditDraft(
                                (d) =>
                                  d &&
                                  ({
                                    ...d,
                                    [f.key]: e.target.value,
                                  } as PosterResponse),
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
                          <p
                            style={{
                              fontSize: 14,
                              color: "#333",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {raw || "-"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isEditing && (
                  <>
                    {editError && (
                      <p style={{ fontSize: 12, color: "#DC2626" }}>
                        {editError}
                      </p>
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
              </div>
            </div>
          );
        })()}
    </div>
  );
}
