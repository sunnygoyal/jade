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

var FileIO = (function() {

  /**
   * Shows an open file dialog
   * @param {function(file, object)} callback called when a file is selected.
   *         The second parameter to the callback is an option key
   *         which can be used to later write the selected file.
   */
  var selectFile = function(callback) {
    var input = $("<input type='file' />");
    input.change(function() {
      if (this.files && this.files[0] && callback) {
        callback(this.files[0]);
      }
    });
    input.click();
  }

  /**
   * Saves a file on the user's disk
   * @param {object} cmd command to send to the worker thread.
   * @param {string} name default name of the file to save.
   */
  var saveFile = function(cmd, name) {
    var downloadLink = $("<a/>").get(0);
    downloadLink.download = name;

    sql.send(cmd, function(data) {
      if (data.error) {
        errorToast(data.error);
      } else {
        var url = URL.createObjectURL(data.blob);
        downloadLink.href = url;
        downloadLink.dispatchEvent(new MouseEvent("click"));
        URL.revokeObjectURL(url);
      }
    });
  }

  /**
   * Downloads the file and saves it at the given name.
   * @param {string} url url to download
   * @param {string} name target file name
   */
  var downloadFile = function(url, name) {
    var downloadLink = $("<a/>").get(0);
    downloadLink.download = name;
    downloadLink.href = url;

    window.setTimeout(function() {
        downloadLink.dispatchEvent(new MouseEvent("click"));
    }, 10);
  }



  /**
   * Shows an open file dialog
   * @param {function(file, object)} callback called when a file is selected.
   *         The second parameter to the callback is an option key
   *         which can be used to later write the selected file.
   * @param {boolean} readonly if true, file is opened as readonly.
   */
  var selectFileExtension = function(callback, readonly) {
    chrome.fileSystem.chooseEntry({type: readonly? "openFile" : "openWritableFile"}, function(entry) {
      if (!entry) return;
      entry.file(function(file) {
        return callback(file, entry);
      });
    });
  }

  var writeFileExtension = function(entry, blobProvider) {
    var waitForIO = function(writer, callback) {
      // set a watchdog to avoid eventual locking:
      var start = Date.now();
      // wait for a few seconds
      var reentrant = function() {
        if (writer.readyState===writer.WRITING && Date.now()-start<4000) {
          setTimeout(reentrant, 100);
          return;
        }
        if (writer.readyState===writer.WRITING) {
          console.error("Write operation taking too long, aborting!"+
            " (current writer readyState is "+writer.readyState+")");
          writer.abort();
        }
        else {
          callback();
        }
      };
      setTimeout(reentrant, 100);
    }

    blobProvider(function(blob) {
        entry.createWriter(function(writer) {
            writer.truncate(blob.size);
            waitForIO(writer, function() {
                writer.onwriteend = function () {
                  Materialize.toast(i18n.getMessage("msg_file_saved"), 1000);
                };
                writer.seek(0);
                writer.write(blob);
            });
        });
    });
  }

  var sqlBlobProvider = function(cmd) {
    return function(callback) {
      sql.send(cmd, function(data) {
        if (data.error) {
          errorToast(data.error);
          return;
        }
        callback(data.blob);
      });
    };
  }

  /**
   * Saves a file on the user's disk when running in chrome extension
   * @param {object} cmd command to send to the worker thread.
   * @param {string} name default name of the file to save.
   */
  var saveFileExtension = function(cmd, name, saveTarget) {
    if (saveTarget) {
      // File entry already present
      writeFileExtension(saveTarget, sqlBlobProvider(cmd));
    } else {
      // Get a file entry
      chrome.fileSystem.chooseEntry({
        type: 'saveFile',
        suggestedName: name
      }, function(entry) {
        if (!entry) return;
        writeFileExtension(entry, sqlBlobProvider(cmd));
      });
    }
  };

  /**
   * Downloads the file and saves it at the given name.
   * @param {string} url url to download
   * @param {string} name target file name
   */
  var downloadFileExtension = function(url, name) {
    var blobProvider = function(callback) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = function(e) {
        if (this.status == 200) {
          callback(new Blob([this.response]));
        }
      };
      xhr.send();
    }
    chrome.fileSystem.chooseEntry({
      type: 'saveFile',
      suggestedName: name
    }, function(entry) {
      if (!entry) return;
      writeFileExtension(entry, blobProvider);
    });
  }

  if (chrome && chrome.fileSystem) {
    // Running as extension
    return {
      save: saveFileExtension,
      open: selectFileExtension,
      download: downloadFileExtension
    };
  } else {
    return {
      save: saveFile,
      open: selectFile,
      download: downloadFile
    };
  }
})();
