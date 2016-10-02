/*
Copyright 2016 Google Inc. All Rights Reserved.

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

var CSVExport = (function() {

  var separatorPopup, encloseFieldsPopup;

  var dataToExport;

  var initUI = function() {
    separatorPopup = new PopupMenu();
    separatorPopup.items = ["Comma (,)", "Semicolor (;)", "Pipe (|)", "Tab"];
    separatorPopup.translated = true;
    separatorPopup.attachTo($("#csvSeparator").val(separatorPopup.items[0]));

    encloseFieldsPopup = new PopupMenu();
    encloseFieldsPopup.items = ["If needed", "Always", "Never"];
    encloseFieldsPopup.translated = true;
    encloseFieldsPopup.attachTo($("#csvEncloseFields").val(encloseFieldsPopup.items[0]));

    $("#btn_start_csv_export").click(doExport);
  }

  var doExport = function() {
    var cmd = {
      action: "exportCSV",
      preserveBlobs: true,
      data: dataToExport,
      seperator: [",", ";", "|", "\t"][separatorPopup.items.indexOf($("#csvSeparator").val())],
      includeHeader: $("#chkIncludeHeader").is(":checked"),
      enclosing: encloseFieldsPopup.items.indexOf($("#csvEncloseFields").val())
    }
    var name = "output.csv";
    FileIO.save(cmd, name);
    $("#export_csv").closeModal();
  }

  var show = function() {
    dataToExport = $(".table-container:visible").data("datagrid-data");
    if (!dataToExport) {
      errorToast("No output to export");
      return;
    }
    if (!separatorPopup) {
      initUI();
    }

    $("#export_csv").openModal({
      out_duration: 100,
      in_duration: 120,
      dismissible: false
    });
  }

  return {
    show : show
  };
})();
