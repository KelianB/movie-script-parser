# Movie Script Parser

This is a utility node module that parses movie scripts from [the Internet Movie Script Database](http://imsdb.com/) (IMSDb).

## Why?

The screenplays from IMSDb adhere very loosely to the standard rules of screenplay formatting, making the use of this data difficult. This project intends on making it easier for anyone 
who wants to use the screenplays by cleaning them up and annotating each line.

## Performance

The parser is flexible enough to perform well on most screenplays. It does however fail on some of the very inconsistent ones due to its rule-based nature. 
