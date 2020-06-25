import {fetch} from "./utils.js"
import {resolve} from "url"
import {MovieMetadata} from "./movie-metadata.js"
import {URL_IMSDB, URL_IMSDB_ALL_SCRIPTS} from "./constants.js";

/**
 * Responsible for fetching metadata for the movies available on IMSDb.
 * @module metadata-retriever
 */

// Number of parallel requests
const FETCH_BATCH_SIZE = 5;


/**
 * Cleans up raw movie titles from IMSDb. 
 * @param {String} title A raw movie title (e.g. "A New Hope, The").
 * @return {String} the cleaned-up title. 
 */
function cleanUpMovieTitle(title) {
    return title.trim().replace(/, the$/i, "").trim();
}


/**
 * Fetch details for the given movies. Fetching is done in batches of n parallel requests.
 * Information is added directly onto the MovieMetadata objects. @See {@link MovieMetadata.setDetails}.
 * @param {Array<MovieMetadata>} movies - An array of movie metadata objects. 
 */
async function fetchMovieDetailsInBatch(movies) {
    const logProgress = (n) => process.stdout.write(`\rFetching movie details... ${i}/${movies.length}`);
        
    // Iterate over batches
    for(let i = 0; i < movies.length; i+=FETCH_BATCH_SIZE) {
        logProgress(i);
        let batch = movies.slice(i, Math.min(i + FETCH_BATCH_SIZE, movies.length));
        // Wait until the batch is finished processing
        await Promise.all(batch.map(fetchMovieDetails));
    }
    logProgress(movies.length);
    process.stdout.write("\n");
}


/**
 * Fetch details for a single movie.
 * Information is added directly onto the MovieMetadata object. @See {@link MovieMetadata.setDetails}.
 * @param {MovieMetadata} movie - A movie metadata object. 
 */
async function fetchMovieDetails(movie) {
    let $;
    try {
        $ = await fetch(resolve(URL_IMSDB, movie.detailsURL));
    }
    catch(err) {
        console.error("An error occured while fetching details for movie '" + movie.title + "':");
        console.error(err);
        return movie;
    }

    // Get the <a href="...">Read "Star Wars: A New Hope" Script</a>
    let scriptLink = $("table.script-details a:last-child");

    // Retrieve the script URL
    let scriptURL = scriptLink.length > 0 ? scriptLink.attr("href") : null;

    // Get the <b>Genres</b> tag
    let genresLabel = $("table.script-details b:contains(Genres)");
    // Get the links that follow, until we find a tag that contains "Script" (e.g. 'Read "Star Wars" Script').
    let genres = genresLabel.nextUntil(":contains(Script)", "a").map((_,a) => $(a).text()).toArray();
    
    // Add the information on the MovieMetadata object
    movie.setDetails(scriptURL, genres);

    return movie;
}


/**
 * Get a list of movies listed of IMSDb, with some metadata information.
 * @param {boolean} [fetchDetails=true] Whether or not to fetch additional details (genres, script URL) about the movies. This is time-intensive as it requires an additional request per movie.
 * @return {Array<MovieMetadata>} a list of movie metadata objects. 
 */
export async function getMoviesList(fetchDetails=true) {
    let $;
    try {
        $ = await fetch(URL_IMSDB_ALL_SCRIPTS);
    }
    catch(err) {
        console.error("An error occured while fetching or parsing the movies list.");
        console.error(err);
        return [];
    }

    let entryContainers = $("td")
        .filter((i, el) => $(el).text().includes("Written by"))
        .children("p");

    let movies = entryContainers.map((i, el) => {
        let p = $(el);
        let a = p.children("a");
        return new MovieMetadata({
            title: cleanUpMovieTitle(a.text()),
            detailsURL: a.attr("href"),
            draft: p.clone().children().remove().end().text().trim().replace(/[\(\)]/g, ""),
            authors: p.children("i").text().replace("Written by", "").split(",").map(str => str.trim())
        });
    }).toArray();

    if(fetchDetails)
        await fetchMovieDetailsInBatch(movies);

    return movies;
}
