'use client'

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { CircleHelp, RotateCcw, X } from 'lucide-react'
import { sendChatMessage, type ChatDocumentType } from '@/lib/api'

type ChatRole = 'assistant' | 'user'

type ChatMessage = {
  id: number
  role: ChatRole
  text: string
}

type DocumentType = '명함' | '티켓' | '포스터' | '영수증'

type Position = {
  x: number
  y: number
}

type HeaderAction = 'help' | 'reset' | 'close'

const HIDDEN_PATH_PREFIXES = ['/', '/login', '/signup']
const CHAT_HEADER_HEIGHT = 58
const MIN_VISIBLE_HEADER_MARGIN = 8
const TOP_BUTTON_SHOW_SCROLL_Y = 280
const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 0,
    role: 'assistant',
    text: '안녕하세요. MORA 챗봇 AI 모라냥입니다. 업로드, 검색, 일정 등록 관련해서 무엇이든 물어보세요.',
  },
]

const HELP_GUIDES = [
  '키워드만 입력하기보다 대화형 문장으로 질문해 주세요.',
  '저는 MORA의 문서 관리 기능(업로드, OCR, 보관함, 검색) 중심으로 안내해 드려요.',
  '실제 문서 인식 결과는 이미지 품질에 따라 달라질 수 있으니 저장 전 필드 값을 꼭 확인해 주세요.',
  '일정/연락처/금액 같은 중요 정보는 원본 이미지와 함께 최종 검토하는 것을 권장해요.',
  '입력한 대화 내용은 품질 개선과 오류 분석을 위해 서비스 정책에 따라 처리될 수 있어요.',
]

const DOCUMENT_TYPES: DocumentType[] = ['명함', '티켓', '포스터', '영수증']
const DOCUMENT_TYPE_VALUES: Record<DocumentType, ChatDocumentType> = {
  명함: 'BUSINESS_CARD',
  티켓: 'TICKET',
  포스터: 'POSTER',
  영수증: 'RECEIPT',
}
const DOCUMENT_TYPE_PLACEHOLDERS: Record<DocumentType, string> = {
  명함: '명함에서 찾고 싶은 내용을 입력하세요',
  티켓: '티켓에서 출발지나 날짜를 검색해보세요',
  포스터: '포스터에서 행사명이나 마감일을 검색해보세요',
  영수증: '영수증에서 가게명이나 금액을 검색해보세요',
}

function shouldHideWidget(pathname: string) {
  if (pathname === '/') {
    return true
  }

  return HIDDEN_PATH_PREFIXES
    .filter(prefix => prefix !== '/')
    .some(prefix => pathname.startsWith(prefix))
}

function readIsLoggedIn() {
  if (typeof window === 'undefined') {
    return false
  }

  return !!localStorage.getItem('mora_token')
}

function subscribeAuth(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener('mora-session-change', onStoreChange)
  window.addEventListener('pageshow', onStoreChange)
  window.addEventListener('focus', onStoreChange)

  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener('mora-session-change', onStoreChange)
    window.removeEventListener('pageshow', onStoreChange)
    window.removeEventListener('focus', onStoreChange)
  }
}

function clampPosition(x: number, y: number, panelWidth: number) {
  const margin = 12
  const maxX = Math.max(margin, window.innerWidth - panelWidth - margin)
  // Allow dragging down, but keep at least the title/header area visible.
  const maxY = Math.max(
    margin,
    window.innerHeight - CHAT_HEADER_HEIGHT - MIN_VISIBLE_HEADER_MARGIN,
  )

  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  }
}

