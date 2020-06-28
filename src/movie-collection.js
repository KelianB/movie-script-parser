/**
 * Responsible for operating on movie metadata and scripts, providing storage to cache and utility functions.
 * @module movie-collection 
 */

import {getMoviesList} from "./metadata-retriever.js"
import {fetchMovieScriptsInBatch} from "../src/movie-script-retriever.js";
import {CACHE_METADATA_FILE, CACHE_SCRIPTS_DIR} from "./constants.js"
import {writeFileSync, readFileSync} from "fs"
import stringSimilarity from "string-similarity"

/**
 * Handles storage and provides utility functions for {@link MovieMetadata} objects and raw movie scripts.
 * @class MovieCollection
 */
export class MovieCollection {
    /**
     * Initialize the collection.
     * @param {Array<MovieMetadata>} meta - An array of metadata objects 
     */
    constructor(meta) {
        this.meta = meta;
        this.rawScripts = {};
    }

    /**
     * Get meta information for all movies.
     * @return {Array<MovieMetadata>} meta information for all movies.
     */
    getMovies() {
        return Object.values(this.meta);
    }

    /**
     * Get meta information for a given movie.
     * @param {String} [tokenizedTitle] - A tokenized movie title.
     * @return {MovieMetadata} meta information for the given movie if it is available, else null.
     */
    getMetaInformation(tokenizedTitle) {
        return this.meta[tokenizedTitle] || null;
    }

    /**
     * Get a raw movie script from its title. The raw script needs to have been loaded before.
     * @param {String} tokenizedTitle - The tokenized title of a movie whose raw script has been loaded.
     * @return {String} the raw movie script associated with the given title, or null if there is no loaded script for this movie. 
     */
    getRawScript(tokenizedTitle) {
        return this.rawScripts[tokenizedTitle] ? this.rawScripts[tokenizedTitle] : null;
    }

    /**
     * Search movies by title and return the best match.
     * @param {String} titleSearchStr The search string.
     * @return {MovieMetadata} the movie whose title matches the search string best.
     */
    searchByTitle(titleSearchStr) {
        let titles = this.getMovies().map(m => m.title);
        let search = stringSimilarity.findBestMatch(titleSearchStr, titles);
        return this.getMovies()[search.bestMatchIndex];
    }

    /**
     * Save all meta information to the cache file.
     */
    saveMetaToCache() {
        // Convert all metadata objects to JSON
        let moviesJSON = this.getMovies().map(mm => mm.toJSON());
        // Write to file
        writeFileSync(CACHE_METADATA_FILE, JSON.stringify(moviesJSON));
    }

    /**
     * Save the raw script to cache for the given movie.
     * @param {String} tokenizedTitle - The tokenized title of a movie whose raw script has been loaded.
     */
    saveRawScriptToCache(tokenizedTitle) {
        let rawScript = this.getRawScript(tokenizedTitle); 
        if(rawScript)
            writeFileSync(CACHE_SCRIPTS_DIR + this.tokenizedTitle + ".txt", rawScript, "utf8");
        else
            console.log(`Cannot save raw script to cache for movie '${tokenizedTitle}': no raw script loaded.`);
    }

    /**
     * Loads the raw script of the given movie from cache.
     * @param {String} tokenizedTitle - The tokenized title of a movie.
     * @return {String} the raw movie script, or null if it doesn't exist in cache.
     */
    loadRawScriptFromCache(tokenizedTitle) {
        try {
            let rawScript = readFileSync(CACHE_SCRIPTS_DIR + tokenizedTitle + ".txt", "utf8").toString();
            this.rawScripts[tokenizedTitle] = rawScript;
            return rawScript;
        }
        catch(e) {
            console.error(`Cannot load the raw script for the movie ${tokenizedTitle} from cache:`);
            console.error(e);
        }
    }

    /**
     * Loads the raw script of the given movie from the IMSDb website.
     * @param {MovieMetadata} movie - The metadata object for a movie.
     * @return {String} the raw movie script, or null if it doesn't exist.
     */
    async loadRawScriptFromSource(movie) {
        await this.loadRawScriptsFromSource([movie]);
        return this.rawScripts[movie.tokenizedTitle];
    }
    
    /**
     * Loads the raw scripts of the given movies from the IMSDb website.
     * @param {Array<MovieMetadata>} movies - The metadata objects for one or more movies.
     * @param {function} [onBatchLoaded] - A callback executed whenever a batch of raw scripts has been loaded. If the callback returns true, the scripts are then unloaded from memory.
     */
    async loadRawScriptsFromSource(movies, onBatchLoaded) {
        onBatchLoaded = onBatchLoaded || (() => {});
        await fetchMovieScriptsInBatch(movies, loadedBatch => {
            for(let tokenizedTitle in loadedBatch)
                this.rawScripts[tokenizedTitle] = loadedBatch[tokenizedTitle];
            
            let unload = onBatchLoaded(loadedBatch) === true;
            if(unload) {
                for(let tokenizedTitle in loadedBatch)
                    delete this.rawScripts[tokenizedTitle];
            }
        });
    }
    

    /**
     * Creates a {@link MovieCollection} by loading all meta information from cache.
     * @return {MovieCollection}
     */
    static loadMetaFromCache() {
        let moviesJSON = JSON.parse(readFileSync(CACHE_METADATA_FILE));
        let meta = moviesJSON.map(obj => new MovieMetadata(obj));
        return new MovieCollection(meta);
    }

    /**
     * Creates a {@link MovieCollection} by loading all meta information from the IMSDb website.
     * @return {MovieCollection}
     */
    static async loadMetaFromSource() {
        // Fetch meta
        let meta = await getMoviesList(true);
        return new MovieCollection(meta);
    }
}