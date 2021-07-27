/**
 * Responsible for operating on movie metadata and scripts, providing storage to cache and utility functions.
 * @module movie-collection
 */

import {getMoviesList} from "./metadata-retriever";
import {fetchMovieScriptsInBatch} from "./movie-script-retriever";
import {MovieMetadata} from "./movie-metadata";
import {CACHE_METADATA_FILE, CACHE_SCRIPTS_DIR} from "./constants";
import {promises as fsPromises} from "fs";
import stringSimilarity from "string-similarity";
import path from "path";

/**
 * Handles storage and provides utility functions for {@link MovieMetadata} objects and raw movie scripts.
 */
export class MovieCollection {
    meta: MovieMetadata[];
    private rawScripts: {[key: string]: string};

    /**
     * Initialize the collection.
     * @param {MovieMetadata[]} meta - An array of metadata objects
     */
    constructor(meta: MovieMetadata[]) {
        this.meta = meta;
        this.rawScripts = {};
    }

    /**
     * Get meta information for all movies.
     * @return {Array<MovieMetadata>} meta information for all movies.
     */
    getMovies(): MovieMetadata[] {
        return Object.values(this.meta);
    }

    /**
     * Get meta information for a given movie.
     * @param {String} [tokenizedTitle] - A tokenized movie title.
     * @return {MovieMetadata} meta information for the given movie if it is available, else null.
     */
    getMetaInformation(tokenizedTitle: string): MovieMetadata | null {
        return this.meta[tokenizedTitle] || null;
    }

    /**
     * Get a raw movie script from its title. The raw script needs to have been loaded before.
     * @param {String} tokenizedTitle - The tokenized title of a movie whose raw script has been loaded.
     * @return {String | null} the raw movie script associated with the given title, or null if there is no loaded script for this movie.
     */
    getRawScript(tokenizedTitle: string): string | null {
        return this.rawScripts[tokenizedTitle] ? this.rawScripts[tokenizedTitle] : null;
    }

    /**
     * Search movies by title and return the best match.
     * @param {String} titleSearchStr The search string.
     * @return {MovieMetadata} the movie whose title matches the search string best.
     */
    searchByTitle(titleSearchStr: string): MovieMetadata {
        const movies = this.getMovies();
        const titles = movies.map((m) => m.title);
        const search = stringSimilarity.findBestMatch(titleSearchStr, titles);
        return movies[search.bestMatchIndex];
    }

    /**
     * Save all meta information to the cache file.
     */
    async saveMetaToCache(): Promise<void> {
        // Convert all metadata objects to JSON
        const moviesJSON = this.getMovies().map((mm) => mm.toJSON());
        // Write to file
        await fsPromises.writeFile(CACHE_METADATA_FILE, JSON.stringify(moviesJSON));
    }

    /**
     * Save the raw script to cache for the given movie.
     * @param {String} tokenizedTitle - The tokenized title of a movie whose raw script has been loaded.
     */
    async saveRawScriptToCache(tokenizedTitle: string): Promise<void> {
        const rawScript = this.getRawScript(tokenizedTitle);
        if (rawScript)
            await fsPromises.writeFile(path.join(CACHE_SCRIPTS_DIR, tokenizedTitle + ".txt"), rawScript, "utf8");
        else console.log(`Cannot save raw script to cache for movie '${tokenizedTitle}': no raw script loaded.`);
    }

    /**
     * Loads the raw script of the given movie from cache.
     * @param {String} tokenizedTitle - The tokenized title of a movie.
     * @return {String} the raw movie script, or null if it doesn't exist in cache.
     */
    async loadRawScriptFromCache(tokenizedTitle: string): Promise<string | null> {
        try {
            const rawScript = await fsPromises.readFile(path.join(CACHE_SCRIPTS_DIR, tokenizedTitle + ".txt"), "utf8");
            this.rawScripts[tokenizedTitle] = rawScript;
            return rawScript;
        } catch (e) {
            console.error(`Cannot load the raw script for the movie ${tokenizedTitle} from cache:`);
            console.error(e);
            return null;
        }
    }

    /**
     * Loads the raw script of the given movie from the IMSDb website.
     * @param {MovieMetadata} movie - The metadata object for a movie.
     * @return {String} the raw movie script, or null if it doesn't exist.
     */
    async loadRawScriptFromSource(movie: MovieMetadata): Promise<string | null> {
        await this.loadRawScriptsFromSource([movie]);
        return this.rawScripts[movie.tokenizedTitle] || null;
    }

    /**
     * Loads the raw scripts of the given movies from the IMSDb website.
     * @param {Array<MovieMetadata>} movies - The metadata objects for one or more movies.
     * @param {function} [onBatchLoaded] - A callback executed whenever a batch of raw scripts has been loaded. If the callback returns true, the scripts are then unloaded from memory.
     */
    async loadRawScriptsFromSource(
        movies: MovieMetadata[],
        onBatchLoaded?: (test: {[key: string]: string | null}) => boolean,
    ): Promise<void> {
        await fetchMovieScriptsInBatch(movies, (loadedBatch) => {
            for (const tokenizedTitle in loadedBatch) {
                const s = loadedBatch[tokenizedTitle];
                if (s !== null) this.rawScripts[tokenizedTitle] = s;
            }

            if (onBatchLoaded) {
                const unload = onBatchLoaded(loadedBatch) === true;
                if (unload) {
                    for (const tokenizedTitle in loadedBatch) delete this.rawScripts[tokenizedTitle];
                }
            }
        });
    }

    /**
     * Creates a {@link MovieCollection} by loading all meta information from cache.
     * @return {MovieCollection}
     */
    static async loadMetaFromCache(): Promise<MovieCollection> {
        const data = await fsPromises.readFile(CACHE_METADATA_FILE, "utf8");
        const moviesJSON = JSON.parse(data);
        const meta = moviesJSON.map((obj) => new MovieMetadata(obj));
        return new MovieCollection(meta);
    }

    /**
     * Creates a {@link MovieCollection} by loading all meta information from the IMSDb website.
     * @return {MovieCollection}
     */
    static async loadMetaFromSource(): Promise<MovieCollection> {
        // Fetch meta
        const meta = await getMoviesList(true);
        return new MovieCollection(meta);
    }
}
