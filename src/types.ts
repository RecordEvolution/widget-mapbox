  
export interface Settings {
    title: string
    subTitle: string
    style: string
    latestValues: number
}

export interface Point {
    lon: number
    lat: number
    size: number
    color: string
    pivot: string
}

export interface Dataseries {
    label: string
    type: string
    order: number
    data: Point[]
}

export interface InputData {
    settings?: Settings
    dataseries: Dataseries[]
}
