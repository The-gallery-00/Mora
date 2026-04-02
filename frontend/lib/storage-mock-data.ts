import type { BaseItem, BusinessCard } from '@/types/storage'

export const mockBusinessCards: BusinessCard[] = [
  {
    id: 'card-1',
    type: 'card',
    title: '김도윤 명함',
    imageUrl:
      'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-03-20T09:30:00.000Z',
    company: 'Mora Labs',
    name: '김도윤',
    position: 'Product Designer',
    phone: '010-1234-5678',
    fax: '02-555-8888',
    email: 'doyoon@mora.ai',
  },
  {
    id: 'card-2',
    type: 'card',
    title: '이서연 명함',
    imageUrl:
      'https://images.unsplash.com/photo-1586717799252-bd134ad00e26?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-03-21T13:15:00.000Z',
    company: 'Mora Labs',
    name: '이서연',
    position: 'Frontend Engineer',
    phone: '010-9876-5432',
    email: 'seoyeon@mora.ai',
  },
  {
    id: 'card-3',
    type: 'card',
    title: '박준호 명함',
    imageUrl:
      'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-03-25T08:40:00.000Z',
    company: 'Mora Partners',
    name: '박준호',
    position: 'Sales Manager',
    phone: '010-5555-1122',
    fax: '02-444-0022',
    email: 'juno.park@morapartners.com',
  },
]

export const mockTickets: BaseItem[] = [
  {
    id: 'ticket-1',
    type: 'ticket',
    title: 'Seoul Design Summit 2026',
    imageUrl:
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-03-18T10:00:00.000Z',
  },
  {
    id: 'ticket-2',
    type: 'ticket',
    title: 'Tech Expo VIP Pass',
    imageUrl:
      'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-03-27T14:20:00.000Z',
  },
]

export const mockPosters: BaseItem[] = [
  {
    id: 'poster-1',
    type: 'poster',
    title: 'Spring Event Poster',
    imageUrl:
      'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-03-12T08:10:00.000Z',
  },
  {
    id: 'poster-2',
    type: 'poster',
    title: 'Brand Campaign Poster',
    imageUrl:
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-03-26T16:45:00.000Z',
  },
]

export const mockReceipts: BaseItem[] = [
  {
    id: 'receipt-1',
    type: 'receipt',
    title: '광고비 영수증',
    imageUrl:
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-03-17T05:00:00.000Z',
  },
  {
    id: 'receipt-2',
    type: 'receipt',
    title: '출장비 영수증',
    imageUrl:
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-03-29T12:00:00.000Z',
  },
]

