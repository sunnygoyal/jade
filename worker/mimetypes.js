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

var parseMimeType = (function() {

  // @constant match any value
  var SKIP = "skip";

  var tree = { };

  /**
   * Adss a definition to the tree
   * @param {string} type
   * @param {int[]} signature array of prefix bytes
   */
  var addToTree = function(type, signature) {
    var root = tree;

    for (var i = 0; i < signature.length; i++) {
      if (!root[signature[i]]) {
        root[signature[i]] = { };
      }
      root = root[signature[i]];
    }

    root.type = type;
  }

  addToTree("mp4", [0x00, 0x00, 0x00, SKIP, 0x66, 0x74, 0x79, 0x70]);
  addToTree("mp4", [0x33, 0x67, 0x70, 0x35]);
  addToTree("gif", [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
  addToTree("gif", [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  addToTree("jpg", [0xFF, 0xD8, 0xFF, 0xE0]);
  addToTree("jpg", [0xFF, 0xD8, 0xFF, 0xE1]);
  addToTree("jpg", [0xFF, 0xD8, 0xFF, 0xE2]);
  addToTree("jpg", [0xFF, 0xD8, 0xFF, 0xE3]);
  addToTree("jpg", [0xFF, 0xD8, 0xFF, 0xE8]);
  addToTree("zip", [0x50, 0x4B, 0x03, 0x04]);
  addToTree("zip", [0x50, 0x4B, 0x05, 0x06]);
  addToTree("zip", [0x50, 0x4B, 0x07, 0x08]);
  addToTree("rar", [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00]);
  addToTree("rar", [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00]);
  addToTree("png", [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  addToTree("pdf", [0x25, 0x50, 0x44, 0x46]);
  addToTree("ogg", [0x4F, 0x67, 0x67, 0x53]);
  addToTree("psd", [0x38, 0x42, 0x50, 0x53]);
  addToTree("mp3", [0xFF, 0xFB]);
  addToTree("mp3", [0x49, 0x44, 0x33]);
  addToTree("bmp", [0x42, 0x4D]);
  addToTree("mid", [0x4D, 0x54, 0x68, 0x64]);
  addToTree("tar", [0x75, 0x73, 0x74, 0x61, 0x72, 0x00, 0x30, 0x30]);
  addToTree("tar", [0x75, 0x73, 0x74, 0x61, 0x72, 0x20, 0x20, 0x00]);
  addToTree("7z",  [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]);
  addToTree("wav", [0x52, 0x49, 0x46, 0x46, SKIP, SKIP, SKIP, SKIP, 0x57, 0x41, 0x56, 0x45]);

  /**
   * Tries to find the mime type for the provided data
   * @param {Uint8Array} data
   * @returns {string} file extension for the mime type
   */
  var matchMime = function(data) {
    var root = tree;
    for (var i = 0; i < data.length; i++) {
      if (root[data[i]]) {
        root = root[data[i]];
        if (root.type) {
          return root.type;
        }
      } else if (root[SKIP]) {
        root = root[SKIP];
      } else {
        return null;
      }
    }
    return null;
  }

  return matchMime;
})();