export default function ChatbotWidget() {
  const pathname = usePathname()
  const isLoggedIn = useSyncExternalStore(subscribeAuth, readIsLoggedIn, () => false)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const draggingRef = useRef(false)
  const messageIdRef = useRef(1)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [hoveredAction, setHoveredAction] = useState<HeaderAction | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [input, setInput] = useState('')
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null)
  const [showTopButton, setShowTopButton] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const inputPlaceholder = selectedDocumentType
    ? DOCUMENT_TYPE_PLACEHOLDERS[selectedDocumentType]
    : '문서 유형을 먼저 선택하세요'

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isOpen || position) return

    const placePanel = () => {
      const panel = panelRef.current
      const width = panel?.offsetWidth ?? Math.min(368, window.innerWidth - 24)
      const height = panel?.offsetHeight ?? Math.min(580, window.innerHeight - 24)
      const targetX = window.innerWidth - width - 20
      const targetY = window.innerHeight - height - 94
      setPosition(clampPosition(targetX, targetY, width))
    }

    placePanel()
    window.requestAnimationFrame(placePanel)
  }, [isOpen, position])

  useEffect(() => {
    if (!isOpen) return

    const handleResize = () => {
      const panel = panelRef.current
      if (!panel || !position) return
      setPosition(clampPosition(position.x, position.y, panel.offsetWidth))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen, position])

  useEffect(() => {
    if (!isOpen) return
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [isOpen, isTyping, messages])

  useEffect(() => {
    const updateTopButton = () => {
      setShowTopButton(window.scrollY >= TOP_BUTTON_SHOW_SCROLL_Y)
    }

    updateTopButton()
    window.addEventListener('scroll', updateTopButton, { passive: true })

    return () => {
      window.removeEventListener('scroll', updateTopButton)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (!draggingRef.current) return
      const panel = panelRef.current
      if (!panel) return

      const nextX = event.clientX - dragOffsetRef.current.x
      const nextY = event.clientY - dragOffsetRef.current.y
      setPosition(clampPosition(nextX, nextY, panel.offsetWidth))
    }

    const handlePointerUp = () => {
      draggingRef.current = false
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isOpen])

  if (shouldHideWidget(pathname) || !isLoggedIn) {
    return null
  }

  function openPanel() {
    setIsOpen(true)
  }

  function closePanel() {
    setIsOpen(false)
    setIsHelpOpen(false)
    setIsResetConfirmOpen(false)
    setHoveredAction(null)
  }

  function resetConversation() {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    messageIdRef.current = 1
    setMessages(INITIAL_MESSAGES)
    setInput('')
    setSelectedDocumentType(null)
    setIsTyping(false)
    setIsResetConfirmOpen(false)
  }

  function startDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if (!panelRef.current) return

    const rect = panelRef.current.getBoundingClientRect()
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    draggingRef.current = true
    event.preventDefault()
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedDocumentType || isTyping) return

    const trimmed = input.trim()
    if (!trimmed) return
    const documentType = DOCUMENT_TYPE_VALUES[selectedDocumentType]

    const userMessage: ChatMessage = {
      id: messageIdRef.current++,
      role: 'user',
      text: trimmed,
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    const result = await sendChatMessage(trimmed, documentType)
    const botMessage: ChatMessage = {
      id: messageIdRef.current++,
      role: 'assistant',
      text: result.success
        ? result.data.answer || '관련 문서를 찾았지만 답변 내용이 비어 있어요.'
        : result.error,
    }

    setMessages(prev => [...prev, botMessage])
    setIsTyping(false)
  }

  function selectDocumentType(type: DocumentType) {
    setSelectedDocumentType(type)
  }

  const panelVisible = isOpen && !!position

  return (
    <>
      {!isOpen && (
        <div
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            zIndex: 1200,
          }}
        >
          <button
            type="button"
            onClick={openPanel}
            aria-label="MORA AI 챗봇 열기"
            style={{
              width: 64,
              height: 64,
              border: 'none',
              borderRadius: 0,
              padding: 0,
              overflow: 'visible',
              background: 'transparent',
              boxShadow: 'none',
              cursor: 'pointer',
            }}
          >
            <img
              src="/icons/chatbot_logo.svg"
              alt=""
              aria-hidden="true"
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 10px 20px rgba(15, 23, 42, 0.25))',
              }}
            />
          </button>
          {showTopButton && (
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label="페이지 맨 위로 이동"
              style={{
                width: 56,
                height: 56,
                border: 'none',
                borderRadius: '50%',
                background: '#64748B',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 800,
                boxShadow: '0 10px 20px rgba(15, 23, 42, 0.25)',
                cursor: 'pointer',
              }}
            >
              TOP
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            left: position?.x ?? 12,
            top: position?.y ?? 12,
            width: 'min(368px, calc(100vw - 24px))',
            height: 'min(580px, calc(100vh - 24px))',
            borderRadius: 20,
            border: '1px solid #CBD5E1',
            background: '#F8FAFC',
            boxShadow: '0 22px 40px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden',
            zIndex: 1201,
            opacity: panelVisible ? 1 : 0,
            transition: 'opacity 0.16s ease-out',
          }}
        >
          <div
            onPointerDown={startDragging}
            style={{
              height: 58,
              padding: '0 16px',
              background: '#15293D',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'grab',
              userSelect: 'none',
            }}
          >
            <strong style={{ fontSize: 20, fontWeight: 700 }}>AI 모라냥</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{ position: 'relative' }}
                onMouseEnter={() => setHoveredAction('help')}
                onMouseLeave={() => setHoveredAction(prev => (prev === 'help' ? null : prev))}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsResetConfirmOpen(false)
                    setIsHelpOpen(true)
                  }}
                  aria-label="도움말 열기"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#FFFFFF',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <CircleHelp size={17} />
                </button>
                {hoveredAction === 'help' && (
                  <span
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: 'calc(100% + 8px)',
                      transform: 'translateX(-50%)',
                      padding: '4px 8px',
                      borderRadius: 8,
                      background: '#0F172A',
                      color: '#FFFFFF',
                      fontSize: 11,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 8px 14px rgba(15, 23, 42, 0.35)',
                      pointerEvents: 'none',
                      zIndex: 6,
                    }}
                  >
                    도움말
                  </span>
                )}
              </div>
              <div
                style={{ position: 'relative' }}
                onMouseEnter={() => setHoveredAction('reset')}
                onMouseLeave={() => setHoveredAction(prev => (prev === 'reset' ? null : prev))}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsHelpOpen(false)
                    setIsResetConfirmOpen(true)
                  }}
                  aria-label="대화 내용 초기화"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#FFFFFF',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={16} />
                </button>
                {hoveredAction === 'reset' && (
                  <span
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: 'calc(100% + 8px)',
                      transform: 'translateX(-50%)',
                      padding: '4px 8px',
                      borderRadius: 8,
                      background: '#0F172A',
                      color: '#FFFFFF',
                      fontSize: 11,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 8px 14px rgba(15, 23, 42, 0.35)',
                      pointerEvents: 'none',
                      zIndex: 6,
                    }}
                  >
                    초기화
                  </span>
                )}
              </div>
              <div
                style={{ position: 'relative' }}
                onMouseEnter={() => setHoveredAction('close')}
                onMouseLeave={() => setHoveredAction(prev => (prev === 'close' ? null : prev))}
              >
                <button
                  type="button"
                  onClick={closePanel}
                  aria-label="챗봇 닫기"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#FFFFFF',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={18} />
                </button>
                {hoveredAction === 'close' && (
                  <span
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: 'calc(100% + 8px)',
                      transform: 'translateX(-50%)',
                      padding: '4px 8px',
                      borderRadius: 8,
                      background: '#0F172A',
                      color: '#FFFFFF',
                      fontSize: 11,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 8px 14px rgba(15, 23, 42, 0.35)',
                      pointerEvents: 'none',
                      zIndex: 6,
                    }}
                  >
                    창 닫기
                  </span>
                )}
              </div>
            </div>
          </div>

          <div
            ref={listRef}
            style={{
              height: 'calc(100% - 180px)',
              overflowY: 'auto',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: 'linear-gradient(180deg, #EFF6FF 0%, #F8FAFC 55%)',
            }}
          >
            {messages.map(message => {
              const isUser = message.role === 'user'
              return (
                <div
                  key={message.id}
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '84%',
                    position: 'relative',
                    paddingTop: isUser ? 0 : 6,
                  }}
                >
                  {!isUser && (
                    <>
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 18,
                          width: 12,
                          height: 12,
                          background: '#FFFFFF',
                          borderLeft: '1px solid #DBEAFE',
                          borderTop: '1px solid #DBEAFE',
                          transform: 'rotate(45deg)',
                          borderRadius: 2,
                        }}
                      />
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 18,
                          width: 12,
                          height: 12,
                          background: '#FFFFFF',
                          borderLeft: '1px solid #DBEAFE',
                          borderTop: '1px solid #DBEAFE',
                          transform: 'rotate(45deg)',
                          borderRadius: 2,
                        }}
                      />
                    </>
                  )}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: isUser ? '#1D4ED8' : '#FFFFFF',
                      color: isUser ? '#FFFFFF' : '#1E293B',
                      border: isUser ? 'none' : '1px solid #DBEAFE',
                      fontSize: 13,
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {message.text}
                  </div>
                </div>
              )
            })}
            {isTyping && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: '8px 12px',
                  borderRadius: '14px 14px 14px 4px',
                  background: '#FFFFFF',
                  border: '1px solid #DBEAFE',
                  color: '#64748B',
                  fontSize: 13,
                }}
              >
                답변 작성 중...
              </div>
            )}
          </div>
          <div
            style={{
              minHeight: 54,
              borderTop: '1px solid #DBEAFE',
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
            }}
          >
            <div
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 8,
              }}
            >
              {DOCUMENT_TYPES.map((type) => {
                const isSelected = selectedDocumentType === type
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => selectDocumentType(type)}
                    style={{
                      width: '100%',
                      height: 34,
                      padding: '0 10px',
                      borderRadius: 999,
                      border: `1px solid ${isSelected ? '#1E3A8A' : '#BFDBFE'}`,
                      background: isSelected ? '#1E3A8A' : '#EFF6FF',
                      color: isSelected ? '#FFFFFF' : '#1E3A8A',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {type}
                  </button>
                )
              })}
            </div>
          </div>

          <form
            onSubmit={sendMessage}
            style={{
              height: 68,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              padding: '12px',
              borderTop: '1px solid #CBD5E1',
              background: '#FFFFFF',
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={inputPlaceholder}
              style={{
                flex: 1,
                height: 44,
                padding: '0 12px',
                borderRadius: 12,
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
                color: '#0F172A',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!selectedDocumentType || input.trim().length === 0 || isTyping}
              style={{
                width: 58,
                height: 44,
                border: 'none',
                borderRadius: 12,
                background: !selectedDocumentType || input.trim().length === 0 || isTyping ? '#94A3B8' : '#15293D',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                cursor: !selectedDocumentType || input.trim().length === 0 || isTyping ? 'not-allowed' : 'pointer',
                flexShrink: 0,
              }}
            >
              전송
            </button>
          </form>

          {(isHelpOpen || isResetConfirmOpen) && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(2, 6, 23, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                zIndex: 4,
              }}
            >
              {isHelpOpen && (
                <div
                  style={{
                    width: '100%',
                    maxWidth: 306,
                    borderRadius: 14,
                    background: '#FFFFFF',
                    boxShadow: '0 22px 30px rgba(15, 23, 42, 0.24)',
                    padding: '16px 14px',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      textAlign: 'center',
                      fontSize: 17,
                      fontWeight: 800,
                      color: '#1F2937',
                    }}
                  >
                    AI 모라냥 이용 안내
                  </h3>
                  <ul
                    style={{
                      margin: '12px 0 0',
                      padding: 0,
                      listStyle: 'none',
                      color: '#374151',
                      fontSize: 13,
                      lineHeight: 1.55,
                    }}
                  >
                    {HELP_GUIDES.map((guide) => (
                      <li
                        key={guide}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            display: 'inline-block',
                            width: 6,
                            height: 6,
                            marginTop: 7,
                            borderRadius: '50%',
                            background: '#1E3A8A',
                            flexShrink: 0,
                          }}
                        />
                        <span>{guide}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(false)}
                    style={{
                      marginTop: 14,
                      width: '100%',
                      height: 44,
                      border: 'none',
                      borderRadius: 12,
                      background: '#1E3A8A',
                      color: '#FFFFFF',
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    확인
                  </button>
                </div>
              )}

              {isResetConfirmOpen && (
                <div
                  style={{
                    width: '100%',
                    maxWidth: 320,
                    borderRadius: 16,
                    background: '#FFFFFF',
                    boxShadow: '0 22px 30px rgba(15, 23, 42, 0.24)',
                    padding: '18px 16px 16px',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      textAlign: 'center',
                      fontSize: 17,
                      fontWeight: 700,
                      color: '#1F2937',
                    }}
                  >
                    대화 내용 초기화
                  </h3>
                  <p
                    style={{
                      margin: '10px 0 0',
                      textAlign: 'center',
                      color: '#4B5563',
                      fontSize: 14,
                      lineHeight: 1.6,
                    }}
                  >
                    대화가 처음부터 다시 시작되며 이전 대화 내용은 복구할 수 없습니다. 초기화 하시겠습니까?
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={() => setIsResetConfirmOpen(false)}
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 12,
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        color: '#64748B',
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={resetConversation}
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 12,
                        border: 'none',
                        background: '#DC2626',
                        color: '#FFFFFF',
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      초기화
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
