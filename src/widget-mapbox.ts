import { html, css, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js'
// @ts-ignore
import mapboxgl from 'https://cdn.skypack.dev/pin/mapbox-gl@v2.15.0-iKfohePv9lgutCMNih0d/mode=imports,min/optimized/mapbox-gl.js'
// import mapboxgl, { Map } from 'mapbox-gl';
import * as GeoJSON from 'geojson';
// @ts-ignore
import tinycolor from "tinycolor2";
import { InputData, Dataseries, Point } from './types.js'

export class WidgetMapbox extends LitElement {

  @property({type: Object}) 
  inputData?: InputData = undefined

  @state()
  private map: any | undefined = undefined;

  @state()
  private mapTitle: string = 'Map-chart';

  @state()
  private mapDescription: string = 'This is a Map-chart for the RE-Dashboard';

  @state()
  private dataSets: Dataseries[] = []

  @state()
  dataLayers: any = new Map()

  @state()
  colors: any = new Map()

  resizeObserver: ResizeObserver
  constructor() {
    super()
    this.resizeObserver = new ResizeObserver(() => {
        this.map?.resize()
        this.fitBounds()
    })
    mapboxgl.accessToken = 'pk.eyJ1IjoibWFya29wZSIsImEiOiJjazc1OWlsNjkwN2pyM2VxajV1eGRnYzgwIn0.3lVksk1nej_0KnWjCkBDAA'
  }

  update(changedProperties: Map<string, any>) {
    changedProperties.forEach((oldValue, propName: string) => {
      if (propName === 'inputData') {
        this.applyInputData()
      }
    })
    super.update(changedProperties)
  }

  firstUpdated() {

    this.applyInputData()
    this.createMap()
    this.resizeObserver.observe(this.map._container)
    this.fitBounds()

    this.map.addControl(new mapboxgl.NavigationControl())
    const scale = new mapboxgl.ScaleControl({
        maxWidth: 80,
        unit: 'metric'
    })
    this.map.addControl(scale)

  }

  fitBounds() {
    const bounds = new mapboxgl.LngLatBounds()
    this.dataLayers.forEach((col: GeoJSON.FeatureCollection) => {
      col.features.forEach(f => {
        // @ts-ignore
        bounds.extend(f.geometry.coordinates)
      })
    })
    if (!bounds.isEmpty()) {
      this.map.fitBounds(bounds, { maxZoom: 14, padding: 100, duration: 100, })
    }
  }


  applyInputData() {
    if(!this?.inputData?.settings || !this?.inputData?.dataseries?.length) return

    this.mapTitle = this.inputData?.settings?.title
    this.mapDescription = this.inputData?.settings?.subTitle


    // choose random color if dataseries has none and store it
    this.inputData.dataseries.forEach(ds => {
      if (!this.colors.has(ds.label)) {
        this.colors.set(ds.label, ds.color ?? tinycolor.random().toString())
      }
    })

    // Pivot inputData if required
    this.dataSets = []
    this.inputData.dataseries.forEach(ds => {
      const color = this.colors.get(ds.label)
      const distincts = [...new Set(ds.data.map((d: Point) => d.pivot))]
      const derivedColors = tinycolor(color).monochromatic(distincts.length).map((c: any) => c.toHexString())
      if (distincts.length > 1) {
        const darker = 50 / (distincts.length + 0)
        distincts.forEach((piv, i) => {
          const pds: any = {
            label: `${ds.label} ${piv}`,
            order: ds.order,
            type: ds.type,
            color: derivedColors[i],
            latestValues: ds.latestValues,
            data: ds.data.filter(d => d.pivot === piv)
          }
          this.dataSets.push(pds)
        })
      } else {
        this.dataSets.push(ds)
      }
    })

    // Filter for latest Values
    this.dataSets.forEach(ds => {
      if (ds.latestValues > 0) ds.data = ds.data.splice(-ds.latestValues)
    })

    // console.log('mapbox datasets', this.dataSets)

    // Transform to geojson
    this.dataSets.sort((a, b) => b.order - a.order).forEach(ds => {

      const features: GeoJSON.Feature[] = ds.data
      .filter(p => p.lon !== undefined && p.lat !== undefined && p.size !== undefined)
      .map(p => {
        const point: GeoJSON.Feature = {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [p.lon, p.lat]
            },
            properties: {
              size: p.size,
              color: p.color ?? ds.color
            }
          }
        return point
      })

      this.dataLayers.set('input:' + ds.label, {
        type: 'FeatureCollection',
        features
      })

      if (this.map) this.syncDataLayers()
      // console.log('mapbox DataLayers', this.dataLayers)
    })
  }

  syncDataLayers() {
    
    // remove Layers that are not part of the inputData anymore
    const layers: any[] = this.map.getStyle().layers
    const myLayers: any[] = layers.filter((s: any) => s.id.startsWith('input:'))

    myLayers.forEach(l => {
      if (!this.dataLayers.has(l.id)){
        this.map.removeLayer(l.id)
        this.map.removeSource(l.id)
      }
    })

    // add new layers or update the data of existing layers 
    this.dataLayers.forEach((ds: GeoJSON.FeatureCollection, label: string) => {
      const src = this.map.getSource(label)
      if (src) {
        src.setData(ds || [])
      } else {
        this.map?.addSource(label, {
          type: 'geojson',
          data: ds || []
        });

        this.map?.addLayer(
          {
            'id': label,
            'type': 'circle',
            'source': label,
            'paint': {
              'circle-radius': ['get', 'size'],
              "circle-color": ['get', 'color'],
            }
          },
          // Place polygons under labels, roads and buildings.
          // 'aeroway-polygon'
        )
      }
    })
  }

  addBuildingLayer() {
    // Insert the layer beneath any symbol layer.
    const {layers} = this.map.getStyle()

    let labelLayerId: number = 0
    for (let i = 0; i < layers.length; i++) {
        if (layers[i].type === 'symbol' && layers[i].layout['text-field']) {
            labelLayerId = layers[i].id
            break
        }
    }

    this.map.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 14,
        'paint': {
            'fill-extrusion-color': '#aaa',
            // use an 'interpolate' expression to add a smooth transition effect to the
            // buildings as the user zooms in
            'fill-extrusion-height': [
                "interpolate", ["linear"],
                ["zoom"],
                14, 0,
                14.05, ["get", "height"]
            ],
            'fill-extrusion-base': [
                "interpolate", ["linear"],
                ["zoom"],
                14, 0,
                14.05, ["get", "min_height"]
            ],
            'fill-extrusion-opacity': .6
        }
    }, labelLayerId)
  }

  createMap() {
    this.map = new mapboxgl.Map({
      container: this.shadowRoot?.getElementById('map') as HTMLCanvasElement,
      style: `mapbox://styles/mapbox/${this.inputData?.settings?.style ?? 'light-v11'}`,
      center: [8.6841700, 50.1155200],
      zoom: 1.8,
    });

    this.map.on('load', () => {
      this.addBuildingLayer()
      this.syncDataLayers()
    });
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

    .paging:not([active]) { display: none !important; }

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
      align-items: end;
      font-size: 14px;
      gap: 8px
    }

  `;

  render() {
    return html`
      <link href="https://api.mapbox.com/mapbox-gl-js/v${mapboxgl.version}/mapbox-gl.css" rel="stylesheet">
      <div class="wrapper">
        <header>
            <div class="title">
              <h3>${this.mapTitle}</h3>
              <p>${this.mapDescription}</p>
            </div>
            <div class="legend paging" ?active=${this?.inputData?.settings?.showLegend}>
              ${repeat(this.dataSets, ds => ds.label, ds => html`
              <div class="label">
                <div style="background: ${ds.color}; width: 24px; height: 12px;"></div>
                <div>${ds.label}</div>
              </div>
              `)}
            </div>
        </header>
        <div id="map"></div>
      </div>
    `;
  }
}

window.customElements.define('widget-mapbox', WidgetMapbox);
