  
export interface Settings {
    title: string
    subTitle: string
}

export interface Point {
    coordinates: number[]
    size: number
    color: string
    title: string
    description: string
}

export interface InputData {
    settings?: Settings
    data?: Point[]
}
