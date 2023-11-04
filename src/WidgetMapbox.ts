import { html, css, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';
// @ts-ignore
import mapboxgl, { Map } from 'https://cdn.skypack.dev/pin/mapbox-gl@v2.15.0-iKfohePv9lgutCMNih0d/mode=imports,min/optimized/mapbox-gl.js'
// import mapboxgl, { Map } from 'mapbox-gl';
import * as GeoJSON from 'geojson';
import { InputData } from './types.js'

export class WidgetMapbox extends LitElement {

  @property({type: Object}) 
  inputData?: InputData = undefined

  @state()
  private map: Map | undefined = undefined;

  @state()
  private geojson: GeoJSON.FeatureCollection | undefined = undefined;

  @state()
  private mapTitle: string = 'Map-chart';

  @state()
  private mapDescription: string = 'This is a Map-chart from the RE-Dashboard';

  resizeObserver: ResizeObserver

  constructor() {
    super()
    this.resizeObserver = new ResizeObserver(() => {
        this.map?.resize()
        this.fitBounds()
    })
  }

  firstUpdated() {
    mapboxgl.accessToken = 'pk.eyJ1IjoibWFya29wZSIsImEiOiJjazc1OWlsNjkwN2pyM2VxajV1eGRnYzgwIn0.3lVksk1nej_0KnWjCkBDAA'

    this.getData()
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
    // @ts-ignore
    const coordinates: GeoJSON.Position[] = this.geojson?.features.map((f: GeoJSON.Feature) => f.geometry.coordinates )
    
    if (!coordinates?.length) return
    for (const coord of coordinates) {
      bounds.extend(coord);
    }
      this.map.fitBounds(bounds, { maxZoom: 14, padding: 100, duration: 100, });
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

  addDataLayer() {
    // Add the vector tileset as a source.
    if (!this.geojson) return
    this.map?.addSource('data', {
      type: 'geojson',
      data: this.geojson || []
    });
    this.map?.addLayer(
      {
        'id': 'population',
        'type': 'circle',
        'source': 'data',
        'paint': {
          'circle-radius':  ['get', 'size'],
          "circle-color": ['get', 'color'],
        }
      },
      // Place polygons under labels, roads and buildings.
      // 'aeroway-polygon'
    );
  }

  getData() {
    if(!this?.inputData?.settings || !this?.inputData?.data?.length) return

    this.mapTitle = this.inputData?.settings?.title ? this.inputData.settings.title : this.mapTitle
    this.mapDescription = this.inputData?.settings?.subTitle ? this.inputData.settings.subTitle : this.mapDescription

    const geojson: GeoJSON.Feature[] | undefined = this.inputData?.data?.map((d: any) => {
      const data: GeoJSON.Feature = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: d.coordinates            
          },
          properties: {
            size: d.size,
            color: d.color,
            title: d.title,
            description: d.description
          }
      }
      return data
    })
    if (geojson) {
      this.geojson = {
        type: 'FeatureCollection',
        features: geojson
      };
    }
  }

  createMap() {
    this.map = new mapboxgl.Map({
      container: this.shadowRoot?.getElementById('main') as HTMLCanvasElement,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [8.6841700, 50.1155200],
      zoom: 1.8,
    });

    this.map.on('load', () => {
      this.addBuildingLayer()
      this.addDataLayer()
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

    header {
      display: flex;
      flex-direction: column;
      margin: 0 0 16px 0;
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
    #main {
      flex: 1;
    }

  `;

  render() {
    return html`
      <link href="https://api.mapbox.com/mapbox-gl-js/v${mapboxgl.version}/mapbox-gl.css" rel="stylesheet">
      <div class="wrapper">
        <header>
            <h3>${this.mapTitle}</h3>
            <p>${this.mapDescription}</p>
        </header>
        <div id="main"></div>
      </div>
    `;
  }
}
