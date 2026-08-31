import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  AttributionControl,
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { divIcon, icon, latLng, latLngBounds, type Marker as LeafletMarker } from 'leaflet'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'
import {
  getGeographicSearchItemKey,
  type GeographicBounds,
  type GeographicSearchItem,
  type SubwayStation,
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

const stationMarkerIcon = divIcon({
  className: 'station-location-marker',
  html: '<span aria-hidden="true" style="display:flex;width:38px;height:38px;align-items:center;justify-content:center;border:3px solid white;border-radius:9999px;background:#4f46e5;color:white;font-size:13px;font-weight:900;box-shadow:0 5px 14px rgba(15,23,42,.3)">역</span>',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -22],
})

type Point = {
  latitude: number
  longitude: number
}

export type MapViewportTarget = {
  key: string
  bounds: GeographicBounds
  maxZoom?: number
  padding?: number
}

type AuctionMapProps = {
  items: GeographicSearchItem[]
  mode?: 'interactive' | 'station-radius-preview'
  selectedGoodsId?: number | null
  selectedItemKey?: string | null
  focusSelectedItem?: boolean
  station?: SubwayStation | null
  radiusM?: number
  viewportTarget?: MapViewportTarget | null
  viewportZoomSnap?: number
  onViewportTargetApplied?: (key: string) => void
  onBoundsChange?: (bounds: GeographicBounds) => void
  onUserBoundsChange?: (bounds: GeographicBounds) => void
  onSelectGoods?: (auctionGoodsId: number) => void
  onSelectItem?: (itemKey: string) => void
  className?: string
}

function FitViewportTarget({
  target,
  enabled,
  onApplied,
}: {
  target: MapViewportTarget | null
  enabled: boolean
  onApplied?: (key: string) => void
}) {
  const map = useMap()
  const lastAppliedKey = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !target || lastAppliedKey.current === target.key) return

    const { west, south, east, north } = target.bounds
    if (
      ![west, south, east, north].every(Number.isFinite) ||
      west >= east || south >= north
    ) {
      return
    }

    const appliedKey = target.key
    const targetBounds = latLngBounds([[south, west], [north, east]])
    const maxZoom = target.maxZoom ?? 12
    const padding = target.padding ?? 28

    map.stop()
    lastAppliedKey.current = appliedKey
    map.fitBounds(targetBounds, {
      animate: false,
      padding: [padding, padding],
      maxZoom,
    })
    onApplied?.(appliedKey)
  }, [enabled, map, onApplied, target])

  return null
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

function ViewportObserver({
  onBoundsChange,
  onUserBoundsChange,
}: {
  onBoundsChange: (bounds: GeographicBounds) => void
  onUserBoundsChange?: (bounds: GeographicBounds) => void
}) {
  const userInteractionPending = useRef(false)
  const userInteractionExpiry = useRef<number | null>(null)
  const clearUserInteractionExpiry = useCallback(() => {
    if (userInteractionExpiry.current !== null) {
      window.clearTimeout(userInteractionExpiry.current)
      userInteractionExpiry.current = null
    }
  }, [])
  const markUserInteraction = useCallback(() => {
    clearUserInteractionExpiry()
    userInteractionPending.current = true
  }, [clearUserInteractionExpiry])
  const markTransientUserInteraction = useCallback(() => {
    markUserInteraction()
    userInteractionExpiry.current = window.setTimeout(() => {
      userInteractionPending.current = false
      userInteractionExpiry.current = null
    }, 1_500)
  }, [markUserInteraction])
  const map = useMapEvents({
    dragstart: markUserInteraction,
    moveend: () => {
      const bounds = readBounds(map)
      onBoundsChange(bounds)
      if (userInteractionPending.current) {
        userInteractionPending.current = false
        clearUserInteractionExpiry()
        onUserBoundsChange?.(bounds)
      }
    },
  })

  useEffect(() => {
    onBoundsChange(readBounds(map))
  }, [map, onBoundsChange])

  useEffect(() => {
    const container = map.getContainer()
    const markFromZoomControl = (event: PointerEvent) => {
      if (
        event.shiftKey || (
          event.target instanceof Element &&
          event.target.closest('.leaflet-control-zoom-in, .leaflet-control-zoom-out')
        )
      ) {
        markTransientUserInteraction()
      }
    }
    const markFromKeyboard = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '-', '='].includes(event.key)) {
        markTransientUserInteraction()
      }
    }
    const markFromTouch = (event: TouchEvent) => {
      if (event.touches.length >= 2) markTransientUserInteraction()
    }

    container.addEventListener('wheel', markTransientUserInteraction, { capture: true, passive: true })
    container.addEventListener('dblclick', markTransientUserInteraction, true)
    container.addEventListener('pointerdown', markFromZoomControl, true)
    container.addEventListener('keydown', markFromKeyboard, true)
    container.addEventListener('touchstart', markFromTouch, { capture: true, passive: true })
    return () => {
      container.removeEventListener('wheel', markTransientUserInteraction, true)
      container.removeEventListener('dblclick', markTransientUserInteraction, true)
      container.removeEventListener('pointerdown', markFromZoomControl, true)
      container.removeEventListener('keydown', markFromKeyboard, true)
      container.removeEventListener('touchstart', markFromTouch, true)
      clearUserInteractionExpiry()
    }
  }, [clearUserInteractionExpiry, map, markTransientUserInteraction])

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

