// Remote locations
 
export const URL_IMSDB = "https://www.imsdb.com/";
export const URL_IMSDB_ALL_SCRIPTS = URL_IMSDB + "all scripts/"

// Local directory & file paths

export const CACHE_DIR = "./cache/"
export const CACHE_SCRIPTS_DIR = CACHE_DIR + "raw-scripts/";
export const CACHE_METADATA_FILE = CACHE_DIR + "metadata.json";
export const OUTPUT_DIR = "./output/";

// Parameters for fetching data

// Number of parallel requests
export const BATCH_SIZE_FETCH_SCRIPTS = 5;
export const BATCH_SIZE_FETCH_METADATA = 5;


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