/*
Copyright 2015 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * Splits a SQL text into multiple commands
 * Based on qlite/shell.c
 */
var importSql = (function() {

  var IsSpace = function(x) {
    return (
      x === ' '  ||
      x === '\t' ||
      x === '\n' ||
      x === '\v' ||
      x === '\f' ||
      x === '\r');
  }

  /*
  ** Test to see if a line consists entirely of whitespace.
  */
  var _all_whitespace = function(z){
    for (var i = 0; i < z.length; i++) {
      if (IsSpace(z[i])) continue;

      if (z[i] == '/' && z[i+1] == '*') {
        i += 2;
        while (i < z.length && (z[i] != '*' || z[i+1] != '/')) { i++; }
        if (i == z.length) return false;
        i++;
        continue;
      }

      if (z[i] == '-' && z[i+1] == '-') {
        i += 2;
        while (i < z.length && z[i] != '\n') { i++; }
        if (i == z.length ) return true;
        continue;
      }
      return false;
    }
    return true;
  }

  /*
  ** Return TRUE if the line typed in is an SQL command terminator other
  ** than a semi-colon.  The SQL Server style "go" command is understood
  ** as is the Oracle "/".
  */
  var line_is_command_terminator = function(zLine){
    var i = 0;
    while (IsSpace(zLine[i])) { i++; };

    if (i < zLine.length && zLine[i]=='/' && _all_whitespace(zLine.substr(i + 1))) {
      return true;  /* Oracle */
    }

    if (i < zLine.length && zLine[i].toLowerCase() == 'g' && zLine[i + 1].toLowerCase() == 'o'
           && _all_whitespace(zLine.substr(i + 2))){
      return true;  /* SQL Server */
    }
    return false;
  }

  /*
  ** Return true if zSql is a complete SQL statement.  Return false if it
  ** ends in the middle of a string literal or C-style comment.
  */
  var line_is_complete = function(zSql){
    if (!zSql) return true;
    return SQL.isComplete(zSql + ";");
  }

  /*
  ** Return TRUE if a semicolon occurs anywhere in the first N characters
  ** of string z[].
  */
  var line_contains_semicolon = function(z) {
    return z.indexOf(';') > -1;
  }

  var startline = 0;      /* Line number for start of current input */

  var tokenize = function(text, progressData) {
    var lines = text.split("\n");

    var zLine = "";         /* A single input line */
    var zSql = "";          /* Accumulated SQL text */
    var nLine;              /* Length of current line */
    var nSql = 0;           /* Bytes of zSql[] used */
    var nSqlPrior = 0;      /* Bytes of zSql[] used by prior line */
    var lineno = 0;         /* Current line number */

    var lastUpdateTime = new Date().getTime();
    var now;

    while (lineno < lines.length) {
      zLine = lines[lineno]

      now = new Date().getTime();
      if ((now - lastUpdateTime) >= 100) {
        progressData.progress = lineno/lines.length;
        postMessage(progressData);
        lastUpdateTime = now;
      }

      lineno++;

      if (nSql==0 && _all_whitespace(zLine)) {
        continue;
      }

      if (line_is_command_terminator(zLine) && line_is_complete(zSql)) {
        zLine = ";";
      }

      nLine = zLine.length;
      nSqlPrior = nSql;

      if (nSql==0) {
        var i;
        for (i =0 ; i < nLine && IsSpace(zLine[i]); i++) {}
        zSql = zLine.substr(i);
        startline = lineno;
        nSql = nLine - i;
      } else {
        zSql = zSql + '\n' + zLine;
        nSql = nSql + 1 + nLine;
      }

      if (nSql > 0 && line_contains_semicolon(zSql.substring(nSqlPrior))
          && SQL.isComplete(zSql)) {
        // Found a complete sql statement
        db.exec(zSql);
        nSql = 0;
      } else if (nSql > 0 && _all_whitespace(zSql)) {
        // Ignore
        nSql = 0;
      }
    }

    if (nSql > 0 && !_all_whitespace(zSql)) {
      throw {message: "Incomplete SQL: " + zSql};
    }

    return {done: true};
  }

  function startImport(args) {
    startline = 0;
    var reader = new FileReaderSync();
    var sql = reader.readAsText(args.file);

    if (args.transaction) {
      db.exec("BEGIN TRANSACTION");
    }

    var result;
    try {
      result = tokenize(sql, {id: args.id, partialResponse: true});
      if (args.transaction) {
        db.exec("COMMIT TRANSACTION");
      }
    } catch (e) {
      if (args.transaction) {
        db.exec("ROLLBACK TRANSACTION");
      }
      result = {
        error: e.message,
        line: startline
      }
    }

    return result;
  }

  return startImport;

})();
