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

var RunSql = (function() {

  var initialized = false;

  // @type {CodeMirror}
  var sqlInput;

  /**
   * Executes the sql in the input and shows the result.
   */
  function executeSql(e) {
    sql.send({
      action: "exec",
      sql: sqlInput.getValue()
    }, function(data) {
      if (data.error) {
        Materialize.toast("Error " + data.error, 2000)
      } else if (!data[0]) {
        $("#cardSqlResult").empty().hide();
      } else {
        $("#cardSqlResult").empty().show().datagrid(data[0]);
      }
    });
  }

  var initialize = function() {
    if (initialized) {
      return;
    }

    initialized = true;
    sqlInput = CodeMirror.fromTextArea($("#contentCodeMirror").get(0), {
      mode: "text/x-mariadb",
      value: "SELECT * FROM mytable",
      indentWithTabs: true,
      lineWrapping: true,
      smartIndent: true,
      lineNumbers: true,
      autofocus: true,
      extraKeys: { "Ctrl-Enter": executeSql,"Cmd-Enter": executeSql  },
    });

    $("#btnExecuteSql").click(executeSql);

    var templates = new PopupMenu(
      ["Select", "SELECT * FROM tableName", "SELECT with WHERE clause", "SELECT (general)"],
      ["Data Manipulation", "DELETE", "INSERT values", "INSERT using select", "UPDATE", "REPLACE values", "REPLACE using select"],
      ["Create / Alter",
          "CREATE TABLE", "CREATE TEMP TABLE", "CREATE TABLE x AS select-statement", "CREATE TEMP TABLE x AS select-statement",
          null,
          "ALTER TABLE x RENAME TO y", "ALTER TABLE x ADD COLUMN column-def",
          null,
          "CREATE INDEX", "CREATE UNIQUE INDEX", "CREATE VIEW", "CREATE TRIGGER"],
      ["Drop", "DROP TABLE", "DROP VIEW", "DROP INDEX", "DROP TRIGGER"],
      ["Reindex", "REINDEX tableName", "REINDEX indexName", "REINDEX collationName"],
      ["PRAGMA", "PRAGMA table_info", "PRAGMA index_list", "PRAGMA index_info", null, "PRAGMA database_list", "PRAGMA collation_list"]);
    templates.translated = true;
    templates.attachTo($("#btnSqlTemplates"));
    templates.onPopupItemClicked = onTemplateClicked;
  }

  var onTemplateClicked = function(category, index) {
    var templates = [
      [
        "SELECT * FROM tableName",
        "SELECT [ALL | DISTINCT] result FROM table-list WHERE expr",
        "SELECT [ALL | DISTINCT] result [FROM table-list] [WHERE expr] [GROUP BY expr-list] [HAVING expr] [compound-op select]* [ORDER BY sort-expr-list] [LIMIT integer [( OFFSET | , ) integer]]"
      ],
      [
        "DELETE FROM tableName [WHERE expr]",
        "INSERT INTO tableName [(column-list)] VALUES(value-list)",
        "INSERT INTO tableName [(column-list)] select-statement",
        "UPDATE tableName SET assignment [, assignment]* [WHERE expr]",
        "REPLACE INTO tableName [(column-list)] VALUES(value-list)",
        "REPLACE INTO tableName [(column-list)] select-statement"
      ],
      [
        "CREATE TABLE IF NOT EXISTS tableName (column-def [, column-def]* [, constraint]*",
        "CREATE TEMP TABLE IF NOT EXISTS tableName (column-def [, column-def]* [, constraint]*",
        "CREATE TABLE tableName AS select-statement",
        "CREATE TEMP TABLE tableName AS select-statement",
        null,
        "ALTER TABLE old_tableName RENAME TO new_tableName",
        "ALTER TABLE x ADD COLUMN column-def",
        null,
        "CREATE INDEX IF NOT EXISTS indexName ON tableName ( columnName [, columnName]* )",
        "CREATE UNIQUE INDEX IF NOT EXISTS indexName ON tableName ( columnName [, columnName]* )",
        "CREATE [TEMPORARY] VIEW IF NOT EXISTS viewName AS selectStatement",
        "CREATE [TEMPORARY] TRIGGER IF NOT EXISTS triggerName [ BEFORE | AFTER ] DELETE|INSERT|UPDATE ON tableName [ FOR EACH ROW ] [ WHEN expression ] BEGIN  semicolon-terminated-update-delete-select-or-insert-statements END"
      ],
      [
        "DROP TABLE tableName",
        "DROP VIEW viewName",
        "DROP INDEX indexName",
        "DROP TRIGGER triggerName"
      ],
      [
        "REINDEX tableName",
        "REINDEX indexName",
        "REINDEX collationName"
      ],
      [
        "PRAGMA table_info (tableName)",
        "PRAGMA index_list (tableName)",
        "PRAGMA index_info (indexName)",
        null,
        "PRAGMA database_list",
        "PRAGMA collation_list"
      ]
    ]
    if (templates[category] && templates[category][index]) {
      sqlInput.setValue(templates[category][index]);
      sqlInput.focus();
    }
  }

  var showView = function() {
    $("#contentRunSql").show();

    // Initialize after the content has become visible, so that CodeMirror can get the element dimensions properly.
    initialize();
  }

  return  {
    show: showView
  };
})();
