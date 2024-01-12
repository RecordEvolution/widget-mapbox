import { html, css, LitElement } from 'lit'
import { property, state } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
// @ts-ignore
// import mapboxgl from 'https://cdn.skypack.dev/-/mapbox-gl@v2.15.0-iKfohePv9lgutCMNih0d/dist=es2020,mode=imports,min/optimized/mapbox-gl.js'
import mapboxgl from 'https://esm.run/mapbox-gl@3.0.1'
import * as GeoJSON from 'geojson'
import tinycolor from 'tinycolor2'
import { MapConfiguration } from './definition-schema.js'

type Dataseries = Exclude<MapConfiguration['dataseries'], undefined>[number]
type Point = Exclude<Dataseries['data'], undefined>[number]

export class WidgetMapbox extends LitElement {
    @property({ type: Object })
    inputData?: MapConfiguration
    @state()
    private map: any | undefined = undefined

    @state()
    private dataSets: Dataseries[] = []

    @state()
    dataSources: any = new Map()

    @state()
    colors: any = new Map()

    public version: string = 'versionplaceholder'
    private mapLoaded: boolean = false
    private resizeObserver: ResizeObserver
    private mapStyle?: string
    private imageList: string[] = []
    constructor() {
        super()
        this.resizeObserver = new ResizeObserver(() => {
            this.map?.resize()
            this.fitBounds()
        })
        mapboxgl.accessToken =
            'pk.eyJ1IjoibWFya29wZSIsImEiOiJjazc1OWlsNjkwN2pyM2VxajV1eGRnYzgwIn0.3lVksk1nej_0KnWjCkBDAA'
    }

    update(changedProperties: Map<string, any>) {
        if (changedProperties.has('inputData')) {
            this.transformInputData()
        }
        super.update(changedProperties)
    }

    firstUpdated() {
        this.transformInputData()
        this.createMap()
        this.resizeObserver.observe(this.map._container)
        this.fitBounds()
    }

    fitBounds() {
        const bounds = new mapboxgl.LngLatBounds()
        this.dataSources.forEach((col: GeoJSON.FeatureCollection) => {
            col.features.forEach((f) => {
                // @ts-ignore
                if (f.geometry.coordinates?.length) bounds.extend(f.geometry.coordinates)
            })
        })
        if (bounds.isEmpty()) {
            bounds.extend([8.6820917, 50.1106444]) // Frankfurt
        }
        this.map.fitBounds(bounds, { maxZoom: 14, padding: 16, duration: 100 })
    }

    transformInputData() {
        if (!this?.inputData?.settings || !this?.inputData?.dataseries?.length) return

        if (this.map && this.inputData.settings.style !== this.mapStyle) {
            this.createMap()
        }

        // choose random color if dataseries has none and store it for furure updates
        this.inputData.dataseries.forEach((ds) => {
            if (!this.colors.has(ds.label)) {
                ds.color = ds.color ?? tinycolor.random().toString()
                this.colors.set(ds.label, ds.color)
            }
        })
        // console.log('The input data', this.inputData.dataseries[0], this.inputData.dataseries[1])
        // Pivot data if required
        this.dataSets = []
        this.inputData.dataseries.forEach((ds) => {
            const color = this.colors.get(ds.label)
            const distincts = [...new Set(ds.data?.map((d: Point) => d.pivot))].sort()
            const derivedColors = tinycolor(color)
                .monochromatic(distincts.length)
                .map((c: any) => c.toHexString())

            distincts.forEach((piv, i) => {
                const prefix = piv ? `${piv} - ` : ''
                const pds: any = {
                    label: prefix + ds.label ?? '',
                    order: ds.order,
                    type: ds.type,
                    latestValues: ds.latestValues,
                    color: derivedColors[i],
                    config: ds.config,
                    data: distincts.length === 1 ? ds.data : ds.data?.filter((d) => d.pivot === piv)
                }
                this.dataSets.push(pds)
            })
        })

        this.inputData.dataseries = []

        // Filter for latest Values
        this.dataSets.forEach((ds) => {
            if (ds?.latestValues && ds?.latestValues > 0) ds.data = ds.data?.splice(-ds.latestValues)
        })

        // console.log('mapbox datasets', this.dataSets)

        // create geojson sources
        this.dataSets
            // .sort((a, b) => b.order - a.order)
            .forEach((ds) => {
                this.dataSources.set('input:' + ds.label, {
                    type: 'FeatureCollection',
                    features: this.createGEOJson(ds)
                } as GeoJSON.FeatureCollection)

                // console.log('mapbox DataLayers', this.dataSources)
            })
        if (this.map) this.syncDataLayers()
    }

