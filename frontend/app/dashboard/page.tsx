'use client'

import { useState, useMemo, useEffect } from 'react'
import { getMyCards, getMyTickets, getMyPosters } from '@/lib/api'
import type { TicketResponse, PosterResponse } from '@/types'

const IMAGE_BASE = process.env.NEXT_PUBLIC_OCR_URL || 'http://localhost:8000'

function formatToday(): string {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  return `${month}.${day} ${weekdays[d.getDay()]}`
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  return `${m}.${day} (${weekdays[d.getDay()]})`
}

function getDDay(dateStr: string): number {
  if (!dateStr) return Infinity
  const target = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getImageFromParsedJson(json: string): string {
  try { return JSON.parse(json || '{}').imageUrl || '' } catch { return '' }
}

function fullImageUrl(url: string): string {
  if (!url) return ''
  return url.startsWith('http') ? url : `${IMAGE_BASE}${url}`
}

interface DeadlineCard {
  id: string
  title: string
  subtitle?: string
  type: 'POSTER' | 'TICKET'
  dDay: number
  date: string
  imageUrl: string
}

interface ScheduleItem {
  id: string
  title: string
  type: 'POSTER' | 'TICKET'
  time: string
  date: string
}

const TYPE_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  POSTER: { color: '#0077B6', bg: '#E8EDF3', label: '포스터' },
  TICKET: { color: '#6746AF', bg: '#E9E5FA', label: '티켓' },
  RECEIPT: { color: '#4FB048', bg: '#CFE5D0', label: '영수증' },
  BUSINESS_CARD: { color: '#15293D', bg: '#E8EDF3', label: '명함' },
}

