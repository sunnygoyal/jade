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

var i18n = (function() {
  if (chrome && chrome.i18n && chrome.i18n.getMessage) {
    return  {
      getMessage: chrome.i18n.getMessage,
      onLoad: function(callback) {
        callback();
      }
    }
  }

  var locales;
  if (navigator.languages) {
    locales = [...navigator.languages];
  } else {
    var locale = navigator.userLanguage || navigator.language;
    if (typeof(locale) == "string") {
      locales = [locale];
      if (locale.indexOf("-") > 0) {
        locales.push(locale.substr(0, locale.indexOf("-")));
      }
    }
  }

  // Default locale
  if (locales.indexOf("en") < 0) {
    locales.push("en");
  }
  console.log(locales, typeof locales);

  // Load jsons
  var promise = $.when.apply($, locales.map(function(locale, i) {
    var def = $.Deferred();
    locales[i] = {};
    $.getJSON(`_locales/${locale}/messages.json`).done(function(data) {
      locales[i] = data;
    }).always(function() {
      def.resolve();
    });
    return def;
  }));

  promise.done(function() {
    locales.reverse();
    locales = $.extend.apply($, locales);
  });

  var getMessage = function(id, args) {
    var msg;
    if (locales[id]) {
      msg = locales[id].message;
    } else {
      return "";
    }
    if (args == undefined || args == null) {
      return msg;
    }
    if (args.constructor != Array) {
      args = [args];
    }
    return msg.replace(/\$\d+/g, function(match) {
      var index = parseInt(match.substring(1)) - 1;
      return (args[index] != undefined) ? args[index] : "";
    });
  }

  return {
    getMessage: getMessage,
    onLoad: promise.done
  }
})();
