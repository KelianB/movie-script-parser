import {MovieCollection} from "./movie-collection";
import {parseMovieScript} from "./movie-script-parser";
import {promises as fsPromises} from "fs";
import {fetchMovieScript} from "./movie-script-retriever";
import {OUTPUT_DIR} from "./constants";

// TODO rename speech cue to parenthetical or wrylie

const FETCH = false;

async function main() {
    const movieCollection = await MovieCollection.loadMetaFromCache();

    let searchTitle = "";
    //searchTitle = "guardians of the galaxy";
    //searchTitle = "Star Wars a new hope";
    //searchTitle = "gladiator";
    //searchTitle = "blade runner";
    //searchTitle = "ghostbusters";
    //searchTitle = "shrek";
    //searchTitle = "avatar";
    //searchTitle = "men in black";
    searchTitle = "Titanic";

    const movie = await movieCollection.searchByTitle(searchTitle);
    let rawScript: string | null;
    if (FETCH) rawScript = await fetchMovieScript(movie);
    else {
        rawScript = await movieCollection.loadRawScriptFromCache(movie.tokenizedTitle);
        //rawScript.saveToCache();
    }

    if (rawScript) {
        const parsed = parseMovieScript(rawScript);
        //console.log(rawScript.substring(0,1000));
        //console.log(parsed.entries.slice(0,100));

        await fsPromises.writeFile(OUTPUT_DIR + movie.tokenizedTitle + ".html", parsed.toHTML(), "utf8");
    }
}

/*
diagnose() {
    console.log(`Computing diagnosis of metadata for ${this.movies.length} movies...`);
    
    let withoutScripts = this.movies.filter(m => !m.hasScriptURL());
    console.log(`\t- Movies without a script URL: ${withoutScripts.length}:`);
    console.log(withoutScripts);
}
*/

main();
