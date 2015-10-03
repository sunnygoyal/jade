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
 * Global state variables and methods
 */

var sql;

/**
 * Shows a confirmation prompt.
 * @param {string} msg message of the prompt
 * @param {string} acceptText text for the primary action button
 * @param {function} callback callback when the primary action button is clicked
 */
var showConfirmation = function(msg, acceptText, callback) {
  $("#dialog_confirmation p").text(msg);
  $("#dialog_confirmation_accept").unbind(".confirm-dialog").bind("click.confirm-dialog", callback);
  $("#dialog_confirmation").openModal({
    out_duration: 100,
    in_duration: 150
  });
}


/**
 * Shows a general toast with error message
 * @param {string} error
 */
var errorToast = function(error) {
  Materialize.toast(i18n.getMessage("msg_error", error), 2000)
}

var AppUi = (function() {

  /**
   * Called when a side bar tab is clicked.
   */
  var showSidebarTab = function(e) {
    $(".contentTab").hide();
    $(".sidebar a").removeClass("active");
    $(this).addClass("active");

    if ($(this).attr("id") == "btnRunSql") {
      RunSql.show();
    } else {
      var index = $(this).parent().index();
      var name = $(this).children("span").text();
      switch (index) {
        case 2: // Tables
          Tables.show(name);
          break;
        case 5: // Views
          Views.show(name);
          break;
        case 7: // Indexes
          Indexes.show(name);
          break;
        case 9: // Triggers
          Triggers.show(name);
          break;
      }
    }
  }


  /**
   * Renders the main UI.
   * @param {string[][]} sqlData.values 2d array where each item is an array of the form [name, type]
   * @param {string|undefined} toPick if provided, that entry is selected by default;
   */
  var loadUI = function(sqlData, toPick) {
    // Pick Run SQL by default
    var selectedItem = $("#btnRunSql").unbind("click").click(showSidebarTab);

    var sections = $(".sidebar .db_entries");
    sections = {
      table: [sections.eq(0).empty(), "view_compact"],
      view: [sections.eq(2).empty(), "web"],
      index: [sections.eq(3).empty(), "list"],
      trigger: [sections.eq(4).empty(), "settings_ethernet"]
    };

    if (sqlData[0]) {
      var items = sqlData[0].values;
      for (var i = 0; i < items.length; i++) {
        var name = items[i][0];
        var type = items[i][1];

        var sectionInfo = sections[type];
        if (sectionInfo) {
          var item = $('<a class="waves-effect"/>').attr("type", type).appendTo(sectionInfo[0]).click(showSidebarTab)
            .append($('<i class="material-icons small left"/>').text(sectionInfo[1]))
            .append($("<span/>").text(name));

          if (toPick && name == toPick) {
            selectedItem = item;
          }
        }
      }
    }

    // *************** Run SQL ***********************
    selectedItem.click();
  }

  return {
    reload: function(toPick) {
      sql.send({action: "reload"}, function(data) {
        loadUI(data, toPick);
      });
    }
  }
})()

var moreOptionsClicked = function(index, subIndex) {
  switch(index) {
    case 0: // Open
      FileIO.open(openDb);
      break;
    case 1: // Reload
      AppUi.reload();
      break;
    case 2: // DB Settings
      DbSettings.show();
      break;

    case 4: { // Export
      var cmd = {
        preserveBlobs: true,
        action: "export"
      }
      var name;
      switch (subIndex) {
        case 0: // All tables
          cmd.type = ["table"];
          cmd.includeDrop = true;
          cmd.includeData = true;
          name = "tables.sql";
          break;
        case 1: // Database
          cmd.type = ["table", "view", "index", "trigger"];
          cmd.includeDrop = true;
          cmd.includeData = true;
          name = "database.sql";
          break;
        case 2: // Database structure
          cmd.type = ["table", "view", "index", "trigger"];
          name = "dbstructure.sql";
          break;
      }
      if (!name) {
        return;
      }
      FileIO.save(cmd, name);
      break;
    }
    case 5: // Import SQL
      FileIO.open(importSql, true);
      break;
  }
}

var openDb = function(dbFile, saveTarget) {
  var newSql = new SQL(dbFile, function(data) {
    if (data.error) {
      errorToast(data.error);
      newSql.terminate();
    } else {
      // Successfully load DB.
      sql.terminate();
      sql = newSql;
      sql.saveTarget = saveTarget;
      AppUi.reload();
      $("#size-menu label").text(dbFile.name);
    }
  });
}

var saveDB = function() {
  FileIO.save({
    preserveBlobs: true,
    action: "exportDB"
  }, $("#size-menu label").text(), sql.saveTarget);
}

var importSql = (function() {
  var startImport = function(sqlFile) {
    if ($("#start_sql_import").hasClass("disabled")) {
      return;
    }

    $("#import_sql p").hide();
    $("#start_sql_import").addClass("disabled");
    $("#import_sql .progress").show().children().css("width", "0%");
    $("#btn_cancel_import").hide();

    sql.send({
      preserveBlobs: true,
      action: "import",
      transaction: $("#chkTransaction").is(":checked"),
      file: sqlFile
    }, handleImportResponse);
  }

  var handleImportResponse = function(response) {
    if (response.progress != undefined) {
      $("#import_sql .progress > div").css("width", (response.progress * 100) + "%");
    } else if (response.error) {
      $("#import_sql .progress").hide();
      $("#import_sql pre").show().text(response.error);
      $("#import_sql b").show().text((response.line != undefined) ? i18n.getMessage("msg_error_at_line", [response.line]) : i18n.getMessage("msg_error_import"));
      $("#btn_cancel_import").show();
      AppUi.reload();
    } else {
      $("#import_sql").closeModal();
      Materialize.toast(i18n.getMessage("msg_import_complete"), 2000);
      AppUi.reload();
    }
  }

  return function(sqlFile) {
    $("#import_sql h4").text(i18n.getMessage("title_import", sqlFile.name));
    $("#import_sql p").show().children("input").attr("checked", "checked");

    $("#import_sql .progress, #import_sql b, #import_sql pre").hide();
    $("#btn_cancel_import").show();
    $("#start_sql_import").removeClass("disabled").unbind(".appui").bind("click.appui", startImport.bind(this, sqlFile));

    $("#import_sql").openModal({
      out_duration: 100,
      in_duration: 150,
      dismissible: false
    });
  }
})()

$(function() {
  i18n.onLoad(function() {
    // Load messages
    $("[i18n-id]").each(function() {
      var msg = i18n.getMessage($(this).attr("i18n-id"));
      if ($(this).attr("i18n-attr")) {
        $(this).attr($(this).attr("i18n-attr"), msg)
      } else {
        $(this).text(msg);
      }
    });

    sql = new SQL(null, AppUi.reload);

    $("#btn_add_table").click(Tables.showAdd);

    // Add a dummy happer implementation
    if (!window.Hammer) {
      window.Hammer = function() { };
      window.Hammer.prototype.on = function() { };
    }

    var moreOptions = new PopupMenu(
      "menu_open",
      "menu_reload",
      "title_db_properties",
      null,
      ["menu_export", "menu_export_tables", "menu_export_db", "menu_export_db_structure"],
      "title_import_sql"
    );
    moreOptions.attachTo($("#app_more_options"));
    moreOptions.onPopupItemClicked = moreOptionsClicked;

    $("#save-db").click(saveDB);
  })
});
