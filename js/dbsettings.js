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

var DbSettings = (function() {

  var TYPE_INT_MINUS_1 = -1;
  var TYPE_INT = 0;
  var TYPE_READONLY = 1;
  var TYPE_BOOLEAN = 2;
  var TYPE_COMBO = 3;

  var popups = {};

  var allSettings;

  var initSettings = function() {
    allSettings = {
      db_setting_section_versioning : {
        schema_version: TYPE_INT,
        user_version: TYPE_INT,
        application_id: TYPE_INT
      },
      db_setting_section_pages_or_sizes : {
        page_size: ["512", "1024", "2048", "4096", "8192", "16384", "32768", "65536"],
        page_count: TYPE_READONLY,
        max_page_count: TYPE_INT,
        journal_mode: ["Delete", "Truncate", "Persist", "Memory", "Wal", "Off"],
        journal_size_limit: TYPE_INT_MINUS_1,
        wal_autocheckpoint: TYPE_INT,
        cache_size: TYPE_INT,
        cache_spill: TYPE_BOOLEAN
      },
      db_setting_section_file_io : {
        legacy_file_format: TYPE_BOOLEAN,
        locking_mode: ["Normal", "Exclusive"],
        query_only: TYPE_BOOLEAN,
        secure_delete: TYPE_BOOLEAN,
        synchronous: ["Off", "Normal", "Full"],
        mmap_size: TYPE_INT,
      },
      db_setting_section_others : {
        auto_vacuum: ["None", "Full", "Incremental"],
        automatic_index: TYPE_BOOLEAN,
        busy_timeout: TYPE_INT,
        foreign_keys: TYPE_BOOLEAN,
        defer_foreign_keys: TYPE_BOOLEAN,
        encoding: TYPE_READONLY,
        read_uncommitted: TYPE_BOOLEAN,
        recursive_triggers: TYPE_BOOLEAN,
        reverse_unordered_selects: TYPE_BOOLEAN,
      }
    };
  }



  /**
   * Called when the input of a number box changed. It ensures that the input is a valid number.
   */
  var onNumberInputChange = function(e) {
    var val = $(this).val();
    if (val.match(/^\-?[0-9]+$/) && parseInt(val) >= parseInt($(this).attr("min"))) {
      $(this).attr("last-number-input", $(this).val());
    } else {
      e.stopPropagation();
      e.preventDefault();
      $(this).val($(this).attr("last-number-input")).change();
    }
  }

  /**
   * Restricts the input to only have numbers
   * @param {type} el Description
   */
  var makeNumberInput = function(el) {
    return el.attr("last-number-input", el.val()).change(onNumberInputChange);
  }


  /**
   * Gets a list of changed values
   */
  var getChangedValues = function() {
    var changed = {};
    $("#db_settings input").each(function() {
      var pragma = $(this).attr("property-name");
      if (!pragma) {
        return;
      }

      var oldValue = $(this).attr("original-value");
      var newValue = $(this).is("[type='checkbox']")
          ? ($(this).is(":checked") ? "1" : "0")
          : $(this).val();

      if (oldValue != newValue) {
        changed[pragma] = newValue;
      }
    });
    return changed;
  }

  /**
   * Verifies if any value has changed.
   */
  var verifyValueChange = function() {
    if ($.isEmptyObject(getChangedValues())) {
      $("#accept_db_settings").addClass("disabled");
    } else {
      $("#accept_db_settings").removeClass("disabled");
    }
  }

  var createForm = function(data) {
    var parent = $("#db_settings tbody");
    var pos = 0;

    for (var category in allSettings) {
      var settingGroup = allSettings[category];
      $("<td colspan=2>").appendTo($("<tr/>").appendTo(parent)).text(i18n.getMessage(category));

      for (var pragma in settingGroup) {
        var setting = settingGroup[pragma];
        var value = data[pos++].values[0][0];

        // Add row
        var row = $("<tr/>").appendTo(parent).append($("<td/>").text(i18n.getMessage("db_setting_" + pragma)));
        var col = $("<td>").appendTo(row);
        var el;
        if (setting.constructor == Array) {
          // Combo box
          el = $('<input type="text" readonly>').appendTo(col);
          $("<span/>").appendTo(col.addClass("combo-box"));
          var popup = popups[pragma];
          if (!popup) {
            popup = new PopupMenu();
            popup.items = setting;
            popup.translated = true;
            popups[pragma] = popup;
          }
          for (var i = 0; i < popup.items.length; i++) {
            if (popup.items[i].toUpperCase() == (value + "").toUpperCase()) {
              el.val(popup.items[i]);
            }
          }
          if (el.val() == "") {
            if (typeof(value) == "number" && popup.items[value]) {
              el.val(popup.items[value]);
            } else {
              el.val(popup.items[0]);
            }
          }
          value = el.val();
          popup.attachTo(el);
        } else {
          switch (setting) {
            case TYPE_INT:
            case TYPE_INT_MINUS_1:
              el = $('<input type="number">').appendTo(col).val(value).attr("min", setting);
              makeNumberInput(el);
              break;
            case TYPE_READONLY:
              el = $('<input type="text" readonly>').appendTo(col).val(value);
              break;
            case TYPE_BOOLEAN:
              el = $(`<div class="switch"><label>${i18n.getMessage('label_off')} <input type="checkbox"><span class="lever"></span> ${i18n.getMessage('label_on')}</label></div>`)
                .appendTo(col).find("input");
              if (value == 1) {
                el.attr("checked", "checked");
              }
              break;
          }
        }
        if (setting != TYPE_READONLY) {
          el.attr("property-name", pragma).attr("original-value", value).change(verifyValueChange);
        }
      }
    }
  }

  var saveSettings = function() {
    if ($(this).hasClass("disabled")) {
      return;
    }

    var changed = getChangedValues();

    $(this).addClass("disabled");
    if ($.isEmptyObject(changed)) {
      return;
    }

    // Disable form
    $("#db_settings input").attr("disabled", "disabled");

    var query = "";
    for (var pragma in changed) {
      query += `PRAGMA ${pragma} = ${changed[pragma]};`;
    }

    sql.send({
      action: "exec",
      preserveBlobs: true,
      sql: query
    }, function(data) {
      if (data.error) {
        errorToast(data.error);
        $("#db_settings input").removeAttr("disabled");
        $("#accept_db_settings").removeClass("disabled");
      } else {
        Materialize.toast(i18n.getMessage("msg_db_properties_updated"), 1000);
        $("#db_settings").closeModal();
      }
    });
  }

  var cleanupDialog = function() {
    $("#db_settings tbody").empty();
    for (var i in popups) {
      popups[i].remove();
    }
  }

  var show = function() {
    if (!allSettings) {
      initSettings();
    }
    $("#db_settings tbody").empty();
    $("#accept_db_settings").addClass("disabled").unbind("click").click(saveSettings);

    var query = "";
    for (var i in allSettings) {
      for (var j in allSettings[i]) {
        query += "PRAGMA " + j + ";";
      }
    }

    sql.send({
      action: "exec",
      preserveBlobs: true,
      sql: query
    }, function(data) {
      if (data.error) {
        errorToast(data.error);
      } else {
        createForm(data);
      }
    })

    $("#db_settings").openModal({
      out_duration: 100,
      in_duration: 120,
      dismissible: false,
      complete: cleanupDialog
    });
  }

  return {
    show : show
  };
})();
