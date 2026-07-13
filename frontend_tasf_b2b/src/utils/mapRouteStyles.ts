import type L from 'leaflet'

export const MAP_PANES = {
  route: 'tasf-route-pane',
  cancelledRoute: 'tasf-cancelled-route-pane',
  airport: 'tasf-airport-pane',
  plane: 'tasf-plane-pane',
} as const

export const SELECTED_ROUTE_STYLE = {
  color: '#0dcaf0',
  weight: 3.5,
  dashArray: '8, 8',
  opacity: 0.95,
  pane: MAP_PANES.route,
} satisfies L.PolylineOptions

export const SHIPMENT_ROUTE_DONE_STYLE = {
  color: '#64748b',
  weight: 2.6,
  dashArray: '5, 7',
  opacity: 0.65,
  pane: MAP_PANES.route,
} satisfies L.PolylineOptions

export const SHIPMENT_ROUTE_ACTIVE_STYLE = {
  color: '#14b8a6',
  weight: 4.2,
  opacity: 1,
  pane: MAP_PANES.route,
} satisfies L.PolylineOptions

export const SHIPMENT_ROUTE_PENDING_STYLE = {
  color: '#0dcaf0',
  weight: 3,
  dashArray: '8, 8',
  opacity: 0.9,
  pane: MAP_PANES.route,
} satisfies L.PolylineOptions

export const LANDED_ROUTE_STYLE = {
  color: '#9ca3af',
  weight: 2.8,
  dashArray: '5, 8',
  opacity: 0.75,
  pane: MAP_PANES.route,
} satisfies L.PolylineOptions

export const GHOST_ROUTE_STYLE = {
  color: '#9ca3af',
  weight: 2,
  dashArray: '5, 8',
  opacity: 0.8,
  pane: MAP_PANES.route,
} satisfies L.PolylineOptions

export const GHOST_FADE_DURATION_MS = 4000

export const ALL_FLIGHTS_ROUTE_BASE_STYLE = {
  weight: 1.4,
  opacity: 0.38,
  dashArray: '3, 5',
  pane: MAP_PANES.route,
} satisfies Omit<L.PolylineOptions, 'color'>

export const CANCELLED_ROUTE_STYLE = {
  weight: 3,
  color: '#dc2626',
  opacity: 1,
  dashArray: '10, 8',
  lineCap: 'round',
  lineJoin: 'round',
  pane: MAP_PANES.cancelledRoute,
} satisfies L.PolylineOptions

export const VIRTUAL_CANCELLED_ROUTE_STYLE = {
  weight: 3,
  color: '#d97706',
  opacity: 1,
  dashArray: '4, 8',
  lineCap: 'round',
  lineJoin: 'round',
  pane: MAP_PANES.cancelledRoute,
} satisfies L.PolylineOptions
