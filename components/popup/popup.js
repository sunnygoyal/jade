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
 * Implementation of popups and combopopups
 */
var PopupMenu = (function() {
  var CLS_COMBO = "combo_popup";
  var CLS_POPUP = "abs_popup";

  /**
   * Creates a list for popup.
   */
  var createUL = function(parent, itemArray, traslated) {
    var el = $("<ul class='popup-menu' />").appendTo(parent);
    for (var i = 0; i < itemArray.length; i++) {
      var item = $("<li/>").appendTo(el);
      if (itemArray[i] == null) {
        item.addClass("separator");
      } else {
        var text;
        if (itemArray[i].constructor === Array) {
          item.addClass("has-sub-popup").data("popup-children", itemArray[i]);
          text = itemArray[i][0];
        } else {
          text = itemArray[i];
        }
        if (!traslated) {
          text = i18n.getMessage(text);
        }
        $("<span class='waves-effect'/>").appendTo(item).text(text);
      }
    }
    return el;
  }

  /**
   * A popup menu which can be attached to multiple targets.
   * A list of items should be passed in the constructor arguments.
   */
  function PopupMenu() {
    this.lastShown = null;
    this.items = $.extend([], arguments);
  }

  /**
   * Attaches the popup to a target.
   *
   * @param {JQuery} target.
   */
  PopupMenu.prototype.attachTo = function(target) {
    var openFn = openPopup.bind(this, target);
    if (target.is("input")) {
      // Target is text box, attach a click handler to the arrow button next to the input.
      target.next().click(openFn);
      if (target.attr("readonly")) {
        target.click(openFn);
        target.keydown(keyUp.bind(this, target, true));
      } else {
        target.keyup(keyUp.bind(this, target, false));
      }
    } else {
      target.click(openFn);
    }
  }

  PopupMenu.prototype.remove = function() {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  /**
   * Callback when a popup item is clicked. This should be overriden.
   * @this {JQuery} element hosting the popup.
   * @param {int...} index the popup item position. In case of a subpopup, all the indixes leading to this item.
   */
  PopupMenu.prototype.onPopupItemClicked = function(index) {
    // No op
  }

  var hidePopup = function(slow) {
    $(document).unbind(".popup-menu");
    if (this.lastShown) {
      if (slow) {
        this.el.stop().fadeOut("slow");
      } else {
        this.el.hide();
      }

      this.lastShown.removeClass("active").unbind(".popup-menu");
      this.lastShown = null;

      this.lastParents.unbind(".popup-menu");
      this.lastParents = null;
    }
    this.selectionIndex = -1;
  }

  var closeSubpopup = function(el) {
    el.children(".selected").removeClass("selected").children("ul").hide();
  }

  var openPopup = function(target, autoShow) {
    if (this.lastShown) {
      if (this.lastShown[0] == target[0]) {
        // Popup is already showing.

        // Only updatethe autoshow if it was true.
        if (this.autoShow) this.autoShow = autoShow;
        return;
      }

      hidePopup.call(this);
    }

    var isCombobox = target.is("input");
    if (isCombobox && target.is(":disabled")) {
      return;
    }
    // Create popup
    if (!this.el) {
      this.el = createUL(document.body, this.items, this.translated).addClass(isCombobox ? CLS_COMBO : CLS_POPUP);
      if (isCombobox) {
        this.el.find("span").mousedown(mouseDown.bind(this));
      } else {
        this.el.find("span").click(popupItemSelected.bind(this));
      }
    }

    closeSubpopup(this.el);

    var hideFn = hidePopup.bind(this, false);
    if (isCombobox) {
      if (!target.is(":focus")) {
        target.focus();
      }

      if (target.attr("readonly")) {
        this.selectionIndex = this.items.indexOf(target.val());
        var selection = this.el.children().eq(this.selectionIndex).addClass("selected");

        this.el.show();
        var pos = target.offset();
        var selPos = selection.position();

        this.el.width(target.parent().outerWidth()).css({
          left: pos.left,
          top: pos.top - selPos.top
        }).velocity({
          translateY: [0, selPos.top + (target.parent().outerHeight() - this.el.outerHeight()) / 2],
          scaleY: [1, target.parent().outerHeight() / this.el.outerHeight()]
        }, {
          duration: 150,
          easing: "easeOutExpo"
        });

      } else {
        var pos = target.offset();
        this.el.width(target.parent().outerWidth()).show().css({
          left: pos.left,
          top: pos.top + target.height(),
          maxHeight: $(document).height() - pos.top - target.height() - 20
        }).velocity({
          translateY: [0, -this.el.outerHeight() / 2],
          scaleY: [1, 0]
        }, {
          duration: 150,
          easing: "easeOutExpo"
        });

        this.selectionIndex = -1;
        this.autoShow = autoShow;
      }

      target.bind("blur.popup-menu", hideFn);
    } else {
      // Show the popup below the button.
      var pos = target.offset();
      var left = Math.max(Math.min($(document).width() - this.el.width() - 10, pos.left), 0);
      var top = Math.max(Math.min(pos.top + target.height(), $(document).height() - this.el.outerHeight()), 0);
      
      var popup = this.el.css({left: left,top: top}).show().velocity({
        translateX : [0, pos.left - left + (target.outerWidth() - this.el.outerWidth()) / 2],
        translateY : [0, -(target.outerHeight() + this.el.outerHeight()) / 2],
        scaleX: [1, target.outerHeight() / this.el.outerHeight()],
        scaleY: [1, target.outerWidth() / this.el.width()]
      }, {
        duration: 200,
        easing: "easeOutExpo"
      });

      target.addClass("active");
      // Hide popup when clicked outside
      $(document).bind("mousedown.popup-menu", function(e) {
        if (!$.contains(popup.get(0), e.target)) {
          e.stopPropagation();
          e.preventDefault();
          hideFn();
        }
      });
    }

    this.lastParents = target.parents().bind("scroll.popup-menu", hideFn);
    this.lastShown = target;
  }

  var popupItemSelected = function(e) {
    var clicked = $(e.target).parent();
    if (clicked.hasClass("has-sub-popup")) {
      closeSubpopup(clicked.parent());
      clicked.addClass("selected");

      var nextPopup = clicked.children("ul");
      if (nextPopup.length == 0) {
        var items = clicked.data("popup-children").slice(1);
        nextPopup = createUL(clicked, items, this.translated).addClass(CLS_POPUP);
        nextPopup.find("span").click(popupItemSelected.bind(this));
      }

      // Show the subpopup
      closeSubpopup(nextPopup);
      nextPopup.show();

      var pos = clicked.offset();
      var left = pos.left;
      var top = pos.top;

      var parentW = clicked.width();
      var popupW = nextPopup.width();
      

      var popupH = nextPopup.outerHeight();
      var winH = $(window).height();
      var popupH = nextPopup.get(0).scrollHeight;
      var popupTop;
      if ((top + popupH) < winH) {
        popupTop = -16;
        nextPopup.removeClass("has_scroll").outerHeight(popupH);
      } else if (winH >= popupH + 16) {
        popupTop = winH - top - popupH -16;
        nextPopup.removeClass("has_scroll").outerHeight(popupH);
      } else {
        popupTop = -top;
        nextPopup.addClass("has_scroll").outerHeight(winH);
      }

      var left = ((left + parentW + popupW) < $(document).width()) ? parentW : -popupW;
      nextPopup.css({
        left: left,
        top: popupTop
      }).velocity({
        translateX: [0, -left/2],
        opacity: [1, 0.6]

      }, {
        duration: 200,
        easing: "easeOutExpo"
      });

    } else {
      var arr = findIndexArray(clicked, []);
      var host = this.lastShown;
      hidePopup.call(this, true);
      this.onPopupItemClicked.apply(host, arr);
    }
  }

  var findIndexArray = function(el, arr) {
    arr.unshift(el.index());
    var parent = el.parent().parent();
    if (parent.hasClass("has-sub-popup")) {
      findIndexArray(parent, arr);
    }
    return arr;
  }

  /**
   * Seles the seleted index of in the popup, which allows controlling
   * the popup using keyboard control.
   */
  var setSelection = function(index) {
    this.el.children(".selected").removeClass("selected");

    if (index == -1) {
      this.selectionIndex = -1;
      return;
    }

    if (index < 0) {
      index = this.items.length - 1;
    } else if (index >= this.items.length) {
      index = 0;
    }
    this.selectionIndex = index;
    var selection = this.el.children().eq(index).addClass("selected");

    var elTop = selection.position().top;
    var elHeight = selection.height();
    var ulHeight = this.el.height();
    if (elTop < 0) {
      this.el.scrollTop(this.el.scrollTop() + elTop);
    } else if ((elTop + elHeight) > ulHeight) {
      this.el.scrollTop(this.el.scrollTop() + elTop + elHeight - ulHeight);
    }
  }

  /**
   * Handles key up events.
   * @param {JQuery} el Jquery object representing a text box.
   * @param {KeyboardEvent} e
   */
  var keyUp = function(el, readonly, e) {
    var keyCode = e.keyCode;
    if (readonly) {
      if (keyCode == 32) {
        keyCode = 13;
      }

      if (!this.lastShown && (keyCode == 40 || keyCode == 38 || keyCode == 13)) {
        openPopup.call(this, el);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    switch (keyCode) {
      case 40: // Down key
        openPopup.call(this, el);
        setSelection.call(this, this.selectionIndex + 1);
        e.preventDefault();
        e.stopPropagation();
        break;
      case 38:  // Up key
        openPopup.call(this, el);

        setSelection.call(this, (readonly && this.selectionIndex == 0) ? (this.items.length - 1) : (this.selectionIndex - 1));
        e.preventDefault();
        e.stopPropagation();
        break;
      case 13: // Enter
        if (this.selectionIndex > -1) {
          el.val(this.el.children().eq(this.selectionIndex).text()).trigger("input").trigger("change")
        }
      case 27:
        e.preventDefault();
        e.stopPropagation();
        if (this.lastShown && keyCode == 27 && readonly) {
          el.keyup(preventEscape);
        }
        hidePopup.call(this);
        break;
      default:
        if (!readonly && (!this.lastShown || this.autoShow)) {
          // Prefix match
          var val = el.val().toLocaleLowerCase();
          if (val == "") {
            hidePopup.call(this);
          } else {
            for (var i = 0; i < this.items.length; i++) {
              if (this.items[i].toLocaleLowerCase().indexOf(val) == 0) {
                openPopup.call(this, el, true);
                setSelection.call(this, i);
                return;
              }
            }
            hidePopup.call(this);
          }
        }
    }
  }

  var preventEscape = function(e) {
    if (e.keyCode == 27) {
      e.preventDefault();
      e.stopPropagation();
      $(this).unbind("keyup", preventEscape);
    }
  }

  /**
   * Handle mouse down events on the popup items.
   * We handle mousedown instead of click, as click will come after
   * the blur and the popup will get hidden before accepting the input.
   */
  var mouseDown = function(e) {
    e.preventDefault();
    e.stopPropagation();
    this.lastShown.val($(e.target).text()).trigger("input").trigger("change").focus();
    hidePopup.call(this);
  }
  return PopupMenu;
})();
