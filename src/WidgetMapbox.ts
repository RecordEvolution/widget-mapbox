import { html, css, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';


declare global {
  interface InputData {
    settings: Settings
    data: Data[]
  }

  interface Settings {
    title: string,
    subTitle: string
  }

  interface Data {
    coordinates: number[]
    size: number,
    color: string,
    title: string,
    description: string
  }

}
export class WidgetMapbox extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      margin: 16px;
      color: var(--re-bar-text-color, #000);
      font-family: sans-serif;
    }
    #wrapper {
      width: 800px;
      height: 600px;
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

    #main {
      width: 100%;
      height: calc(100% - 64px);
    }

    .marker {
      cursor: pointer;
      border-radius: 50% 50% 50% 0;
      border: 2px solid #334d5c;
      width: 10px;
      height: 10px;
      transform: rotate(-45deg);
    }
    
    .marker::after {
      position: absolute;
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      top: 50%;
      left: 50%;
      margin-left: -3px;
      margin-top: -3px;
      background-color: #334d5c;
    }

  `;

  @property() inputData = {} as InputData

  @state()
  private map: any | undefined = undefined;
  @state()
  private geojson: any | undefined = undefined;
  @state()
  private mapTitle: string = 'Map-chart';
  @state()
  private mapDescription: string = 'This is a Map-chart from the RE-Dahsboard';


  render() {
    return html`
      <link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet">
      <div id="wrapper">
        <header>
            <h3>${this.mapTitle}</h3>
            <p>${this.mapDescription}</p>
        </header>
        <div id="main"></div>
      </div>
    `;
  }

  firstUpdated() {
    //@ts-ignore
    mapboxgl.accessToken = 'pk.eyJ1IjoibWFya29wZSIsImEiOiJjazc1OWlsNjkwN2pyM2VxajV1eGRnYzgwIn0.3lVksk1nej_0KnWjCkBDAA'

    this.getData()
    this.createMap()
    this.map.on('load',() => {
      this.map.resize()
    })
  
  }

  getData() {
    if(!this.inputData) return
    if(this.inputData && !this.inputData?.settings && !this.inputData?.data.length) return

    this.mapTitle = this.inputData?.settings?.title ? this.inputData.settings.title : this.mapTitle
    this.mapDescription = this.inputData?.settings?.subTitle ? this.inputData.settings.subTitle : this.mapDescription

    const geojson = this.inputData.data.map((d:Data) => {
      return {
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
    })
    this.geojson = {
      type: 'FeatureCollection',
      features: geojson
    };
  }

  createMap() {
    //@ts-ignore
    this.map = new mapboxgl.Map({
      container: this.shadowRoot?.querySelector('#main') as HTMLCanvasElement,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [8.6841700, 50.1155200],
      zoom: 1.8,
    });

    this.map.on('load', () => {
      // Add the vector tileset as a source.
      this.map.addSource('data', {
        type: 'geojson',
        data: this.geojson || []
      });
      this.map.addLayer(
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
        'aeroway-polygon'
      );
    });
  }

}
