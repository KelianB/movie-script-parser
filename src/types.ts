export enum Annotation {
    UNKNOWN = "UNKNOWN",
    META = "META",
    SCENE = "SCENE",
    NARRATIVE = "NARRATIVE",
    SPEECH = "SPEECH",
    SPEECH_CUE = "SPEECH CUE",
    CHARACTER = "CHARACTER",
}

export type Entry = {content: string; annotation: Annotation; locked?: boolean};