    createGEOJson(ds: Dataseries): GeoJSON.Feature[] | undefined {
        ds.data?.forEach((p) => {
            p = {
                lon: Number(p.lon),
                lat: Number(p.lat),
                alt: Number(p.alt),
                value: Number(p.value),
                pivot: p.pivot
            }
        })
        if (ds.type !== 'line') {
            const features: GeoJSON.Feature[] | undefined = ds.data
                ?.filter(
                    (p) =>
                        p.lon != null &&
                        p.lat != null &&
                        p.value != null &&
                        typeof p.lon === 'number' &&
                        typeof p.lat === 'number' &&
                        typeof p.value === 'number'
                )
                .map((p) => {
                    const point: GeoJSON.Feature = {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            // @ts-ignore
                            coordinates: [p.lon, p.lat]
                        },
                        properties: {
                            value: p.value ? Math.round(p.value) : undefined
                        }
                    }
                    return point
                })
            return features
        }

        const line: number[][] | undefined = ds?.data
            ?.reverse()
            ?.filter((p) => p.lon !== undefined && p.lat !== undefined)
            ?.map((p) => [p.lon, p.lat, p?.alt]) as number[][]

        const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: line
            },
            properties: {}
        }
        return [feature]
    }

    addCircleLayer(dataSet: Dataseries) {
        if (!dataSet) return
        const layerConfig = {
            id: dataSet.label + ':circle',
            type: 'circle',
            source: 'input:' + dataSet.label,
            paint: {
                'circle-blur': dataSet.config?.['circle']?.['circle-blur'] ?? 0,
                'circle-opacity': dataSet.config?.['circle']?.['circle-opacity'] ?? 1,
                'circle-radius': ['get', 'value'],
                'circle-radius-transition': {
                    duration: 1000,
                    delay: 0
                },
                'circle-color': dataSet.color
            }
            // Place polygons under labels, roads and buildings.
            // 'aeroway-polygon'
        }

        this.map?.addLayer(layerConfig)

        if (!dataSet.config?.['symbol']) return
        const layerConfig2 = {
            id: dataSet.label + ':symbol',
            type: 'symbol',
            source: 'input:' + dataSet.label,
            layout: {
                'text-field': ['get', 'value'],
                'text-size': dataSet.config['symbol']?.['text-size'] ?? 14,
                'text-anchor': 'center'
            },
            paint: {
                'text-color': dataSet.config['symbol']?.['text-color'] ?? '#000'
            }
            // Place polygons under labels, roads and buildings.
            // 'aeroway-polygon'
        }
        this.map?.addLayer(layerConfig2)
    }

    addSymbolLayer(dataSet: Dataseries) {
        if (!dataSet) return
        const layerConfig = {
            id: dataSet.label + ':symbol',
            type: 'symbol',
            source: 'input:' + dataSet.label,
            layout: {
                'text-field': ['get', 'value'],
                'text-size': dataSet.config?.['symbol']?.['text-size'] ?? 14,
                'text-anchor': 'center',
                'icon-image':
                    (dataSet.config?.symbol?.['icon-image'] ?? '') +
                    (dataSet.config?.symbol?.['icon-size'] ?? 1),
                'icon-size': 1
            },
            paint: {
                'text-color': dataSet.config?.['symbol']?.['text-color']
            }
            // Place polygons under labels, roads and buildings.
            // 'aeroway-polygon'
        }
        this.map?.addLayer(layerConfig)
    }

    addHeatmapLayer(dataSet: Dataseries) {
        if (!dataSet) return
        const values = (dataSet.data?.map((p) => p?.value).filter((v) => v !== undefined) as number[]) ?? []
        const min = Math.min(...values)
        const max = Math.max(...values)
        const layerConfig = {
            id: dataSet.label + ':heatmap',
            type: 'heatmap',
            source: 'input:' + dataSet.label,
            paint: {
                ...dataSet.config?.heatmap,
                'heatmap-color': [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    0,
                    'rgba(0, 0, 255, 0)',
                    0.1,
                    'royalblue',
                    0.3,
                    'cyan',
                    0.5,
                    'lime',
                    0.7,
                    'yellow',
                    1,
                    'tomato'
                ],
                // Increase the heatmap weight based on frequency and property magnitude
                'heatmap-weight': ['interpolate', ['linear'], ['get', 'value'], min, 0, max, 3],
                // // Increase the heatmap color weight weight by zoom level
                // // heatmap-intensity is a multiplier on top of heatmap-weight
                // 'heatmap-intensity': [
                //   'interpolate',
                //   ['linear'],
                //   ['zoom'],
                //   0, 1,
                //   9, 3
                //   ],
                // Adjust the heatmap radius by zoom level
                'heatmap-radius': [
                    'interpolate',
                    ['linear'],
                    ['get', 'value'],
                    min,
                    30,
                    max,
                    30 + (dataSet.config?.heatmap?.['heatmap-radius'] ?? 0)
                ],
                'heatmap-radius-transition': {
                    duration: 1000,
                    delay: 0
                }
                //   // Transition from heatmap to circle layer by zoom level
                //   'heatmap-opacity': [
                //   'interpolate',
                //   ['linear'],
                //   ['zoom'],
                //   7, 1,
                //   9, 0
                //   ]
            }
            // Place polygons under labels, roads and buildings.
            // 'aeroway-polygon'
        }
        this.map?.addLayer(layerConfig)
    }

    addLineLayer(dataSet: Dataseries) {
        if (!dataSet) return
        const layerConfig = {
            id: dataSet.label + ':line',
            type: 'line',
            source: 'input:' + dataSet.label,
            layout: {
                'line-cap': 'round'
            },
            paint: {
                ...dataSet.config?.line,
                'line-color': dataSet.color
            }
            // Place polygons under labels, roads and buildings.
            // 'aeroway-polygon'
        }
        this.map?.addLayer(layerConfig)

        if (!dataSet.config?.symbol?.['icon-image']) return

        const layerConfig2 = {
            id: dataSet.label + ':symbol',
            type: 'symbol',
            source: 'input:' + dataSet.label,
            layout: {
                'icon-image':
                    (dataSet.config?.symbol?.['icon-image'] ?? '') +
                    (dataSet.config?.symbol?.['icon-size'] ?? 1),
                'icon-size': 1
            },
            paint: {
                'icon-color': dataSet.color
            }
            // Place polygons under labels, roads and buildings.
            // 'aeroway-polygon'
        }
        this.map?.addLayer(layerConfig2)
    }

    syncDataLayers() {
        if (!this.mapLoaded) {
            console.log('Map not yet finished loading. Skipping syncDataLayers')
            return
        }
        // remove sources and all Layers that are not part of the inputData anymore
        const sources: any[] = this.map.getStyle().sources ?? []
        const mySources: [string, any][] = Object.entries(sources).filter(([l]) => l.startsWith('input:'))

        mySources.forEach(([label]) => {
            if (!this.dataSources.has(label)) {
                // remove all layers using this source
                this.map
                    .getStyle()
                    .layers.filter((la: any) => la.id === label + ':' + la.type)
                    .forEach((la: any) => {
                        this.map.removeLayer(la.id)
                    })
                this.map.removeSource(label)
            }
        })

        // add new layers or update the data of existing layers
        this.dataSets.forEach((ds: Dataseries) => {
            const sz = ds.config?.symbol?.['icon-size'] ?? 1
            const _imageName = ds.config?.symbol?.['icon-image'] ?? ''
            const imageName = _imageName + sz
            if (['line', 'symbol'].includes(ds.type ?? '') && !this.imageList.includes(imageName)) {
                const img = new Image(24 * sz, 24 * sz) as HTMLImageElement
                img.onload = () => this.map.addImage(imageName, img, { sdf: true })
                img.src = `/icons/${_imageName}.svg`
                this.imageList.push(imageName)
            }
            const fc = this.dataSources.get('input:' + ds.label)
            const src = this.map.getSource('input:' + ds.label)
            if (src) {
                src.setData(fc || [])
                return
            }
            // console.log('adding source', ds.label, ds.type)
            this.map?.addSource('input:' + ds.label, {
                type: 'geojson',
                data: fc || []
            })

            switch (ds.type) {
                case 'circle':
                    this.addCircleLayer(ds)
                    return
                case 'symbol':
                    this.addSymbolLayer(ds)
                    return
                case 'heatmap':
                    this.addHeatmapLayer(ds)
                    return
                case 'line':
                    this.addLineLayer(ds)
            }
        })
        if (this.inputData?.settings?.follow) this.fitBounds()
    }

    addBuildingLayer() {
        // Insert the layer beneath any symbol layer.
        const { layers } = this.map.getStyle()

        let labelLayerId: number = 0
        for (let i = 0; i < layers.length; i++) {
            if (layers[i].type === 'symbol' && layers[i].layout['text-field']) {
                labelLayerId = layers[i].id
                break
            }
        }

        this.map.addLayer(
            {
                id: '3d-buildings',
                source: 'composite',
                'source-layer': 'building',
                filter: ['==', 'extrude', 'true'],
                type: 'fill-extrusion',
                minzoom: 14,
                paint: {
                    'fill-extrusion-color': '#aaa',
                    // use an 'interpolate' expression to add a smooth transition effect to the
                    // buildings as the user zooms in
                    'fill-extrusion-height': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        14,
                        0,
                        14.05,
                        ['get', 'height']
                    ],
                    'fill-extrusion-base': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        14,
                        0,
                        14.05,
                        ['get', 'min_height']
                    ],
                    'fill-extrusion-opacity': 0.6
                }
            },
            labelLayerId
        )
    }

    createMap() {
        if (this.map) return
        this.mapStyle = this.inputData?.settings?.style
        this.map = new mapboxgl.Map({
            container: this.shadowRoot?.getElementById('map') as HTMLCanvasElement,
            style: `mapbox://styles/mapbox/${this.mapStyle ?? 'light-v11'}`,
            center: [8.68417, 50.11552],
            zoom: 1.8,
            attributionControl: false
        })

        this.map.scrollZoom.disable()

        this.map.addControl(new mapboxgl.NavigationControl(), 'top-right')

        const scale = new mapboxgl.ScaleControl({
            maxWidth: 80,
            unit: 'metric'
        })

        this.map.addControl(scale, 'bottom-left')

        console.log('MAPBOX VERSION', mapboxgl.version)

        this.map.on('load', () => {
            this.mapLoaded = true
            this.addBuildingLayer()
            this.syncDataLayers()
        })
    }

    static styles = css`
        :host {
            display: block;
            color: var(--re-bar-text-color, #000);
            font-family: sans-serif;
            padding: 16px;
            box-sizing: border-box;
            margin: auto;
        }

        .paging:not([active]) {
            display: none !important;
        }

        header {
            display: flex;
            margin: 0 0 16px 0;
            gap: 24px;
            justify-content: space-between;
        }
        h3 {
            margin: 0;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        p {
            margin: 10px 0 0 0;
            max-width: 300px;
            font-size: 14px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            line-height: 17px;
        }

        .wrapper {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
        }
        #map {
            flex: 1;
        }

        .title {
            white-space: nowrap;
        }

        .legend {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
        }

        .label {
            display: flex;
            align-items: center;
            font-size: 14px;
            gap: 8px;
        }

        a.mapboxgl-ctrl-logo {
            display: none;
        }
    `

    render() {
        return html`
            <link
                href="https://api.mapbox.com/mapbox-gl-js/v${mapboxgl.version}/mapbox-gl.css"
                rel="stylesheet"
            />
            <div class="wrapper">
                <header
                    class="paging"
                    ?active=${this.inputData?.settings?.title || this.inputData?.settings?.subTitle}
                >
                    <div class="title">
                        <h3 class="paging" ?active=${this.inputData?.settings?.title}>
                            ${this.inputData?.settings?.title}
                        </h3>
                        <p class="paging" ?active=${this.inputData?.settings?.subTitle}>
                            ${this.inputData?.settings?.subTitle}
                        </p>
                    </div>
                    <div class="legend paging" ?active=${this?.inputData?.settings?.showLegend}>
                        ${repeat(
                            this.dataSets,
                            (ds) => ds.label,
                            (ds) => {
                                return html`
                                    <div class="label">
                                        <div
                                            style="background: ${ds.color}; width: 24px; height: 12px;"
                                        ></div>
                                        <div>${ds.label}</div>
                                    </div>
                                `
                            }
                        )}
                    </div>
                </header>
                <div id="map"></div>
            </div>
        `
    }
}

window.customElements.define('widget-mapbox-versionplaceholder', WidgetMapbox)
