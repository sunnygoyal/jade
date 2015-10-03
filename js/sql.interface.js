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

var SQL = function(file, callback) {
  this._counter = 0;
  this.callbacks = { };

  var that = this;
  this.worker = new Worker("worker/sql.worker.js");
  this.worker.onmessage = function(event) {
    that._handleResponse(event.data);
  }

  this.send({action:'open', file: file}, callback)
}

SQL.prototype._handleResponse = function(response) {
  if (this.callbacks[response.id]) {
    this.callbacks[response.id](response);
    if (!response.partialResponse) {
      delete this.callbacks[response.id];
    }
  }
}

SQL.prototype.send = function(command, callback) {
  var id = this._counter++;

  command.id = id;
  this.callbacks[id] = callback;
  this.worker.postMessage(command);
}

SQL.prototype.terminate = function() {
  this.worker.terminate();
}

/**
 * Escapes a SQL string
 * @param {string} param
 */
var escapeSql = function(param) {
  return "'" + param.replace(/'/g, "''") + "'";
}
