/**
 * Responsible for retrieving raw movie scripts from IMSDb.
 * @module movie-script-retriever 
 */

 import {fetch} from "./utils.js"
import {resolve} from "url"
import {URL_IMSDB, BATCH_SIZE_FETCH_SCRIPTS} from "./constants.js";


/**
 * Fetch the script for a single movie, assuming it has a scriptURL.
 * @param {MovieMetadata} movie - A movie metadata object.
 * @return {String} the raw script. 
 */
export async function fetchMovieScript(movie) {
    if(!movie.hasScriptURL()) {
        // The movie does not have a script on IMSDb, the specific page for this movie containing the script URL was never loaded.
        console.log(`Cannot fetch the movie script for '${movie.title}' + ": make sure details were loaded for this movie.`);
        return null;
    }
    if(!movie.scriptURL.includes(".html")) {
        // The script is not in HTML form (perhaps PDF)
        console.log(`Cannot fetch the movie script for '${movie.title}' + ": not in HTML format (${movie.scriptURL}).`);
        return null;
    }

    try {
        let $ = await fetch(resolve(URL_IMSDB, movie.scriptURL));
        let scriptContainer = $("td.scrtext");

        // Remove unwanted elements at the end
        scriptContainer.children("table").nextAll().remove();
        scriptContainer.children("table").remove();

        let htmlContent = "";

        if(scriptContainer.length == 0) {
            console.error(`Could not retrieve movie script for movie ${movie.title}.`);
            htmlContent = $.html();
        }
        else
            htmlContent = scriptContainer.html();
        return htmlContent;
    }
    catch(err) {
        console.log(`An error occured while fetching the script for '${movie.title}'.`);
        console.error(err);
    }
}


/**
 * Fetch raw scripts for the given movies. Fetching is done in batches of n parallel requests.
 * @param {Array<MovieMetadata>} movies - An array of movie metadata objects.
 * @param {function} [onBatchLoaded] - A callback that is called whenever one batch has been fetched. Takes an object of {tokenizedTitle: rawScript}.
 */
export async function fetchMovieScriptsInBatch(movies, onBatchLoaded) {
    onBatchLoaded = onBatchLoaded || (() => {});
    
    let fetchableMovies = movies.filter(m => m.hasFetchableScript());
    const logProgress = (n) => process.stdout.write(`\rFetching movie scripts... ${n}/${fetchableMovies.length}`);

    for(let i = 0; i < fetchableMovies.length; i+=BATCH_SIZE_FETCH_SCRIPTS) {
        logProgress(i);
        let batch = fetchableMovies.slice(i, Math.min(i + BATCH_SIZE_FETCH_SCRIPTS, fetchableMovies.length));
        let batchScripts = {};
        // Wait until we have fetched all of the data for the batch
        let loadedScripts = await Promise.all(batch.map(fetchMovieScript));
        loadedScripts.forEach((rawScript, i) => batchScripts[movies[i].tokenizedTitle] = rawScript);
        onBatchLoaded(batchScripts);
    }

    logProgress(fetchableMovies.length);
    process.stdout.write("\n");
}