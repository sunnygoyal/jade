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

importScripts('../third_party/sql/sql.js');

importScripts('where.peg.js'); // remove-on-compile
importScripts('mimetypes.js'); // remove-on-compile
importScripts('import_sql.js'); // remove-on-compile

var db;

var cachedUrls = [];

SQL.Statement.prototype.parseBlob = function(value) {
  var type = parseMimeType(value);
  if (!type) type = "blob";
  var url = URL.createObjectURL(new Blob([value]));
  cachedUrls.push(url);
  return {
    blobUrl : url,
    blobType : type,
    length: value.length
  }
}

function openDb(file) {
  if (!file) {
    db = new SQL.Database();
  } else {
    var reader = new FileReaderSync();
    db = new SQL.Database(new Uint8Array(reader.readAsArrayBuffer(file)));
  }

  return reloadMasterTable();
}

function reloadMasterTable() {
  return db.exec("SELECT name, type FROM sqlite_master");
}

var handleCommand = function(data) {
  // Revoke all old urls.
  if (!data.preserveBlobs && cachedUrls.length > 0) {
    for (var i = 0; i < cachedUrls.length; i++) {
      URL.revokeObjectURL(cachedUrls[i]);
    }
    cachedUrls = [];
  }

  switch (data.action) {
    case "open":
      return openDb(data.file);
    case "reload":
      return reloadMasterTable();
    case "exec": {
      if (data.query) {
        // Verify the query
        try {
          Parser.parse(data.query);
        } catch (e) {
          throw {message: "Invalid search params"};
        }
        data.sql = data.sql + " where " + data.query;
      }

      return db.exec(data.sql);
    }
    case "load": {
      return loadTable(data.name);
    }
    case "statement" : {
      return runStatement(data);
    }
    case "export" : {
      return exportData(data);
    }
    case "exportDB" : {
      return exportDB(data);
    }
    case "import": {
      return importSql(data);
    }
  }
}

var runStatement = function(data) {
  var stmt = db.prepare(data.sql);
  stmt.run(sanitizeArgs(data.args));
  stmt.free();

  if (!data.resultSql) {
    return {result: "OK"};
  }
  stmt = db.prepare(data.resultSql);
  var result = stmt.get(sanitizeArgs(data.resultArgs));
  stmt.free();
  return result;
}

var sanitizeArgs = function(args) {
  for (var i = 0; i < args.length; i++) {
    if (args[i] instanceof File) {
      // read file to blob
      var reader = new FileReaderSync();
      var ab = reader.readAsArrayBuffer(args[i]);
      args[i] = new Uint8Array(ab);
    } else if (args[i] != null && args[i].blobType) {
      var request = new XMLHttpRequest();
      request.open('GET', args[i].blobUrl, false);  // `false` makes the request synchronous
      request.responseType = 'arraybuffer';
      request.send(null);
      if (request.status === 200) {
        args[i] = new Uint8Array(request.response);
      } else {
        throw {message: "Error loading blob"};
      }
    }
  }
  return args;
}

var loadTable = function (tableName) {
  var cols = db.exec(`PRAGMA table_info(${escapeSql(tableName)})`)[0];
  // Check for primary key
  var pkIndex = cols.columns.indexOf("pk");
  var hasPrimaryKey = false;
  // Check if there is a primary key or not
  for (var i = 0; i < cols.values.length; i++) {
    if (cols.values[i][pkIndex] == 1) {
      // primary index found;
      hasPrimaryKey = true;
      break;
    }
  }

  var sql = (hasPrimaryKey ? "select * from " : "select rowid, * from ") + escapeSql(tableName);
  var entries = db.exec(sql);

  var tableData = entries[0];
  if (!tableData) {
    // Table was empty. Create a dummy table
    var columns = [];
    if (!hasPrimaryKey) {
      columns.push("rowid");
    }

    var nameIndex = cols.columns.indexOf("name");
    for (var i = 0; i < cols.values.length; i++) {
      columns.push(cols.values[i][nameIndex]);
    }
    tableData = {
      columns : columns,
      values : []
    };
  }

  return {
    0: tableData,
    1: cols,
    hasPrimaryKey : hasPrimaryKey,
    baseSql: sql,
    pkIndex : pkIndex
  };
}

var exportData = function(args) {
  var dropString = "";
  var entries = db.exec("SELECT type, name, sql FROM sqlite_master")[0].values;

  var fullString = "";
  for (var i = 0; i < entries.length; i++) {
    if (args.type.indexOf(entries[i][0]) == -1) continue;

    var name = escapeSql(entries[i][1]);
    dropString += `DROP ${entries[i][0].toUpperCase()} IF EXISTS ${name};\n`;
    fullString += entries[i][2] + ";\n";

    if (args.includeData && entries[i][0].toUpperCase() == "TABLE") {
      var stmt = db.prepare(`SELECT * from ${name}`);
      stmt.parseBlob = function(data) {return data};
      while(stmt.step()) {
        var values = stmt.get().map(exportDataMapper).join(",");
        fullString += `INSERT INTO ${name} VALUES(${values});\n`
      }
      stmt.free();
    }
  }

  if (args.includeDrop) {
    fullString = dropString + fullString;
  }

  var data = new Blob([fullString], {type: 'text/plain'});
  return {blob: data};
}

var exportDataMapper = function(v) {
  if (v == null) {
    return "NULL";
  } else if (typeof(v) == "string") {
    return escapeSql(v);
  } else if (v instanceof Uint8Array) {
    var str = "";
    for (var i = 0; i < v.length; i++) {
      var hex = v[i].toString(16);
      str += hex.length < 2 ? "0" + hex : hex;
    }
    return "X'" + str + "'";
  } else {
    return v;
  }
}

var exportDB = function(args) {
  return {blob: new Blob([db.export()])};
}

self.onmessage = function(event) {
  var result;
  try {
    result = handleCommand(event.data);
  } catch (e) {
    result = { error: e.message };
  }
  result.id = event.data.id;
  return postMessage(result);
}

var escapeSql = function(param) {
  return "'" + param.replace(/'/g, "''") + "'";
}