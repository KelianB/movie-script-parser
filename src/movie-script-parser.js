/**
 * Responsible for parsing raw movie scripts that are close to the standard screenplay format.
 * @module movie-script-parser
 */

import {ParsedMovieScript} from "./parsed-script.js"
import {Annotation} from "./constants.js"

// Utility functions used for parsing

/**
 * Computes the number of space at the beginning of a string.
 * @param {String} str
 * @return {Number} the indentation of the given string.
 */
function computeIndentation(str) {
    return str.search(/\S|$/);
}

/**
 * Computes the frequency of upper case characters in a given string.
 * @param {String} str
 * @return {Number} the ratio of upper case characters to alphabetical characters. 
 */
function computeUpperCaseFrequency(str) {
    let lowerCaseChars = str.search(/[a-z]/g);
    let upperCaseChars = str.search(/[A-Z]/g);
    return upperCaseChars / ((lowerCaseChars + upperCaseChars) || 1);
}

/**
 * Computes several metrics for a given string.
 * @param {String} str
 * @return {Object} a metrics object. Fields: indentation (Number), upperCaseFrequency (Number), bold (boolean). 
 */
function computeMetrics(str) {
    return {
        indentation: computeIndentation(str),
        upperCaseFrequency: computeUpperCaseFrequency(str),
        bold: str.search(/^\s*<b>.*<\/b>\s*$/) != -1
    };
}

/**
 * Check if a string matches at least one of the given Regex patterns.
 * @param {String} str 
 * @param {Array<RegExp>} patterns
 * @return true if the string matches at least one pattern. 
 */
function matchesOnePattern(str, patterns) {
    return patterns.some(p => str.search(p) != -1);
}


function timeExecution(taskName, fn) {
    let time = Date.now();
    fn();
    let elapsed = Date.now() - time;
    console.log(taskName + " - Took " + elapsed + " ms.");
}


