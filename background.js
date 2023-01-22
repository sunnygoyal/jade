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

chrome.runtime.onStartup.addListener(function() {
  // Find an unused id.
  // Using an id enables storing the window state, but disables opening multiple windows.
  // To allow opening multiple-instances, we use an unused id every time. This doesn't
  // save the state properly, but at-least the first window has consistent state.
  var usedIds = chrome.window.getAll().map(function(window) {
    return window.id;
  });
  var id = 0;
  var idStr;
  do {
    idStr = "client-" + id;
    id++;
  } while (usedIds.indexOf(idStr) > -1)

  var params = {
	  innerBounds: {
		  minWidth: 640,
		  minHeight: 400
	  },
      state: "maximized",
	  id: idStr
  };
  chrome.window.create("index.html", params);
});

chrome.action.onClicked.addListener( () => {
   chrome.tabs.create({url:'index.html'});
});