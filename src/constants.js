// Remote locations
 
export const URL_IMSDB = "https://www.imsdb.com/";
export const URL_IMSDB_ALL_SCRIPTS = URL_IMSDB + "all scripts/"

// Local directory paths

export const CACHE_DIR = "./cache/"
export const CACHE_SCRIPTS_DIR = CACHE_DIR + "raw-scripts/";
export const CACHE_METADATA_FILE = CACHE_DIR + "metadata.json";

// Movie annotation types

export const Annotation = {
    UNKNOWN: "UNKNOWN",
    META: "META",
    SCENE: "SCENE",
    NARRATIVE: "NARRATIVE",
    SPEECH: "SPEECH",
    SPEECH_CUE: "SPEECH CUE",
    CHARACTER: "CHARACTER"
};