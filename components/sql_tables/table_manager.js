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
 * Base class for handling tables and views
 */


/**
 * Create a new table manager.
 * @class
 * @param {string} tableName
 * @param {string} type type of the object: table or view
 */
function TableManager(tableName, type) {
  this.name = tableName
  this.type = type;
}

/**
 * Loads the table and shows the data
 * @param {Object} cmd query to send to the sql client
 */
TableManager.prototype.load = function(cmd) {
  $("#contentTable").show();

  // Reset UI
  $("#contentTable .card-title").text(this.name);
  $("#contentTable .buttonbar").hide();
  $("#contentTable .selection-wrapper").hide();

  $("#contentTable .table-container").empty();

  var that = this;

  sql.send(cmd, function(data) {
    if (data.error) {
      Materialize.toast("Error " + data.error, 2000);
      AppUi.reload();
    } else {
      that.success = true;
      $("#contentTable .buttonbar").show();
      that.onDataLoad(that, data);
      that.showGrid(data[0]);
    }
  });

  // Bind search callbacks
  $("#contentTable #search_table").val("").unbind("keypress").keypress(function(e) {
    if (e.which == 13) {
      that.searchTable($(this).val());
    }
  });

  // Table properties
  $("#btnTableProperties").unbind("click").click(function() {
    $("#contentTable").hide();
    new PropertyManager(that.name, that.type, "table_info").load();
  });
}

/**
 * Handle data search
 * @param {string} query Description
 */
TableManager.prototype.searchTable = function(query) {
  if (!this.success) {
    return;
  }

  var that = this;
  sql.send({
    action: "exec",
    sql: this.baseSql,
    query: query
  },
  function(data) {
    if (data.error) {
      errorToast(data.error);
    } else if (!data[0]) {
      $("#contentTable .table-body").empty();
    } else {
      that.showGrid(data[0], true);
      that.query = query;
    }
  });
}
