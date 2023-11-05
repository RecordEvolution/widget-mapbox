  
export interface Settings {
    title: string
    subTitle: string
}

export interface Point {
    label: string
    lon: number
    lat: number
    size: number
    color: string
    description: string
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
