"use client"

import React from "react"
import {
  FullscreenControl,
  Layer,
  Map as MapView,
  NavigationControl,
  Popup,
  Source,
  type LayerProps,
  type MapLayerMouseEvent,
  type MapRef,
} from "@vis.gl/react-maplibre"
import type { GeoJSONSource, LngLatBoundsLike } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { mapStyleUrl } from "@/lib/config"
import type { ParsedMap, ParsedMapPoint } from "./XmlMap"
import styles from "./XmlMap.module.css"

const SOURCE_ID = "souvenir-map-points"
const CLUSTER_LAYER_ID = "souvenir-map-clusters"
const CLUSTER_COUNT_LAYER_ID = "souvenir-map-cluster-count"
const POINT_LAYER_ID = "souvenir-map-points-layer"

const clusterLayer: LayerProps = {
  id: CLUSTER_LAYER_ID,
  type: "circle",
  source: SOURCE_ID,
  filter: ["has", "point_count"],
  paint: {
    "circle-color": ["step", ["get", "point_count"], "#8EAED8", 10, "#4A83BF", 30, "#0D6EB2"],
    "circle-radius": ["step", ["get", "point_count"], 17, 10, 21, 30, 25],
    "circle-stroke-width": 2,
    "circle-stroke-color": "rgba(255,255,255,0.9)",
  },
}

const clusterCountLayer: LayerProps = {
  id: CLUSTER_COUNT_LAYER_ID,
  type: "symbol",
  source: SOURCE_ID,
  filter: ["has", "point_count"],
  layout: {
    "text-field": ["get", "point_count_abbreviated"],
    "text-font": ["Noto Sans Regular"],
    "text-size": 12,
  },
  paint: { "text-color": "#ffffff" },
}

interface RankedGroup {
  key: string
  label: string
  value: number
}

function formatValue(value: number, unit: string): string {
  const compact = new Intl.NumberFormat("en", {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1_000 ? 1 : 2,
  }).format(value)
  if (!unit) return compact
  if (/^[\$£€¥]$/.test(unit)) return `${unit}${compact}`
  return `${compact} ${unit}`
}

function boundsFor(points: ParsedMapPoint[]): LngLatBoundsLike | null {
  if (points.length < 2) return null
  let west = points[0]!.lng
  let east = points[0]!.lng
  let south = points[0]!.lat
  let north = points[0]!.lat
  for (const point of points.slice(1)) {
    west = Math.min(west, point.lng)
    east = Math.max(east, point.lng)
    south = Math.min(south, point.lat)
    north = Math.max(north, point.lat)
  }
  return [[west, south], [east, north]]
}

function aggregate(points: ParsedMapPoint[]): RankedGroup[] {
  const byGroup = new Map<string, RankedGroup>()
  for (const point of points) {
    const current = byGroup.get(point.group)
    if (current) current.value += point.value
    else byGroup.set(point.group, { key: point.group, label: point.group, value: point.value })
  }
  return [...byGroup.values()].sort((a, b) => b.value - a.value)
}

