export type EntityFocusRequest = {
  type: 'airport' | 'flight' | 'shipment'
  id: string | number
  requestId: number
}
