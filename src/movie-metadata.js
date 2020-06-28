/**
 * Responsible for representing and operating on movie meta information.
 * @module movie-metadata 
 */


/**
 * Transforms a given movie title into a filename-safe format.
 * e.g. Star Wars: A New Hope is mapped to star-wars-a-new-hope.
 * @param {String} title A movie title.
 * @return {String} the transformed title. 
 */
function tokenizeMovieTitle(title) {
    return title.toLowerCase().trim().replace(/ /g, "-").replace(/[:!?]/g, "");
}


/**
 * Stores movie meta information.
 */
export class MovieMetadata {
    /**
     * Create a MovieMetadata object from raw meta information.
     * @param {Object} metadata
     */
    constructor(metadata) {
        this.title = metadata.title;
        this.tokenizedTitle = tokenizeMovieTitle(this.title);
        this.detailsURL = metadata.detailsURL;
        this.draft = metadata.draft;
        this.authors = metadata.authors;
        this.genres = metadata.genres || [];
        this.scriptURL = metadata.scriptURL || null;
    }

    /**
     * Get whether or not we have retrieved the URL for this movie's script.
     * @return {boolean} true if the script URL is available, else false.
     */
    hasScriptURL() {
        return this.scriptURL !== null;
    }

    /**
     * Get whether or not this movie's raw script can be fetched.
     * @return {boolean} true if the script URL is available and points to a HTML page, else false.
     */
    hasFetchableScript() {
        return this.hasScriptURL() && this.scriptURL.includes(".html");
    }

    /**
     * Set the details for this movie (additional information fetched from the specific page for this movie).
     * @param {String} scriptURL 
     * @param {Array<String>} genres 
     */
    setDetails(scriptURL, genres) {
        this.scriptURL = scriptURL;
        this.genres = genres;
    }

    /**
     * Serialize the meta information to a JSON object.
     * @return {Object} a JSON representation of the metadata.
     */
    toJSON() {
        return {
            title: this.title,
            tokenizedTitle: this.tokenizedTitle,
            detailsURL: this.detailsURL,
            draft: this.draft,
            authors: this.authors,
            genres: this.genres,
            scriptURL: this.scriptURL
        };
    }
}