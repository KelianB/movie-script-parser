import {MovieCollection} from "../src/movie-metadata.js";

/**
 * A simple script to fetch movie metadata and scripts from IMSDb, for all movies available.
 * Data is saved in the cache directory.
 */
async function downloadAll() {
    // Load metadata from source
    let movieCollection = await MovieCollection.loadMetaFromSource();
   
    // Save metadata to cache
    movieCollection.saveMetaToCache();

    // Load all movie scripts from source
    let movies = movieCollection.getMovies();
    movieCollection.loadRawScriptsFromSource(movies, (loadedBatch) => {
        // Save batch to cache
        Object.keys(loadedBatch).forEach(tokenizedTitle => movieCollection.saveRawScriptToCache(tokenizedTitle));

        // Return true so the data is removed from memory by the MovieCollection class, so we don't fill up RAM.
        return true;
    });
}

downloadAll();