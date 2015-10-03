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
* Class to handle browing tables
*/
var Tables = (function() {

  /* @constant JQuery selector for a single row in add entry from */
  var ADD_FORM_ROW_SELECTOR = ".column_entry";

  /* @constant CSS class add to a form row to indicate it has text data (which hides set null and upload blob button) */
  var CLS_LONG_TEXT_DATA = "long_text";

  /* @constant JQuery selector for a single row in add entry from */
  var KEY_ROW_VALUE = "row-value";

  /* @type {TableManager} Current manager */
  var currentManager;

  /* @type {boolean} indicates whether all the click handlers have been attached or not */
  var clickHandlersInitialized = false;

  /*
   * @type {JQuery} The cached copy of the first entry in the add entry form.
   * Ths allows to easily create the form by just cloning the elements
   */
  var addEntryFormField;

  /*
   * @type {JQuery} The cached copy of an column entry in the add table form.
   * Ths allows to easily create the form by just cloning the elements
   */
  var addTableColumnField;
  var comboPopupType, comboPopupValue;

  /**
   * Binds the data to add entry row, and sets the appropriate placeholder
   * @param {*} value
   * @param {JQuery} row
   * @param {JQuery} textArea to set the placeholder
   * @param {boolean} applyText if true, the value is applied to the text area.
   */
  var bindDataToAddEntryRow = function(value, row, textArea, applyText) {
    row.data(KEY_ROW_VALUE, value);
    var v = currentManager.cols.values[row.index()];
    var primary = currentManager.hasPrimaryKey && v[currentManager.pkIndex] == 1;

    var isTextValue = false;
    var text;
    if (value == null) {
      text = i18n.getMessage((primary ? "column_type_primary_key" : "column_type_default_value"), v[currentManager.typeIndex]);
    } else if (value instanceof File) {
      text = i18n.getMessage("column_type_blob_file", value.name);
    } else if (value != null && value.blobType) {
      text = i18n.getMessage("column_type_blob_data", [value.length, value.blobType]);
    } else {
      text = i18n.getMessage("column_type_empty_string", v[currentManager.typeIndex]);
      isTextValue = true;
    }

    if (isTextValue && applyText) {
      textArea.val(value);
    }
    if (textArea.attr("placeholder", text).val().length > 20) {
      row.addClass(CLS_LONG_TEXT_DATA);
    } else {
      row.removeClass(CLS_LONG_TEXT_DATA);
    }
  }

  /**
   * Called when user changes an input field in add entry form.
   */
  var onAddFormInput = function() {
    bindDataToAddEntryRow($(this).val(), $(this).closest(ADD_FORM_ROW_SELECTOR), $(this));
  }

  var onAddFormSetNull = function() {
    var row = $(this).closest(ADD_FORM_ROW_SELECTOR);
    bindDataToAddEntryRow(null, row, row.find("textarea").val(""));
  }

  var onAddFormFileSelect = function() {
    if (this.files[0]) {
      var row = $(this).closest(ADD_FORM_ROW_SELECTOR);
      bindDataToAddEntryRow(this.files[0], row, row.find("textarea").val(""));
    }
    // Reset the value, so that the cange event is fired again when selecting the same file.
    this.value = null;
  }

  var onAddFormAccept = function(e) {
    e.preventDefault();
    if ($(this).hasClass("disabled")) {
      return;
    }

    // Disable the form
    $("#add_entry_dialog form textarea").attr("disabled", "disabled");
    $("#add_entry_dialog form .icon_button").hide();
    var that = $(this).addClass("disabled");

    var columnsAdded = "" , paramsAdded = "";
    var args = [];

    var nameIndex = currentManager.cols.columns.indexOf("name");
    $("#add_entry_dialog " + ADD_FORM_ROW_SELECTOR).each(function(i) {
      var val = $(this).data(KEY_ROW_VALUE);

      if (val != null) {
        if (columnsAdded) {
          columnsAdded += ", ";
          paramsAdded += ", ";
        }

        columnsAdded += escapeSql(currentManager.cols.values[i][nameIndex]);
        paramsAdded += "?";
        args.push(val);
      }
    });

    var showError = function(msg) {
      Materialize.toast(msg, 2000);
      $("#add_entry_dialog form textarea").removeAttr("disabled");
      $("#add_entry_dialog form .icon_button").show();
      that.removeClass("disabled");
    }

    if (!columnsAdded) {
      showError(i18n.getMessage("msg_error_no_values_provided"));
      return;
    }

    var query = `INSERT iNTO ${escapeSql(currentManager.name)} (${columnsAdded}) VALUES (${paramsAdded})`;
    sql.send({
      action: "statement",
      sql: query,
      args: args,
      preserveBlobs: true
    }, function(data) {
      if (data.error) {
        showError(i18n.getMessage("msg_error", data.error))
      } else {
        $("#add_entry_dialog").closeModal();
        // Refresh data
        currentManager.searchTable(currentManager.query);
      }
    });
  }

  /**
   * Initializes and shows the add entry dialog
   * @param {Event} e Ignored
   * @param {*[]|undefined} values Initial set of values to use.
   */
  var showAddEntryDialog = function(e, values) {
    if (!addEntryFormField) {
      addEntryFormField = $("#add_entry_dialog form > div").first();
      $("#add_entry_accept").click(onAddFormAccept);
    }
    var form = $("#add_entry_dialog form").empty();
    values = values ? values : [];

    var nameIndex = currentManager.cols.columns.indexOf("name");
    for (var i = 0; i < currentManager.cols.values.length; i++) {
      var el = addEntryFormField.clone().appendTo(form);
      el.find("label").text(currentManager.cols.values[i][nameIndex]);

      var value = values[i] != undefined ? values[i] : null;
      bindDataToAddEntryRow(value, el, el.find("textarea"), true);
    }

    form.find('.tooltipped').tooltip();
    form.find("textarea").bind("input", onAddFormInput);
    form.find(".delete_button").click(onAddFormSetNull);
    form.find('[type="file"]').change(onAddFormFileSelect);
    $("#add_entry_accept").removeClass("disabled");
    $("#add_entry_dialog").openModal({
      out_duration: 100,
      ready: function() {
        form.find("textarea").first().focus();
      }
    });
  }

  /**
   * Shows add entry dialog prefilled with selected row values.
   */
  var showDuplicateEntryDialog = function(e) {
    var values = $("#contentTable .table-container").datagridRowValues(currentManager.selectedRow);
    showAddEntryDialog(e, values);
  }

  /**
   * Deletes the selected entry.
   */
  var performDeleteEntry = function() {
    var rowValues = $("#contentTable .table-container").datagridRowValues(currentManager.selectedRow);
    var selectionArgs = [];
    var whereClause = getRowSelectionArgs(rowValues, selectionArgs);

    sql.send({
      action: "statement",
      sql: `DELETE FROM ${escapeSql(currentManager.name)} WHERE ${whereClause};`,
      args: selectionArgs
    }, function(data) {
      if (data.error) {
        errorToast(data.error)
      } else {
        // Refresh data
        currentManager.searchTable(currentManager.query);
      }
    });
  }

  /**
   * Show a prompt to confirm deleting the selected row.
   */
  var showDeleteEntryConfirmation = function(e) {
    showConfirmation(i18n.getMessage("msg_confirm_delete_row"), i18n.getMessage("btn_delete"), performDeleteEntry);
  }

  var onAddTableAccept = function(e) {
    e.preventDefault();
    if ($(this).hasClass("disabled")) {
      return;
    }

    // Disable the form
    var alredyDisabled = $("#add_table_dialog input:disabled");
    $("#add_table_dialog input").attr("disabled", "disabled");
    $("#add_table_new_column, #add_table_new_column").addClass("disabled");

    var showError = function(msg) {
      Materialize.toast(msg, 2000);
      $("#add_table_dialog input").removeAttr("disabled");
      alredyDisabled.attr("disabled", "disabled");
      $("#add_table_new_column, #add_table_new_column").removeClass("disabled");
    }

    var tableName = $("#add_table_name").val();
    if (tableName == "") {
      showError(i18n.getMessage("msg_error_no_table_name_provided"));
      $("#add_table_name").focus();
      return;
    }

    // Create query
    var query = "CREATE";
    if ($("#chkTmpTable").is(":checked")) {
      query += " TEMP";
    }
    query += " TABLE";
    if ($("#chkIfNotExist").is(":checked")) {
      query += " IF NOT EXISTS";
    }
    query += " " + escapeSql(tableName) + " (";

    var autoIncCount = 0;
    var primaryKeys = [];

    var makeColumnQuery = function(el, inlinePrimaryKey) {
      var texts = el.find("[type='text']");
      var checkboxes = el.find("[type='checkbox']");

      var columnName = texts.eq(0).val();
      if (columnName == "") {
        return null;
      }

      var columnQuery = escapeSql(columnName) + " ";
      var type = texts.eq(1).val();

      if (type != "") {
        if (comboPopupType.items.indexOf(type.toUpperCase()) > -1) {
          columnQuery += type;
        } else {
          columnQuery += escapeSql(type);
        }
      }

      // Primary and auto increment
      if (checkboxes.eq(0).is(":checked")) {
        if (inlinePrimaryKey) {
          columnQuery += " PRIMARY KEY";
        } else {
          primaryKeys.push(escapeSql(columnName));
        }


        if (type.toUpperCase() == "INTEGER" && checkboxes.eq(1).is(":checked")) {
          columnQuery += " AUTOINCREMENT";
          autoIncCount++;
        }
      }

      // Unique
      if (checkboxes.eq(3).is(":checked")) {
        columnQuery += " UNIQUE";
      }

            // Default value
      var defaultValue = texts.eq(2).val();
      if (defaultValue != "") {
        columnQuery += " DEFAULT ";
        if (comboPopupValue.items.indexOf(defaultValue.toUpperCase()) > -1) {
          columnQuery += defaultValue;
        } else {
          columnQuery += escapeSql(defaultValue);
        }
      }

      // Not null
      if (!checkboxes.eq(2).is(":checked")) {
        columnQuery += " NOT NULL";
      }

      return columnQuery;
    }

    var columns = [];
    var firstPrimaryIndex = -1;
    var firstPrimaryRow = null;

    $("#columnTable tr").each(function() {
      var columnQuery = makeColumnQuery($(this), false);
      if (columnQuery == null) return;
      if (firstPrimaryIndex == -1 && primaryKeys.length > 0) {
        // Last row was the first primary key
        firstPrimaryIndex = columns.length;
        firstPrimaryRow = $(this);
      }
      columns.push(columnQuery);
    });

    if (columns.length == 0) {
      showError(i18n.getMessage("msg_error_no_column_provided"));
      return;
    }

    if (primaryKeys.length == 1) {
      // Only one primary key, inline the primary key syntax
      columns[firstPrimaryIndex] = makeColumnQuery(firstPrimaryRow, true);
    } else if (primaryKeys.length > 1) {
      if (autoIncCount > 0) {
        showError(i18n.getMessage("msg_error_composite_increment_key"));
        return;
      } else {
        columns.push(`PRIMARY KEY (${primaryKeys.join(", ")})`);
      }
    }

    query += columns.join(", ") + ")";
    sql.send({
      action: "exec",
      sql: query
    }, function(data) {
      if (data.error) {
        showError(i18n.getMessage("msg_error", data.error));
      } else {
        $("#add_table_dialog").closeModal();
        // Refresh data
        AppUi.reload(tableName);
      }
    });
  }

  /**
   * Adds a row for a column in an add table dialog.
   */
  var newColumnRowInAddTableDialog = function() {
    var count = $("#columnTable tr").length;

    var row = addTableColumnField.clone().appendTo($("#columnTable tbody"));
    var checkboxes = row.find("[type='checkbox']").each(function(i) {
      $(this).attr("id", "addTableChk" + (i + count*5)).next().attr("for", "addTableChk" + (i + count*5));
    });

    var txt = row.find("[type='text']");
    comboPopupType.attachTo(txt.eq(1));
    comboPopupValue.attachTo(txt.eq(2));

    var checkCanAutoInc = function() {
      if (checkboxes.eq(0).is(":checked") && txt.eq(1).val().toUpperCase() == "INTEGER") {
        checkboxes.eq(1).removeAttr("disabled");
      } else {
        checkboxes.eq(1).removeAttr("checked").attr("disabled", "disabled");;
      }
    }

    txt.bind('input', checkCanAutoInc);
    checkboxes.eq(0).change(checkCanAutoInc);
    return row;
  }

  /**
   * Shows the table addition dialog.
   */
  var showAddTableDialog = function() {
    var scrollArea = $("#add_table_dialog .modal-content");
    if (!addTableColumnField) {
      addTableColumnField = $("#columnTable tr").first();
      comboPopupType = new PopupMenu("INTEGER", "BLOB", "DOUBLE", "FLOAT", "REAL", "CHAR",
                                      "TEXT", "VARCHAR", "BLOB", "NUMERIC", "DATETIME");
      comboPopupType.translated = true;
      comboPopupValue = new PopupMenu("CURRENT_DATE", "CURRENT_TIME", "CURRENT_TIMESTAMP");
      comboPopupValue.translated = true;

      $("#add_table_new_column").click(function() {
        if (!$(this).hasClass("disabled")) {
          newColumnRowInAddTableDialog().find("[type='text']").eq(0).focus();
        }
      });
      $("#add_table_accept").click(onAddTableAccept);
    }

    // Hack to reset scroll top
    scrollArea.remove().prependTo($("#add_table_dialog"));

    var columnHead = $("#columnTableHead");
    // Scroll fix, head always at top.
    scrollArea.scroll(function() {
      var pos = columnHead.parent().position();

      var shift = -Math.min(0, pos.top);
      var shadow = Math.min(shift, 100) / 100;
      columnHead.css({
        transform: `translateY(${shift}px)`,
        boxShadow: `0 0 ${shadow * 4}px rgba(0,0,0,${shadow * .14}), 0 ${shadow * 4}px ${shadow * 8}px rgba(0,0,0,${shadow * .28})`
      })
    }).scroll();

    // Reset Table
    $("#chkTmpTable, #chkIfNotExist").removeAttr("checked").removeAttr("disabled");
    $("#add_table_name").val("").removeAttr("disabled");
    var columnBody = $("#columnTable tbody").empty();
    $("#add_table_new_column, #add_table_new_column").removeClass("disabled");

    // Add 5 columns
    for (var i = 0; i < 5; i++) {
      newColumnRowInAddTableDialog();
    }

    $("#add_table_dialog").openModal({
      out_duration: 100,
      in_duration: 120,
      ready: function() {
        $("#add_table_name").focus();
      },
      complete: function() {
        comboPopupType.remove();
        comboPopupValue.remove();
      }
    });
  }

  /**
   * @param {TableManager} manager
   * @param {Object} SQL client result
   */
  var onDataLoad = function(manager, data) {
    manager.baseSql = data.baseSql;
    manager.hasPrimaryKey = data.hasPrimaryKey;
    manager.cols = data[1];
    manager.pkIndex = data.pkIndex;
    manager.typeIndex = data[1].columns.indexOf("type");

    // Show the add button
    $("#contentTable .selection-wrapper").eq(1).show();

    if (!clickHandlersInitialized) {
      clickHandlersInitialized = true;
      $("#table_add_entry").click(showAddEntryDialog);
      $("#table_copy_entry").click(showDuplicateEntryDialog);
      $("#table_delete_entry").click(showDeleteEntryConfirmation);
    }
  }

  /**
   * @returns {boolean} true if the column is editable
   */
  var shouldAllowTableColumnEdit = function(columnIndex) {
    if (!currentManager.hasPrimaryKey) {
       return columnIndex != 0;
    } else {
      return currentManager.cols.values[columnIndex][currentManager.pkIndex] != 1;
    }
  }

  /**
   * Callback when a cell value is edited. Updates the data in the DB
   * @params {int} columnIndex
   * @params {*} newValue
   * @params {*[]} rowValues array of original values for that row
   * @params {onSaveComplete}
   */
  var updateValues = function(columnIndex, newValue, rowValues, callback) {
    var selectionArgs = [];
    var whereClause = getRowSelectionArgs(rowValues, selectionArgs);

    var colNameIndex = currentManager.cols.columns.indexOf("name")
    var columnName = currentManager.cols.values[currentManager.hasPrimaryKey ? columnIndex : (columnIndex - 1)][colNameIndex];
    var tableName = escapeSql(currentManager.name);

    var updateArgs = selectionArgs.slice(0);
    updateArgs.unshift(newValue);
    var cmd = {
      action: "statement",
      sql: `UPDATE ${tableName} SET ${escapeSql(columnName)} = ? WHERE ${whereClause};`,
      args: updateArgs,
      resultSql: `SELECT ${tableName + "." + escapeSql(columnName)} from ${tableName} WHERE ${whereClause};`,
      resultArgs: selectionArgs,
      preserveBlobs: true
    };

    sql.send(cmd, function(data) {
      if (data.error) {
        Materialize.toast("Error " + data.error, 2000)
      } else {
        callback(data[0]);
      }
    });
  }


  /**
   * Creates a SQL where clause that can be used to identify the provided row values.
   * @param {*[]} rowValues Array of values for that row.
   * @param {string[]} selectionArgs this array is filled with bind params corresponding to the result.
   * @return {string} SQL where clause, e.g., col1 = ? and col2 = ?
   */
  var getRowSelectionArgs = function (rowValues, selectionArgs) {
    var colNameIndex = currentManager.cols.columns.indexOf("name")
    var whereClause = "";
    var tableNamePrefix = escapeSql(currentManager.name) + "."

    // If there is a primacy key, create a sql statement based on the primary key values, otherwise use the rowId.
    if (currentManager.hasPrimaryKey) {
      var pkIndex = currentManager.cols.columns.indexOf("pk");
      $.each(currentManager.cols.values, function(i, v) {
        if (v[pkIndex] == 1) {
          selectionArgs.push(rowValues[i]);
          if (whereClause) {
            whereClause += " AND ";
          }
          whereClause += tableNamePrefix + escapeSql(v[colNameIndex]) + " = ?";
        }
      });
    } else {
      selectionArgs = [rowValues[0]];
      whereClause = "rowid = ?";
    }
    return whereClause;
  }

  /**
   * Callback when a row is selected. Shows the delete and copy buttons.
   * @param {int} rowIndex
   */
  var onRowSelect = function(rowIndex) {
    currentManager.selectedRow = rowIndex;
    $("#contentTable .selection-wrapper").first().show();
  }

  var showGrid = function(data, preserveHead) {
    $("#contentTable .selection-wrapper").first().hide();
    $("#contentTable .table-container").show()
      .datagrid(data, {
        allowEdit : shouldAllowTableColumnEdit,
        onSave : updateValues,
        onRowSelect: onRowSelect,
        preserveHead: preserveHead
    });
  }

  var showTable = function(tableName) {
    currentManager = new TableManager(tableName, "table");
    currentManager.showGrid = showGrid;
    currentManager.onDataLoad = onDataLoad
    currentManager.load({
      action: "load",
      name: tableName
    });
  }

  return  {
    show: showTable,
    showAdd: showAddTableDialog
  };
})();
