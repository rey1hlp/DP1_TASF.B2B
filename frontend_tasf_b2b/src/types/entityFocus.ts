export type EntityFocusRequest = {
  type: 'airport' | 'flight' | 'shipment' | 'bag'
  id: string | number
  requestId: number
}
