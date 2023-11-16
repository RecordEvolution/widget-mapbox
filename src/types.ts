  
export interface Settings {
    title: string
    subTitle: string
    style: string
    showLegend: boolean
}

export interface Point {
    lon: number
    lat: number
    alt: number
    value: number
    pivot: string
}

export interface Dataseries {
    label: string
    type: string
    order: number
    latestValues: number
    config: any
    color: string
    data: Point[]
    // non inputs
    derivedColor: string
}

export interface InputData {
    settings?: Settings
    dataseries: Dataseries[]
}