export default function DashboardPage() {
  const today = useMemo(() => new Date(), [])
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState(today.getDate())

  const [deadlineCards, setDeadlineCards] = useState<DeadlineCard[]>([])
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([])
  const [todayCount, setTodayCount] = useState(0)
  const [totalCards, setTotalCards] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const selectedDateKey = useMemo(() => {
    const d = new Date(currentYear, currentMonth, selectedDate)
    return d.toISOString().split('T')[0]
  }, [currentYear, currentMonth, selectedDate])

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      const [cardsRes, ticketsRes, postersRes] = await Promise.all([
        getMyCards(),
        getMyTickets(0, 100),
        getMyPosters(0, 100),
      ])

      const tickets: TicketResponse[] = ticketsRes.success ? ticketsRes.data : []
      const posters: PosterResponse[] = postersRes.success ? postersRes.data : []
      const cards = cardsRes.success ? cardsRes.data : []

      setTotalCards(cards.length + tickets.length + posters.length)

      const deadlines: DeadlineCard[] = []

      for (const t of tickets) {
        const dDay = getDDay(t.departureDate)
        if (dDay >= 0 && dDay <= 30) {
          deadlines.push({
            id: t.id,
            title: `${t.departureLocation || '출발'} → ${t.arrivalLocation || '도착'}`,
            subtitle: t.transportType || '',
            type: 'TICKET',
            dDay,
            date: t.departureDate,
            imageUrl: getImageFromParsedJson(t.parsedJson) || t.imageUrl || '',
          })
        }
      }

      for (const p of posters) {
        const endDate = p.eventEndDate || p.eventStartDate
        const dDay = getDDay(endDate)
        if (dDay >= 0 && dDay <= 30) {
          deadlines.push({
            id: p.id,
            title: p.title || '이벤트',
            type: 'POSTER',
            dDay,
            date: endDate,
            imageUrl: getImageFromParsedJson(p.parsedJson) || p.imageUrl || '',
          })
        }
      }

      deadlines.sort((a, b) => a.dDay - b.dDay)
      setDeadlineCards(deadlines)

      const todayStr = new Date().toISOString().split('T')[0]
      const todaySchedules = [
        ...tickets.filter(t => t.departureDate === todayStr),
        ...posters.filter(p => p.eventStartDate === todayStr || p.eventEndDate === todayStr),
      ]
      setTodayCount(todaySchedules.length)
      buildScheduleForDate(todayStr, tickets, posters)
      setIsLoading(false)
    }

    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function updateSchedule() {
      const [ticketsRes, postersRes] = await Promise.all([
        getMyTickets(0, 100),
        getMyPosters(0, 100),
      ])
      const tickets: TicketResponse[] = ticketsRes.success ? ticketsRes.data : []
      const posters: PosterResponse[] = postersRes.success ? postersRes.data : []
      buildScheduleForDate(selectedDateKey, tickets, posters)
    }
    if (!isLoading) updateSchedule()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateKey])

  function buildScheduleForDate(dateStr: string, tickets: TicketResponse[], posters: PosterResponse[]) {
    const items: ScheduleItem[] = []
    for (const t of tickets) {
      if (t.departureDate === dateStr) {
        items.push({
          id: t.id,
          title: `${t.departureLocation || '출발'} → ${t.arrivalLocation || '도착'}`,
          type: 'TICKET',
          time: t.departureTime || '',
          date: t.departureDate,
        })
      }
    }
    for (const p of posters) {
      if (p.eventStartDate === dateStr || p.eventEndDate === dateStr) {
        items.push({ id: p.id, title: p.title || '이벤트', type: 'POSTER', time: '', date: dateStr })
      }
    }
    items.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
    setScheduleItems(items)
  }

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const days: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }, [currentYear, currentMonth])

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1) }
    else setCurrentMonth(currentMonth - 1)
  }
  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1) }
    else setCurrentMonth(currentMonth + 1)
  }

  const isToday = (day: number) =>
    day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* ── 오늘의 MORA 배너 (피그마) ── */}
      <section style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
        borderRadius: 16, overflow: 'hidden', marginBottom: 32,
        border: '1px solid #CBD5E1',
      }}>
        {/* 왼쪽: 날짜 */}
        <div style={{
          background: '#15293D', padding: '28px 32px', color: '#FFF',
        }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>오늘의 MORA</p>
          <p style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{formatToday()}</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>일상의 요약된 정보를 확인하세요</p>
        </div>
        {/* 오늘 일정 */}
        <div style={{
          background: 'linear-gradient(180deg, #F0F9FF, #FFFFFF)',
          padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#E8F4FD', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, fontSize: 20, color: '#0077B6' }}>📅</div>
          <p style={{ fontSize: 13, color: '#505050' }}>오늘 일정</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: '#15293D' }}>
            {isLoading ? '-' : todayCount} <span style={{ fontSize: 14, fontWeight: 400 }}>건</span>
          </p>
          <p style={{ fontSize: 11, color: '#999' }}>예정된 일정</p>
        </div>
        {/* 마감 임박 */}
        <div style={{
          background: 'linear-gradient(180deg, #FFF7ED, #FFFFFF)',
          padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FEF3E2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, fontSize: 20, color: '#DC8540' }}>⏰</div>
          <p style={{ fontSize: 13, color: '#505050' }}>마감 임박</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: '#15293D' }}>
            {isLoading ? '-' : deadlineCards.length} <span style={{ fontSize: 14, fontWeight: 400 }}>건</span>
          </p>
          <p style={{ fontSize: 11, color: '#999' }}>30일 이내 마감</p>
        </div>
        {/* 보관 문서 */}
        <div style={{
          background: 'linear-gradient(180deg, #F0FDF4, #FFFFFF)',
          padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, fontSize: 20, color: '#4FB048' }}>📄</div>
          <p style={{ fontSize: 13, color: '#505050' }}>보관 문서</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: '#15293D' }}>
            {isLoading ? '-' : totalCards} <span style={{ fontSize: 14, fontWeight: 400 }}>건</span>
          </p>
          <p style={{ fontSize: 11, color: '#999' }}>전체 저장 문서</p>
        </div>
      </section>

      {/* ── 마감 임박 (이미지 포함 카드) ── */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#15293D' }}>마감 임박</h2>
          {!isLoading && deadlineCards.length > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: '#FEF3E2', color: '#DC8540',
            }}>
              {deadlineCards.length}건
            </span>
          )}
        </div>

        {isLoading ? (
          <p style={{ fontSize: 14, color: '#999' }}>불러오는 중...</p>
        ) : deadlineCards.length === 0 ? (
          <div style={{ padding: '32px', borderRadius: 12, border: '1px solid #CBD5E1', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#999' }}>30일 이내 마감되는 일정이 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
            {deadlineCards.map(card => {
              const typeInfo = TYPE_COLORS[card.type]
              const imgSrc = fullImageUrl(card.imageUrl)
              return (
                <div
                  key={card.id}
                  style={{
                    minWidth: 320, maxWidth: 360,
                    display: 'grid', gridTemplateColumns: '1fr 120px',
                    borderRadius: 12, border: '1px solid #CBD5E1',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    background: '#FFFFFF', flexShrink: 0, overflow: 'hidden',
                    cursor: 'pointer', transition: 'transform 0.15s',
                  }}
                >
                  {/* 텍스트 */}
                  <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: typeInfo.bg, color: typeInfo.color,
                      }}>
                        {typeInfo.label}
                      </span>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#111', marginTop: 10, lineHeight: 1.4 }}>
                        {card.title}
                      </p>
                      {card.subtitle && (
                        <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{card.subtitle}</p>
                      )}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <p style={{
                        fontSize: 13, fontWeight: 700,
                        color: card.dDay <= 3 ? '#DC8540' : '#0077B6',
                      }}>
                        {card.dDay === 0 ? 'D-DAY' : `D-${card.dDay}`}
                      </p>
                      <p style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                        {formatDateShort(card.date)}
                      </p>
                    </div>
                  </div>
                  {/* 이미지 */}
                  <div style={{
                    background: '#F1F5F9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={card.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <span style={{ fontSize: 32, color: '#CBD5E1' }}>
                        {card.type === 'TICKET' ? '🎫' : '📄'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── 캘린더 + 일정 ── */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#15293D', marginBottom: 14 }}>캘린더</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* 캘린더 */}
          <div style={{ borderRadius: 12, border: '1px solid #CBD5E1', padding: 24, background: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <button onClick={prevMonth} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: '#0077B6', padding: '4px 8px', fontWeight: 700 }}>‹</button>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#0077B6' }}>
                {currentYear} {currentMonth + 1}월
              </span>
              <button onClick={nextMonth} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: '#0077B6', padding: '4px 8px', fontWeight: 700 }}>›</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 8 }}>
              {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                <span key={d} style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>{d}</span>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {calendarDays.map((day, i) => (
                <button
                  key={i}
                  disabled={!day}
                  onClick={() => day && setSelectedDate(day)}
                  style={{
                    width: 36, height: 36, margin: '0 auto', borderRadius: '50%', border: 'none',
                    background: day && isToday(day) ? '#0077B6'
                      : day === selectedDate && !isToday(day) ? '#E8EDF3' : 'transparent',
                    color: day && isToday(day) ? '#FFF' : day ? '#333' : 'transparent',
                    fontSize: 13, fontWeight: day && isToday(day) ? 700 : 400,
                    cursor: day ? 'pointer' : 'default', transition: 'background 0.15s',
                  }}
                >
                  {day || ''}
                </button>
              ))}
            </div>
          </div>

          {/* 일정 목록 */}
          <div style={{ borderRadius: 12, border: '1px solid #CBD5E1', padding: 24, background: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#15293D' }}>
                  {currentYear}.{String(currentMonth + 1).padStart(2, '0')}.{String(selectedDate).padStart(2, '0')} 일정
                </h3>
                {scheduleItems.length > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                    background: '#E8F4FD', color: '#0077B6',
                  }}>
                    {scheduleItems.length}건
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {scheduleItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ fontSize: 14, color: '#999' }}>일정이 없습니다</p>
                </div>
              ) : (
                scheduleItems.map(item => {
                  const typeInfo = TYPE_COLORS[item.type]
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px', borderRadius: 10,
                        background: typeInfo.bg,
                      }}
                    >
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                        background: '#FFF', color: typeInfo.color, flexShrink: 0,
                      }}>
                        {typeInfo.label}
                      </span>
                      {item.time && (
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#333', flexShrink: 0 }}>
                          {item.time}
                        </span>
                      )}
                      <span style={{ fontSize: 13, color: '#333' }}>{item.title}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
