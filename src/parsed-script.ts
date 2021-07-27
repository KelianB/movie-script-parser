/**
 * Responsible for representing parsed movie scripts.
 * @module parsed-script
 */

import {Entry} from "./types";

/**
 * Stores and provides utility functions for parsed movie scripts.
 */
export class ParsedMovieScript {
    private entries: Entry[];

    constructor(entries: Entry[]) {
        this.entries = entries;
    }

    toHTML(): string {
        // TODO pad with padStart
        function pad(n: string | number, width: number, z = "0") {
            n = n + "";
            return n.length >= width ? n : z.repeat(width - n.length) + n;
        }

        const html =
            "<!DOCTYPE html>" +
            "<html lang='en'>" +
            "<head>" +
            "   <style>p {white-space: pre; font-family: monospace;}</style>" +
            "</head>" +
            "<body>" +
            "   <p>" +
            this.entries
                .map((e, i) => pad(i, 4, " ") + pad(e.annotation || "", 11, " ") + "\t" + e.content)
                .join("\n") +
            "</p>" +
            "</body>" +
            "</html>";
        return html;
    }
}
