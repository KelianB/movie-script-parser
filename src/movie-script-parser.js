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
    
    pass(entries, processEntry) {
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

        //let lines = this.rawScript.split("\n");
        let lines;
        timeExecution("Split", () => {
            lines = this.rawScript.split("\n");
        });

        // Discard pass
        let discard = ["<pre>", "</pre>"];
        timeExecution("Discard pass", () => {
            lines = lines.filter(l => discard.indexOf(l.trim()) == -1);
        });

        // Create initial entry
        timeExecution("Init entries & merge pass", () => {
            let entries = lines.map(l => {return {content: l};});

            // Blank line counter, reset every time a line isn't blank.
            let blankLineCounter = 0;

            this.entries = this.pass(entries, (e, i, metrics, previousMetrics, previousEntry) => {
                if(e.content.length == 0) {
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
            });
        });

        let boldTagPattern = /(<b>)|(<\/b>)/g;
        let characterSuffixPattern = /\s*(\((V.O.|VO|V\/O|O.S.|OS|O\/S|O.C.|OC|CONT'D|CONT|CONT.|CONT'D.|CONT 'D.|OFF)\))|( --)/g;
        let characterExcludePatterns = [
            / -(<\/b>)?$/g, // ends with " -"
            /^\s*(<b>)?\(.+\)(<\/b>)?$/, // all in parenthesis
            /^\s*(<b>)?[^\w]+(<\/b>)?$/, // no alphanumeric characters
        ];
        let cleanupCharacterEntry = e => e.content.replace(characterSuffixPattern, "").toLowerCase().replace(boldTagPattern, "").trim();

        // Do a pass to identify common indents that correspond to characters and scenes:
        // biggest group of lines with identical indentation, that are either bold or all upper-case. 
        timeExecution("CHARACTER and SCENES pass", () => {
            let indentOccurrences = {};
            let total = 0;
            this.pass(this.entries, (e, i, metrics) => {
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
                && sameIndentEntries[1].length > this.entries.length * 0.025
                && sameIndentEntries[0].length + sameIndentEntries[1].length > total * 0.66) {
                // if so, the one with the most entries is almost certainly character names; the other category is almost certainly scenes
                // (we could also compare the indents, since character names are usually centered)
                let characterNameEntries = sameIndentEntries[0].filter(idx => idx >= 1).map(idx => this.entries[idx]).filter(e => !matchesOnePattern(e.content, characterExcludePatterns));
                characterNameEntries.forEach(e => e.annotation = Annotation.CHARACTER);
                sameIndentEntries[1].forEach(idx => this.entries[idx].annotation = Annotation.SCENE);

                if(sameIndentEntries.length > 2) {
                    let characterNames = new Set(characterNameEntries.map(e => cleanupCharacterEntry(e)));
                    //console.log(characterNames);
                    sameIndentEntries.shift();
                    sameIndentEntries.shift();
                    
                    // Flag indentation groups that contain an entry that is a character name as CHARACTER entries
                    let toFlag = sameIndentEntries.filter(entryIdcs => entryIdcs.some(idx => characterNames.has(cleanupCharacterEntry(this.entries[idx]))));
                    toFlag.forEach(entries => entries.filter(idx => !matchesOnePattern(this.entries[idx].content, characterExcludePatterns)).forEach(idx => this.entries[idx].annotation = Annotation.CHARACTER));
                    console.log(toFlag);
                }
                 
            }
            else {
                console.log("Cannot rely on indent for annotating.");
                console.log(indentOccurrences);
            }
        });

        // Flag SPEECH CUE entries
        timeExecution("Flag SPEECH CUE", () => {
            let speechCuePattern = /^\s*(<b>)?\(.+\)(<\/b>)?\s*$/;
            this.pass(this.entries, (e) => {
                if(e.annotation == Annotation.UNKNOWN && e.content.search(speechCuePattern) != -1) {
                    e.annotation = Annotation.SPEECH_CUE;
                    e.locked = true;
                }
            });
        });
    
        // Flag entries that follow a CHARACTER as SPEECH, unless they differ from the expected indent 
        timeExecution("Flag SPEECH", () => {
            let indentOccurrences = {};
            this.pass(this.entries, (e, i, metrics, previousMetrics, previousEntry) => {
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
                /* [CHARACTER]                  LUKE
                   [SPEECH CUE]             (Very animated)
                   [UNKNOWN]                         ...so I cut off my power, shut down the afterburners [...] */
                this.pass(this.entries, (e, i, metrics, previousMetrics, previousEntry) => {
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
            }
        });

        // Flag SCENE entries with certainty using a lexicon
        timeExecution("SCENE lexicon pass", () => {
            let sceneCertaintyLexicon = [
                / INT\.?:? /g, / INTERIOR:? /g, /^\s*INSIDE /g,
                / EXT\.?:? /g, / EXTERIOR:? /g, /^\s*OUTSIDE /g,
                / EXT\.?\/INT\.?:? /g, / INT\.?\/EXT\.?:? /g,
                / E\.?\/I\.?:? /g, / I\.?\/E\.?:? /g
            ];

            this.pass(this.entries, (e) => {                
                if(e.annotation == Annotation.UNKNOWN || !e.locked) {
                    if(matchesOnePattern(e.content, sceneCertaintyLexicon))
                        e.annotation = Annotation.SCENE;                   
                }
            });
        });

        let metaLexicon = [
            /FADE /g, /FADES /g, /DISSOLVE /g, /BLACK:/g,
            /THE END/g, /- END/g,
            /CREDITS/g,
            /CUT TO/g, /CUT BACK TO/g, /(INTERCUT)/g,
            /CLOSE ON/g, /CLOSER ON/g, /CLOSE UP/g, /CLOSEUP/g,
            /WIDER ON/g, /WIDE ON/g,
            /RESUME ON/g, /BACK ON /g, /UP ON /g,
            / LATER/g,
            /CONTINUED/g,
            /(MORE)/g,
            / SHOT:?$/g,
            /THEIR POV/g, /'S POV/g,
            /SUPER:/,
            / BY .+ PLAYS\.?\s*/g, // ex: "SURRENDER" BY CHEAP TRICK PLAYS.
            //"TITLE |^\s*ON | VIEW| SHOTS|CAMERA|IMAGE:")
        ];
        
        // Find meta entries using lexicon
        timeExecution("META lexicon pass", () => {
            this.pass(this.entries, (e) => {                
                if(!e.locked && (e.annotation == Annotation.UNKNOWN || e.annotation == Annotation.CHARACTER || e.annotation == Annotation.SCENE)) {
                    if(matchesOnePattern(e.content, metaLexicon))
                        e.annotation = Annotation.META;                   
                }
            });
        });

        // Find narrative entries
        timeExecution("Find NARRATIVE using character name occurrences and annotations", () => {
            // Build a list of lower-case character names
            let characterNames = [];
            this.pass(this.entries, (e) => {                
                if(e.annotation == Annotation.CHARACTER) {
                    let name = cleanupCharacterEntry(e);
                    if(characterNames.indexOf(name) == -1)
                        characterNames.push(name);
                }
            });

            // Look for UNKNOWN entries that mention character names. They are likely to be NARRATIVE (we use indentation to catch all of them)
            let indentOccurrences = {};
            this.pass(this.entries, (e, i, metrics) => {
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
            this.pass(this.entries, (e, i, metrics) => {
                if(e.annotation == Annotation.UNKNOWN && metrics.indentation == narrativeIndentation)
                    e.annotation = Annotation.NARRATIVE;
            });
        });

        // Removal pass
        timeExecution("Entry removal pass", () => {
            let removed = [];
            this.entries = this.entries.filter(e => {
                if(e.annotation == Annotation.UNKNOWN) {
                    if(e.content.search(/^\s*(<b>)?[0-9]*(<\/b>)?\s*$/) != -1) {
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
            this.pass(this.entries, (e, i, metrics, previousMetrics, previousEntry) => {
                if(i > 0 && previousEntry.annotation == Annotation.CHARACTER && [Annotation.SPEECH, Annotation.CHARACTER, Annotation.SPEECH_CUE].indexOf(e.annotation) == -1)
                    e.annotation = Annotation.SPEECH;
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
        this.pass(this.entries, (e, i, metrics) => {
            totalEntries[e.annotation] = (totalEntries[e.annotation] || 0) + 1;
            averageIndent[e.annotation] = (averageIndent[e.annotation] || 0) + metrics.indentation;
        });
        Object.keys(averageIndent).forEach(a => averageIndent[a] /= totalEntries[a]);

        // Fix consecutive CHARACTER entries
        let roundedCharacterIndent = Math.round(averageIndent[Annotation.CHARACTER]);
        this.pass(this.entries, (e, i, metrics, previousMetrics, previousEntry) => {
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
}

export function parseMovieScript(rawScript) {
    return new ScriptParser(rawScript).parse();
}

/*
    exp_location = re.compile("INT\.|EXT\.|INT |EXT |INT:|EXT:|INTERIOR|EXTERIOR|EXT/INT|INT/EXT|I/E|INSIDE|OUTSIDE| ROOM")
    exp_location_2 = re.compile("^\s*[0-9]+[A-Z]{0,1}\s*[A-Z]+")
    exp_direction = re.compile("FADE |FADES |THE END|- END |- THE END |CREDITS|END CREDITS|CUT TO|CUT BACK TO|(\()*CONTINUED|\(MORE\)|TITLE |\(INTERCUT\)|ANGLE|CLOSE ON |CLOSE UP| SHOT|THEIR POV|\'S POV|WIDER ON|WIDE ON|CLOSER ON|CLOSE ON|RESUME ON|^\s*ON | VIEW|LATER| SHOTS|DISSOLVE|SUPER:|IN THE |UNDER THE |OVER THE |BACK ON |UP ON |FROM |CLOSEUP|CAMERA|IMAGE:")
    exp_direction_continued = re.compile("^(\s)*[0-9    ]*(\s)*(\()*CONTINUED")

    exp_number_period = re.compile("^(\s|\n)*[0-9]+\.(\s|\n)*$")
    exp_character_colon_speech = re.compile("^[\t ]*[0-9A-Z\- l]+(?=\: [a-zA-Z!() ]+)")

    # Example match: "FADE TO:"
    exp_direction_colon_ending = re.compile("\:\s*$")

    # Example match: "SUDDENLY."
    exp_direction_period_ending = re.compile("\.\s*$")

    # Example match: "  45 \n "
    exp_numeric_only = re.compile("^\s*[0-9]+\s*$")

    # Example match: "(PEEKS INSIDE)"
    exp_parenthesis_caps = re.compile("^(\s|\n)*\([A-Z 0-9`]+\)(\s|\n)*$") 

    exp_has_alphanumeric = re.compile(r"[0-9A-Za-z]")

    character_cleanup_pattern_1 = r"\s*(\(V\.O\.\)|\(VO\)|\(V/O\)|\(O.S.\)|\(OS\)|\(O/S\)|\(O\.C\.\)|\(OC\)|\(CONT'D\)|\(CONT\)|\(CONT\.\)|\(CONT'D.\)|\(CONT 'D.\)|(OFF))"
    character_cleanup_pattern_2 = r" --"



    def classify_entry_type(self, raw, is_bold):
        is_first = len(self.entries) == 0

        entry_type = TYPE_DIRECTION

        # Handle lines like "64." or "12"
        if exp_number_period.search(raw) != None or exp_numeric_only.search(raw) != None:
            entry_type = TYPE_DIRECTION
        else:
            # Lines that are for sure a LOCATION
            if is_bold and (exp_location.search(raw) != None or exp_location_2.search(raw) != None):
                entry_type = TYPE_LOCATION
                self.meta_finished = True
            # Lines that are for sure a DIRECTION
            elif exp_direction.search(raw) != None:
                entry_type = TYPE_DIRECTION
                self.meta_finished = True
            # Handle movies where dialogue is written as CHARACTER: Speech
            elif exp_character_colon_speech.search(raw) != None:
                match = exp_character_colon_speech.search(raw)
                character_name = match.group().strip()
                character_name = character_name.replace("l", "I") # fix a scan error that often occurs
                self.entries.append({"type": TYPE_CHARACTER, "content": character_name})
                entry_type = TYPE_SPEECH
                raw = raw[match.end()+1:]
            elif is_bold:
                if exp_direction_continued.search(raw) != None or exp_direction_colon_ending.search(raw) != None or exp_direction_period_ending.search(raw) != None:
                    entry_type = TYPE_DIRECTION
                # After a CHARACTER entry, there should be a SPEECH entry
                elif (not is_first) and self.entries[-1]["type"] == TYPE_CHARACTER:
                    entry_type == TYPE_SPEECH
                # Very likely to be a speech
                elif "!" in raw or raw.strip().count(" ") >= 4:
                    entry_type = TYPE_SPEECH
                elif exp_parenthesis_caps.search(raw) != None:
                    if (not is_first) and self.entries[-1]["type"] in [TYPE_CHARACTER, TYPE_SPEECH]:
                        entry_type = TYPE_SPEECH # action like "(SCANS FILE)"
                    else:
                        entry_type = TYPE_DIRECTION # direction like "(INTO COMM)" or "(TO <name>)"
                else:
                    entry_type = TYPE_CHARACTER
            else:
                # Check again for LOCATION, this time on non-bold
                if exp_location.search(raw) != None:
                    entry_type = TYPE_LOCATION
                    self.meta_finished = True
                # Flag instructions such as "PAN TO:" as DIRECTION
                elif exp_direction_colon_ending.search(raw) != None:
                    entry_type = TYPE_DIRECTION
                elif (not is_first) and self.entries[-1]["type"] in [TYPE_CHARACTER, TYPE_SPEECH]:
                    entry_type = TYPE_SPEECH

        if not self.meta_finished:
            entry_type = TYPE_META                

        return entry_type, raw


*/