let patterns = {};
patterns.boldTag = /(<b>)|(<\/b>)/g;
patterns.characterSuffix = /\s*(\((V.O.|VO|V\/O|O.S.|O.S|OS|O\/S|O.C.|OC|CONT'D|CONT|CONT.|CONT'D.|CONT 'D.|OFF)\))|( --)/g;
patterns.characterExclusion = [
    / -(<\/b>)?$/g, // ends with " -"
    /^\s*(<b>)?\(.+\)(<\/b>)?$/, // all in parenthesis
    /^\s*(<b>)?[^\w]+(<\/b>)?$/, // no alphanumeric characters
];
patterns.sceneLexicon = [
    /( |^)INT\.?:? /g, /( |^)INTERIOR:? /g, /^\s*INSIDE /g,
    /( |^)EXT\.?:? /g, /( |^)EXTERIOR:? /g, /^\s*OUTSIDE /g,
    /( |^)EXT\.?\/INT\.?:? /g,
    /( |^)INT\.?\/EXT\.?:? /g,
    /( |^)E\.?\/I\.?:? /g,
    /( |^)I\.?\/E\.?:? /g
];
patterns.metaLexicon = [
    /FADE /g, /FADES /g, /DISSOLVE(:| )/g, /BLACK:/g,
    /THE END/g, /- END/g,
    /CREDITS/g,
    /CUT TO/g, /CUT BACK TO/g, /WIPE TO/g,
    /(INTERCUT)/g,
    /CLOSE ON/g, /CLOSER ON/g, /CLOSE UP/g, /CLOSEUP/g,
    /WIDER ON/g, /WIDE ON/g,
    /RESUME ON/g, /BACK ON /g, /UP ON /g,
    /<b>[A-Z]+ (ANGLE|SHOT)/g, // "WIDER ANGLE", "CLOSE ANGLE", "REACTION SHOT" etc
    /<b>ANGLE ON /g, /<b>ON /g,
    / LATER/g,
    /CONTINUED/g,
    /TRANSITION/g,
    /(MORE)/g,
    / SHOT:?$/g,
    /THEIR POV/g, /'S POV/g,
    /SUPER:/,
    / BY .+ PLAYS\.?\s*/g, // ex: "SURRENDER" BY CHEAP TRICK PLAYS.
    /<b>CAMERA /g,
    /<b>ZOOM /g, 
];
patterns.speechCue = /^\s*(<b>)?\([^)(]+\)(<\/b>)?\s*$/; // e.g. "(screams)"
patterns.numericalOnly = /^\s*(<b>)?[0-9]*\.?(<\/b>)?\s*$/;

let cleanupCharacterEntry = e => e.content.replace(patterns.characterSuffix, "").toLowerCase().replace(patterns.boldTag, "").trim();

/**
 * Handles the parsing of a single raw movie script.
 */
class ScriptParser {
    /**
     * Initializes a parser for the given raw script.
     */
    constructor(rawScript) {
        this.rawScript = rawScript;
        this.entries = [];
    }
    
    pass(processEntry, entries) {
        entries = entries || this.entries;
        let previousEntry = null;
        let previousMetrics = computeMetrics("");

        return entries.map((e,i) => {
            let metrics = computeMetrics(e.content);
            let mapping = processEntry(e, i, metrics, previousMetrics, previousEntry);
            previousMetrics = metrics;
            if(mapping !== null)
                previousEntry = mapping === undefined ? e : mapping;
            return mapping;
        }).filter(e => e !== null);
    }

    parse() {
        timeExecution("Pre-processing", () => this.preprocess());

        let lines = this.rawScript.split("\n");

        // Discard pass
        let discard = ["<pre>", "</pre>"];
        timeExecution("Discard pass", () => {
            // Discard lines that match exactly (after trim) one of the tokens in the discard array
            lines = lines.filter(l => discard.indexOf(l.trim()) == -1);
            // If a line contains one of the discard tokens (but is not equal to it), remove the token from the line
            lines = lines.map(l => discard.reduce((accumulator, currentValue) => accumulator.replace(currentValue, ""), l));
        });

        // Create initial entry
        timeExecution("Init entries & merge pass", () => {
            let entries = lines.map(l => {return {content: l};});

            // Blank line counter, reset every time a line isn't blank.
            let blankLineCounter = 0;

            this.entries = this.pass((e, i, metrics, previousMetrics, previousEntry) => {
                if(e.content.trim().length == 0) {
                    blankLineCounter++;
                    return null;
                }

                // Merge consecutive lines that have the same indent
                if(blankLineCounter == 0 && metrics.indentation == previousMetrics.indentation) {
                    // TODO maybe check if the previous line isn't bold / upper case
                    previousEntry.content = previousEntry.content.trimEnd() + " " + e.content.trim();
                    return null;
                }
        
                blankLineCounter = 0;
                return {
                    annotation: Annotation.UNKNOWN,
                    content: e.content,
                    locked: false
                };
            }, entries);
            console.log(this.entries.slice(0,5))
        });


        

        // Do a pass to identify common indents that correspond to characters and scenes:
        // biggest group of lines with identical indentation, that are either bold or all upper-case. 
        timeExecution("CHARACTER and SCENES pass", () => {
            let indentOccurrences = {};
            let total = 0;
            this.pass((e, i, metrics) => {
                if(metrics.upperCaseFrequency == 1 || metrics.bold) {
                    if(!indentOccurrences[metrics.indentation])
                        indentOccurrences[metrics.indentation] = [];
                    indentOccurrences[metrics.indentation].push(i);
                    total++;
                }
            });

            // Check if we see two major categories that emerge
            let sameIndentEntries = Object.values(indentOccurrences).sort((a,b) => b.length - a.length);

            if(sameIndentEntries.length >= 2
                && sameIndentEntries[0].length > this.entries.length * 0.1
                && sameIndentEntries[1].length > this.entries.length * 0.015
                && sameIndentEntries[0].length + sameIndentEntries[1].length > total * 0.5) {
                // if so, the one with the most entries is almost certainly character names; the other category is almost certainly scenes
                // (we could also compare the indents, since character names are usually centered)
                let characterNameEntries = sameIndentEntries[0].filter(idx => idx >= 1).map(idx => this.entries[idx]).filter(e => !matchesOnePattern(e.content, patterns.characterExclusion));
                characterNameEntries.forEach(e => e.annotation = Annotation.CHARACTER);
                sameIndentEntries[1].forEach(idx => this.entries[idx].annotation = Annotation.SCENE);

                if(sameIndentEntries.length > 2) {
                    let characterNames = new Set(characterNameEntries.map(e => cleanupCharacterEntry(e)));
                    sameIndentEntries.shift();
                    sameIndentEntries.shift();

                    // Flag indentation groups that contain an entry that is a character name as CHARACTER entries                   
                    let indentGroupsWithCharacters = [];
                    do {
                        indentGroupsWithCharacters = sameIndentEntries.filter(indices => indices.some(idx => characterNames.has(cleanupCharacterEntry(this.entries[idx]))));
                        sameIndentEntries =         sameIndentEntries.filter(indices => !indices.some(idx => characterNames.has(cleanupCharacterEntry(this.entries[idx]))));
                        indentGroupsWithCharacters.forEach(indices => {    
                            indices.filter(idx => idx >= 1 && !matchesOnePattern(this.entries[idx].content, patterns.characterExclusion)).forEach(idx => {
                                this.entries[idx].annotation = Annotation.CHARACTER
                                characterNames.add(cleanupCharacterEntry(this.entries[idx]));
                            });
                        });
                        
                    }
                    while(indentGroupsWithCharacters.length > 0);
                }
                 
            }
            else {
                console.log("Cannot rely on indent for annotating.");
                console.log(sameIndentEntries.length);
                console.log(sameIndentEntries[0].length, this.entries.length * 0.1);
                console.log(sameIndentEntries[1].length, this.entries.length * 0.02)
                console.log(sameIndentEntries[0].length + sameIndentEntries[1].length, total * 0.66);
                console.log(indentOccurrences);
            }
        });

        // Flag SCENE entries with certainty using a lexicon
        timeExecution("SCENE lexicon pass", () => {
             this.pass((e) => {                
                if(e.annotation == Annotation.UNKNOWN || !e.locked) {
                    if(matchesOnePattern(e.content.replace("<b>", ""), patterns.sceneLexicon)) {
                        e.annotation = Annotation.SCENE;                   
                        e.locked = true;
                    }
                }
            });
        });

        // TODO for lines like
        // This is the part where you run away. (The men scramble to get away. He laughs.) And stay out! (looks down and picks up a piece of paper. Reads.) "Wanted. Fairy tale creatures."(He sighs and throws the paper over his shoulder.)
        // Separate into SPEECH \n SPEECH CUE \n SPEECH \n SPEECH CUE etc 

        // Flag SPEECH CUE entries
        timeExecution("Flag SPEECH CUE", () => {
            this.pass((e) => {
                if(e.annotation == Annotation.UNKNOWN && e.content.search(patterns.speechCue) != -1) {
                    e.annotation = Annotation.SPEECH_CUE;
                    e.locked = true;
                }
            });
        });
    
        // Flag entries that follow a CHARACTER as SPEECH, unless they differ from the expected indent 
        timeExecution("Flag SPEECH", () => {
            /*
            let indentOccurrences = {};
            this.pass((e, i, metrics, previousMetrics, previousEntry) => {
                if(i > 0 && previousEntry.annotation == Annotation.CHARACTER) {
                    if(!indentOccurrences[metrics.indentation])
                        indentOccurrences[metrics.indentation] = [];
                    indentOccurrences[metrics.indentation].push(i);
                }
            });

            let indentationLevels = Object.keys(indentOccurrences).sort((a,b) => indentOccurrences[b].length - indentOccurrences[a].length);
            let speechIndent = indentationLevels[0];
            indentOccurrences[speechIndent].map(idx => this.entries[idx]).forEach(e => {
                if(e.annotation == Annotation.UNKNOWN)
                    e.annotation = Annotation.SPEECH;
            });
            
            if(indentationLevels.length > 1) {
                let speechCueIndent = indentationLevels[1];
                //indentOccurrences[speechCueIndent].forEach(idx => this.entries[idx].annotation = Annotation.SPEECH_CUE);

                // Do one pass to catch the speech entries that occur after a speech cue. For example:
                // [CHARACTER]                  LUKE
                //   [SPEECH CUE]             (Very animated)
                //   [UNKNOWN]                         ...so I cut off my power, shut down the afterburners [...] 
                this.pass((e, i, metrics, previousMetrics, previousEntry) => {
                    if(i > 0 && (previousEntry.annotation == Annotation.SPEECH || previousEntry.annotation == Annotation.SPEECH_CUE)) {
                        if(!metrics.bold && metrics.upperCaseFrequency < 0.9) {
                            if(metrics.indentation == speechIndent)
                                e.annotation = Annotation.SPEECH;
                            //else if(metrics.indentation == speechCueIndent)
                                //e.annotation = Annotation.SPEECH_CUE;
                        }
                    }
                });
            }
            if(indentationLevels.length > 2) {
                console.log("Anomaly: found more than 2 indentation levels for entries that follow CHARACTER entries.");
                console.log(indentOccurrences);
            }*/

            
            let indentOccurrences = {};
            let postSpeechCueIndentOccurrences = {};
            this.pass((e, i, metrics, previousMetrics, previousEntry) => {
                if(i > 0 && previousEntry.annotation == Annotation.CHARACTER) {
                    if(e.annotation != Annotation.UNKNOWN)
                        console.log(previousEntry.content, e.annotation, e.content)
                    if(e.annotation == Annotation.UNKNOWN)
                        e.annotation = Annotation.SPEECH;
                    if(!indentOccurrences[metrics.indentation])
                        indentOccurrences[metrics.indentation] = [];
                    indentOccurrences[metrics.indentation].push(i);
                }
                else if(i > 0 && previousEntry.annotation == Annotation.SPEECH_CUE) {
                    if(!postSpeechCueIndentOccurrences[metrics.indentation])
                        postSpeechCueIndentOccurrences[metrics.indentation] = [];
                    postSpeechCueIndentOccurrences[metrics.indentation].push(i); 
                }
            });

            // Catch SPEECH that follows a SPEECH CUE
            let postCharacterIndents = Object.keys(indentOccurrences);
            let postSpeechCueIndents = Object.keys(postSpeechCueIndentOccurrences);
            postSpeechCueIndents.filter(indent => postCharacterIndents.indexOf(indent) != -1).forEach(indent => {
                postSpeechCueIndentOccurrences[indent].filter(idx => this.entries[idx].annotation == Annotation.UNKNOWN).forEach(idx => this.entries[idx].annotation = Annotation.SPEECH);
            });
        });

       
        // Find meta entries using lexicon
        timeExecution("META lexicon pass", () => {
            this.pass((e) => {                
                if(!e.locked && (e.annotation == Annotation.UNKNOWN || e.annotation == Annotation.CHARACTER || e.annotation == Annotation.SCENE)) {
                    if(matchesOnePattern(e.content, patterns.metaLexicon))
                        e.annotation = Annotation.META;                   
                }
            });
        });

        // Find narrative entries
        timeExecution("Find NARRATIVE using character name occurrences and annotations", () => {
            // Build a list of lower-case character names
            let characterNames = [];
            this.pass((e) => {                
                if(e.annotation == Annotation.CHARACTER) {
                    let name = cleanupCharacterEntry(e);
                    if(characterNames.indexOf(name) == -1)
                        characterNames.push(name);
                }
            });

            // Look for UNKNOWN entries that mention character names. They are likely to be NARRATIVE (we use indentation to extrapolate to the other ones)
            let indentOccurrences = {};
            this.pass((e, i, metrics) => {
                if(e.annotation == Annotation.UNKNOWN) {
                    let lowerCaseContent = e.content.toLowerCase();
                    if(characterNames.some(n => lowerCaseContent.includes(n))) {
                        if(!indentOccurrences[metrics.indentation])
                            indentOccurrences[metrics.indentation] = [];
                        indentOccurrences[metrics.indentation].push(i);
                    }
                }
            });
            let indentationLevels = Object.keys(indentOccurrences).sort((a,b) => indentOccurrences[b].length - indentOccurrences[a].length);
            let narrativeIndentation = indentationLevels[0];
            
            // Flag UNKNOWN entries with the right indentation as NARRATIVE
            this.pass((e, i, metrics) => {
                if(e.annotation == Annotation.UNKNOWN && metrics.indentation == narrativeIndentation)
                    e.annotation = Annotation.NARRATIVE;
            });
        });

        // Removal pass
        timeExecution("Entry removal pass", () => {
            let removed = [];
            this.entries = this.entries.filter(e => {
                if(e.annotation == Annotation.UNKNOWN) {
                    if(e.content.search(patterns.numericalOnly) != -1) {
                        removed.push(e.content);
                        return false;
                    }
                }
                return true;
            });
            console.log(`\t> Removed ${removed.length} entries.`)
        });

        // Meta pass
        timeExecution("Flag META entries", () => {
            // Flag all entries as META until we find a non-unknown one
            let i = 0;
            while(this.entries[i].annotation == Annotation.UNKNOWN) {
                this.entries[i].annotation = Annotation.META;
                i++;
            }
            
            // Flag all UNKNOWN entries that come after the very last CHARACTER entry as META
            // (will catch things like "THE END", "FADE OUT", etc)
        });


        timeExecution("Last SPEECH pass", () => {
            this.pass((e, i, metrics, previousMetrics, previousEntry) => {
                if(i > 0 && previousEntry.annotation == Annotation.CHARACTER && !e.locked && [Annotation.SPEECH, Annotation.CHARACTER, Annotation.SPEECH_CUE].indexOf(e.annotation) == -1)
                    e.annotation = Annotation.SPEECH;
                // TODO if CHARACTER entry is followed by a locked entry that is not SPEECH or SPEECH CUE, flag it as UNKNOWN 
            });
        });

        timeExecution("Post-processing", () => {
            this.postprocess();
        });

        return new ParsedMovieScript(this.entries);
    }

    preprocess() {
        const repl = (token, replacement) => {this.rawScript = this.rawScript.replace(token, replacement);}

        let deleteTokens = [/\r/g];
        deleteTokens.forEach(t => repl(t, ""));

        repl(/<br>/g, "\n");
        repl(/<br\/>/g, "\n");
        
        /*# Remove spaces before a </b>
        text = re.sub("(?<=[^ ])( +)(?=</b>)", "", text)
    
        # Extract \n from <b> tags when there is no other content inside
        text = re.sub("<b>( *)\n(?=(\s|\n)*</b>)", "\n<b>", text)
        text = re.sub("<b>( *)\n(?=(\s|\n)*</b>)", "\n<b>", text)
        text = re.sub("<b>( *)\n(?=(\s|\n)*</b>)", "\n<b>", text)
        text = re.sub("<b>( *)\n(?=(\s|\n)*</b>)", "\n<b>", text)
    
        */
    
        // Replace tabs with spaces
        repl(/\t/g, "        ");

        // Remove spaces between consecutive line breaks
        repl(/\n *\n/g, "\n\n");

        /* Move line breaks after </b>. Example: 
           <b>                                     THREEPIO
           </b>                         I should have known better than to
           Will become:
           <b>                                     THREEPIO</b>
                                    I should have known better than to
        */
       repl(/\n<\/b>/g, "</b>\n");

        /* Move <b> after spaces. Example: 
           <b>                                     THREEPIO</b>
                                    I should have known better than to
           Will become:
                                                <b>THREEPIO</b>
                                     I should have known better than to
        */
       repl(/<b>( +)/g, ($0, $1) => " ".repeat($1.length) + "<b>");
       repl(/<b>(\t+)/g, ($0, $1) => "        ".repeat($1.length) + "<b>");

       // Replace empty <b></b>
       repl(/<b><\/b>/g, "");
    }

    postprocess() {
        // Start by computing the average indentation for each type of annotation 
        let totalEntries = {};
        let averageIndent = {};
        this.pass((e, i, metrics) => {
            totalEntries[e.annotation] = (totalEntries[e.annotation] || 0) + 1;
            averageIndent[e.annotation] = (averageIndent[e.annotation] || 0) + metrics.indentation;
        });
        Object.keys(averageIndent).forEach(a => averageIndent[a] /= totalEntries[a]);

        // Fix consecutive CHARACTER entries
        let roundedCharacterIndent = Math.round(averageIndent[Annotation.CHARACTER]);
        this.pass((e, i, metrics, previousMetrics, previousEntry) => {
            if(i > 0 && previousEntry.annotation == Annotation.CHARACTER && e.annotation == Annotation.CHARACTER) {
                let discard = null;
                // Use indentation if possible
                if(metrics.indentation != previousMetrics.indentation) {
                    discard = metrics.indentation == roundedCharacterIndent ? previousEntry :
                        previousMetrics.indentation == roundedCharacterIndent ? e :
                        previousMetrics.indentation < metrics.indentation ? previousEntry : e;    
                }
                // Otherwise, just keep the shortest entry
                else {
                    discard = e.content.length < previousEntry.content.length ? e : previousEntry;
                }

                if(discard == e)
                    e.annotation = Annotation.SPEECH;
                else
                    previousEntry.annotation = Annotation.UNKNOWN;
                //console.log(e.content.trim(), "\t\t", previousEntry.content.trim());
                //console.log("> DISCARDING " + discard.content);
            }
        });
    }

    diagnose() {
        console.log("\n##### Screenplay parsing diagnosis #####");
        let speechAnomalies = [];
        let unknownLines = [];
        this.pass((e, i, metrics, previousMetrics, previousEntry) => {
            if(i > 0 && previousEntry.annotation == Annotation.CHARACTER && e.annotation != Annotation.SPEECH && e.annotation != Annotation.SPEECH_CUE)
                speechAnomalies.push(i); 
            if(e.annotation == Annotation.UNKNOWN)
                unknownLines.push(i);    
        });
        if(speechAnomalies.length > 0)
            console.log(`${speechAnomalies.length} speech anomalies at following line indices: ${speechAnomalies}`);
        if(unknownLines.length > 0)
            console.log(`${unknownLines.length} unknown lines found at following line indices: ${unknownLines}`);
        

        // List character occurrences
        let characterOccurrences = this.entries.filter(e => e.annotation == Annotation.CHARACTER).map(e => cleanupCharacterEntry(e).toUpperCase()).reduce((accumulator, val) => {
            if(!accumulator[val])
                accumulator[val] = 0;
            accumulator[val]++;
            return accumulator;
        }, {});
        let sortedOccurrences = {};
        Object.keys(characterOccurrences).sort((a,b) => characterOccurrences[b] - characterOccurrences[a]).forEach(name => sortedOccurrences[name] = characterOccurrences[name]);
        console.log("Character occurrences:", sortedOccurrences);
    }
}

export function parseMovieScript(rawScript) {
    let parser = new ScriptParser(rawScript);
    let parsed = parser.parse();
    parser.diagnose();

    return parsed;
}