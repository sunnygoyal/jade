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

// Chrome throws some wierd exception without this.
function noop () { }

/**
* A JQuery plugin for creating Data grids
*/
(function ( $ ) {

  /* @constant CSS class of the table holder */
  var CLASS_DATAGIRD = "table-container";

  /* @constant CSS class of the table body */
  var CLASS_DATAGIRD_BODY = "table-body";

  /* @constant CSS class of the table header row */
  var CLASS_DATAGIRD_HEAD = "header";

  /* @constant */
  var CLASS_ACTIVE = "active";


  /* @constant JQuery selector for cell value edit popup. The element must be present in the html document. */
  var EDIT_DIALOG = "#daragrid_dialog";

  /* @constant CSS class on the edit dialog to indicate that it is editable */
  var CLASS_EDITABLE = "allow-edit";

  /* @constant CSS class on the edit dialog to indicate that has a blob value */
  var CLASS_HAS_BLOB = "has-blob";

  /* @constant JQuery selector for the download button in the edit dialog */
  var DOWNLOAD_BTN = "#daragrid_dialog #daragrid_dialog_download";

  /* @constant JQuery selector for input text in edit dialog */
  var CELL_INPUT = "#daragrid_cell_text";


  /* @constant CSS class on cells of a hidden column */
  var CLASS_HIDE_COLUMN = "column-hidden";

  /* @constant Element tag for column expand button */
  var EL_COLUMN_EXPAND_BTN = "column-expand-button"


  /* @constant Key used to store the table options on the table element */
  var KEY_OPTIONS = "grid-options";

  /* @constant Key used to store the cell value */
  var KEY_VALUE = "grid-value";

  /* @constant Minium width of a column when table is created */
  var MIN_START_WIDTH = 100;

  /* @type {JQuery} The popup menu for showing options on a column */
  var cellPopup;

  /* @type {CanvasRenderingContext2D} Used to measure width of cells */
  var ctxCellMeasure;

  /* @type {PopupMenu} Popup menu for column options */
  var popupColumnOptions;

  /**
  * Finds the table this element blongs to.
  * @param {JQuery} el
  */
  var findTable = function(el) {
    return el.closest("." + CLASS_DATAGIRD);
  }

  /**
   * Finds the column head at the provided index
   * @param {JQuery} table
   * @param {int} index
   * @return {JQuery} table element
   */
  var findHead = function(table, index) {
    return table.children().first().children().eq(index * 2);
  }

  /**
   * Finds all the cells in column at the provided index
   * @param {JQuery} el or the cell head
   * @param {int|undefined} index of the column. Not required id the provided element is a
   * table head cell.
   * @return {JQuery} table element
   */
  var findCells = function(el, index) {
    if (index != undefined) {
      return el.find(`.${CLASS_DATAGIRD_BODY} span:nth-child(${index + 1})`)
    } else {
      return findCells(findTable(el), el.index() / 2);
    }
  }

  /**
  * Callback for mose down even on a column resize. Handles column resizing. This is called on the resizer which
  * is next to the column head.
  * @param {MouseEvent}
  */
  var resizeMouseDown = function(e) {
    if (e.which != 1) return;
    e.preventDefault();

    // The column index
    var pos = ($(this).index() - 1) / 2;
    var table = findTable($(this));

    var cells = table.find(`.${CLASS_DATAGIRD_BODY} span:nth-child(${pos+1})`);
    var cellHead = $(this).prev();
    var resizer = $(this).addClass(CLASS_ACTIVE);
    cellHead.parent().addClass(CLASS_ACTIVE);

    var startWidth = cellHead.width();
    var minWidth = parseInt(cellHead.css("min-width"), 10);
    var startX = e.pageX;

    // Create a resize bar if it does not yet exist.
    var bar = table.find("resizebar");
    if (bar.length == 0) {
      bar = $("<resizebar/>").appendTo(table);
    }

    var barStartLeft = $(this).position().left + ($(this).width() - bar.width()) / 2;
    bar.css({
      left: barStartLeft,
      transform: $(this).parent().css("transform")
    }).show();

    $(document).bind("mousemove.datagrid", function(e) {
      var delta = e.pageX - startX;
      if ((delta + startWidth) < minWidth) {
        delta = minWidth - startWidth;
      }

      cellHead.width(startWidth + delta);
      cells.width(startWidth + delta);
      bar.css("left", barStartLeft + delta);

      e.preventDefault();

    }).bind("mouseup.datagrid", function() {
      $(document).unbind(".datagrid");
      resizer.removeClass(CLASS_ACTIVE);
      bar.hide();
      cellHead.parent().removeClass(CLASS_ACTIVE);
    });
  }

  /**
  * Select a row in the table body. Called on a table row.
  */
  var selectRow = function(e) {
    if (!$(this).hasClass(CLASS_ACTIVE)) {
      $(this).parent().children("." + CLASS_ACTIVE).removeClass(CLASS_ACTIVE);
      $(this).parent().parent().data(KEY_OPTIONS).onRowSelect($(this).addClass(CLASS_ACTIVE).index());
    }
  }

  /**
   * Fixes the table head to be always on the top, by translating it approptiately.
   * Called when the table is scrolled.
   */
  var fixHeader = function(e) {
    var scroll = $(this).scrollTop();
    var shadow = Math.min(scroll, 100) / 100;
    var head = $(this).children().first().css({
      transform: `translateY(${scroll}px)`,
      boxShadow: `0 0 ${shadow * 4}px rgba(0,0,0,${shadow * .14}), 0 ${shadow * 4}px ${shadow * 8}px rgba(0,0,0,${shadow * .28})`
    });
  }

  /**
   * Called when a cell si double clicked. Shows a popup with the cell value for quick view/copy.
   * If the cell is editable, allows editing the value.
   */
  var cellDblClicked = function(e) {
    e.preventDefault();
    var table = findTable($(this));
    var options = table.data(KEY_OPTIONS);

    var editable = options.allowEdit($(this).index());
    var value = $(this).data(KEY_VALUE);

    if (!editable && value == null) return;

    var dialog = $(EDIT_DIALOG).show().removeClass(CLASS_HAS_BLOB);
    dialog.find("h4").text(findHead(table, $(this).index()).text());

    var text;
    var img = dialog.find("img");
    if (value != null && value.blobType) {
      // Blob
      if (value.blobType == "blob") {
        i18n.getMessage("column_type_blob_size", value.length);
      } else {
        text = i18n.getMessage("column_type_blob_data", [value.length, value.blobType])
      }
      $("#daragrid_dialog_blob").text(text);

      dialog.addClass(CLASS_HAS_BLOB);
      $(DOWNLOAD_BTN).unbind(".datagrid").bind("click.datagrid", function() {
        FileIO.download(value.blobUrl, $("#daragrid_dialog h4").text() + "." + value.blobType);
      });

      if (value.blobType == "gif" || value.blobType == "jpg" || value.blobType == "png") {
        img.attr("src", value.blobUrl);
      }
    } else {
      text = value == null ? "" : value;
    }

    var cell = $(CELL_INPUT).val(text);
    if (editable || !dialog.hasClass(CLASS_HAS_BLOB)) {
      cell.keyup().focus().select();
    }

    var hideInputPrompt = function() {
      $(document).unbind(".datagrid-prompt");
      dialog.hide();
      cell.unbind(".datagrid-prompt");
      img.removeAttr("src");
    }

    if (editable) {
      dialog.addClass(CLASS_EDITABLE);
      cell.removeAttr("readOnly").focus().select();
      var that = $(this);

      var setValue = function(value) {
        hideInputPrompt();
        var rowValues = [];
        that.parent().children().each(function() {
          rowValues.push($(this).data("grid-value"));
        });

        options.onSave(that.index(), value, rowValues, function(result) {
          bindColumnValue(that, result);
        });
      }

      // Disable the save button to prevent accidental save
      $("#daragrid_dialog_save").unbind("click").click(function() {
        if (!$(this).hasClass("disabled")) {
          setValue(cell.val());
        }
      }).addClass("disabled");
      cell.bind("keyup.datagrid-prompt", function(e) {
        $("#daragrid_dialog_save").removeClass("disabled");
      })

      $("#daragrid_dialog_delete").unbind("click").click(function() {
        setValue(null);
      });

      // Reset file input
      $("#daragrid_dialog_upload input").remove();
      $('<input type="file" />').prependTo("#daragrid_dialog_upload").change(function(e) {
        setValue(this.files[0]);
      });

    } else {
      dialog.removeClass(CLASS_EDITABLE);
      cell.attr("readonly", "readonly")
    }

    // Position the popup above the clicked cell.
    var pos = $(this).offset();
    dialog.css({
      left: Math.min($(document).width() - dialog.width() - 10, pos.left),
      bottom: Math.max($(document).height() - dialog.height() - pos.top, 10)
    });

    // Auto hide the popup when clicked outside or escape key press
    $(document).bind("mousedown.datagrid-prompt", function(e) {
      if (!$.contains(dialog.get(0), e.target)) {
        hideInputPrompt();
      }
    }).bind("keyup.datagrid-prompt", function(e) {
      if (e.which == 27) hideInputPrompt();
    });
  }

  /**
   * Callback for show hidden column button. Recursively shows all consicutive hidden columns before this button parent.
   * Called on the expand button which lies inside the table head cell.
   */
  var showColumnsClicked = function(e) {
    var head = $(this).parent();
    $(this).remove();

    head = head.prev().prev().removeClass(CLASS_HIDE_COLUMN);
    var index = head.index() / 2;
    findCells(head).removeClass(CLASS_HIDE_COLUMN);
    head.children(EL_COLUMN_EXPAND_BTN).click();
  }


  /**
   * Callback when an option is selected from the column popup.
   */
  var onPopupItemClicked = function(index) {
    var head = this.parent();
    if (index == 0) {
      // Hide column.
      head.addClass(CLASS_HIDE_COLUMN);
      findCells(head).addClass(CLASS_HIDE_COLUMN);

      $(`<${EL_COLUMN_EXPAND_BTN}/>`).prependTo(head.next().next()).click(showColumnsClicked);
    } else {
      autoSizeColumn(head);
    }
  }

  /**
   * Description  Resizes the column to fit the values without any overflow
   * @param {JQuery} cellHead The column head element
   */
  var autoSizeColumn = function(head) {
    // Measure head
    var headFont = getComputedStyle(head.get(0), null);
    ctxCellMeasure.font = headFont.font;
    var width = Math.max(ctxCellMeasure.measureText(head.text()).width,
                         parseInt(headFont.minWidth, 10));

    // Measure cells
    var cells = findCells(head);
    if (cells.get(0)) {
      ctxCellMeasure.font = getComputedStyle(cells.get(0), null).font;
      cells.each(function() {
        width = Math.max(width, ctxCellMeasure.measureText($(this).text()).width);
      });
    }

    cells.width(width);
    head.width(width);
  }

  var headDblClicked = function(e) {
    autoSizeColumn($(this).parent());
  }

  /**
   * Binds and display the column value
   * @param {JQuery} col Cell element
   * @param v the value to bind
   */
  var bindColumnValue = function(cell, v) {
    cell.data(KEY_VALUE, v);
    if (v == null) {
      cell.text(i18n.getMessage("column_type_null")).addClass("no-display-value");
    } else if (v.blobType) {
      cell.text(i18n.getMessage("column_type_blob_size", [v.length])).addClass("no-display-value");
    } else {
      cell.text(v).removeClass("no-display-value");
    }
  }

  /**
   * Callback for checking if a cell is editable
   * @callback allowEdit
   * @params {int} columnIndex
   * @return {boolean} true if cell is editable
   */

  /**
   * Callback when background same is complete
   * @callback onSaveComplete
   * @params {*} newValue the actual saved value
   */

  /**
   * Callback when a cell value is edited
   * @callback onSave
   * @params {int} columnIndex
   * @params {*} newValue
   * @params {*[]} rowValues array of original values for that row
   * @params {onSaveComplete}
   */

  /**
   * Create a data table
   * @param {Object} data The data to display
   * @param {String[]} data.columns column names
   * @param {*[][]} data.values 2d of values. Each element is a array of values corresponding to each column.
   * @param {Object|undefined} options
   * @param {allowEdit|undefined} options.allowEdit
   * @param {onSave|undefined} options.onSave
   * @param {boolean|undefined} options.preserveHead if true, the table head is not reset. The provided data must match
   * the previously applied data.
   * @param {function(int)|undefined} options.onRowSelect Callback when a row is selected. The selected row index is passed
   * as an argument
   */
  $.fn.datagrid = function(data, options) {
    options = $.extend({
      allowEdit: function() {return false},
      onSave: function() {},
      onRowSelect: function() {},
      preserveHead : false
    }, options);

    // Initialize contexts used for measuring cells.
    if (!ctxCellMeasure) {
      ctxCellMeasure = $("<canvas />").get(0).getContext("2d");
      ctxCellMeasure.imageSmoothingEnabled = false;
    }

    if (!popupColumnOptions) {
      popupColumnOptions = new PopupMenu("menu_hide_column", "menu_auto_size");
      popupColumnOptions.onPopupItemClicked = onPopupItemClicked;
    }

    var table = this.scrollTop(0).data(KEY_OPTIONS, options).addClass(CLASS_DATAGIRD);
    var cols = data.columns.length;

    var body;
    var colState = [];
    var minWidth;

    if (options.preserveHead) {
      body = table.children("." + CLASS_DATAGIRD_BODY).empty();

      // Cleate column state.
      table.children("." + CLASS_DATAGIRD_HEAD).children("label").each(function() {
        colState.push([$(this).width(), $(this).hasClass(CLASS_HIDE_COLUMN)]);
      })
    } else {
      table.empty().unbind("scroll").scroll(fixHeader);

      // Add Header
      var header = $("<div>").addClass(CLASS_DATAGIRD_HEAD).appendTo(table);

      for (var i = 0; i < cols; i++) {
        var head = $("<label>").append($("<span/>").text(data.columns[i]).dblclick(headDblClicked)).appendTo(header);
        $("<resizeend>").html("&nbsp;").appendTo(header).mousedown(resizeMouseDown);

        // overflow menu
        popupColumnOptions.attachTo($("<column-menu-button/>").appendTo(head));

        // Measure width
        if (i == 0) {
          headFont = getComputedStyle(head.get(0), null);
          ctxCellMeasure.font = headFont.font;
          minWidth = parseInt(headFont.minWidth, 10);
        }
        colState[i] = [Math.max(ctxCellMeasure.measureText(data.columns[i]).width, minWidth), i];
      }

      // Add another column for space
      $("<label>").html("<span>&nbsp;</span>").appendTo(header);

      // Optimization: Do not append the body, so that the browser doesn't render the table twice when we try to calculate column widths.
      body = $("<div>").addClass(CLASS_DATAGIRD_BODY);
    }

    for (var i = 0; i < data.values.length; i++) {
      var row = $("<div>").appendTo(body).click(selectRow);
      for (var j = 0; j < cols; j++) {
        var col = $("<span>").appendTo(row).dblclick(cellDblClicked);
        bindColumnValue(col, data.values[i][j]);

        if (options.preserveHead) {
          // Use 5 extra pixels to account for the border width.
          col.width(colState[j][0] + 5);
          if (colState[j][1]) {
            col.addClass(CLASS_HIDE_COLUMN);
          }
        } else {
          // Update min width.
          if (i == 0 && j == 0) {
            ctxCellMeasure.font = getComputedStyle(col.get(0), null);
          }
          colState[j][0] = Math.max(ctxCellMeasure.measureText(col.text()).width, colState[j][0]);
        }
      }
      // Add another column in the end
      $("<span>").appendTo(row);
    }

    // Auto resize columns
    if (!options.preserveHead) {
      var awailableWidth = table.width() - 100 - 26 * cols;
      var total = 0;

      for (var i = 0; i < colState.length; i++) {
        total += colState[i][0];
      }

      // find the cells using the body element, until that are appended to the head.
      var findCells = function(index) {
        var cells = body.children().map(function() {
          return $(this).children().get(index);
        });
        return cells;
      }

      var heads = table.children().first().children()
      if (total < awailableWidth) {
        // All columns can fit the screen without scroll, expand cells proprotionally
        var factor = awailableWidth / total;

        for (var i = 0; i < colState.length; i++) {
          var width = colState[i][0] * factor;
          findCells(i).css("width", width + 26);
          heads.eq(i * 2).css("width", width + 21)
        }
      } else {
        /**
         * Resize column based on the stratagy:
         *   1) If the cell is smaller that the default width, make them small
         *   2) If there is more space available for remaining column than the default width, share it equally among columns
         *   3) If there is not enough space, use default width, and let the table scroll
         */
        colState.sort(function(a, b) {return a[0] - b[0]});

        var remainingWidth = awailableWidth;
        var remainingCols = colState.length;
        var expectedCellWidth = MIN_START_WIDTH;

        for (var i = 0; i < colState.length; i++) {
          remainingCols --;
          var width;
          if (colState[i][0] < expectedCellWidth) {
            width = colState[i][0];
            remainingWidth -= width;
            expectedCellWidth = (remainingCols <= 0) ? MIN_START_WIDTH : Math.max(MIN_START_WIDTH, remainingWidth / remainingCols);
          } else {
            width = expectedCellWidth;
            remainingWidth -= width;
          }

          findCells(colState[i][1]).css("width", width + 26);
          heads.eq(colState[i][1] * 2).css("width", width + 21)
        }
      }

      body.appendTo(table);
    }
    return this;
  };

  /**
   * @return {*[]} values to the provided row index
   */
  $.fn.datagridRowValues = function(rowIndex) {
    var values = [];
    // Note: using $(...).map skips null values, so used $(...).each instead.
    this.children("." + CLASS_DATAGIRD_BODY).children().eq(rowIndex).children().each(function() {
      values.push($(this).data(KEY_VALUE));
    });
    return values;
  }
}( jQuery ));
