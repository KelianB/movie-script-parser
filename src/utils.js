import rp from "request-promise-native";
import cheerio from "cheerio";

/**
 * Fetches html from a remote location and parses it using cheerio.
 * @param {String} uri The remote URL.
 * @return {cheerio} a cheerio object. 
 */
export async function fetch(uri) {
    return await rp({
        uri: uri,
        transform: body => cheerio.load(body, {decodeEntities: false})
    });
}

/**
 * Cleans up raw movie titles from IMSDb. 
 * @param {String} title A raw movie title (e.g. "A New Hope, The").
 * @return {String} the cleaned-up title. 
 */
export function cleanUpMovieTitle(title) {
    return title.trim().replace(/, the$/i, "").trim();
}
