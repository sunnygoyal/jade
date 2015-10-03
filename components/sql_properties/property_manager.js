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
 * Base class for handling properties view
 */

/**
 * Create a new property manager.
 * @class
 * @param {string} name
 * @param {string} type type of the object: table, view, index or trigger
 * @param {string|undefined} pragma sqlite pragma for gating the property
 */
function PropertyManager(name, type, pragma) {
  this.name = name;
  this.type = type;
  this.pragma = pragma;
}

/**
 * Loads the item and shows the data
 * @param {Object} cmd query to send to the sql client
 */
PropertyManager.prototype.load = function(cmd) {
  $("#propertyContent").show();

  // Reset UI
  $("#propertySql .card-title").text(this.name);
  $("#propertyContent .buttonbar").hide();
  $("#propertyColumns").hide();

  var that = this;

  var el = $("#propertyCodeMirror");
  var cm = el.data("codemirror");

  if (!cm) {
    cm = CodeMirror.fromTextArea(el.get(0), {
      mode: "text/x-mariadb",
      autofocus: true,
      readOnly: true,
      lineWrapping: true
    });
    el.data("codemirror", cm);
    cm.setValue("");
  }

  var sqlstatement = `SELECT sql FROM sqlite_master where name = ${escapeSql(this.name)}`;
  if (this.pragma) {
    sqlstatement = `${sqlstatement}; PRAGMA ${this.pragma}(${escapeSql(this.name)});`;
  }

  sql.send({
    action: "exec",
    sql: sqlstatement
  }, function(data) {
    if (data.error) {
      errorToast(data.error);
    } else if (!data[0]) {
      Materialize.toast(i18n.getMessage("msg_error_property_not_found", [that.type, that.name]), 2000)
      AppUi.reload();
    } else {
      that.success = true;
      $("#propertyContent .buttonbar").show();
      $("#btn_property_delete").unbind(".property-manager").bind("click.property-manager", that.confirmDelete.bind(that));
      cm.setValue(data[0].values[0][0]);

      if (data[1]) {
        $("#propertyColumns").show();
        $("#propertyColumns .table-container").datagrid(data[1]);
      }
    }
  });
}


PropertyManager.prototype.confirmDelete = function() {
  showConfirmation(i18n.getMessage("msg_confirm_delete_property", [this.type, this.name]), i18n.getMessage("btn_delete"), this.deleteItem.bind(this));
}

PropertyManager.prototype.deleteItem = function() {
  sql.send({
    action: "exec",
    sql: `drop ${this.type} if exists ${escapeSql(this.name)}`
  }, function(data) {
    if (data.error) {
      errorToast(data.error);
    } else {
      AppUi.reload();
    }
  });
}
