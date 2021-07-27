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

type PartialMetadata = {
    title: string;
    detailsURL: string;
    draft: string;
    authors: string;
};

type FullMetadata = PartialMetadata & {
    genres: string[];
    scriptURL: string;
};

function isFullMetadata(metadata: PartialMetadata | FullMetadata): metadata is FullMetadata {
    return metadata.hasOwnProperty("scriptURL");
}

/**
 * Stores movie meta information.
 */
export class MovieMetadata {
    readonly title: string;
    readonly tokenizedTitle: string;
    readonly detailsURL: string;
    readonly draft: string;
    readonly authors: string;
    private genres: string[];
    private scriptURL_: string | null;

    /**
     * Create a MovieMetadata object from raw meta information.
     * @param {Object} metadata
     */
    constructor(metadata: PartialMetadata | FullMetadata) {
        this.title = metadata.title;
        this.tokenizedTitle = tokenizeMovieTitle(this.title);
        this.detailsURL = metadata.detailsURL;
        this.draft = metadata.draft;
        this.authors = metadata.authors;
        if (isFullMetadata(metadata)) {
            this.genres = metadata.genres;
            this.scriptURL_ = metadata.scriptURL;
        } else {
            this.genres = [];
            this.scriptURL_ = null;
        }
    }

    /**
     * Get whether or not we have retrieved the URL for this movie's script.
     * @return {boolean} true if the script URL is available, else false.
     */
    hasScriptURL(): boolean {
        return this.scriptURL !== null;
    }

    get scriptURL(): string | null {
        return this.scriptURL_;
    }

    /**
     * Get whether or not this movie's raw script can be fetched.
     * @return {boolean} true if the script URL is available and points to a HTML page, else false.
     */
    hasFetchableScript(): boolean {
        return this.hasScriptURL() && this.scriptURL!.includes(".html");
    }

    /**
     * Set the details for this movie (additional information fetched from the specific page for this movie).
     * @param {String} scriptURL
     * @param {Array<String>} genres
     */
    setDetails(scriptURL: string, genres: []): void {
        this.scriptURL_ = scriptURL;
        this.genres = genres;
    }

    /**
     * Serialize the meta information to a JSON object.
     * @return {Object} a JSON representation of the metadata.
     */
    toJSON(): {[key: string]: string | string[] | null} {
        return {
            title: this.title,
            tokenizedTitle: this.tokenizedTitle,
            detailsURL: this.detailsURL,
            draft: this.draft,
            authors: this.authors,
            genres: this.genres,
            scriptURL: this.scriptURL,
        };
    }
}
