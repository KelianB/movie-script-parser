/**
 * Responsible for representing parsed movie scripts.
 * @module parsed-script
 */


/**
 * Stores and provides utility functions for parsed movie scripts. 
 */
export class ParsedMovieScript {
    constructor(entries) {
        this.entries = entries;
    }

    toHTML() {
        function pad(n, width, z="0") {
            n = n + "";
            return n.length >= width ? n : z.repeat(width - n.length) + n;
        }
    
        let html = "<!DOCTYPE html>" +
            "<html lang='en'>" + 
            "<head>" +
            "   <style>p {white-space: pre; font-family: monospace;}</style>" +
            "</head>" +
            "<body>" +
            "   <p>" + this.entries.map((e,i) => pad(i,4," ") + pad(e.annotation,11," ") + "\t" + e.content).join("\n") + "</p>" +
            "</body>" +
            "</html>";
        return html;
    }
}