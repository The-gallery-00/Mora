export type ItemType = 'card' | 'ticket' | 'poster' | 'receipt'

export interface BaseItem {
  id: string
  type: ItemType
  title: string
  imageUrl: string
  createdAt: string
}

export interface BusinessCard extends BaseItem {
  type: 'card'
  company: string
  name: string
  position: string
  phone: string
  fax?: string
  email: string
}