function MapRail({
  data,
  visiblePoints,
  selectedPoint,
  onSelectGroup,
  onShowAll,
}: {
  data: ParsedMap
  visiblePoints: ParsedMapPoint[]
  selectedPoint: ParsedMapPoint | null
  onSelectGroup: (key: string) => void
  onShowAll: () => void
}) {
  const allVisible = visiblePoints.length === data.points.length
  const ranked = React.useMemo(() => {
    if (allVisible && data.groups.length > 0) {
      return [...data.groups].sort((a, b) => b.value - a.value)
    }
    return aggregate(visiblePoints)
  }, [allVisible, data.groups, visiblePoints])
  const shown = ranked.slice(0, 6)
  const maxValue = Math.max(...shown.map((group) => group.value), 1)

  return (
    <aside className={styles.rail} aria-label={`${data.metric} ranking`}>
      <div className={styles.railHeader}>
        <div>
          <div className={styles.eyebrow}>{data.metric} by region</div>
          <div className={styles.visibleCount}>{visiblePoints.length} of {data.points.length} points visible</div>
        </div>
        {!allVisible && (
          <button type="button" className={styles.textButton} onClick={onShowAll}>Show all</button>
        )}
      </div>

      <div className={styles.ranking}>
        {shown.length === 0 ? (
          <p className={styles.emptyRail}>Move the map to bring data points into view.</p>
        ) : shown.map((group) => {
          const selected = selectedPoint?.group === group.key
          return (
            <button
              type="button"
              key={group.key}
              className={`${styles.rankRow} ${selected ? styles.rankRowSelected : ""}`}
              onClick={() => onSelectGroup(group.key)}
            >
              <span className={styles.rankMeta}>
                <span className={styles.rankLabel} title={group.label}>{group.label}</span>
                <span className={styles.rankValue}>{formatValue(group.value, data.unit)}</span>
              </span>
              <span className={styles.barTrack} aria-hidden>
                <span className={styles.barFill} style={{ width: `${Math.max(4, (group.value / maxValue) * 100)}%` }} />
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

export function XmlMapCanvas({ data }: { data: ParsedMap }) {
  const mapRef = React.useRef<MapRef>(null)
  const [visibleIds, setVisibleIds] = React.useState<Set<string>>(() => new Set(data.points.map((point) => point.id)))
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const selectedPoint = data.points.find((point) => point.id === selectedId) ?? null
  const visiblePoints = data.points.filter((point) => visibleIds.has(point.id))

  const valueMax = Math.max(...data.points.map((point) => point.value), 1)
  const pointLayer = React.useMemo<LayerProps>(() => ({
    id: POINT_LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": ["interpolate", ["linear"], ["get", "value"], 0, "#8EAED8", valueMax, "#0D6EB2"],
      "circle-radius": ["interpolate", ["linear"], ["get", "value"], 0, 6, valueMax, 17],
      "circle-opacity": 0.88,
      "circle-stroke-width": ["case", ["==", ["get", "id"], selectedId ?? ""], 3, 1.5],
      "circle-stroke-color": ["case", ["==", ["get", "id"], selectedId ?? ""], "#26211E", "#ffffff"],
    },
  }), [selectedId, valueMax])

  const geojson = React.useMemo(() => ({
    type: "FeatureCollection" as const,
    features: data.points.map((point) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
      properties: {
        id: point.id,
        label: point.label,
        group: point.group,
        value: point.value,
      },
    })),
  }), [data.points])

  const allBounds = React.useMemo(() => boundsFor(data.points), [data.points])
  const initialViewState = allBounds
    ? { bounds: allBounds, fitBoundsOptions: { padding: 42, maxZoom: 8 } }
    : { longitude: data.points[0]!.lng, latitude: data.points[0]!.lat, zoom: 7 }

  const updateVisiblePoints = React.useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const bounds = map.getBounds()
    setVisibleIds(new Set(data.points.filter((point) => bounds.contains([point.lng, point.lat])).map((point) => point.id)))
  }, [data.points])

  const showPoints = React.useCallback((points: ParsedMapPoint[]) => {
    const map = mapRef.current
    if (!map || points.length === 0) return
    const bounds = boundsFor(points)
    if (bounds) map.fitBounds(bounds, { padding: 64, maxZoom: 9, duration: 700 })
    else map.flyTo({ center: [points[0]!.lng, points[0]!.lat], zoom: 8, duration: 700 })
  }, [])

  const onClick = React.useCallback(async (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0]
    if (!feature) return

    if (feature.layer.id === CLUSTER_LAYER_ID) {
      const clusterId = Number(feature.properties?.cluster_id)
      const source = mapRef.current?.getSource(SOURCE_ID) as GeoJSONSource | undefined
      const coordinates = feature.geometry.type === "Point" ? feature.geometry.coordinates : null
      if (!source || !coordinates || !Number.isFinite(clusterId)) return
      const zoom = await source.getClusterExpansionZoom(clusterId)
      mapRef.current?.easeTo({ center: coordinates as [number, number], zoom, duration: 450 })
      return
    }

    const id = String(feature.properties?.id ?? "")
    setSelectedId(id || null)
  }, [])

  return (
    <section className={styles.card} aria-label={data.title}>
      <header className={styles.cardHeader}>
        <div>
          <h3 className={styles.title}>{data.title}</h3>
          <p className={styles.subtitle}>Pan, zoom, or select a region to explore this snapshot.</p>
        </div>
        <span className={styles.pointBadge}>{data.points.length} locations</span>
      </header>

      <div className={styles.layout}>
        <div className={styles.mapPane} role="application" aria-label={`Interactive map of ${data.title}`}>
          <MapView
            ref={mapRef}
            initialViewState={initialViewState}
            mapStyle={mapStyleUrl}
            attributionControl={{ compact: true }}
            interactiveLayerIds={[CLUSTER_LAYER_ID, POINT_LAYER_ID]}
            onClick={onClick}
            onLoad={updateVisiblePoints}
            onMoveEnd={updateVisiblePoints}
            onMouseEnter={(event) => { event.target.getCanvas().style.cursor = "pointer" }}
            onMouseLeave={(event) => { event.target.getCanvas().style.cursor = "" }}
            reuseMaps
            style={{ width: "100%", height: "100%" }}
          >
            <NavigationControl position="top-left" showCompass={false} />
            <FullscreenControl position="top-right" />
            <Source id={SOURCE_ID} type="geojson" data={geojson} cluster clusterMaxZoom={13} clusterRadius={46}>
              <Layer {...clusterLayer} />
              <Layer {...clusterCountLayer} />
              <Layer {...pointLayer} />
            </Source>
            {selectedPoint && (
              <Popup
                longitude={selectedPoint.lng}
                latitude={selectedPoint.lat}
                offset={14}
                closeButton={false}
                closeOnClick={false}
                onClose={() => setSelectedId(null)}
                anchor="bottom"
              >
                <div className={styles.popup}>
                  <strong>{selectedPoint.label}</strong>
                  <span>{data.metric}: {formatValue(selectedPoint.value, data.unit)}</span>
                </div>
              </Popup>
            )}
          </MapView>
        </div>

        <MapRail
          data={data}
          visiblePoints={visiblePoints}
          selectedPoint={selectedPoint}
          onSelectGroup={(key) => {
            const points = data.points.filter((point) => point.group === key || point.code === key)
            setSelectedId(points[0]?.id ?? null)
            showPoints(points)
          }}
          onShowAll={() => showPoints(data.points)}
        />
      </div>
    </section>
  )
}
