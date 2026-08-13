import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { icon, type Marker as LeafletMarker } from 'leaflet'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'
import type {
  GeographicBounds,
  GeographicSearchItem,
  SubwayStation,
} from '../lib/auction-extra'
import { formatMoney } from '../lib/format'

const DEFAULT_CENTER: [number, number] = [36.35, 127.8]

const defaultMarkerIcon = icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

type Point = {
  latitude: number
  longitude: number
}

type AuctionMapProps = {
  items: GeographicSearchItem[]
  selectedGoodsId?: number | null
  station?: SubwayStation | null
  radiusM?: number
  onBoundsChange?: (bounds: GeographicBounds) => void
  onSelectGoods?: (auctionGoodsId: number) => void
  className?: string
}

function hasCoordinates(item: GeographicSearchItem): item is GeographicSearchItem & Point {
  return (
    typeof item.latitude === 'number' && Number.isFinite(item.latitude) &&
    typeof item.longitude === 'number' && Number.isFinite(item.longitude)
  )
}

function readBounds(map: ReturnType<typeof useMap>): GeographicBounds {
  const bounds = map.getBounds()
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  }
}

function ViewportObserver({ onBoundsChange }: { onBoundsChange: (bounds: GeographicBounds) => void }) {
  const map = useMapEvents({
    moveend: () => onBoundsChange(readBounds(map)),
    zoomend: () => onBoundsChange(readBounds(map)),
  })

  useEffect(() => {
    onBoundsChange(readBounds(map))
  }, [map, onBoundsChange])

  return null
}

function FocusMap({
  point,
  zoom,
  focusKey,
}: {
  point: Point | null
  zoom: number
  focusKey: string | null
}) {
  const map = useMap()
  const lastAppliedFocusKey = useRef<string | null>(null)

  useEffect(() => {
    if (!focusKey) {
      lastAppliedFocusKey.current = null
      return
    }
    if (!point || lastAppliedFocusKey.current === focusKey) {
      return
    }
    lastAppliedFocusKey.current = focusKey
    map.flyTo([point.latitude, point.longitude], zoom, { duration: 0.65 })
  }, [focusKey, map, point, zoom])

  return null
}

function AuctionMarker({
  item,
  selected,
  onSelect,
}: {
  item: GeographicSearchItem & Point
  selected: boolean
  onSelect?: (auctionGoodsId: number) => void
}) {
  const markerRef = useRef<LeafletMarker | null>(null)
  const address = item.printed_address || item.road_address || item.lot_number_address
  const price = item.current_lowest_sale_price ?? item.first_announcement_lowest_sale_price

  useEffect(() => {
    if (selected) {
      markerRef.current?.openPopup()
    }
  }, [selected])

  return (
    <Marker
      ref={markerRef}
      icon={defaultMarkerIcon}
      position={[item.latitude, item.longitude]}
      eventHandlers={{ click: () => onSelect?.(item.auction_goods_id) }}
    >
      <Popup minWidth={220}>
        <div className="space-y-2 text-sm">
          <div className="font-extrabold text-slate-900">
            {item.building_name || address || `물건 ${item.auction_goods_id}`}
          </div>
          <div className="text-xs leading-5 text-gray-600">{address || '주소 정보 없음'}</div>
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-2">
            <span className="font-extrabold text-blue-800">{formatMoney(price)}</span>
            <Link to={`/goods/${item.auction_goods_id}`} className="font-extrabold text-indigo-700 hover:underline">
              상세 보기
            </Link>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

export default function AuctionMap({
  items,
  selectedGoodsId = null,
  station = null,
  radiusM = 0,
  onBoundsChange,
  onSelectGoods,
  className = 'h-[560px]',
}: AuctionMapProps) {
  const mappedItems = useMemo(() => items.filter(hasCoordinates), [items])
  const selectedItem = mappedItems.find((item) => item.auction_goods_id === selectedGoodsId) ?? null
  const focusPoint = selectedGoodsId !== null
    ? selectedItem
      ? { latitude: selectedItem.latitude, longitude: selectedItem.longitude }
      : null
    : station
      ? { latitude: station.latitude, longitude: station.longitude }
      : null
  const focusKey = selectedGoodsId !== null
    ? `goods:${selectedGoodsId}`
    : station
      ? `station:${station.station_id}`
      : null

  return (
    <MapContainer
      center={station ? [station.latitude, station.longitude] : DEFAULT_CENTER}
      zoom={station ? 14 : 8}
      scrollWheelZoom
      className={`w-full bg-slate-100 ${className}`}
      style={{ height: '100%', minHeight: '520px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onBoundsChange && <ViewportObserver onBoundsChange={onBoundsChange} />}
      <FocusMap
        point={focusPoint}
        zoom={selectedGoodsId !== null ? 16 : 14}
        focusKey={focusKey}
      />

      {station && (
        <>
          <Marker icon={defaultMarkerIcon} position={[station.latitude, station.longitude]}>
            <Popup>
              <div className="font-extrabold text-slate-900">{station.name}</div>
              <div className="mt-1 text-xs text-gray-500">{station.lines.join(' · ') || station.city || '역 정보'}</div>
            </Popup>
          </Marker>
          {radiusM > 0 && (
            <Circle
              center={[station.latitude, station.longitude]}
              radius={radiusM}
              pathOptions={{ color: '#4f46e5', fillColor: '#6366f1', fillOpacity: 0.12, weight: 2 }}
            />
          )}
        </>
      )}

      {mappedItems.map((item) => (
        <AuctionMarker
          key={item.auction_goods_id}
          item={item}
          selected={item.auction_goods_id === selectedGoodsId}
          onSelect={onSelectGoods}
        />
      ))}
    </MapContainer>
  )
}
