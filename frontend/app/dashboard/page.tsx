"use client";

import { CircleChevronLeft, CircleChevronRight } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { getMyCards, getMyTickets, getMyPosters } from "@/lib/api";
import type { TicketResponse, PosterResponse } from "@/types";

const IMAGE_BASE = process.env.NEXT_PUBLIC_OCR_URL || "http://localhost:8000";

function formatToday(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${month}.${day} ${weekdays[d.getDay()]}`;
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${m}.${day} (${weekdays[d.getDay()]})`;
}

function getDDay(dateStr: string): number {
  if (!dateStr) return Infinity;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function getImageFromParsedJson(json: string): string {
  try {
    return JSON.parse(json || "{}").imageUrl || "";
  } catch {
    return "";
  }
}

function fullImageUrl(url: string): string {
  if (!url) return "";
  return url.startsWith("http") ? url : `${IMAGE_BASE}${url}`;
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isDateInRange(dateStr: string, startDate?: string, endDate?: string) {
  const start = (startDate || endDate || "").slice(0, 10);
  const end = (endDate || startDate || "").slice(0, 10);
  if (!dateStr || !start || !end) return false;

  const rangeStart = start <= end ? start : end;
  const rangeEnd = start <= end ? end : start;
  return dateStr >= rangeStart && dateStr <= rangeEnd;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function scheduleItemKey(item: ScheduleItem): string {
  return `${item.type}-${item.id}-${item.date}-${item.time}-${item.title}`;
}

interface DeadlineCard {
  id: string;
  title: string;
  subtitle?: string;
  type: "POSTER" | "TICKET";
  dDay: number;
  date: string;
  imageUrl: string;
}

interface ScheduleItem {
  id: string;
  title: string;
  type: "POSTER" | "TICKET";
  time: string;
  date: string;
}

const TYPE_COLORS: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  POSTER: { color: "#0077B6", bg: "#E8EDF3", label: "포스터" },
  TICKET: { color: "#6746AF", bg: "#E9E5FA", label: "티켓" },
  RECEIPT: { color: "#4FB048", bg: "#CFE5D0", label: "영수증" },
  BUSINESS_CARD: { color: "#15293D", bg: "#E8EDF3", label: "명함" },
};

function getWeekendColor(dayOfWeek: number) {
  if (dayOfWeek === 0) return "#DC2626";
  if (dayOfWeek === 6) return "#2563EB";
  return "#333";
}

export default function DashboardPage() {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const [deadlineCards, setDeadlineCards] = useState<DeadlineCard[]>([]);
  const [tickets, setTickets] = useState<TicketResponse[]>([]);
  const [posters, setPosters] = useState<PosterResponse[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const selectedDate = useMemo(() => {
    if (!selectedDateKey) return null;
    const [year, month, day] = selectedDateKey.split("-").map(Number);
    return { year, month: month - 1, day, toString: () => String(day) };
  }, [selectedDateKey]);

  const setSelectedDate = (date: null) => {
    if (date === null) setSelectedDateKey(null);
  };

  const selectedDayInCurrentMonth =
    selectedDate?.year === currentYear && selectedDate.month === currentMonth
      ? selectedDate.day
      : null;

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const [cardsRes, ticketsRes, postersRes] = await Promise.all([
        getMyCards(),
        getMyTickets(0, 100),
        getMyPosters(0, 100),
      ]);

      const tickets: TicketResponse[] = ticketsRes.success
        ? uniqueById(ticketsRes.data)
        : [];
      const posters: PosterResponse[] = postersRes.success
        ? uniqueById(postersRes.data)
        : [];
      const cards = cardsRes.success ? cardsRes.data : [];

      setTickets(tickets);
      setPosters(posters);
      setTotalCards(cards.length + tickets.length + posters.length);

      const deadlines: DeadlineCard[] = [];

      for (const t of tickets) {
        const dDay = getDDay(t.departureDate);
        if (dDay >= 0 && dDay <= 30) {
          deadlines.push({
            id: t.id,
            title: `${t.departureLocation || "출발"} → ${t.arrivalLocation || "도착"}`,
            subtitle: t.transportType || "",
            type: "TICKET",
            dDay,
            date: t.departureDate,
            imageUrl: getImageFromParsedJson(t.parsedJson) || t.imageUrl || "",
          });
        }
      }

      for (const p of posters) {
        const endDate = p.eventEndDate || p.eventStartDate;
        const dDay = getDDay(endDate);
        if (dDay >= 0 && dDay <= 30) {
          deadlines.push({
            id: p.id,
            title: p.title || "이벤트",
            type: "POSTER",
            dDay,
            date: endDate,
            imageUrl: getImageFromParsedJson(p.parsedJson) || p.imageUrl || "",
          });
        }
      }

      deadlines.sort((a, b) => a.dDay - b.dDay);
      setDeadlineCards(deadlines);

      const todayStr = new Date().toISOString().split("T")[0];
      const todaySchedules = [
        ...tickets.filter((t) => t.departureDate === todayStr),
        ...posters.filter((p) =>
          isDateInRange(todayStr, p.eventStartDate, p.eventEndDate),
        ),
      ];
      setTodayCount(todaySchedules.length);
      setIsLoading(false);
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getScheduleItemsForDate(
    dateStr: string,
    tickets: TicketResponse[],
    posters: PosterResponse[],
  ): ScheduleItem[] {
    const items: ScheduleItem[] = [];
    for (const t of tickets) {
      if (t.departureDate === dateStr) {
        items.push({
          id: t.id,
          title: `${t.departureLocation || "출발"} → ${t.arrivalLocation || "도착"}`,
          type: "TICKET",
          time: t.departureTime || "",
          date: t.departureDate,
        });
      }
    }
    for (const p of posters) {
      if (isDateInRange(dateStr, p.eventStartDate, p.eventEndDate)) {
        items.push({
          id: p.id,
          title: p.title || "이벤트",
          type: "POSTER",
          time: "",
          date: dateStr,
        });
      }
    }
    const uniqueItems = new Map<string, ScheduleItem>();
    for (const item of items) {
      uniqueItems.set(scheduleItemKey(item), item);
    }

    return Array.from(uniqueItems.values()).sort((a, b) =>
      (a.time || "99:99").localeCompare(b.time || "99:99"),
    );
  }

  const scheduleItems = useMemo(
    () =>
      selectedDateKey
        ? getScheduleItemsForDate(selectedDateKey, tickets, posters)
        : [],
    [selectedDateKey, tickets, posters],
  );

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [currentYear, currentMonth]);

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else setCurrentMonth(currentMonth - 1);
  }
  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else setCurrentMonth(currentMonth + 1);
  }

  const isToday = (day: number) =>
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  const calendarContentWidth = selectedDate == null ? 1016 : 508;
  const calendarRowGap = selectedDate == null ? 16 : 10;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>
      {/* ── 오늘의 MORA 배너 (피그마) ── */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          borderRadius: 16,
          overflow: "hidden",
          marginBottom: 32,
          border: "1px solid #CBD5E1",
        }}
      >
        {/* 왼쪽: 날짜 */}
        <div
          style={{
            background: "#15293D",
            padding: "28px 32px",
            color: "#FFF",
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              marginBottom: 4,
            }}
          >
            오늘의 MORA
          </p>
          <p style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
            {formatToday()}
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
            일상의 요약된 정보를 확인하세요
          </p>
        </div>
        {/* 오늘 일정 */}
        <div
          style={{
            background: "linear-gradient(180deg, #F0F9FF, #FFFFFF)",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#E8F4FD",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
              fontSize: 20,
              color: "#0077B6",
            }}
          >
            📅
          </div>
          <p style={{ fontSize: 13, color: "#505050" }}>오늘 일정</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: "#15293D" }}>
            {isLoading ? "-" : todayCount}{" "}
            <span style={{ fontSize: 14, fontWeight: 400 }}>건</span>
          </p>
          <p style={{ fontSize: 11, color: "#999" }}>예정된 일정</p>
        </div>
        {/* 마감 임박 */}
        <div
          style={{
            background: "linear-gradient(180deg, #FFF7ED, #FFFFFF)",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#FEF3E2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
              fontSize: 20,
              color: "#DC8540",
            }}
          >
            ⏰
          </div>
          <p style={{ fontSize: 13, color: "#505050" }}>마감 임박</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: "#15293D" }}>
            {isLoading ? "-" : deadlineCards.length}{" "}
            <span style={{ fontSize: 14, fontWeight: 400 }}>건</span>
          </p>
          <p style={{ fontSize: 11, color: "#999" }}>30일 이내 마감</p>
        </div>
        {/* 보관 문서 */}
        <div
          style={{
            background: "linear-gradient(180deg, #F0FDF4, #FFFFFF)",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#DCFCE7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
              fontSize: 20,
              color: "#4FB048",
            }}
          >
            📄
          </div>
          <p style={{ fontSize: 13, color: "#505050" }}>보관 문서</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: "#15293D" }}>
            {isLoading ? "-" : totalCards}{" "}
            <span style={{ fontSize: 14, fontWeight: 400 }}>건</span>
          </p>
          <p style={{ fontSize: 11, color: "#999" }}>전체 저장 문서</p>
        </div>
      </section>

      {/* ── 마감 임박 (이미지 포함 카드) ── */}
      <section style={{ marginBottom: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#15293D" }}>
            마감 임박
          </h2>
          {!isLoading && deadlineCards.length > 0 && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 10,
                background: "#FEF3E2",
                color: "#DC8540",
              }}
            >
              {deadlineCards.length}건
            </span>
          )}
        </div>

        {isLoading ? (
          <p style={{ fontSize: 14, color: "#999" }}>불러오는 중...</p>
        ) : deadlineCards.length === 0 ? (
          <div
            style={{
              padding: "32px",
              borderRadius: 12,
              border: "1px solid #CBD5E1",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 14, color: "#999" }}>
              30일 이내 마감되는 일정이 없습니다
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 16,
              overflowX: "auto",
              paddingBottom: 8,
            }}
          >
            {deadlineCards.map((card) => {
              const typeInfo = TYPE_COLORS[card.type];
              const imgSrc = fullImageUrl(card.imageUrl);
              return (
                <div
                  key={card.id}
                  style={{
                    minWidth: 320,
                    maxWidth: 360,
                    display: "grid",
                    gridTemplateColumns: "1fr 120px",
                    borderRadius: 12,
                    border: "1px solid #CBD5E1",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    background: "#FFFFFF",
                    flexShrink: 0,
                    overflow: "hidden",
                    cursor: "pointer",
                    transition: "transform 0.15s",
                  }}
                >
                  {/* 텍스트 */}
                  <div
                    style={{
                      padding: "16px 20px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: typeInfo.bg,
                          color: typeInfo.color,
                        }}
                      >
                        {typeInfo.label}
                      </span>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#111",
                          marginTop: 10,
                          lineHeight: 1.4,
                        }}
                      >
                        {card.title}
                      </p>
                      {card.subtitle && (
                        <p
                          style={{ fontSize: 12, color: "#999", marginTop: 4 }}
                        >
                          {card.subtitle}
                        </p>
                      )}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: card.dDay <= 3 ? "#DC8540" : "#0077B6",
                        }}
                      >
                        {card.dDay === 0 ? "D-DAY" : `D-${card.dDay}`}
                      </p>
                      <p style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
                        {formatDateShort(card.date)}
                      </p>
                    </div>
                  </div>
                  {/* 이미지 */}
                  <div
                    style={{
                      background: "#F1F5F9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={card.title}
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
                      <span style={{ fontSize: 32, color: "#CBD5E1" }}>
                        {card.type === "TICKET" ? "🎫" : "📄"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 캘린더 + 일정 ── */}
      <section>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "#15293D",
            marginBottom: 14,
          }}
        >
          캘린더
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: selectedDate != null ? "1fr 1fr" : "1fr",
            gap: 24,
          }}
        >
          {/* 캘린더 */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #CBD5E1",
              padding: selectedDate == null ? "40px 0 64px" : "20px 0 24px",
              background: "#FFFFFF",
              width: "100%",
              minHeight: selectedDate != null ? undefined : 420,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: calendarContentWidth,
                maxWidth: "100%",
                margin: "0 auto",
                marginBottom: 10,
              }}
            >
              <button
                onClick={prevMonth}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: selectedDate == null ? 40 : 18,
                  color: "#0077B6",
                  padding: selectedDate == null ? "8px 12px" : "4px 8px",
                  fontWeight: 700,
                }}
              >
                <CircleChevronLeft
                  size={selectedDate == null ? 32 : 24}
                  strokeWidth={2}
                />
              </button>
              <span
                style={{
                  fontSize: selectedDate == null ? 25 : 15,
                  fontWeight: 700,
                  color: "#0077B6",
                }}
              >
                {currentYear}년 {currentMonth + 1}월
              </span>
              <button
                onClick={nextMonth}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: selectedDate == null ? 40 : 18,
                  color: "#0077B6",
                  padding: selectedDate == null ? "8px 12px" : "4px 8px",
                  fontWeight: 700,
                }}
              >
                <CircleChevronRight
                  size={selectedDate == null ? 32 : 24}
                  strokeWidth={2}
                />
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                columnGap: 0,
                rowGap: calendarRowGap,
                width: "100%",
                margin: selectedDate == null ? "0 0 28px" : "0 0 14px",
                padding: selectedDate == null ? "64px 0 0 0" : "32px 0 0 0",
                textAlign: "center",
                justifyItems: "center",
              }}
            >
              {["일", "월", "화", "수", "목", "금", "토"].map((d, index) => (
                <span
                  key={d}
                  style={{
                    fontSize: selectedDate == null ? 20 : 12,
                    color:
                      index === 0
                        ? "#DC2626"
                        : index === 6
                          ? "#2563EB"
                          : "#999",
                    fontWeight: 500,
                  }}
                >
                  {d}
                </span>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                columnGap: 0,
                rowGap: calendarRowGap,
                width: "100%",
                margin: 0,
                justifyItems: "center",
                paddingTop: 6,
              }}
            >
              {calendarDays.map((day, i) => {
                const dayOfWeek = i % 7;
                return day ? (
                  <button
                    key={i}
                    onClick={() =>
                      setSelectedDateKey(
                        formatDateKey(currentYear, currentMonth, day),
                      )
                    }
                    style={{
                      width: selectedDate != null ? 36 : 72,
                      height: selectedDate != null ? 36 : 72,
                      borderRadius: "50%",
                      border: "none",
                      background: isToday(day)
                        ? "#0077B6"
                        : day === selectedDayInCurrentMonth
                          ? "#E8EDF3"
                          : "transparent",
                      color: isToday(day) ? "#FFF" : getWeekendColor(dayOfWeek),
                      fontSize: selectedDate != null ? 13 : 20,
                      fontWeight: isToday(day) ? 700 : 400,
                      cursor: "pointer",
                      transition: "background 0.15s, transform 0.15s",
                    }}
                  >
                    {day}
                  </button>
                ) : (
                  <div
                    key={"empty-" + i}
                    style={{
                      width: selectedDate != null ? 36 : 72,
                      height: selectedDate != null ? 36 : 72,
                      borderRadius: "50%",
                      background: "transparent",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* 일정 목록 (선택된 날짜가 있을 때만 표시) */}
          {selectedDate != null && (
            <div
              style={{
                position: "relative",
                borderRadius: 12,
                border: "1px solid #CBD5E1",
                padding: 24,
                background: "#FFFFFF",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3
                    style={{ fontSize: 15, fontWeight: 600, color: "#15293D" }}
                  >
                    {selectedDate.year}.
                    {String(selectedDate.month + 1).padStart(2, "0")}.
                    {String(selectedDate).padStart(2, "0")} 일정
                  </h3>
                  {scheduleItems.length > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "#E8F4FD",
                        color: "#0077B6",
                      }}
                    >
                      {scheduleItems.length}건
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setSelectedDate(null)}
                  aria-label="닫기"
                  title="닫기"
                  style={{
                    position: "absolute",
                    right: 24,
                    top: 24,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: 18,
                    color: "#666",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {scheduleItems.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <p style={{ fontSize: 14, color: "#999" }}>
                      일정이 없습니다
                    </p>
                  </div>
                ) : (
                  scheduleItems.map((item) => {
                    const typeInfo = TYPE_COLORS[item.type];
                    return (
                      <div
                        key={scheduleItemKey(item)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 16px",
                          borderRadius: 10,
                          background: typeInfo.bg,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: 4,
                            background: "#FFF",
                            color: typeInfo.color,
                            flexShrink: 0,
                          }}
                        >
                          {typeInfo.label}
                        </span>
                        {item.time && (
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#333",
                              flexShrink: 0,
                            }}
                          >
                            {item.time}
                          </span>
                        )}
                        <span style={{ fontSize: 13, color: "#333" }}>
                          {item.title}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
