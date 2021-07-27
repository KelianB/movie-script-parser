/**
 * Provies general-purpose utility functions.
 * @module utils
 */

import cheerio from "cheerio";
import fetch from "node-fetch";

/**
 * Fetches html from a remote location and parses it using cheerio.
 * @param {String} uri The remote URL.
 * @return {cheerio} a cheerio object.
 */
export async function fetchHTML(uri: string): Promise<cheerio.Root> {
    const resp = await fetch(uri, {method: "GET"});
    const raw = await resp.text();
    return cheerio.load(raw, {decodeEntities: false});
}