function FitStationRadius({
  station,
  radiusM,
  enabled,
}: {
  station: SubwayStation | null
  radiusM: number
  enabled: boolean
}) {
  const map = useMap()

  useEffect(() => {
    if (!station || !enabled) return
    const center = latLng(station.latitude, station.longitude)
    if (radiusM > 0) {
      map.stop()
      map.invalidateSize({ animate: false, pan: false })
      map.fitBounds(center.toBounds(radiusM * 2), {
        animate: false,
        maxZoom: 18,
        padding: [48, 48],
      })
      return
    }
    map.flyTo(center, 14, { duration: 0.5 })
  }, [enabled, map, radiusM, station])

  return null
}

function AuctionMarker({
  item,
  itemKey,
  selected,
  autoPanOnSelect,
  keyboardEnabled,
  onSelect,
}: {
  item: GeographicSearchItem & Point
  itemKey: string
  selected: boolean
  autoPanOnSelect: boolean
  keyboardEnabled: boolean
  onSelect?: (itemKey: string, auctionGoodsId: number) => void
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
      autoPanOnFocus={autoPanOnSelect}
      keyboard={keyboardEnabled}
      eventHandlers={{ click: () => onSelect?.(itemKey, item.auction_goods_id) }}
    >
      <Popup minWidth={220} autoPan={autoPanOnSelect}>
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
  mode = 'interactive',
  selectedGoodsId = null,
  selectedItemKey = null,
  focusSelectedItem = true,
  station = null,
  radiusM = 0,
  viewportTarget = null,
  viewportZoomSnap = 1,
  onViewportTargetApplied,
  onBoundsChange,
  onUserBoundsChange,
  onSelectGoods,
  onSelectItem,
  className = 'h-[560px]',
}: AuctionMapProps) {
  const isStationRadiusPreview = mode === 'station-radius-preview'
  const mappedItems = useMemo(() => items.filter(hasCoordinates), [items])
  const legacySelectedItem = selectedGoodsId === null
    ? null
    : mappedItems.find((item) => item.auction_goods_id === selectedGoodsId) ?? null
  const activeSelectedItemKey = selectedItemKey ?? (
    legacySelectedItem ? getGeographicSearchItemKey(legacySelectedItem) : null
  )
  const selectedItem = activeSelectedItemKey === null
    ? null
    : mappedItems.find((item) => getGeographicSearchItemKey(item) === activeSelectedItemKey) ?? null
  const focusPoint = selectedItem && focusSelectedItem && !isStationRadiusPreview
    ? { latitude: selectedItem.latitude, longitude: selectedItem.longitude }
    : null
  const focusKey = selectedItem && focusSelectedItem && !isStationRadiusPreview
    ? `item:${activeSelectedItemKey}`
    : null
  const handleSelect = (itemKey: string, auctionGoodsId: number) => {
    onSelectItem?.(itemKey)
    onSelectGoods?.(auctionGoodsId)
  }

  return (
    <div
      role="region"
      aria-label={station
        ? `${station.name} 역세권 지도`
        : isStationRadiusPreview ? '역세권 반경 미리보기 지도' : '경매물건 지도'}
      data-map-mode={mode}
    >
      <MapContainer
        center={station ? [station.latitude, station.longitude] : DEFAULT_CENTER}
        zoom={station ? 14 : 8}
        zoomSnap={viewportZoomSnap}
        zoomControl={!isStationRadiusPreview}
        scrollWheelZoom={!isStationRadiusPreview}
        doubleClickZoom={!isStationRadiusPreview}
        touchZoom={!isStationRadiusPreview}
        boxZoom={!isStationRadiusPreview}
        keyboard={!isStationRadiusPreview}
        dragging={!isStationRadiusPreview}
        attributionControl={false}
        className={`w-full bg-slate-100 ${className}`}
        style={{ minHeight: isStationRadiusPreview ? '420px' : '520px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AttributionControl prefix={false} />
        {onBoundsChange && (
          <ViewportObserver
            onBoundsChange={onBoundsChange}
            onUserBoundsChange={onUserBoundsChange}
          />
        )}
        <FitStationRadius
          station={station}
          radiusM={radiusM}
          enabled={isStationRadiusPreview || selectedItem === null}
        />
        <FitViewportTarget
          target={viewportTarget}
          enabled={selectedItem === null && station === null}
          onApplied={onViewportTargetApplied}
        />
        <FocusMap
          point={focusPoint}
          zoom={16}
          focusKey={focusKey}
        />

        {station && (
          <>
            <Marker
              key={station.station_id}
              icon={stationMarkerIcon}
              position={[station.latitude, station.longitude]}
              zIndexOffset={1_000}
              title={`${station.name} 역 위치`}
              alt={`${station.name} 역 위치`}
              autoPanOnFocus={!isStationRadiusPreview}
              keyboard={!isStationRadiusPreview}
            >
              <Popup autoPan={!isStationRadiusPreview}>
                <div className="font-extrabold text-slate-900">{station.name}</div>
                <div className="mt-1 text-xs text-gray-500">{station.lines.join(' · ') || station.city || '역 정보'}</div>
              </Popup>
            </Marker>
            {radiusM > 0 && (
              <Circle
                key={`${station.station_id}:${radiusM}`}
                className="station-radius-circle"
                center={[station.latitude, station.longitude]}
                radius={radiusM}
                pathOptions={{ color: '#4f46e5', fillColor: '#6366f1', fillOpacity: 0.12, weight: 2 }}
              />
            )}
          </>
        )}

        {mappedItems.map((item) => {
          const itemKey = getGeographicSearchItemKey(item)
          return (
            <AuctionMarker
              key={itemKey}
              item={item}
              itemKey={itemKey}
              selected={itemKey === activeSelectedItemKey}
              autoPanOnSelect={focusSelectedItem && !isStationRadiusPreview}
              keyboardEnabled={!isStationRadiusPreview}
              onSelect={handleSelect}
            />
          )
        })}
      </MapContainer>
    </div>
  )
}
