(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

(function() {
  function toArray(arr) {
    return Array.prototype.slice.call(arr);
  }

  function promisifyRequest(request) {
    return new Promise(function(resolve, reject) {
      request.onsuccess = function() {
        resolve(request.result);
      };

      request.onerror = function() {
        reject(request.error);
      };
    });
  }

  function promisifyRequestCall(obj, method, args) {
    var request;
    var p = new Promise(function(resolve, reject) {
      request = obj[method].apply(obj, args);
      promisifyRequest(request).then(resolve, reject);
    });

    p.request = request;
    return p;
  }

  function promisifyCursorRequestCall(obj, method, args) {
    var p = promisifyRequestCall(obj, method, args);
    return p.then(function(value) {
      if (!value) return;
      return new Cursor(value, p.request);
    });
  }

  function proxyProperties(ProxyClass, targetProp, properties) {
    properties.forEach(function(prop) {
      Object.defineProperty(ProxyClass.prototype, prop, {
        get: function() {
          return this[targetProp][prop];
        },
        set: function(val) {
          this[targetProp][prop] = val;
        }
      });
    });
  }

  function proxyRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return promisifyRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function proxyMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return this[targetProp][prop].apply(this[targetProp], arguments);
      };
    });
  }

  function proxyCursorRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return promisifyCursorRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function Index(index) {
    this._index = index;
  }

  proxyProperties(Index, '_index', [
    'name',
    'keyPath',
    'multiEntry',
    'unique'
  ]);

  proxyRequestMethods(Index, '_index', IDBIndex, [
    'get',
    'getKey',
    'getAll',
    'getAllKeys',
    'count'
  ]);

  proxyCursorRequestMethods(Index, '_index', IDBIndex, [
    'openCursor',
    'openKeyCursor'
  ]);

  function Cursor(cursor, request) {
    this._cursor = cursor;
    this._request = request;
  }

  proxyProperties(Cursor, '_cursor', [
    'direction',
    'key',
    'primaryKey',
    'value'
  ]);

  proxyRequestMethods(Cursor, '_cursor', IDBCursor, [
    'update',
    'delete'
  ]);

  // proxy 'next' methods
  ['advance', 'continue', 'continuePrimaryKey'].forEach(function(methodName) {
    if (!(methodName in IDBCursor.prototype)) return;
    Cursor.prototype[methodName] = function() {
      var cursor = this;
      var args = arguments;
      return Promise.resolve().then(function() {
        cursor._cursor[methodName].apply(cursor._cursor, args);
        return promisifyRequest(cursor._request).then(function(value) {
          if (!value) return;
          return new Cursor(value, cursor._request);
        });
      });
    };
  });

  function ObjectStore(store) {
    this._store = store;
  }

  ObjectStore.prototype.createIndex = function() {
    return new Index(this._store.createIndex.apply(this._store, arguments));
  };

  ObjectStore.prototype.index = function() {
    return new Index(this._store.index.apply(this._store, arguments));
  };

  proxyProperties(ObjectStore, '_store', [
    'name',
    'keyPath',
    'indexNames',
    'autoIncrement'
  ]);

  proxyRequestMethods(ObjectStore, '_store', IDBObjectStore, [
    'put',
    'add',
    'delete',
    'clear',
    'get',
    'getAll',
    'getKey',
    'getAllKeys',
    'count'
  ]);

  proxyCursorRequestMethods(ObjectStore, '_store', IDBObjectStore, [
    'openCursor',
    'openKeyCursor'
  ]);

  proxyMethods(ObjectStore, '_store', IDBObjectStore, [
    'deleteIndex'
  ]);

  function Transaction(idbTransaction) {
    this._tx = idbTransaction;
    this.complete = new Promise(function(resolve, reject) {
      idbTransaction.oncomplete = function() {
        resolve();
      };
      idbTransaction.onerror = function() {
        reject(idbTransaction.error);
      };
      idbTransaction.onabort = function() {
        reject(idbTransaction.error);
      };
    });
  }

  Transaction.prototype.objectStore = function() {
    return new ObjectStore(this._tx.objectStore.apply(this._tx, arguments));
  };

  proxyProperties(Transaction, '_tx', [
    'objectStoreNames',
    'mode'
  ]);

  proxyMethods(Transaction, '_tx', IDBTransaction, [
    'abort'
  ]);

  function UpgradeDB(db, oldVersion, transaction) {
    this._db = db;
    this.oldVersion = oldVersion;
    this.transaction = new Transaction(transaction);
  }

  UpgradeDB.prototype.createObjectStore = function() {
    return new ObjectStore(this._db.createObjectStore.apply(this._db, arguments));
  };

  proxyProperties(UpgradeDB, '_db', [
    'name',
    'version',
    'objectStoreNames'
  ]);

  proxyMethods(UpgradeDB, '_db', IDBDatabase, [
    'deleteObjectStore',
    'close'
  ]);

  function DB(db) {
    this._db = db;
  }

  DB.prototype.transaction = function() {
    return new Transaction(this._db.transaction.apply(this._db, arguments));
  };

  proxyProperties(DB, '_db', [
    'name',
    'version',
    'objectStoreNames'
  ]);

  proxyMethods(DB, '_db', IDBDatabase, [
    'close'
  ]);

  // Add cursor iterators
  // TODO: remove this once browsers do the right thing with promises
  ['openCursor', 'openKeyCursor'].forEach(function(funcName) {
    [ObjectStore, Index].forEach(function(Constructor) {
      Constructor.prototype[funcName.replace('open', 'iterate')] = function() {
        var args = toArray(arguments);
        var callback = args[args.length - 1];
        var nativeObject = this._store || this._index;
        var request = nativeObject[funcName].apply(nativeObject, args.slice(0, -1));
        request.onsuccess = function() {
          callback(request.result);
        };
      };
    });
  });

  // polyfill getAll
  [Index, ObjectStore].forEach(function(Constructor) {
    if (Constructor.prototype.getAll) return;
    Constructor.prototype.getAll = function(query, count) {
      var instance = this;
      var items = [];

      return new Promise(function(resolve) {
        instance.iterateCursor(query, function(cursor) {
          if (!cursor) {
            resolve(items);
            return;
          }
          items.push(cursor.value);

          if (count !== undefined && items.length == count) {
            resolve(items);
            return;
          }
          cursor.continue();
        });
      });
    };
  });

  var exp = {
    open: function(name, version, upgradeCallback) {
      var p = promisifyRequestCall(indexedDB, 'open', [name, version]);
      var request = p.request;

      request.onupgradeneeded = function(event) {
        if (upgradeCallback) {
          upgradeCallback(new UpgradeDB(request.result, event.oldVersion, request.transaction));
        }
      };

      return p.then(function(db) {
        return new DB(db);
      });
    },
    delete: function(name) {
      return promisifyRequestCall(indexedDB, 'deleteDatabase', [name]);
    }
  };

  if (typeof module !== 'undefined') {
    module.exports = exp;
    module.exports.default = module.exports;
  }
  else {
    self.idb = exp;
  }
}());

},{}],2:[function(require,module,exports){
'use strict';

var ConversionModule = require('./../modules/ConversionHelper.js');
var NetworkModule = require('./../modules/NetworkHelper.js');
var DisplayHelper = require('./../modules/DisplayHelper.js');
var ListModule = require('./../modules/ListModule.js');

window.onload = function () {
    var listCurr = "USD";
    // === GET ALL THE RELEVANT ELEMENTS IN THE DOM

    // currency conversion boxes
    var curr1Input = document.getElementById('curr-1');
    var curr2Input = document.getElementById('curr-2');
    var currLabelTop = document.querySelector('.currency-label.top h2');
    var currLabelBottom = document.querySelector('.currency-label.bottom h2');

    // update dialog boxes
    var updateDialog = document.getElementById('update-display');
    var updateInstallButton = document.getElementById('update-accept');
    var updateDismissButton = document.getElementById('update-dismiss');

    // currency select tirggers
    var topCurrRevealButton = document.querySelector('.currency-label.top .dropdown');
    var bottomCurrRevealButton = document.querySelector('.currency-label.bottom .dropdown');
    // currency select popups
    var currPopupTop = document.querySelector('.curr-select.top');
    var currPopupBottom = document.querySelector('.curr-select.bottom');
    // currency option buttons
    var currSelectButtonsTop = document.querySelectorAll('.curr-select.top button');
    var currSelectButtonsBottom = document.querySelectorAll('.curr-select.bottom button');
    // list elements
    var listPopup = document.querySelector("#spend-list");
    var listPopupShowButton = document.querySelector("#spend-list .show-list");
    var listNamesEl = document.querySelector(".list-names");
    var listNamesExpandEl = document.querySelector(".list-name-display img");
    var listItemsEl = document.querySelector(".list-items");
    var listTotalEl = document.querySelector(".item-total");
    var listCurrencyEl = document.querySelector(".list-currs");
    var listCurrencyExpandEl = document.querySelector(".curr-display img");

    // list tab elements
    var listPopupTab = document.querySelector("#spend-list .tab");
    var listPopupAddToListButton = document.querySelector("#spend-list .add-to-list");
    var listPopupItemDescription = document.querySelector("#spend-list .item-description");
    var listPopupExpandDescription = document.querySelector(".expand-description");
    var listNameDisplayTab = document.querySelector(".tab-list-name");
    var listTotalDisplayTab = document.querySelector(".tab-list-total");

    // helper modules
    var displayHelper = function DisplayHelper() {

        if (!document) throw new Error("No document object to work with"); // check to see if there is a document object

        // add the events to the currencySelectButtons
        var showCurrSelect = function showCurrSelect(buttonClicked, currButtons) {
            // remove selected class from all buttons
            currButtons.forEach(function (button) {
                button.classList.remove('selected');
            });
            // set the currency to the same as the selected button

            // add the selected class to the selected button
            buttonClicked.classList.add('selected');

            return;
        };

        var revealPopup = function revealPopup(popupElement) {
            return popupElement.classList.add('active');
        };
        var hidePopup = function hidePopup(popupElement) {
            return popupElement.classList.remove('active');
        };

        var updateCurrencyLabel = function updateCurrencyLabel(labelElement, currencyString) {
            labelElement.innerText = currencyString;
        };

        var generateCurrSelectButton = function generateCurrSelectButton(currLabel, selected) {
            var currButton = document.createElement('button');
            var checkElement = document.createElement('img');
            var labelName = document.createElement('p');

            labelName.innerText = currLabel; // set the labelname

            checkElement.src = "assets/checkmark.svg";
            checkElement.classList.add("checkmark");

            if (selected) currButton.classList.add('selected');

            currButton.appendChild(checkElement);
            currButton.appendChild(labelName);

            return currButton;
        };

        var emptyElement = function emptyElement(element) {
            while (element.children.length > 0) {
                element.children[0].remove();
            }
        };

        var toggleExpanded = function toggleExpanded(element) {
            return element.classList.toggle("expanded");
        };

        var genListNameEl = function genListNameEl() {
            var _ref, _ref$remove, _ref$click;

            var listName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "<name missing>";
            var callbacks = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : (_ref = {}, _ref$remove = _ref.remove, remove = _ref$remove === undefined ? function () {
                console.log("delete clicked");
            } : _ref$remove, _ref$click = _ref.click, click = _ref$click === undefined ? function () {
                console.log("listName clicked");
            } : _ref$click, _ref);


            var listNameEl = document.createElement('li');
            var deleteButton = document.createElement('button');

            deleteButton.innerText = "-";
            deleteButton.addEventListener('click', callbacks.remove);

            listNameEl.innerText = listName;
            listNameEl.addEventListener("click", callbacks.click);

            if (listName != "Default List") listNameEl.appendChild(deleteButton);

            return listNameEl;
        };

        var genListAddEl = function genListAddEl() {
            var addCallback = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function () {
                console.log("Add List button clicked");
            };


            var listAddEl = document.createElement('li');
            var addButton = document.createElement('button');
            var nameInput = document.createElement('input');

            addButton.innerText = "+";
            addButton.addEventListener('click', addCallback);

            nameInput.classList.add("listadd-listname");

            listAddEl.appendChild(nameInput);
            listAddEl.appendChild(addButton);

            return listAddEl;
        };

        var genListItemEl = function genListItemEl() {
            var description = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "<description missing>";
            var price = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

            var _ref2 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
                _ref2$remove = _ref2.remove,
                remove = _ref2$remove === undefined ? function () {
                console.log("litItem delete clicked");
            } : _ref2$remove,
                _ref2$click = _ref2.click,
                click = _ref2$click === undefined ? function () {
                console.log("listItem clicked");
            } : _ref2$click;

            var listItemEl = document.createElement('li');
            var deleteButton = document.createElement('button');

            deleteButton.innerText = "-";
            deleteButton.addEventListener('click', remove);

            listItemEl.innerText = price + ' : ' + description;
            listItemEl.addEventListener("click", click);
            listItemEl.appendChild(deleteButton);

            return listItemEl;
        };

        var genListCurrEl = function genListCurrEl() {
            var currName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "<curr not defined>";

            var _ref3 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
                _ref3$click = _ref3.click,
                click = _ref3$click === undefined ? function () {
                console.log("listCurr clicked");
            } : _ref3$click;

            var listCurrEl = document.createElement('li');

            listCurrEl.innerText = currName;
            listCurrEl.addEventListener("click", click);

            return listCurrEl;
        };

        return {
            revealPopup: revealPopup,
            hidePopup: hidePopup,
            showCurrSelect: showCurrSelect,
            updateCurrencyLabel: updateCurrencyLabel,
            generateCurrSelectButton: generateCurrSelectButton,
            emptyElement: emptyElement,
            toggleExpanded: toggleExpanded,
            genListNameEl: genListNameEl,
            genListItemEl: genListItemEl,
            genListAddEl: genListAddEl,
            genListCurrEl: genListCurrEl
        };
    }();

    var listHelper = ListModule();

    var networkHelper = NetworkModule();

    var conversionHelper = ConversionModule();

    var serviceWorkerHelper = function ServiceWorkerHelper(workerLocation, updateUI, updateTriggerEl) {
        if (!navigator.serviceWorker) throw new Error("service worker not supported");

        var updateTriggerElement = updateTriggerEl;

        // register the service worker
        navigator.serviceWorker.register(workerLocation).then(function (reg) {

            // check if service worker loaded the page - if it didn't return (as service worker is the latest)
            if (!navigator.serviceWorker.controller) return;

            // if there is one waiting - there was a service worker installed on the last refresh and its waiting
            if (reg.waiting) {
                displayHelper.revealPopup(updateUI);
                return;
            }

            // if there is a service worker installing
            if (reg.installing) {
                trackInstalling(reg.installing);
                return;
            }

            // listen for future workers installing
            reg.addEventListener('updatefound', function () {
                trackInstalling(reg.installing);
            });
        }).catch(function (err) {
            throw new Error('Service worker didn\'t register: ' + err.message);
        });

        // listen for changeover of service worker - reload page if a new one took over
        navigator.serviceWorker.addEventListener('controllerchange', function () {
            window.location.reload();
        });

        // listen to installing service worker && show user when its waiting
        var trackInstalling = function trackInstalling(worker) {

            worker.addEventListener('statechange', function () {
                if (worker.state == 'installed') {

                    updateTriggerElement.addEventListener('click', function () {
                        // add click event to the UI
                        worker.postMessage({ action: 'skipWaiting' });
                    });

                    displayHelper.revealPopup(updateUI); // show the UI
                }
            });
        };
    }('sw.js', updateDialog, updateInstallButton);

    // IMPLEMENTATION SPECIFIC COMMANDS

    // callback for when currency select buttons are clicked
    var currSelectCallback = function currSelectCallback(event, isTopCurr) {

        var currIndex = isTopCurr ? 1 : 2;
        var currLabel = isTopCurr ? currLabelTop : currLabelBottom;
        var currPopup = isTopCurr ? currPopupTop : currPopupBottom;
        var currSelectButtons = isTopCurr ? currSelectButtonsTop : currSelectButtonsBottom;
        var currButton = event.target.tagName != 'BUTTON' ? event.target.parentNode : event.target; // if the click on a child - set parent OR - set the parent as the button
        var currButtonCurrName = currButton.querySelector('p').innerText;

        var newConvValues = void 0;

        displayHelper.showCurrSelect(currButton, currSelectButtons); // display the tick on the currency
        displayHelper.updateCurrencyLabel(currLabel, currButtonCurrName); // change the label at the top

        conversionHelper.setCurr(currIndex, currButtonCurrName); // set the new currency for top

        newConvValues = conversionHelper.updateConversions(); // get the new values for the conversion (using defaults)
        curr1Input.value = newConvValues.topValue;
        curr2Input.value = newConvValues.bottomValue;

        //changeCurrency
        displayHelper.hidePopup(currPopup); // hide the currency select
        return;
    };

    var updateListNameDisplay = function updateListNameDisplay() {
        // empty the list name Element
        displayHelper.emptyElement(listNamesEl);

        var clickCallback = function clickCallback(listName) {
            console.log('doing all the click stuff: ' + listName);

            listHelper.changeList(listName).then(function () {
                console.log('List changed: ' + listName);
                displayHelper.toggleExpanded(listNamesEl);
                updateListNameDisplay();
            });
        };

        var deleteCallback = function deleteCallback(event, listName) {
            console.log('doing all the delete stuff: ' + listName);

            // cancel the event bubbling
            event.stopPropagation();

            // delete the items in the list
            listHelper.deleteList(listName).then(listHelper.changeList()).then(function () {
                updateListNameDisplay();
            });
        };

        // get the anmes of the lists
        listHelper.getListNames().then(function (listNames) {
            var activeList = listHelper.getActiveList();

            listNames.forEach(function (listName) {
                var callbacks = { click: function click() {
                        clickCallback(listName);
                    }, remove: function remove(event) {
                        deleteCallback(event, listName);
                    } };
                var positionInsert = listName == activeList ? listNamesEl.firstChild : null;

                listNamesEl.insertBefore(displayHelper.genListNameEl(listName, callbacks), positionInsert);
            });
            return true;
        }).then(function () {
            // add the element to add a list

            // callback for when you want to create a new list
            var createNewList = function createNewList() {
                var listName = document.querySelector(".listadd-listname").value;
                listHelper.createList(listName).then(function () {
                    updateListNameDisplay();
                });
            };
            //add the add list button
            listNamesEl.appendChild(displayHelper.genListAddEl(createNewList));

            updateItemListDisplay();
        }).catch(function (error) {
            console.log("Couldn't update the listNamesElement");
        });
    };

    var updateItemListDisplay = function updateItemListDisplay() {
        // empty the list items
        displayHelper.emptyElement(listItemsEl);
        // listItemsEl

        // define functions for the click and remove
        var clickCallback = function clickCallback() {
            console.log("doing the click callback");
            // don't want anything to happen when the item gets clicked
        };

        var removeCallback = function removeCallback(event, storeKey) {
            console.log("doing the remove callback");
            event.stopPropagation();
            listHelper.deletePurchasedItem(storeKey).then(function () {
                updateItemListDisplay();
            });
        };

        // get the details of the list items
        listHelper.getListItems(listHelper.getActiveList()).then(function (listItemDetails) {

            var listTotal = 0;

            listItemDetails.forEach(function (listItem) {
                var callbacks = { click: clickCallback, remove: function remove(event) {
                        removeCallback(event, listItem.storeKey);
                    } };
                var convertedPrice = conversionHelper.convertValue({ sourceValue: listItem.price, targetCurrency: listCurr });
                listItemsEl.appendChild(displayHelper.genListItemEl(listItem.description, convertedPrice.toFixed(2), callbacks));
                listTotal += convertedPrice;
            });

            listTotalEl.innerText = '' + listTotal.toFixed(2);
            updateTabDisplay(listHelper.getActiveList(), listTotal.toFixed(2), listCurr);
        });
    };

    var setListCurr = function setListCurr(currency) {
        if (conversionHelper.getCurrLabels().includes(currency)) {
            return listCurr = currency;
        } else {
            throw new Error(currency + ' not a valid currency');
        }
    };

    var updateListCurrDisplay = function updateListCurrDisplay() {
        // empty the currency element
        displayHelper.emptyElement(listCurrencyEl);

        // get the currencies available
        var currencies = conversionHelper.getCurrLabels();

        var clickCallback = function clickCallback(currencyName) {
            setListCurr(currencyName);
            updateListCurrDisplay();
            displayHelper.toggleExpanded(listCurrencyEl);
            updateItemListDisplay();
        };

        currencies.forEach(function (currName) {
            var currNamePosition = currName == listCurr ? listCurrencyEl.firstChild : null;
            listCurrencyEl.insertBefore(displayHelper.genListCurrEl(currName, { click: function click() {
                    clickCallback(currName);
                } }), currNamePosition);
        });
    };

    var updateTabDisplay = function updateTabDisplay() {
        var listName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "<Missing List Name";
        var listTotal = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : NaN;
        var currency = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "<No currency>";

        listNameDisplayTab.innerText = listName;
        listTotalDisplayTab.innerText = listTotal + ' ' + currency;
    };

    // == currency relevant events

    // event listeners -- when the input is modified 
    curr1Input.addEventListener('keyup', function (event) {
        var convertValues = conversionHelper.updateConversions(event.target.value, conversionHelper.getCurr(1));
        curr2Input.value = convertValues.bottomValue;
    });

    curr2Input.addEventListener('keyup', function (event) {
        var convertValues = conversionHelper.updateConversions(event.target.value, conversionHelper.getCurr(2));
        curr1Input.value = convertValues.topValue;
    });

    topCurrRevealButton.addEventListener('click', function () {
        displayHelper.revealPopup(currPopupTop);
    });
    bottomCurrRevealButton.addEventListener('click', function () {
        displayHelper.revealPopup(currPopupBottom);
    });

    // == list tab related events
    listPopupShowButton.addEventListener('click', function () {
        if (listPopup.classList.contains("active")) {
            displayHelper.hidePopup(listPopup);
        } else {
            displayHelper.revealPopup(listPopup);
        }
    });

    // add to list
    listPopupAddToListButton.addEventListener('click', function () {
        listHelper.addRecord({
            description: listPopupItemDescription.value,
            cost: conversionHelper.getCoreUSDValue()
        }).then(function () {
            updateItemListDisplay();
        });
    });

    listPopupExpandDescription.addEventListener('click', function () {
        displayHelper.toggleExpanded(listPopupTab);
    });

    // == list realated events
    listNamesExpandEl.addEventListener("click", function () {
        displayHelper.toggleExpanded(listNamesEl);
    });

    listCurrencyExpandEl.addEventListener("click", function () {
        displayHelper.toggleExpanded(listCurrencyEl);
    });

    // GETTING STARTED - after we have grabbed rates

    // grab the rates
    networkHelper.getRates().then(function (rates) {
        var currLabels = void 0;

        conversionHelper.setRates(rates);

        currLabels = conversionHelper.getCurrLabels();

        // empty the popups of their buttons
        displayHelper.emptyElement(currPopupTop);
        displayHelper.emptyElement(currPopupBottom);

        currLabels.forEach(function (currLabel) {
            var topButton = displayHelper.generateCurrSelectButton(currLabel, currLabel == conversionHelper.getCurr(1));
            var bottomButton = displayHelper.generateCurrSelectButton(currLabel, currLabel == conversionHelper.getCurr(2));

            topButton.addEventListener('click', function (event) {
                currSelectCallback(event, true);
            });
            bottomButton.addEventListener('click', function (event) {
                currSelectCallback(event, false);
            });

            currPopupTop.appendChild(topButton);
            currPopupBottom.appendChild(bottomButton);
        });

        // update the currSelectButtons - so they can be cleared
        currSelectButtonsTop = document.querySelectorAll('.curr-select.top button');
        currSelectButtonsBottom = document.querySelectorAll('.curr-select.bottom button');

        updateListNameDisplay();
        updateListCurrDisplay();
    });

    // dismiss the update 
    updateDismissButton.addEventListener('click', function () {
        displayHelper.hidePopup(updateDismissButton);
    });

    // expose the modules for inspection- dev only
    window.convAppObjs = {
        displayHelper: displayHelper,
        networkHelper: networkHelper,
        conversionHelper: conversionHelper,
        serviceWorkerHelper: serviceWorkerHelper,
        listHelper: listHelper,
        setListCurr: setListCurr
    };
};

},{"./../modules/ConversionHelper.js":3,"./../modules/DisplayHelper.js":4,"./../modules/ListModule.js":5,"./../modules/NetworkHelper.js":6}],3:[function(require,module,exports){
'use strict';

var ConversionHelper = function ConversionHelper() {

    var returnObject = {};
    var coreUSDValue = 0;
    var curr = ['USD', 'GBP'];
    var rates = {
        USD: 1,
        GBP: 0.752245
    };

    var setRates = function setRates(newRates) {
        return rates = newRates;
    };

    var convertValue = function convertValue() {
        var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
            _ref$sourceValue = _ref.sourceValue,
            sourceValue = _ref$sourceValue === undefined ? 0 : _ref$sourceValue,
            _ref$sourceCurrency = _ref.sourceCurrency,
            sourceCurrency = _ref$sourceCurrency === undefined ? 'USD' : _ref$sourceCurrency,
            _ref$targetCurrency = _ref.targetCurrency,
            targetCurrency = _ref$targetCurrency === undefined ? 'GBP' : _ref$targetCurrency;

        var USD = sourceValue / rates[sourceCurrency]; // convert to base currency (USD)
        return USD * rates[targetCurrency]; // return value 
    };

    // functions to update what currency is being used

    var getCurr = function getCurr(currIndex) {
        return curr[currIndex - 1];
    };

    var setCurr = function setCurr(currIndex, newCurr) {
        curr[currIndex - 1] = newCurr;
    };

    var updateConversions = function updateConversions() {
        var convertValue = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : coreUSDValue;
        var sourceCurrency = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'USD';


        // normalise to USD
        var incomingUSDValue = returnObject.convertValue({
            sourceValue: convertValue,
            sourceCurrency: sourceCurrency,
            targetCurrency: 'USD'
        });

        coreUSDValue = incomingUSDValue; // store this value for the future

        // update the value in top box
        var conversion1 = returnObject.convertValue({
            sourceValue: incomingUSDValue,
            sourceCurrency: 'USD',
            targetCurrency: curr[0]
        }).toFixed(2);

        // update value in bottom box
        var conversion2 = returnObject.convertValue({
            sourceValue: incomingUSDValue,
            sourceCurrency: 'USD',
            targetCurrency: curr[1]
        }).toFixed(2);
        return { topValue: conversion1, bottomValue: conversion2 };
    };

    var getCurrLabels = function getCurrLabels() {
        return Object.keys(rates);
    };

    var getCoreUSDValue = function getCoreUSDValue() {
        return coreUSDValue;
    };

    return Object.assign(returnObject, {
        setRates: setRates,
        convertValue: convertValue,
        getCurr: getCurr,
        setCurr: setCurr,
        updateConversions: updateConversions,
        getCurrLabels: getCurrLabels,
        getCoreUSDValue: getCoreUSDValue
    });
};

module.exports = ConversionHelper;

},{}],4:[function(require,module,exports){
'use strict';

var DisplayHelper = function DisplayHelper() {

    if (!document) throw new Error("No document object to work with"); // check to see if there is a document object

    var returnObject = {};

    // add the events to the currencySelectButtons
    var showCurrSelect = function showCurrSelect(buttonClicked, currButtons) {
        // remove selected class from all buttons
        currButtons.forEach(function (button) {
            button.classList.remove('selected');
        });
        // set the currency to the same as the selected button

        // add the selected class to the selected button
        buttonClicked.classList.add('selected');

        return;
    };

    var revealPopup = function revealPopup(popupElement) {
        return popupElement.classList.add('active');
    };
    var hidePopup = function hidePopup(popupElement) {
        return popupElement.classList.remove('active');
    };

    var updateCurrencyLabel = function updateCurrencyLabel(labelElement, currencyString) {
        labelElement.innerText = currencyString;
    };

    var generateCurrSelectButton = function generateCurrSelectButton(currLabel, selected) {
        var currButton = document.createElement('button');
        var checkElement = document.createElement('img');
        var labelName = document.createElement('p');

        labelName.innerText = currLabel; // set the labelname

        checkElement.src = "assets/checkmark.svg";
        checkElement.classList.add("checkmark");

        if (selected) currButton.classList.add('selected');

        currButton.appendChild(checkElement);
        currButton.appendChild(labelName);

        return currButton;
    };

    var emptyElement = function emptyElement(element) {
        while (element.children.length > 0) {
            element.children[0].remove();
        }

        return element;
    };

    return Object.assign(returnObject, {
        revealPopup: revealPopup,
        hidePopup: hidePopup,
        showCurrSelect: showCurrSelect,
        updateCurrencyLabel: updateCurrencyLabel,
        generateCurrSelectButton: generateCurrSelectButton,
        emptyElement: emptyElement
    });
};

module.exports = DisplayHelper;

},{}],5:[function(require,module,exports){
'use strict';

var idb = require('idb');

var ListModule = function ListModule() {
    var defaultListName = "Default List";
    var activeList = defaultListName;

    var dbPromise = idb.open('spend-lists', 2, function (upgradeDb) {
        switch (upgradeDb.oldVersion) {
            case 0:
                var listStore = upgradeDb.createObjectStore('purchased-items', { autoIncrement: true });
                listStore.createIndex('by-list', "listName");
            case 1:
                var listNameStore = upgradeDb.createObjectStore('list-names');
                listNameStore.put(true, activeList);
        }
    });

    // IDB functions
    var addRecord = function addRecord() {
        var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
            _ref$listName = _ref.listName,
            listName = _ref$listName === undefined ? activeList : _ref$listName,
            _ref$description = _ref.description,
            description = _ref$description === undefined ? "Something" : _ref$description,
            _ref$cost = _ref.cost,
            cost = _ref$cost === undefined ? 0 : _ref$cost;

        return dbPromise.then(function (db) {
            var tx = db.transaction('purchased-items', 'readwrite');
            var listStore = tx.objectStore('purchased-items');
            listStore.put({ listName: listName, description: description, price: cost });
            return tx.complete;
        });
    };

    var createList = function createList(listName) {
        return dbPromise.then(function (db) {
            var tx = db.transaction('list-names', 'readwrite');
            var listNameStore = tx.objectStore('list-names');
            listNameStore.put(true, listName);
            return tx.complete;
        });
    };

    var changeList = function changeList() {
        var listName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultListName;

        return getList(listName).then(function (listObject) {
            if (listObject != undefined) {
                activeList = listName;
                return true;
            } else {
                return false;
            }
        });
    };

    var getList = function getList(listName) {
        return dbPromise.then(function (db) {
            var tx = db.transaction('list-names');
            var listNameStore = tx.objectStore('list-names');
            return listNameStore.get(listName);
        });
    };

    var getListNames = function getListNames() {
        return dbPromise.then(function (db) {
            var tx = db.transaction('list-names');
            var listStore = tx.objectStore('list-names');
            return listStore.getAllKeys();
        });
    };

    var getListItems = function getListItems() {
        var listName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultListName;

        return dbPromise.then(function (db) {
            var tx = db.transaction('purchased-items');
            var purchasedItemStore = tx.objectStore('purchased-items');
            return Promise.all([purchasedItemStore.getAll(), purchasedItemStore.getAllKeys()]);
        }).then(function (purchasedItemDetails) {
            return purchasedItemDetails[0].map(function (itemValues, index) {
                itemValues.storeKey = purchasedItemDetails[1][index];
                return itemValues;
            }).filter(function (itemDetails) {
                return itemDetails.listName == listName;
            });
        });
    };

    var deletePurchasedItem = function deletePurchasedItem(tableKey) {
        return dbPromise.then(function (db) {
            var tx = db.transaction('purchased-items', 'readwrite');
            var purchasedItemStore = tx.objectStore('purchased-items');
            return purchasedItemStore.delete(tableKey);
        });
    };

    var deleteList = function deleteList(listName) {
        return dbPromise.then(function (db) {
            var tx = db.transaction(['list-names', 'purchased-items'], 'readwrite');
            var listNameStore = tx.objectStore('list-names');
            var purchasedItemStore = tx.objectStore('purchased-items');

            var listNameDelete = listNameStore.delete(listName);
            var listItemsDelete = purchasedItemStore.openCursor(null, "next").then(function removeItemByList(cursor) {
                if (!cursor) return; // recursive exit condition
                if (cursor.value.listName == listName) cursor.delete(); // if list is right - delete item
                return cursor.continue().then(removeItemByList); // move to the next item
            });

            return Promise.all([listNameDelete, listItemsDelete]);
        });
    };

    var getActiveList = function getActiveList() {
        return activeList.slice(0);
    };

    return {
        addRecord: addRecord,
        createList: createList,
        changeList: changeList,
        getList: getList,
        getListNames: getListNames,
        getListItems: getListItems,
        deletePurchasedItem: deletePurchasedItem,
        deleteList: deleteList,
        getActiveList: getActiveList
    };
};

module.exports = ListModule;

},{"idb":1}],6:[function(require,module,exports){
'use strict';

var NetworkHelper = function NetworkHelper() {

    var returnObject = {};

    var handleResponse = function handleResponse(response) {
        // checks if the request for the rates was successful

        if (response.ok) {
            return response.json();
        } else {
            Promise.reject(new Error('Unexpected Response'));
        }
    };

    var logMessage = function logMessage(message) {
        console.log(message);
        return message;
    };

    var getRates = function getRates() {
        // returns a promise that resolves to the data
        return fetch('/rates', { method: 'GET', credentials: 'same-origin' }).then(handleResponse).catch(function (err) {
            logMessage(err.message);
        });
    };

    return Object.assign(returnObject, {
        getRates: getRates
    });
};

module.exports = NetworkHelper;

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvaWRiL2xpYi9pZGIuanMiLCJzcmNcXGNsaWVudFxcbWFpbi5qcyIsInNyY1xcbW9kdWxlc1xcQ29udmVyc2lvbkhlbHBlci5qcyIsInNyY1xcbW9kdWxlc1xcRGlzcGxheUhlbHBlci5qcyIsInNyY1xcbW9kdWxlc1xcTGlzdE1vZHVsZS5qcyIsInNyY1xcbW9kdWxlc1xcTmV0d29ya0hlbHBlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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TyxPQUFQO0FBQ0gsS0FIRDs7QUFLQSxRQUFNLFdBQVcsU0FBWCxRQUFXLEdBQUk7QUFBRztBQUNwQixlQUFPLE1BQU0sUUFBTixFQUFnQixFQUFDLFFBQVEsS0FBVCxFQUFlLGFBQVksYUFBM0IsRUFBaEIsRUFDRixJQURFLENBQ0csY0FESCxFQUVGLEtBRkUsQ0FFSSxVQUFDLEdBQUQsRUFBTztBQUFFLHVCQUFXLElBQUksT0FBZjtBQUF5QixTQUZ0QyxDQUFQO0FBR0gsS0FKRDs7QUFNQSxXQUFPLE9BQU8sTUFBUCxDQUFlLFlBQWYsRUFDSDtBQUNJO0FBREosS0FERyxDQUFQO0FBT0gsQ0EvQkQ7O0FBaUNBLE9BQU8sT0FBUCxHQUFpQixhQUFqQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbihmdW5jdGlvbigpIHtcbiAgZnVuY3Rpb24gdG9BcnJheShhcnIpIHtcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb21pc2lmeVJlcXVlc3QocmVxdWVzdCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc29sdmUocmVxdWVzdC5yZXN1bHQpO1xuICAgICAgfTtcblxuICAgICAgcmVxdWVzdC5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChyZXF1ZXN0LmVycm9yKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9taXNpZnlSZXF1ZXN0Q2FsbChvYmosIG1ldGhvZCwgYXJncykge1xuICAgIHZhciByZXF1ZXN0O1xuICAgIHZhciBwID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICByZXF1ZXN0ID0gb2JqW21ldGhvZF0uYXBwbHkob2JqLCBhcmdzKTtcbiAgICAgIHByb21pc2lmeVJlcXVlc3QocmVxdWVzdCkudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgIH0pO1xuXG4gICAgcC5yZXF1ZXN0ID0gcmVxdWVzdDtcbiAgICByZXR1cm4gcDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb21pc2lmeUN1cnNvclJlcXVlc3RDYWxsKG9iaiwgbWV0aG9kLCBhcmdzKSB7XG4gICAgdmFyIHAgPSBwcm9taXNpZnlSZXF1ZXN0Q2FsbChvYmosIG1ldGhvZCwgYXJncyk7XG4gICAgcmV0dXJuIHAudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgaWYgKCF2YWx1ZSkgcmV0dXJuO1xuICAgICAgcmV0dXJuIG5ldyBDdXJzb3IodmFsdWUsIHAucmVxdWVzdCk7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm94eVByb3BlcnRpZXMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoUHJveHlDbGFzcy5wcm90b3R5cGUsIHByb3AsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdGhpc1t0YXJnZXRQcm9wXVtwcm9wXTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICB0aGlzW3RhcmdldFByb3BdW3Byb3BdID0gdmFsO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5UmVxdWVzdE1ldGhvZHMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgQ29uc3RydWN0b3IsIHByb3BlcnRpZXMpIHtcbiAgICBwcm9wZXJ0aWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgaWYgKCEocHJvcCBpbiBDb25zdHJ1Y3Rvci5wcm90b3R5cGUpKSByZXR1cm47XG4gICAgICBQcm94eUNsYXNzLnByb3RvdHlwZVtwcm9wXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gcHJvbWlzaWZ5UmVxdWVzdENhbGwodGhpc1t0YXJnZXRQcm9wXSwgcHJvcCwgYXJndW1lbnRzKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm94eU1ldGhvZHMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgQ29uc3RydWN0b3IsIHByb3BlcnRpZXMpIHtcbiAgICBwcm9wZXJ0aWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgaWYgKCEocHJvcCBpbiBDb25zdHJ1Y3Rvci5wcm90b3R5cGUpKSByZXR1cm47XG4gICAgICBQcm94eUNsYXNzLnByb3RvdHlwZVtwcm9wXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpc1t0YXJnZXRQcm9wXVtwcm9wXS5hcHBseSh0aGlzW3RhcmdldFByb3BdLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5Q3Vyc29yUmVxdWVzdE1ldGhvZHMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgQ29uc3RydWN0b3IsIHByb3BlcnRpZXMpIHtcbiAgICBwcm9wZXJ0aWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgaWYgKCEocHJvcCBpbiBDb25zdHJ1Y3Rvci5wcm90b3R5cGUpKSByZXR1cm47XG4gICAgICBQcm94eUNsYXNzLnByb3RvdHlwZVtwcm9wXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gcHJvbWlzaWZ5Q3Vyc29yUmVxdWVzdENhbGwodGhpc1t0YXJnZXRQcm9wXSwgcHJvcCwgYXJndW1lbnRzKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBJbmRleChpbmRleCkge1xuICAgIHRoaXMuX2luZGV4ID0gaW5kZXg7XG4gIH1cblxuICBwcm94eVByb3BlcnRpZXMoSW5kZXgsICdfaW5kZXgnLCBbXG4gICAgJ25hbWUnLFxuICAgICdrZXlQYXRoJyxcbiAgICAnbXVsdGlFbnRyeScsXG4gICAgJ3VuaXF1ZSdcbiAgXSk7XG5cbiAgcHJveHlSZXF1ZXN0TWV0aG9kcyhJbmRleCwgJ19pbmRleCcsIElEQkluZGV4LCBbXG4gICAgJ2dldCcsXG4gICAgJ2dldEtleScsXG4gICAgJ2dldEFsbCcsXG4gICAgJ2dldEFsbEtleXMnLFxuICAgICdjb3VudCdcbiAgXSk7XG5cbiAgcHJveHlDdXJzb3JSZXF1ZXN0TWV0aG9kcyhJbmRleCwgJ19pbmRleCcsIElEQkluZGV4LCBbXG4gICAgJ29wZW5DdXJzb3InLFxuICAgICdvcGVuS2V5Q3Vyc29yJ1xuICBdKTtcblxuICBmdW5jdGlvbiBDdXJzb3IoY3Vyc29yLCByZXF1ZXN0KSB7XG4gICAgdGhpcy5fY3Vyc29yID0gY3Vyc29yO1xuICAgIHRoaXMuX3JlcXVlc3QgPSByZXF1ZXN0O1xuICB9XG5cbiAgcHJveHlQcm9wZXJ0aWVzKEN1cnNvciwgJ19jdXJzb3InLCBbXG4gICAgJ2RpcmVjdGlvbicsXG4gICAgJ2tleScsXG4gICAgJ3ByaW1hcnlLZXknLFxuICAgICd2YWx1ZSdcbiAgXSk7XG5cbiAgcHJveHlSZXF1ZXN0TWV0aG9kcyhDdXJzb3IsICdfY3Vyc29yJywgSURCQ3Vyc29yLCBbXG4gICAgJ3VwZGF0ZScsXG4gICAgJ2RlbGV0ZSdcbiAgXSk7XG5cbiAgLy8gcHJveHkgJ25leHQnIG1ldGhvZHNcbiAgWydhZHZhbmNlJywgJ2NvbnRpbnVlJywgJ2NvbnRpbnVlUHJpbWFyeUtleSddLmZvckVhY2goZnVuY3Rpb24obWV0aG9kTmFtZSkge1xuICAgIGlmICghKG1ldGhvZE5hbWUgaW4gSURCQ3Vyc29yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICBDdXJzb3IucHJvdG90eXBlW21ldGhvZE5hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY3Vyc29yID0gdGhpcztcbiAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIGN1cnNvci5fY3Vyc29yW21ldGhvZE5hbWVdLmFwcGx5KGN1cnNvci5fY3Vyc29yLCBhcmdzKTtcbiAgICAgICAgcmV0dXJuIHByb21pc2lmeVJlcXVlc3QoY3Vyc29yLl9yZXF1ZXN0KS50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgaWYgKCF2YWx1ZSkgcmV0dXJuO1xuICAgICAgICAgIHJldHVybiBuZXcgQ3Vyc29yKHZhbHVlLCBjdXJzb3IuX3JlcXVlc3QpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH07XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIE9iamVjdFN0b3JlKHN0b3JlKSB7XG4gICAgdGhpcy5fc3RvcmUgPSBzdG9yZTtcbiAgfVxuXG4gIE9iamVjdFN0b3JlLnByb3RvdHlwZS5jcmVhdGVJbmRleCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgSW5kZXgodGhpcy5fc3RvcmUuY3JlYXRlSW5kZXguYXBwbHkodGhpcy5fc3RvcmUsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIE9iamVjdFN0b3JlLnByb3RvdHlwZS5pbmRleCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgSW5kZXgodGhpcy5fc3RvcmUuaW5kZXguYXBwbHkodGhpcy5fc3RvcmUsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhPYmplY3RTdG9yZSwgJ19zdG9yZScsIFtcbiAgICAnbmFtZScsXG4gICAgJ2tleVBhdGgnLFxuICAgICdpbmRleE5hbWVzJyxcbiAgICAnYXV0b0luY3JlbWVudCdcbiAgXSk7XG5cbiAgcHJveHlSZXF1ZXN0TWV0aG9kcyhPYmplY3RTdG9yZSwgJ19zdG9yZScsIElEQk9iamVjdFN0b3JlLCBbXG4gICAgJ3B1dCcsXG4gICAgJ2FkZCcsXG4gICAgJ2RlbGV0ZScsXG4gICAgJ2NsZWFyJyxcbiAgICAnZ2V0JyxcbiAgICAnZ2V0QWxsJyxcbiAgICAnZ2V0S2V5JyxcbiAgICAnZ2V0QWxsS2V5cycsXG4gICAgJ2NvdW50J1xuICBdKTtcblxuICBwcm94eUN1cnNvclJlcXVlc3RNZXRob2RzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgSURCT2JqZWN0U3RvcmUsIFtcbiAgICAnb3BlbkN1cnNvcicsXG4gICAgJ29wZW5LZXlDdXJzb3InXG4gIF0pO1xuXG4gIHByb3h5TWV0aG9kcyhPYmplY3RTdG9yZSwgJ19zdG9yZScsIElEQk9iamVjdFN0b3JlLCBbXG4gICAgJ2RlbGV0ZUluZGV4J1xuICBdKTtcblxuICBmdW5jdGlvbiBUcmFuc2FjdGlvbihpZGJUcmFuc2FjdGlvbikge1xuICAgIHRoaXMuX3R4ID0gaWRiVHJhbnNhY3Rpb247XG4gICAgdGhpcy5jb21wbGV0ZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgaWRiVHJhbnNhY3Rpb24ub25jb21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9O1xuICAgICAgaWRiVHJhbnNhY3Rpb24ub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QoaWRiVHJhbnNhY3Rpb24uZXJyb3IpO1xuICAgICAgfTtcbiAgICAgIGlkYlRyYW5zYWN0aW9uLm9uYWJvcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KGlkYlRyYW5zYWN0aW9uLmVycm9yKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBUcmFuc2FjdGlvbi5wcm90b3R5cGUub2JqZWN0U3RvcmUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IE9iamVjdFN0b3JlKHRoaXMuX3R4Lm9iamVjdFN0b3JlLmFwcGx5KHRoaXMuX3R4LCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBwcm94eVByb3BlcnRpZXMoVHJhbnNhY3Rpb24sICdfdHgnLCBbXG4gICAgJ29iamVjdFN0b3JlTmFtZXMnLFxuICAgICdtb2RlJ1xuICBdKTtcblxuICBwcm94eU1ldGhvZHMoVHJhbnNhY3Rpb24sICdfdHgnLCBJREJUcmFuc2FjdGlvbiwgW1xuICAgICdhYm9ydCdcbiAgXSk7XG5cbiAgZnVuY3Rpb24gVXBncmFkZURCKGRiLCBvbGRWZXJzaW9uLCB0cmFuc2FjdGlvbikge1xuICAgIHRoaXMuX2RiID0gZGI7XG4gICAgdGhpcy5vbGRWZXJzaW9uID0gb2xkVmVyc2lvbjtcbiAgICB0aGlzLnRyYW5zYWN0aW9uID0gbmV3IFRyYW5zYWN0aW9uKHRyYW5zYWN0aW9uKTtcbiAgfVxuXG4gIFVwZ3JhZGVEQi5wcm90b3R5cGUuY3JlYXRlT2JqZWN0U3RvcmUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IE9iamVjdFN0b3JlKHRoaXMuX2RiLmNyZWF0ZU9iamVjdFN0b3JlLmFwcGx5KHRoaXMuX2RiLCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBwcm94eVByb3BlcnRpZXMoVXBncmFkZURCLCAnX2RiJywgW1xuICAgICduYW1lJyxcbiAgICAndmVyc2lvbicsXG4gICAgJ29iamVjdFN0b3JlTmFtZXMnXG4gIF0pO1xuXG4gIHByb3h5TWV0aG9kcyhVcGdyYWRlREIsICdfZGInLCBJREJEYXRhYmFzZSwgW1xuICAgICdkZWxldGVPYmplY3RTdG9yZScsXG4gICAgJ2Nsb3NlJ1xuICBdKTtcblxuICBmdW5jdGlvbiBEQihkYikge1xuICAgIHRoaXMuX2RiID0gZGI7XG4gIH1cblxuICBEQi5wcm90b3R5cGUudHJhbnNhY3Rpb24gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFRyYW5zYWN0aW9uKHRoaXMuX2RiLnRyYW5zYWN0aW9uLmFwcGx5KHRoaXMuX2RiLCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBwcm94eVByb3BlcnRpZXMoREIsICdfZGInLCBbXG4gICAgJ25hbWUnLFxuICAgICd2ZXJzaW9uJyxcbiAgICAnb2JqZWN0U3RvcmVOYW1lcydcbiAgXSk7XG5cbiAgcHJveHlNZXRob2RzKERCLCAnX2RiJywgSURCRGF0YWJhc2UsIFtcbiAgICAnY2xvc2UnXG4gIF0pO1xuXG4gIC8vIEFkZCBjdXJzb3IgaXRlcmF0b3JzXG4gIC8vIFRPRE86IHJlbW92ZSB0aGlzIG9uY2UgYnJvd3NlcnMgZG8gdGhlIHJpZ2h0IHRoaW5nIHdpdGggcHJvbWlzZXNcbiAgWydvcGVuQ3Vyc29yJywgJ29wZW5LZXlDdXJzb3InXS5mb3JFYWNoKGZ1bmN0aW9uKGZ1bmNOYW1lKSB7XG4gICAgW09iamVjdFN0b3JlLCBJbmRleF0uZm9yRWFjaChmdW5jdGlvbihDb25zdHJ1Y3Rvcikge1xuICAgICAgQ29uc3RydWN0b3IucHJvdG90eXBlW2Z1bmNOYW1lLnJlcGxhY2UoJ29wZW4nLCAnaXRlcmF0ZScpXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgYXJncyA9IHRvQXJyYXkoYXJndW1lbnRzKTtcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdO1xuICAgICAgICB2YXIgbmF0aXZlT2JqZWN0ID0gdGhpcy5fc3RvcmUgfHwgdGhpcy5faW5kZXg7XG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmF0aXZlT2JqZWN0W2Z1bmNOYW1lXS5hcHBseShuYXRpdmVPYmplY3QsIGFyZ3Muc2xpY2UoMCwgLTEpKTtcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICBjYWxsYmFjayhyZXF1ZXN0LnJlc3VsdCk7XG4gICAgICAgIH07XG4gICAgICB9O1xuICAgIH0pO1xuICB9KTtcblxuICAvLyBwb2x5ZmlsbCBnZXRBbGxcbiAgW0luZGV4LCBPYmplY3RTdG9yZV0uZm9yRWFjaChmdW5jdGlvbihDb25zdHJ1Y3Rvcikge1xuICAgIGlmIChDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZ2V0QWxsKSByZXR1cm47XG4gICAgQ29uc3RydWN0b3IucHJvdG90eXBlLmdldEFsbCA9IGZ1bmN0aW9uKHF1ZXJ5LCBjb3VudCkge1xuICAgICAgdmFyIGluc3RhbmNlID0gdGhpcztcbiAgICAgIHZhciBpdGVtcyA9IFtdO1xuXG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSkge1xuICAgICAgICBpbnN0YW5jZS5pdGVyYXRlQ3Vyc29yKHF1ZXJ5LCBmdW5jdGlvbihjdXJzb3IpIHtcbiAgICAgICAgICBpZiAoIWN1cnNvcikge1xuICAgICAgICAgICAgcmVzb2x2ZShpdGVtcyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGl0ZW1zLnB1c2goY3Vyc29yLnZhbHVlKTtcblxuICAgICAgICAgIGlmIChjb3VudCAhPT0gdW5kZWZpbmVkICYmIGl0ZW1zLmxlbmd0aCA9PSBjb3VudCkge1xuICAgICAgICAgICAgcmVzb2x2ZShpdGVtcyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH07XG4gIH0pO1xuXG4gIHZhciBleHAgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24obmFtZSwgdmVyc2lvbiwgdXBncmFkZUNhbGxiYWNrKSB7XG4gICAgICB2YXIgcCA9IHByb21pc2lmeVJlcXVlc3RDYWxsKGluZGV4ZWREQiwgJ29wZW4nLCBbbmFtZSwgdmVyc2lvbl0pO1xuICAgICAgdmFyIHJlcXVlc3QgPSBwLnJlcXVlc3Q7XG5cbiAgICAgIHJlcXVlc3Qub251cGdyYWRlbmVlZGVkID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKHVwZ3JhZGVDYWxsYmFjaykge1xuICAgICAgICAgIHVwZ3JhZGVDYWxsYmFjayhuZXcgVXBncmFkZURCKHJlcXVlc3QucmVzdWx0LCBldmVudC5vbGRWZXJzaW9uLCByZXF1ZXN0LnRyYW5zYWN0aW9uKSk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHJldHVybiBwLnRoZW4oZnVuY3Rpb24oZGIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEQihkYik7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIGRlbGV0ZTogZnVuY3Rpb24obmFtZSkge1xuICAgICAgcmV0dXJuIHByb21pc2lmeVJlcXVlc3RDYWxsKGluZGV4ZWREQiwgJ2RlbGV0ZURhdGFiYXNlJywgW25hbWVdKTtcbiAgICB9XG4gIH07XG5cbiAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBleHA7XG4gICAgbW9kdWxlLmV4cG9ydHMuZGVmYXVsdCA9IG1vZHVsZS5leHBvcnRzO1xuICB9XG4gIGVsc2Uge1xuICAgIHNlbGYuaWRiID0gZXhwO1xuICB9XG59KCkpO1xuIiwiY29uc3QgQ29udmVyc2lvbk1vZHVsZSA9IHJlcXVpcmUoYC4vLi4vbW9kdWxlcy9Db252ZXJzaW9uSGVscGVyLmpzYClcclxuY29uc3QgTmV0d29ya01vZHVsZSA9IHJlcXVpcmUoJy4vLi4vbW9kdWxlcy9OZXR3b3JrSGVscGVyLmpzJylcclxuY29uc3QgRGlzcGxheUhlbHBlciA9IHJlcXVpcmUoJy4vLi4vbW9kdWxlcy9EaXNwbGF5SGVscGVyLmpzJylcclxuY29uc3QgTGlzdE1vZHVsZSA9IHJlcXVpcmUoJy4vLi4vbW9kdWxlcy9MaXN0TW9kdWxlLmpzJylcclxuXHJcbndpbmRvdy5vbmxvYWQgPSAoKT0+e1xyXG4gICAgbGV0IGxpc3RDdXJyID0gXCJVU0RcIjtcclxuLy8gPT09IEdFVCBBTEwgVEhFIFJFTEVWQU5UIEVMRU1FTlRTIElOIFRIRSBET01cclxuXHJcbiAgICAvLyBjdXJyZW5jeSBjb252ZXJzaW9uIGJveGVzXHJcbiAgICBjb25zdCBjdXJyMUlucHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2N1cnItMScpXHJcbiAgICBjb25zdCBjdXJyMklucHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2N1cnItMicpXHJcbiAgICBjb25zdCBjdXJyTGFiZWxUb3AgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY3VycmVuY3ktbGFiZWwudG9wIGgyJylcclxuICAgIGNvbnN0IGN1cnJMYWJlbEJvdHRvbSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jdXJyZW5jeS1sYWJlbC5ib3R0b20gaDInKVxyXG5cclxuICAgIC8vIHVwZGF0ZSBkaWFsb2cgYm94ZXNcclxuICAgIGNvbnN0IHVwZGF0ZURpYWxvZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd1cGRhdGUtZGlzcGxheScpXHJcbiAgICBjb25zdCB1cGRhdGVJbnN0YWxsQnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3VwZGF0ZS1hY2NlcHQnKVxyXG4gICAgY29uc3QgdXBkYXRlRGlzbWlzc0J1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd1cGRhdGUtZGlzbWlzcycpXHJcbiAgICBcclxuICAgIC8vIGN1cnJlbmN5IHNlbGVjdCB0aXJnZ2Vyc1xyXG4gICAgY29uc3QgdG9wQ3VyclJldmVhbEJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jdXJyZW5jeS1sYWJlbC50b3AgLmRyb3Bkb3duJylcclxuICAgIGNvbnN0IGJvdHRvbUN1cnJSZXZlYWxCdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY3VycmVuY3ktbGFiZWwuYm90dG9tIC5kcm9wZG93bicpXHJcbiAgICAvLyBjdXJyZW5jeSBzZWxlY3QgcG9wdXBzXHJcbiAgICBjb25zdCBjdXJyUG9wdXBUb3AgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY3Vyci1zZWxlY3QudG9wJylcclxuICAgIGNvbnN0IGN1cnJQb3B1cEJvdHRvbSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jdXJyLXNlbGVjdC5ib3R0b20nKVxyXG4gICAgLy8gY3VycmVuY3kgb3B0aW9uIGJ1dHRvbnNcclxuICAgIGxldCBjdXJyU2VsZWN0QnV0dG9uc1RvcCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jdXJyLXNlbGVjdC50b3AgYnV0dG9uJylcclxuICAgIGxldCBjdXJyU2VsZWN0QnV0dG9uc0JvdHRvbSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jdXJyLXNlbGVjdC5ib3R0b20gYnV0dG9uJylcclxuICAgIC8vIGxpc3QgZWxlbWVudHNcclxuICAgIGNvbnN0IGxpc3RQb3B1cCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjc3BlbmQtbGlzdFwiKVxyXG4gICAgY29uc3QgbGlzdFBvcHVwU2hvd0J1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjc3BlbmQtbGlzdCAuc2hvdy1saXN0XCIpXHJcbiAgICBjb25zdCBsaXN0TmFtZXNFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIubGlzdC1uYW1lc1wiKVxyXG4gICAgY29uc3QgbGlzdE5hbWVzRXhwYW5kRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLmxpc3QtbmFtZS1kaXNwbGF5IGltZ1wiKVxyXG4gICAgY29uc3QgbGlzdEl0ZW1zRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLmxpc3QtaXRlbXNcIilcclxuICAgIGNvbnN0IGxpc3RUb3RhbEVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi5pdGVtLXRvdGFsXCIpXHJcbiAgICBjb25zdCBsaXN0Q3VycmVuY3lFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIubGlzdC1jdXJyc1wiKVxyXG4gICAgY29uc3QgbGlzdEN1cnJlbmN5RXhwYW5kRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLmN1cnItZGlzcGxheSBpbWdcIilcclxuXHJcbiAgICAvLyBsaXN0IHRhYiBlbGVtZW50c1xyXG4gICAgY29uc3QgbGlzdFBvcHVwVGFiID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNzcGVuZC1saXN0IC50YWJcIik7XHJcbiAgICBjb25zdCBsaXN0UG9wdXBBZGRUb0xpc3RCdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI3NwZW5kLWxpc3QgLmFkZC10by1saXN0XCIpXHJcbiAgICBjb25zdCBsaXN0UG9wdXBJdGVtRGVzY3JpcHRpb24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI3NwZW5kLWxpc3QgLml0ZW0tZGVzY3JpcHRpb25cIilcclxuICAgIGNvbnN0IGxpc3RQb3B1cEV4cGFuZERlc2NyaXB0aW9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi5leHBhbmQtZGVzY3JpcHRpb25cIilcclxuICAgIGNvbnN0IGxpc3ROYW1lRGlzcGxheVRhYiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIudGFiLWxpc3QtbmFtZVwiKVxyXG4gICAgY29uc3QgbGlzdFRvdGFsRGlzcGxheVRhYiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIudGFiLWxpc3QtdG90YWxcIilcclxuXHJcblxyXG4vLyBoZWxwZXIgbW9kdWxlc1xyXG4gICAgY29uc3QgZGlzcGxheUhlbHBlciA9IGZ1bmN0aW9uIERpc3BsYXlIZWxwZXIoKXtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoIWRvY3VtZW50KSB0aHJvdyBuZXcgRXJyb3IoXCJObyBkb2N1bWVudCBvYmplY3QgdG8gd29yayB3aXRoXCIpICAgLy8gY2hlY2sgdG8gc2VlIGlmIHRoZXJlIGlzIGEgZG9jdW1lbnQgb2JqZWN0XHJcblxyXG4gICAgICAgIC8vIGFkZCB0aGUgZXZlbnRzIHRvIHRoZSBjdXJyZW5jeVNlbGVjdEJ1dHRvbnNcclxuICAgICAgICBjb25zdCBzaG93Q3VyclNlbGVjdCA9IChidXR0b25DbGlja2VkLCBjdXJyQnV0dG9ucyk9PntcclxuICAgICAgICAgICAgLy8gcmVtb3ZlIHNlbGVjdGVkIGNsYXNzIGZyb20gYWxsIGJ1dHRvbnNcclxuICAgICAgICAgICAgY3VyckJ1dHRvbnMuZm9yRWFjaCgoYnV0dG9uKT0+e1xyXG4gICAgICAgICAgICAgICAgYnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoJ3NlbGVjdGVkJylcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgLy8gc2V0IHRoZSBjdXJyZW5jeSB0byB0aGUgc2FtZSBhcyB0aGUgc2VsZWN0ZWQgYnV0dG9uXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBhZGQgdGhlIHNlbGVjdGVkIGNsYXNzIHRvIHRoZSBzZWxlY3RlZCBidXR0b25cclxuICAgICAgICAgICAgYnV0dG9uQ2xpY2tlZC5jbGFzc0xpc3QuYWRkKCdzZWxlY3RlZCcpXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCByZXZlYWxQb3B1cCA9IChwb3B1cEVsZW1lbnQpPT57XHJcbiAgICAgICAgICAgIHJldHVybiBwb3B1cEVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnYWN0aXZlJylcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgaGlkZVBvcHVwID0gKHBvcHVwRWxlbWVudCk9PntcclxuICAgICAgICAgICAgcmV0dXJuIHBvcHVwRWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdhY3RpdmUnKVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgdXBkYXRlQ3VycmVuY3lMYWJlbCA9IChsYWJlbEVsZW1lbnQsY3VycmVuY3lTdHJpbmcpPT57XHJcbiAgICAgICAgICAgIGxhYmVsRWxlbWVudC5pbm5lclRleHQgPSBjdXJyZW5jeVN0cmluZ1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgZ2VuZXJhdGVDdXJyU2VsZWN0QnV0dG9uID0gKGN1cnJMYWJlbCwgc2VsZWN0ZWQpPT57XHJcbiAgICAgICAgICAgIGNvbnN0IGN1cnJCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICAgICAgICAgICAgY29uc3QgY2hlY2tFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW1nJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGxhYmVsTmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKVxyXG5cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBsYWJlbE5hbWUuaW5uZXJUZXh0ID0gY3VyckxhYmVsIC8vIHNldCB0aGUgbGFiZWxuYW1lXHJcblxyXG4gICAgICAgICAgICBjaGVja0VsZW1lbnQuc3JjID0gXCJhc3NldHMvY2hlY2ttYXJrLnN2Z1wiO1xyXG4gICAgICAgICAgICBjaGVja0VsZW1lbnQuY2xhc3NMaXN0LmFkZChcImNoZWNrbWFya1wiKVxyXG5cclxuICAgICAgICAgICAgaWYoc2VsZWN0ZWQpIGN1cnJCdXR0b24uY2xhc3NMaXN0LmFkZCgnc2VsZWN0ZWQnKVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY3VyckJ1dHRvbi5hcHBlbmRDaGlsZChjaGVja0VsZW1lbnQpXHJcbiAgICAgICAgICAgIGN1cnJCdXR0b24uYXBwZW5kQ2hpbGQobGFiZWxOYW1lKVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGN1cnJCdXR0b25cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGVtcHR5RWxlbWVudCA9IChlbGVtZW50KT0+e1xyXG4gICAgICAgICAgICB3aGlsZShlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDApe1xyXG4gICAgICAgICAgICAgICAgZWxlbWVudC5jaGlsZHJlblswXS5yZW1vdmUoKVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCB0b2dnbGVFeHBhbmRlZCA9IChlbGVtZW50KT0+e1xyXG4gICAgICAgICAgICByZXR1cm4gZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKFwiZXhwYW5kZWRcIilcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGdlbkxpc3ROYW1lRWwgPSAobGlzdE5hbWUgPSBcIjxuYW1lIG1pc3Npbmc+XCIsIGNhbGxiYWNrcyA9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyAgIHJlbW92ZSA9ICgpPT57Y29uc29sZS5sb2coXCJkZWxldGUgY2xpY2tlZFwiKX0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsaWNrID0gKCk9Pntjb25zb2xlLmxvZyhcImxpc3ROYW1lIGNsaWNrZWRcIil9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSA9IHt9ICk9PntcclxuXHJcbiAgICAgICAgICAgIGxldCBsaXN0TmFtZUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcclxuICAgICAgICAgICAgbGV0IGRlbGV0ZUJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpXHJcblxyXG4gICAgICAgICAgICBkZWxldGVCdXR0b24uaW5uZXJUZXh0ID0gXCItXCI7XHJcbiAgICAgICAgICAgIGRlbGV0ZUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsY2FsbGJhY2tzLnJlbW92ZSlcclxuXHJcbiAgICAgICAgICAgIGxpc3ROYW1lRWwuaW5uZXJUZXh0ID0gbGlzdE5hbWU7XHJcbiAgICAgICAgICAgIGxpc3ROYW1lRWwuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGNhbGxiYWNrcy5jbGljaylcclxuXHJcbiAgICAgICAgICAgIGlmKGxpc3ROYW1lICE9IFwiRGVmYXVsdCBMaXN0XCIpIGxpc3ROYW1lRWwuYXBwZW5kQ2hpbGQoZGVsZXRlQnV0dG9uKVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGxpc3ROYW1lRWw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBnZW5MaXN0QWRkRWwgPSAoYWRkQ2FsbGJhY2sgPSAoKT0+e2NvbnNvbGUubG9nKFwiQWRkIExpc3QgYnV0dG9uIGNsaWNrZWRcIil9KT0+e1xyXG5cclxuICAgICAgICAgICAgbGV0IGxpc3RBZGRFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XHJcbiAgICAgICAgICAgIGxldCBhZGRCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKVxyXG4gICAgICAgICAgICBsZXQgbmFtZUlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKVxyXG5cclxuICAgICAgICAgICAgYWRkQnV0dG9uLmlubmVyVGV4dCA9IFwiK1wiO1xyXG4gICAgICAgICAgICBhZGRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLGFkZENhbGxiYWNrKVxyXG5cclxuICAgICAgICAgICAgbmFtZUlucHV0LmNsYXNzTGlzdC5hZGQoXCJsaXN0YWRkLWxpc3RuYW1lXCIpXHJcblxyXG4gICAgICAgICAgICBsaXN0QWRkRWwuYXBwZW5kQ2hpbGQobmFtZUlucHV0KTtcclxuICAgICAgICAgICAgbGlzdEFkZEVsLmFwcGVuZENoaWxkKGFkZEJ1dHRvbik7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gbGlzdEFkZEVsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgZ2VuTGlzdEl0ZW1FbCA9ICggZGVzY3JpcHRpb24gPSBcIjxkZXNjcmlwdGlvbiBtaXNzaW5nPlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaWNlID0gMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ICAgcmVtb3ZlID0gKCk9Pntjb25zb2xlLmxvZyhcImxpdEl0ZW0gZGVsZXRlIGNsaWNrZWRcIil9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGljayA9ICgpPT57Y29uc29sZS5sb2coXCJsaXN0SXRlbSBjbGlja2VkXCIpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH09e30gKT0+e1xyXG5cclxuXHJcbiAgICAgICAgICAgIGxldCBsaXN0SXRlbUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcclxuICAgICAgICAgICAgbGV0IGRlbGV0ZUJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpXHJcblxyXG4gICAgICAgICAgICBkZWxldGVCdXR0b24uaW5uZXJUZXh0ID0gXCItXCI7XHJcbiAgICAgICAgICAgIGRlbGV0ZUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHJlbW92ZSlcclxuXHJcbiAgICAgICAgICAgIGxpc3RJdGVtRWwuaW5uZXJUZXh0ID0gYCR7cHJpY2V9IDogJHtkZXNjcmlwdGlvbn1gO1xyXG4gICAgICAgICAgICBsaXN0SXRlbUVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBjbGljaylcclxuICAgICAgICAgICAgbGlzdEl0ZW1FbC5hcHBlbmRDaGlsZChkZWxldGVCdXR0b24pXHJcblxyXG4gICAgICAgICAgICByZXR1cm4gbGlzdEl0ZW1FbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGdlbkxpc3RDdXJyRWwgPSAoY3Vyck5hbWUgPSBcIjxjdXJyIG5vdCBkZWZpbmVkPlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNhbGxiYWNrc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgY2xpY2sgPSAoKT0+e2NvbnNvbGUubG9nKFwibGlzdEN1cnIgY2xpY2tlZFwiKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9ID0ge30pPT57XHJcbiAgICAgICAgICAgIGxldCBsaXN0Q3VyckVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKVxyXG5cclxuICAgICAgICAgICAgbGlzdEN1cnJFbC5pbm5lclRleHQgPSBjdXJyTmFtZTtcclxuICAgICAgICAgICAgbGlzdEN1cnJFbC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgY2xpY2spXHJcblxyXG4gICAgICAgICAgICByZXR1cm4gbGlzdEN1cnJFbFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgcmV2ZWFsUG9wdXAsXHJcbiAgICAgICAgICAgIGhpZGVQb3B1cCxcclxuICAgICAgICAgICAgc2hvd0N1cnJTZWxlY3QsXHJcbiAgICAgICAgICAgIHVwZGF0ZUN1cnJlbmN5TGFiZWwsXHJcbiAgICAgICAgICAgIGdlbmVyYXRlQ3VyclNlbGVjdEJ1dHRvbixcclxuICAgICAgICAgICAgZW1wdHlFbGVtZW50LFxyXG4gICAgICAgICAgICB0b2dnbGVFeHBhbmRlZCxcclxuICAgICAgICAgICAgZ2VuTGlzdE5hbWVFbCxcclxuICAgICAgICAgICAgZ2VuTGlzdEl0ZW1FbCxcclxuICAgICAgICAgICAgZ2VuTGlzdEFkZEVsLFxyXG4gICAgICAgICAgICBnZW5MaXN0Q3VyckVsXHJcbiAgICAgICAgfVxyXG4gICAgfSgpXHJcblxyXG4gICAgY29uc3QgbGlzdEhlbHBlciA9IExpc3RNb2R1bGUoKTtcclxuXHJcbiAgICBjb25zdCBuZXR3b3JrSGVscGVyID0gTmV0d29ya01vZHVsZSgpXHJcblxyXG4gICAgY29uc3QgY29udmVyc2lvbkhlbHBlciA9IENvbnZlcnNpb25Nb2R1bGUoKVxyXG5cclxuICAgIGNvbnN0IHNlcnZpY2VXb3JrZXJIZWxwZXIgPSBmdW5jdGlvbiBTZXJ2aWNlV29ya2VySGVscGVyKHdvcmtlckxvY2F0aW9uLCB1cGRhdGVVSSwgdXBkYXRlVHJpZ2dlckVsKXtcclxuICAgICAgICBpZiAoIW5hdmlnYXRvci5zZXJ2aWNlV29ya2VyKSB0aHJvdyBuZXcgRXJyb3IoXCJzZXJ2aWNlIHdvcmtlciBub3Qgc3VwcG9ydGVkXCIpXHJcblxyXG4gICAgICAgIGNvbnN0IHVwZGF0ZVRyaWdnZXJFbGVtZW50ID0gdXBkYXRlVHJpZ2dlckVsO1xyXG5cclxuICAgICAgICAvLyByZWdpc3RlciB0aGUgc2VydmljZSB3b3JrZXJcclxuICAgICAgICBuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5yZWdpc3Rlcih3b3JrZXJMb2NhdGlvbikudGhlbigocmVnKT0+e1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gY2hlY2sgaWYgc2VydmljZSB3b3JrZXIgbG9hZGVkIHRoZSBwYWdlIC0gaWYgaXQgZGlkbid0IHJldHVybiAoYXMgc2VydmljZSB3b3JrZXIgaXMgdGhlIGxhdGVzdClcclxuICAgICAgICAgICAgaWYgKCFuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5jb250cm9sbGVyKSByZXR1cm5cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGlmIHRoZXJlIGlzIG9uZSB3YWl0aW5nIC0gdGhlcmUgd2FzIGEgc2VydmljZSB3b3JrZXIgaW5zdGFsbGVkIG9uIHRoZSBsYXN0IHJlZnJlc2ggYW5kIGl0cyB3YWl0aW5nXHJcbiAgICAgICAgICAgIGlmKHJlZy53YWl0aW5nKXtcclxuICAgICAgICAgICAgICAgIGRpc3BsYXlIZWxwZXIucmV2ZWFsUG9wdXAodXBkYXRlVUkpXHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGlmIHRoZXJlIGlzIGEgc2VydmljZSB3b3JrZXIgaW5zdGFsbGluZ1xyXG4gICAgICAgICAgICBpZihyZWcuaW5zdGFsbGluZyl7XHJcbiAgICAgICAgICAgICAgICB0cmFja0luc3RhbGxpbmcocmVnLmluc3RhbGxpbmcpXHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGxpc3RlbiBmb3IgZnV0dXJlIHdvcmtlcnMgaW5zdGFsbGluZ1xyXG4gICAgICAgICAgICByZWcuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZm91bmQnLCAoKT0+e1xyXG4gICAgICAgICAgICAgICAgdHJhY2tJbnN0YWxsaW5nKHJlZy5pbnN0YWxsaW5nKVxyXG4gICAgICAgICAgICB9KVxyXG5cclxuXHJcbiAgICAgICAgfSkuY2F0Y2goKGVycik9PntcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTZXJ2aWNlIHdvcmtlciBkaWRuJ3QgcmVnaXN0ZXI6ICR7ZXJyLm1lc3NhZ2V9YClcclxuICAgICAgICB9KVxyXG5cclxuICAgICAgICAvLyBsaXN0ZW4gZm9yIGNoYW5nZW92ZXIgb2Ygc2VydmljZSB3b3JrZXIgLSByZWxvYWQgcGFnZSBpZiBhIG5ldyBvbmUgdG9vayBvdmVyXHJcbiAgICAgICAgbmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignY29udHJvbGxlcmNoYW5nZScsICgpPT57XHJcbiAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKVxyXG4gICAgICAgIH0pXHJcblxyXG5cclxuICAgICAgICAvLyBsaXN0ZW4gdG8gaW5zdGFsbGluZyBzZXJ2aWNlIHdvcmtlciAmJiBzaG93IHVzZXIgd2hlbiBpdHMgd2FpdGluZ1xyXG4gICAgICAgIGNvbnN0IHRyYWNrSW5zdGFsbGluZyA9ICh3b3JrZXIpPT57XHJcblxyXG4gICAgICAgICAgICB3b3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignc3RhdGVjaGFuZ2UnLCAoKT0+e1xyXG4gICAgICAgICAgICAgICAgaWYod29ya2VyLnN0YXRlID09ICdpbnN0YWxsZWQnKXtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlVHJpZ2dlckVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKT0+eyAvLyBhZGQgY2xpY2sgZXZlbnQgdG8gdGhlIFVJXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHdvcmtlci5wb3N0TWVzc2FnZSh7YWN0aW9uOiAnc2tpcFdhaXRpbmcnfSlcclxuICAgICAgICAgICAgICAgICAgICB9KVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBkaXNwbGF5SGVscGVyLnJldmVhbFBvcHVwKHVwZGF0ZVVJKSAgLy8gc2hvdyB0aGUgVUlcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSlcclxuICAgICAgICB9XHJcblxyXG4gICAgfSgnc3cuanMnLHVwZGF0ZURpYWxvZywgdXBkYXRlSW5zdGFsbEJ1dHRvbilcclxuXHJcbiAgICBcclxuLy8gSU1QTEVNRU5UQVRJT04gU1BFQ0lGSUMgQ09NTUFORFNcclxuXHJcbiAgICAvLyBjYWxsYmFjayBmb3Igd2hlbiBjdXJyZW5jeSBzZWxlY3QgYnV0dG9ucyBhcmUgY2xpY2tlZFxyXG4gICAgY29uc3QgY3VyclNlbGVjdENhbGxiYWNrID0gKGV2ZW50LGlzVG9wQ3Vycik9PntcclxuICAgIFxyXG4gICAgICAgIGNvbnN0IGN1cnJJbmRleCA9IChpc1RvcEN1cnIpID8gMToyO1xyXG4gICAgICAgIGNvbnN0IGN1cnJMYWJlbCA9IChpc1RvcEN1cnIpID8gY3VyckxhYmVsVG9wOiBjdXJyTGFiZWxCb3R0b21cclxuICAgICAgICBjb25zdCBjdXJyUG9wdXAgPSAoaXNUb3BDdXJyKSA/IGN1cnJQb3B1cFRvcDogY3VyclBvcHVwQm90dG9tXHJcbiAgICAgICAgY29uc3QgY3VyclNlbGVjdEJ1dHRvbnMgPSAoaXNUb3BDdXJyKSA/IGN1cnJTZWxlY3RCdXR0b25zVG9wOiBjdXJyU2VsZWN0QnV0dG9uc0JvdHRvbTtcclxuICAgICAgICBjb25zdCBjdXJyQnV0dG9uID0gKGV2ZW50LnRhcmdldC50YWdOYW1lICE9ICdCVVRUT04nKSA/IGV2ZW50LnRhcmdldC5wYXJlbnROb2RlIDogZXZlbnQudGFyZ2V0OyAvLyBpZiB0aGUgY2xpY2sgb24gYSBjaGlsZCAtIHNldCBwYXJlbnQgT1IgLSBzZXQgdGhlIHBhcmVudCBhcyB0aGUgYnV0dG9uXHJcbiAgICAgICAgY29uc3QgY3VyckJ1dHRvbkN1cnJOYW1lID0gY3VyckJ1dHRvbi5xdWVyeVNlbGVjdG9yKCdwJykuaW5uZXJUZXh0XHJcblxyXG5cclxuICAgICAgICBsZXQgbmV3Q29udlZhbHVlcztcclxuICAgICAgICBcclxuICAgICAgICBkaXNwbGF5SGVscGVyLnNob3dDdXJyU2VsZWN0KGN1cnJCdXR0b24sIGN1cnJTZWxlY3RCdXR0b25zKTsgLy8gZGlzcGxheSB0aGUgdGljayBvbiB0aGUgY3VycmVuY3lcclxuICAgICAgICBkaXNwbGF5SGVscGVyLnVwZGF0ZUN1cnJlbmN5TGFiZWwoY3VyckxhYmVsLCBjdXJyQnV0dG9uQ3Vyck5hbWUpIC8vIGNoYW5nZSB0aGUgbGFiZWwgYXQgdGhlIHRvcFxyXG5cclxuICAgICAgICBjb252ZXJzaW9uSGVscGVyLnNldEN1cnIoY3VyckluZGV4LCBjdXJyQnV0dG9uQ3Vyck5hbWUpIC8vIHNldCB0aGUgbmV3IGN1cnJlbmN5IGZvciB0b3BcclxuICAgICAgICBcclxuICAgICAgICBuZXdDb252VmFsdWVzID0gY29udmVyc2lvbkhlbHBlci51cGRhdGVDb252ZXJzaW9ucygpIC8vIGdldCB0aGUgbmV3IHZhbHVlcyBmb3IgdGhlIGNvbnZlcnNpb24gKHVzaW5nIGRlZmF1bHRzKVxyXG4gICAgICAgIGN1cnIxSW5wdXQudmFsdWUgPSBuZXdDb252VmFsdWVzLnRvcFZhbHVlO1xyXG4gICAgICAgIGN1cnIySW5wdXQudmFsdWUgPSBuZXdDb252VmFsdWVzLmJvdHRvbVZhbHVlO1xyXG5cclxuICAgICAgICAvL2NoYW5nZUN1cnJlbmN5XHJcbiAgICAgICAgZGlzcGxheUhlbHBlci5oaWRlUG9wdXAoY3VyclBvcHVwKS8vIGhpZGUgdGhlIGN1cnJlbmN5IHNlbGVjdFxyXG4gICAgICAgIHJldHVyblxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHVwZGF0ZUxpc3ROYW1lRGlzcGxheSA9ICgpPT57XHJcbiAgICAgICAgLy8gZW1wdHkgdGhlIGxpc3QgbmFtZSBFbGVtZW50XHJcbiAgICAgICAgZGlzcGxheUhlbHBlci5lbXB0eUVsZW1lbnQobGlzdE5hbWVzRWwpO1xyXG5cclxuICAgICAgICBjb25zdCBjbGlja0NhbGxiYWNrID0gKGxpc3ROYW1lKT0+e1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgZG9pbmcgYWxsIHRoZSBjbGljayBzdHVmZjogJHtsaXN0TmFtZX1gKVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgbGlzdEhlbHBlci5jaGFuZ2VMaXN0KGxpc3ROYW1lKS50aGVuKCgpPT57XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgTGlzdCBjaGFuZ2VkOiAke2xpc3ROYW1lfWApXHJcbiAgICAgICAgICAgICAgICBkaXNwbGF5SGVscGVyLnRvZ2dsZUV4cGFuZGVkKGxpc3ROYW1lc0VsKVxyXG4gICAgICAgICAgICAgICAgdXBkYXRlTGlzdE5hbWVEaXNwbGF5KClcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGRlbGV0ZUNhbGxiYWNrID0gKGV2ZW50LGxpc3ROYW1lKT0+e1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgZG9pbmcgYWxsIHRoZSBkZWxldGUgc3R1ZmY6ICR7bGlzdE5hbWV9YClcclxuXHJcbiAgICAgICAgICAgIC8vIGNhbmNlbCB0aGUgZXZlbnQgYnViYmxpbmdcclxuICAgICAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcclxuXHJcbiAgICAgICAgICAgIC8vIGRlbGV0ZSB0aGUgaXRlbXMgaW4gdGhlIGxpc3RcclxuICAgICAgICAgICAgbGlzdEhlbHBlci5kZWxldGVMaXN0KGxpc3ROYW1lKVxyXG4gICAgICAgICAgICAudGhlbihsaXN0SGVscGVyLmNoYW5nZUxpc3QoKSlcclxuICAgICAgICAgICAgLnRoZW4oKCk9PntcclxuICAgICAgICAgICAgICAgIHVwZGF0ZUxpc3ROYW1lRGlzcGxheSgpXHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBnZXQgdGhlIGFubWVzIG9mIHRoZSBsaXN0c1xyXG4gICAgICAgIGxpc3RIZWxwZXIuZ2V0TGlzdE5hbWVzKCkudGhlbigobGlzdE5hbWVzKT0+e1xyXG4gICAgICAgICAgICBjb25zdCBhY3RpdmVMaXN0ID0gbGlzdEhlbHBlci5nZXRBY3RpdmVMaXN0KCk7XHJcblxyXG4gICAgICAgICAgICBsaXN0TmFtZXMuZm9yRWFjaCgobGlzdE5hbWUpPT57XHJcbiAgICAgICAgICAgICAgICBjb25zdCBjYWxsYmFja3MgPSB7IGNsaWNrOigpPT57Y2xpY2tDYWxsYmFjayhsaXN0TmFtZSl9ICwgcmVtb3ZlOihldmVudCk9PntkZWxldGVDYWxsYmFjayhldmVudCxsaXN0TmFtZSl9IH1cclxuICAgICAgICAgICAgICAgIGNvbnN0IHBvc2l0aW9uSW5zZXJ0ID0gKGxpc3ROYW1lID09IGFjdGl2ZUxpc3QpID8gbGlzdE5hbWVzRWwuZmlyc3RDaGlsZCA6IG51bGw7XHJcblxyXG4gICAgICAgICAgICAgICAgbGlzdE5hbWVzRWwuaW5zZXJ0QmVmb3JlKGRpc3BsYXlIZWxwZXIuZ2VuTGlzdE5hbWVFbChsaXN0TmFtZSwgY2FsbGJhY2tzKSwgcG9zaXRpb25JbnNlcnQpXHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlXHJcblxyXG4gICAgICAgIH0pLnRoZW4oKCk9PnsgLy8gYWRkIHRoZSBlbGVtZW50IHRvIGFkZCBhIGxpc3RcclxuXHJcbiAgICAgICAgICAgIC8vIGNhbGxiYWNrIGZvciB3aGVuIHlvdSB3YW50IHRvIGNyZWF0ZSBhIG5ldyBsaXN0XHJcbiAgICAgICAgICAgIGNvbnN0IGNyZWF0ZU5ld0xpc3QgPSAoKT0+e1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbGlzdE5hbWUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLmxpc3RhZGQtbGlzdG5hbWVcIikudmFsdWU7XHJcbiAgICAgICAgICAgICAgICBsaXN0SGVscGVyLmNyZWF0ZUxpc3QobGlzdE5hbWUpLnRoZW4oKCk9Pnt1cGRhdGVMaXN0TmFtZURpc3BsYXkoKX0pXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy9hZGQgdGhlIGFkZCBsaXN0IGJ1dHRvblxyXG4gICAgICAgICAgICBsaXN0TmFtZXNFbC5hcHBlbmRDaGlsZChkaXNwbGF5SGVscGVyLmdlbkxpc3RBZGRFbChjcmVhdGVOZXdMaXN0KSlcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHVwZGF0ZUl0ZW1MaXN0RGlzcGxheSgpXHJcblxyXG4gICAgICAgIH0pLmNhdGNoKChlcnJvcik9PntcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJDb3VsZG4ndCB1cGRhdGUgdGhlIGxpc3ROYW1lc0VsZW1lbnRcIilcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHVwZGF0ZUl0ZW1MaXN0RGlzcGxheSA9ICgpPT57XHJcbiAgICAgICAgLy8gZW1wdHkgdGhlIGxpc3QgaXRlbXNcclxuICAgICAgICBkaXNwbGF5SGVscGVyLmVtcHR5RWxlbWVudChsaXN0SXRlbXNFbClcclxuICAgICAgICAvLyBsaXN0SXRlbXNFbFxyXG5cclxuICAgICAgICAvLyBkZWZpbmUgZnVuY3Rpb25zIGZvciB0aGUgY2xpY2sgYW5kIHJlbW92ZVxyXG4gICAgICAgIGNvbnN0IGNsaWNrQ2FsbGJhY2sgPSAoKT0+e1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImRvaW5nIHRoZSBjbGljayBjYWxsYmFja1wiKVxyXG4gICAgICAgICAgICAvLyBkb24ndCB3YW50IGFueXRoaW5nIHRvIGhhcHBlbiB3aGVuIHRoZSBpdGVtIGdldHMgY2xpY2tlZFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgcmVtb3ZlQ2FsbGJhY2sgPSAoZXZlbnQsIHN0b3JlS2V5KT0+e1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImRvaW5nIHRoZSByZW1vdmUgY2FsbGJhY2tcIilcclxuICAgICAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcclxuICAgICAgICAgICAgbGlzdEhlbHBlci5kZWxldGVQdXJjaGFzZWRJdGVtKHN0b3JlS2V5KS50aGVuKCgpPT57XHJcbiAgICAgICAgICAgICAgICB1cGRhdGVJdGVtTGlzdERpc3BsYXkoKVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgIC8vIGdldCB0aGUgZGV0YWlscyBvZiB0aGUgbGlzdCBpdGVtc1xyXG4gICAgICAgIGxpc3RIZWxwZXIuZ2V0TGlzdEl0ZW1zKGxpc3RIZWxwZXIuZ2V0QWN0aXZlTGlzdCgpKS50aGVuKChsaXN0SXRlbURldGFpbHMpPT57XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBsZXQgbGlzdFRvdGFsID0gMDtcclxuXHJcbiAgICAgICAgICAgIGxpc3RJdGVtRGV0YWlscy5mb3JFYWNoKChsaXN0SXRlbSk9PntcclxuICAgICAgICAgICAgICAgIGNvbnN0IGNhbGxiYWNrcyA9IHtjbGljazogY2xpY2tDYWxsYmFjaywgcmVtb3ZlOihldmVudCk9PntyZW1vdmVDYWxsYmFjayhldmVudCwgbGlzdEl0ZW0uc3RvcmVLZXkpfSB9XHJcbiAgICAgICAgICAgICAgICBjb25zdCBjb252ZXJ0ZWRQcmljZSA9IGNvbnZlcnNpb25IZWxwZXIuY29udmVydFZhbHVlKHtzb3VyY2VWYWx1ZTogbGlzdEl0ZW0ucHJpY2UsIHRhcmdldEN1cnJlbmN5Omxpc3RDdXJyfSlcclxuICAgICAgICAgICAgICAgIGxpc3RJdGVtc0VsLmFwcGVuZENoaWxkKGRpc3BsYXlIZWxwZXIuZ2VuTGlzdEl0ZW1FbChsaXN0SXRlbS5kZXNjcmlwdGlvbiwgY29udmVydGVkUHJpY2UudG9GaXhlZCgyKSwgY2FsbGJhY2tzKSlcclxuICAgICAgICAgICAgICAgIGxpc3RUb3RhbCArPSBjb252ZXJ0ZWRQcmljZVxyXG4gICAgICAgICAgICB9KVxyXG5cclxuICAgICAgICAgICAgbGlzdFRvdGFsRWwuaW5uZXJUZXh0ID0gYCR7bGlzdFRvdGFsLnRvRml4ZWQoMil9YFxyXG4gICAgICAgICAgICB1cGRhdGVUYWJEaXNwbGF5KGxpc3RIZWxwZXIuZ2V0QWN0aXZlTGlzdCgpLCBsaXN0VG90YWwudG9GaXhlZCgyKSxsaXN0Q3VycilcclxuICAgICAgICB9KVxyXG5cclxuXHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc2V0TGlzdEN1cnIgPSAoY3VycmVuY3kpPT57XHJcbiAgICAgICAgaWYoY29udmVyc2lvbkhlbHBlci5nZXRDdXJyTGFiZWxzKCkuaW5jbHVkZXMoY3VycmVuY3kpKXtcclxuICAgICAgICAgICAgcmV0dXJuIGxpc3RDdXJyID0gY3VycmVuY3k7XHJcbiAgICAgICAgfWVsc2V7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtjdXJyZW5jeX0gbm90IGEgdmFsaWQgY3VycmVuY3lgKVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB1cGRhdGVMaXN0Q3VyckRpc3BsYXkgPSAoKT0+e1xyXG4gICAgICAgIC8vIGVtcHR5IHRoZSBjdXJyZW5jeSBlbGVtZW50XHJcbiAgICAgICAgZGlzcGxheUhlbHBlci5lbXB0eUVsZW1lbnQobGlzdEN1cnJlbmN5RWwpXHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gZ2V0IHRoZSBjdXJyZW5jaWVzIGF2YWlsYWJsZVxyXG4gICAgICAgIGNvbnN0IGN1cnJlbmNpZXMgPSBjb252ZXJzaW9uSGVscGVyLmdldEN1cnJMYWJlbHMoKVxyXG5cclxuICAgICAgICBjb25zdCBjbGlja0NhbGxiYWNrID0gKGN1cnJlbmN5TmFtZSk9PntcclxuICAgICAgICAgICAgc2V0TGlzdEN1cnIoY3VycmVuY3lOYW1lKTtcclxuICAgICAgICAgICAgdXBkYXRlTGlzdEN1cnJEaXNwbGF5KCk7XHJcbiAgICAgICAgICAgIGRpc3BsYXlIZWxwZXIudG9nZ2xlRXhwYW5kZWQobGlzdEN1cnJlbmN5RWwpXHJcbiAgICAgICAgICAgIHVwZGF0ZUl0ZW1MaXN0RGlzcGxheSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY3VycmVuY2llcy5mb3JFYWNoKChjdXJyTmFtZSk9PntcclxuICAgICAgICAgICAgbGV0IGN1cnJOYW1lUG9zaXRpb24gPSAoY3Vyck5hbWUgPT0gbGlzdEN1cnIpID8gbGlzdEN1cnJlbmN5RWwuZmlyc3RDaGlsZCA6IG51bGw7XHJcbiAgICAgICAgICAgIGxpc3RDdXJyZW5jeUVsLmluc2VydEJlZm9yZShkaXNwbGF5SGVscGVyLmdlbkxpc3RDdXJyRWwoY3Vyck5hbWUsIHtjbGljazooKT0+e2NsaWNrQ2FsbGJhY2soY3Vyck5hbWUpfX0pLCBjdXJyTmFtZVBvc2l0aW9uKTtcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHVwZGF0ZVRhYkRpc3BsYXkgPSAobGlzdE5hbWUgPSBcIjxNaXNzaW5nIExpc3QgTmFtZVwiLCBsaXN0VG90YWw9TmFOLCBjdXJyZW5jeT1cIjxObyBjdXJyZW5jeT5cIik9PntcclxuICAgICAgICBsaXN0TmFtZURpc3BsYXlUYWIuaW5uZXJUZXh0ID0gbGlzdE5hbWU7XHJcbiAgICAgICAgbGlzdFRvdGFsRGlzcGxheVRhYi5pbm5lclRleHQgPSBgJHtsaXN0VG90YWx9ICR7Y3VycmVuY3l9YFxyXG4gICAgfVxyXG5cclxuICAgIC8vID09IGN1cnJlbmN5IHJlbGV2YW50IGV2ZW50c1xyXG5cclxuICAgIC8vIGV2ZW50IGxpc3RlbmVycyAtLSB3aGVuIHRoZSBpbnB1dCBpcyBtb2RpZmllZCBcclxuICAgIGN1cnIxSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLChldmVudCk9PnsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGNvbnZlcnRWYWx1ZXMgPSBjb252ZXJzaW9uSGVscGVyLnVwZGF0ZUNvbnZlcnNpb25zKGV2ZW50LnRhcmdldC52YWx1ZSwgY29udmVyc2lvbkhlbHBlci5nZXRDdXJyKDEpKVxyXG4gICAgICAgIGN1cnIySW5wdXQudmFsdWUgPSBjb252ZXJ0VmFsdWVzLmJvdHRvbVZhbHVlO1xyXG4gICAgfSlcclxuXHJcbiAgICBjdXJyMklucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywoZXZlbnQpPT57XHJcbiAgICAgICAgY29uc3QgY29udmVydFZhbHVlcyA9IGNvbnZlcnNpb25IZWxwZXIudXBkYXRlQ29udmVyc2lvbnMoZXZlbnQudGFyZ2V0LnZhbHVlLCBjb252ZXJzaW9uSGVscGVyLmdldEN1cnIoMikpXHJcbiAgICAgICAgY3VycjFJbnB1dC52YWx1ZSA9IGNvbnZlcnRWYWx1ZXMudG9wVmFsdWU7XHJcbiAgICB9KVxyXG5cclxuICAgIHRvcEN1cnJSZXZlYWxCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKT0+e1xyXG4gICAgICAgIGRpc3BsYXlIZWxwZXIucmV2ZWFsUG9wdXAoY3VyclBvcHVwVG9wKTtcclxuICAgIH0pXHJcbiAgICBib3R0b21DdXJyUmV2ZWFsQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCk9PntcclxuICAgICAgICBkaXNwbGF5SGVscGVyLnJldmVhbFBvcHVwKGN1cnJQb3B1cEJvdHRvbSlcclxuICAgIH0pXHJcblxyXG4gICAgLy8gPT0gbGlzdCB0YWIgcmVsYXRlZCBldmVudHNcclxuICAgIGxpc3RQb3B1cFNob3dCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKT0+e1xyXG4gICAgICAgIGlmKGxpc3RQb3B1cC5jbGFzc0xpc3QuY29udGFpbnMoXCJhY3RpdmVcIikpe1xyXG4gICAgICAgICAgICBkaXNwbGF5SGVscGVyLmhpZGVQb3B1cChsaXN0UG9wdXApXHJcbiAgICAgICAgfWVsc2V7XHJcbiAgICAgICAgICAgIGRpc3BsYXlIZWxwZXIucmV2ZWFsUG9wdXAobGlzdFBvcHVwKVxyXG4gICAgICAgIH0gXHJcbiAgICB9KVxyXG5cclxuICAgIC8vIGFkZCB0byBsaXN0XHJcbiAgICBsaXN0UG9wdXBBZGRUb0xpc3RCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKT0+e1xyXG4gICAgICAgIGxpc3RIZWxwZXIuYWRkUmVjb3JkKHtcclxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGxpc3RQb3B1cEl0ZW1EZXNjcmlwdGlvbi52YWx1ZSxcclxuICAgICAgICAgICAgY29zdDpjb252ZXJzaW9uSGVscGVyLmdldENvcmVVU0RWYWx1ZSgpXHJcbiAgICAgICAgfSkudGhlbigoKT0+e1xyXG4gICAgICAgICAgICB1cGRhdGVJdGVtTGlzdERpc3BsYXkoKVxyXG4gICAgICAgIH0pXHJcbiAgICB9KVxyXG5cclxuICAgIGxpc3RQb3B1cEV4cGFuZERlc2NyaXB0aW9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCk9PntcclxuICAgICAgICBkaXNwbGF5SGVscGVyLnRvZ2dsZUV4cGFuZGVkKGxpc3RQb3B1cFRhYilcclxuICAgIH0pXHJcblxyXG4gICAgLy8gPT0gbGlzdCByZWFsYXRlZCBldmVudHNcclxuICAgIGxpc3ROYW1lc0V4cGFuZEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKT0+e1xyXG4gICAgICAgIGRpc3BsYXlIZWxwZXIudG9nZ2xlRXhwYW5kZWQobGlzdE5hbWVzRWwpXHJcbiAgICB9KVxyXG5cclxuICAgIGxpc3RDdXJyZW5jeUV4cGFuZEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKT0+e1xyXG4gICAgICAgIGRpc3BsYXlIZWxwZXIudG9nZ2xlRXhwYW5kZWQobGlzdEN1cnJlbmN5RWwpXHJcbiAgICB9KVxyXG5cclxuICAgIC8vIEdFVFRJTkcgU1RBUlRFRCAtIGFmdGVyIHdlIGhhdmUgZ3JhYmJlZCByYXRlc1xyXG5cclxuICAgIC8vIGdyYWIgdGhlIHJhdGVzXHJcbiAgICBuZXR3b3JrSGVscGVyLmdldFJhdGVzKCkudGhlbigocmF0ZXMpPT57XHJcbiAgICAgICAgbGV0IGN1cnJMYWJlbHM7XHJcblxyXG5cclxuICAgICAgICBjb252ZXJzaW9uSGVscGVyLnNldFJhdGVzKHJhdGVzKVxyXG4gICAgICAgIFxyXG4gICAgICAgIGN1cnJMYWJlbHMgPSBjb252ZXJzaW9uSGVscGVyLmdldEN1cnJMYWJlbHMoKVxyXG5cclxuICAgICAgICAvLyBlbXB0eSB0aGUgcG9wdXBzIG9mIHRoZWlyIGJ1dHRvbnNcclxuICAgICAgICBkaXNwbGF5SGVscGVyLmVtcHR5RWxlbWVudChjdXJyUG9wdXBUb3ApXHJcbiAgICAgICAgZGlzcGxheUhlbHBlci5lbXB0eUVsZW1lbnQoY3VyclBvcHVwQm90dG9tKVxyXG5cclxuICAgICAgICBjdXJyTGFiZWxzLmZvckVhY2goKGN1cnJMYWJlbCk9PntcclxuICAgICAgICAgICAgY29uc3QgdG9wQnV0dG9uID0gZGlzcGxheUhlbHBlci5nZW5lcmF0ZUN1cnJTZWxlY3RCdXR0b24oY3VyckxhYmVsLCBjdXJyTGFiZWwgPT0gY29udmVyc2lvbkhlbHBlci5nZXRDdXJyKDEpKVxyXG4gICAgICAgICAgICBjb25zdCBib3R0b21CdXR0b24gPSBkaXNwbGF5SGVscGVyLmdlbmVyYXRlQ3VyclNlbGVjdEJ1dHRvbihjdXJyTGFiZWwsIGN1cnJMYWJlbCA9PSBjb252ZXJzaW9uSGVscGVyLmdldEN1cnIoMikpXHJcblxyXG4gICAgICAgICAgICB0b3BCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpPT57IGN1cnJTZWxlY3RDYWxsYmFjayhldmVudCwgdHJ1ZSl9KVxyXG4gICAgICAgICAgICBib3R0b21CdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpPT57IGN1cnJTZWxlY3RDYWxsYmFjayhldmVudCwgZmFsc2UpfSlcclxuXHJcbiAgICAgICAgICAgIGN1cnJQb3B1cFRvcC5hcHBlbmRDaGlsZCh0b3BCdXR0b24pXHJcbiAgICAgICAgICAgIGN1cnJQb3B1cEJvdHRvbS5hcHBlbmRDaGlsZChib3R0b21CdXR0b24pXHJcbiAgICAgICAgfSlcclxuXHJcbiAgICAgICAgLy8gdXBkYXRlIHRoZSBjdXJyU2VsZWN0QnV0dG9ucyAtIHNvIHRoZXkgY2FuIGJlIGNsZWFyZWRcclxuICAgICAgICBjdXJyU2VsZWN0QnV0dG9uc1RvcCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jdXJyLXNlbGVjdC50b3AgYnV0dG9uJylcclxuICAgICAgICBjdXJyU2VsZWN0QnV0dG9uc0JvdHRvbSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jdXJyLXNlbGVjdC5ib3R0b20gYnV0dG9uJylcclxuXHJcbiAgICAgICAgdXBkYXRlTGlzdE5hbWVEaXNwbGF5KClcclxuICAgICAgICB1cGRhdGVMaXN0Q3VyckRpc3BsYXkoKVxyXG4gICAgfSlcclxuXHJcbiAgICAvLyBkaXNtaXNzIHRoZSB1cGRhdGUgXHJcbiAgICB1cGRhdGVEaXNtaXNzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywoKT0+e1xyXG4gICAgICAgIGRpc3BsYXlIZWxwZXIuaGlkZVBvcHVwKHVwZGF0ZURpc21pc3NCdXR0b24pXHJcbiAgICB9KVxyXG5cclxuLy8gZXhwb3NlIHRoZSBtb2R1bGVzIGZvciBpbnNwZWN0aW9uLSBkZXYgb25seVxyXG4gICAgd2luZG93LmNvbnZBcHBPYmpzID0ge1xyXG4gICAgICAgIGRpc3BsYXlIZWxwZXIsXHJcbiAgICAgICAgbmV0d29ya0hlbHBlcixcclxuICAgICAgICBjb252ZXJzaW9uSGVscGVyLFxyXG4gICAgICAgIHNlcnZpY2VXb3JrZXJIZWxwZXIsXHJcbiAgICAgICAgbGlzdEhlbHBlcixcclxuICAgICAgICBzZXRMaXN0Q3VyclxyXG4gICAgfVxyXG59XHJcbiIsIlxyXG5jb25zdCBDb252ZXJzaW9uSGVscGVyID0gKCk9PntcclxuICAgIFxyXG4gICAgbGV0IHJldHVybk9iamVjdCA9IHt9XHJcbiAgICBsZXQgY29yZVVTRFZhbHVlID0gMDtcclxuICAgIGxldCBjdXJyID0gWydVU0QnLCAnR0JQJ11cclxuICAgIGxldCByYXRlcyA9IHtcclxuICAgICAgICBVU0Q6IDEsXHJcbiAgICAgICAgR0JQOiAwLjc1MjI0NVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNldFJhdGVzID0gKG5ld1JhdGVzKT0+e1xyXG4gICAgICAgIHJldHVybiByYXRlcyA9IG5ld1JhdGVzXHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY29udmVydFZhbHVlPSAoe3NvdXJjZVZhbHVlPTAsIHNvdXJjZUN1cnJlbmN5PSdVU0QnLCB0YXJnZXRDdXJyZW5jeT0nR0JQJ309e30pPT57XHJcbiAgICAgICAgY29uc3QgVVNEID0gc291cmNlVmFsdWUgLyByYXRlc1tzb3VyY2VDdXJyZW5jeV0gICAvLyBjb252ZXJ0IHRvIGJhc2UgY3VycmVuY3kgKFVTRClcclxuICAgICAgICByZXR1cm4gVVNEKnJhdGVzW3RhcmdldEN1cnJlbmN5XSAgIC8vIHJldHVybiB2YWx1ZSBcclxuICAgIH1cclxuXHJcbiAgICAvLyBmdW5jdGlvbnMgdG8gdXBkYXRlIHdoYXQgY3VycmVuY3kgaXMgYmVpbmcgdXNlZFxyXG5cclxuICAgIGNvbnN0IGdldEN1cnIgPSAoY3VyckluZGV4KT0+e1xyXG4gICAgICAgIHJldHVybiBjdXJyW2N1cnJJbmRleC0xXVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNldEN1cnIgPSAoY3VyckluZGV4LCBuZXdDdXJyKT0+e1xyXG4gICAgICAgIGN1cnJbY3VyckluZGV4LTFdID0gbmV3Q3VyclxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHVwZGF0ZUNvbnZlcnNpb25zID0gKGNvbnZlcnRWYWx1ZT1jb3JlVVNEVmFsdWUsIHNvdXJjZUN1cnJlbmN5PSdVU0QnKT0+e1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIG5vcm1hbGlzZSB0byBVU0RcclxuICAgICAgICBjb25zdCBpbmNvbWluZ1VTRFZhbHVlID0gcmV0dXJuT2JqZWN0LmNvbnZlcnRWYWx1ZSh7XHJcbiAgICAgICAgICAgIHNvdXJjZVZhbHVlOiBjb252ZXJ0VmFsdWUsXHJcbiAgICAgICAgICAgIHNvdXJjZUN1cnJlbmN5OiBzb3VyY2VDdXJyZW5jeSxcclxuICAgICAgICAgICAgdGFyZ2V0Q3VycmVuY3k6ICdVU0QnXHJcbiAgICAgICAgfSlcclxuXHJcbiAgICAgICAgY29yZVVTRFZhbHVlID0gaW5jb21pbmdVU0RWYWx1ZTsgLy8gc3RvcmUgdGhpcyB2YWx1ZSBmb3IgdGhlIGZ1dHVyZVxyXG5cclxuICAgICAgICAvLyB1cGRhdGUgdGhlIHZhbHVlIGluIHRvcCBib3hcclxuICAgICAgICBjb25zdCBjb252ZXJzaW9uMSA9IHJldHVybk9iamVjdC5jb252ZXJ0VmFsdWUoe1xyXG4gICAgICAgICAgICBzb3VyY2VWYWx1ZTogaW5jb21pbmdVU0RWYWx1ZSxcclxuICAgICAgICAgICAgc291cmNlQ3VycmVuY3k6J1VTRCcsXHJcbiAgICAgICAgICAgIHRhcmdldEN1cnJlbmN5OiBjdXJyWzBdXHJcbiAgICAgICAgfSkudG9GaXhlZCgyKVxyXG5cclxuICAgICAgICAvLyB1cGRhdGUgdmFsdWUgaW4gYm90dG9tIGJveFxyXG4gICAgICAgIGNvbnN0IGNvbnZlcnNpb24yID0gcmV0dXJuT2JqZWN0LmNvbnZlcnRWYWx1ZSh7XHJcbiAgICAgICAgICAgIHNvdXJjZVZhbHVlOiBpbmNvbWluZ1VTRFZhbHVlLFxyXG4gICAgICAgICAgICBzb3VyY2VDdXJyZW5jeTogJ1VTRCcsXHJcbiAgICAgICAgICAgIHRhcmdldEN1cnJlbmN5OiBjdXJyWzFdXHJcbiAgICAgICAgfSkudG9GaXhlZCgyKVxyXG4gICAgICAgIHJldHVybiB7IHRvcFZhbHVlOiBjb252ZXJzaW9uMSwgYm90dG9tVmFsdWU6IGNvbnZlcnNpb24yfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGdldEN1cnJMYWJlbHMgPSAoKT0+e1xyXG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhyYXRlcylcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBnZXRDb3JlVVNEVmFsdWUgPSAoKT0+e1xyXG4gICAgICAgIHJldHVybiBjb3JlVVNEVmFsdWVcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihyZXR1cm5PYmplY3QsXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBzZXRSYXRlcyxcclxuICAgICAgICAgICAgY29udmVydFZhbHVlLFxyXG4gICAgICAgICAgICBnZXRDdXJyLFxyXG4gICAgICAgICAgICBzZXRDdXJyLFxyXG4gICAgICAgICAgICB1cGRhdGVDb252ZXJzaW9ucyxcclxuICAgICAgICAgICAgZ2V0Q3VyckxhYmVscyxcclxuICAgICAgICAgICAgZ2V0Q29yZVVTRFZhbHVlXHJcbiAgICAgICAgfVxyXG4gICAgKVxyXG59XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDb252ZXJzaW9uSGVscGVyIiwiY29uc3QgRGlzcGxheUhlbHBlciA9ICgpPT57XHJcbiAgICAgICAgXHJcbiAgICBpZiAoIWRvY3VtZW50KSB0aHJvdyBuZXcgRXJyb3IoXCJObyBkb2N1bWVudCBvYmplY3QgdG8gd29yayB3aXRoXCIpICAgLy8gY2hlY2sgdG8gc2VlIGlmIHRoZXJlIGlzIGEgZG9jdW1lbnQgb2JqZWN0XHJcblxyXG4gICAgbGV0IHJldHVybk9iamVjdCA9IHt9XHJcblxyXG4gICAgLy8gYWRkIHRoZSBldmVudHMgdG8gdGhlIGN1cnJlbmN5U2VsZWN0QnV0dG9uc1xyXG4gICAgY29uc3Qgc2hvd0N1cnJTZWxlY3QgPSAoYnV0dG9uQ2xpY2tlZCwgY3VyckJ1dHRvbnMpPT57XHJcbiAgICAgICAgLy8gcmVtb3ZlIHNlbGVjdGVkIGNsYXNzIGZyb20gYWxsIGJ1dHRvbnNcclxuICAgICAgICBjdXJyQnV0dG9ucy5mb3JFYWNoKChidXR0b24pPT57XHJcbiAgICAgICAgICAgIGJ1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCdzZWxlY3RlZCcpXHJcbiAgICAgICAgfSlcclxuICAgICAgICAvLyBzZXQgdGhlIGN1cnJlbmN5IHRvIHRoZSBzYW1lIGFzIHRoZSBzZWxlY3RlZCBidXR0b25cclxuICAgICAgICBcclxuICAgICAgICAvLyBhZGQgdGhlIHNlbGVjdGVkIGNsYXNzIHRvIHRoZSBzZWxlY3RlZCBidXR0b25cclxuICAgICAgICBidXR0b25DbGlja2VkLmNsYXNzTGlzdC5hZGQoJ3NlbGVjdGVkJylcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gXHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcmV2ZWFsUG9wdXAgPSAocG9wdXBFbGVtZW50KT0+e1xyXG4gICAgICAgIHJldHVybiBwb3B1cEVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnYWN0aXZlJylcclxuICAgIH1cclxuICAgIGNvbnN0IGhpZGVQb3B1cCA9IChwb3B1cEVsZW1lbnQpPT57XHJcbiAgICAgICAgcmV0dXJuIHBvcHVwRWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdhY3RpdmUnKVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHVwZGF0ZUN1cnJlbmN5TGFiZWwgPSAobGFiZWxFbGVtZW50LGN1cnJlbmN5U3RyaW5nKT0+e1xyXG4gICAgICAgIGxhYmVsRWxlbWVudC5pbm5lclRleHQgPSBjdXJyZW5jeVN0cmluZ1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGdlbmVyYXRlQ3VyclNlbGVjdEJ1dHRvbiA9IChjdXJyTGFiZWwsIHNlbGVjdGVkKT0+e1xyXG4gICAgICAgIGNvbnN0IGN1cnJCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICAgICAgICBjb25zdCBjaGVja0VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcclxuICAgICAgICBjb25zdCBsYWJlbE5hbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJylcclxuXHJcbiAgICAgICAgXHJcbiAgICAgICAgXHJcbiAgICAgICAgbGFiZWxOYW1lLmlubmVyVGV4dCA9IGN1cnJMYWJlbCAvLyBzZXQgdGhlIGxhYmVsbmFtZVxyXG5cclxuICAgICAgICBjaGVja0VsZW1lbnQuc3JjID0gXCJhc3NldHMvY2hlY2ttYXJrLnN2Z1wiO1xyXG4gICAgICAgIGNoZWNrRWxlbWVudC5jbGFzc0xpc3QuYWRkKFwiY2hlY2ttYXJrXCIpXHJcblxyXG4gICAgICAgIGlmKHNlbGVjdGVkKSBjdXJyQnV0dG9uLmNsYXNzTGlzdC5hZGQoJ3NlbGVjdGVkJylcclxuICAgICAgICBcclxuICAgICAgICBjdXJyQnV0dG9uLmFwcGVuZENoaWxkKGNoZWNrRWxlbWVudClcclxuICAgICAgICBjdXJyQnV0dG9uLmFwcGVuZENoaWxkKGxhYmVsTmFtZSlcclxuXHJcbiAgICAgICAgcmV0dXJuIGN1cnJCdXR0b25cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBlbXB0eUVsZW1lbnQgPSAoZWxlbWVudCk9PntcclxuICAgICAgICB3aGlsZShlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDApe1xyXG4gICAgICAgICAgICBlbGVtZW50LmNoaWxkcmVuWzBdLnJlbW92ZSgpXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gZWxlbWVudFxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHJldHVybk9iamVjdCxcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHJldmVhbFBvcHVwLFxyXG4gICAgICAgICAgICBoaWRlUG9wdXAsXHJcbiAgICAgICAgICAgIHNob3dDdXJyU2VsZWN0LFxyXG4gICAgICAgICAgICB1cGRhdGVDdXJyZW5jeUxhYmVsLFxyXG4gICAgICAgICAgICBnZW5lcmF0ZUN1cnJTZWxlY3RCdXR0b24sXHJcbiAgICAgICAgICAgIGVtcHR5RWxlbWVudFxyXG4gICAgICAgIH1cclxuICAgIClcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBEaXNwbGF5SGVscGVyIiwiY29uc3QgaWRiID0gcmVxdWlyZSgnaWRiJylcclxuXHJcbmNvbnN0IExpc3RNb2R1bGUgPSAoKT0+e1xyXG4gICAgY29uc3QgZGVmYXVsdExpc3ROYW1lID0gXCJEZWZhdWx0IExpc3RcIjtcclxuICAgIGxldCBhY3RpdmVMaXN0ID0gZGVmYXVsdExpc3ROYW1lO1xyXG5cclxuICAgIGxldCBkYlByb21pc2UgPSBpZGIub3Blbignc3BlbmQtbGlzdHMnLDIsICh1cGdyYWRlRGIpPT57XHJcbiAgICAgICAgc3dpdGNoKHVwZ3JhZGVEYi5vbGRWZXJzaW9uKXtcclxuICAgICAgICAgICAgY2FzZSAwOlxyXG4gICAgICAgICAgICAgICAgdmFyIGxpc3RTdG9yZSA9IHVwZ3JhZGVEYi5jcmVhdGVPYmplY3RTdG9yZSgncHVyY2hhc2VkLWl0ZW1zJywge2F1dG9JbmNyZW1lbnQ6IHRydWV9KTtcclxuICAgICAgICAgICAgICAgIGxpc3RTdG9yZS5jcmVhdGVJbmRleCgnYnktbGlzdCcsIFwibGlzdE5hbWVcIilcclxuICAgICAgICAgICAgY2FzZSAxOlxyXG4gICAgICAgICAgICAgICAgdmFyIGxpc3ROYW1lU3RvcmUgPSB1cGdyYWRlRGIuY3JlYXRlT2JqZWN0U3RvcmUoJ2xpc3QtbmFtZXMnKTtcclxuICAgICAgICAgICAgICAgIGxpc3ROYW1lU3RvcmUucHV0KHRydWUsYWN0aXZlTGlzdClcclxuICAgICAgICB9XHJcbiAgICB9KVxyXG4gICAgXHJcbiAgICBcclxuICAgIC8vIElEQiBmdW5jdGlvbnNcclxuICAgIGNvbnN0IGFkZFJlY29yZCA9ICh7IGxpc3ROYW1lPWFjdGl2ZUxpc3QgLCBkZXNjcmlwdGlvbj1cIlNvbWV0aGluZ1wiLCBjb3N0PTAgfT0ge30pPT57XHJcbiAgICAgICAgcmV0dXJuIGRiUHJvbWlzZS50aGVuKChkYik9PntcclxuICAgICAgICAgICAgdmFyIHR4ID0gZGIudHJhbnNhY3Rpb24oJ3B1cmNoYXNlZC1pdGVtcycsICdyZWFkd3JpdGUnKVxyXG4gICAgICAgICAgICB2YXIgbGlzdFN0b3JlID0gdHgub2JqZWN0U3RvcmUoJ3B1cmNoYXNlZC1pdGVtcycpXHJcbiAgICAgICAgICAgIGxpc3RTdG9yZS5wdXQoIHtsaXN0TmFtZTogbGlzdE5hbWUsIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbiwgcHJpY2U6IGNvc3R9KVxyXG4gICAgICAgICAgICByZXR1cm4gdHguY29tcGxldGU7XHJcbiAgICAgICAgfSlcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc3QgY3JlYXRlTGlzdCA9IChsaXN0TmFtZSk9PntcclxuICAgICAgICByZXR1cm4gZGJQcm9taXNlLnRoZW4oKGRiKT0+e1xyXG4gICAgICAgICAgICB2YXIgdHggPSBkYi50cmFuc2FjdGlvbignbGlzdC1uYW1lcycsICdyZWFkd3JpdGUnKVxyXG4gICAgICAgICAgICB2YXIgbGlzdE5hbWVTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKCdsaXN0LW5hbWVzJylcclxuICAgICAgICAgICAgbGlzdE5hbWVTdG9yZS5wdXQodHJ1ZSwgbGlzdE5hbWUpXHJcbiAgICAgICAgICAgIHJldHVybiB0eC5jb21wbGV0ZVxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IGNoYW5nZUxpc3QgPSAobGlzdE5hbWUgPSBkZWZhdWx0TGlzdE5hbWUpPT57XHJcbiAgICAgICAgcmV0dXJuIGdldExpc3QobGlzdE5hbWUpLnRoZW4oKGxpc3RPYmplY3QpPT57XHJcbiAgICAgICAgICAgIGlmKGxpc3RPYmplY3QgIT0gdW5kZWZpbmVkKXtcclxuICAgICAgICAgICAgICAgIGFjdGl2ZUxpc3QgPSBsaXN0TmFtZTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlXHJcbiAgICAgICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBnZXRMaXN0ID0gKGxpc3ROYW1lKT0+e1xyXG4gICAgICAgIHJldHVybiBkYlByb21pc2UudGhlbigoZGIpPT57XHJcbiAgICAgICAgICAgIHZhciB0eCA9IGRiLnRyYW5zYWN0aW9uKCdsaXN0LW5hbWVzJylcclxuICAgICAgICAgICAgdmFyIGxpc3ROYW1lU3RvcmUgPSB0eC5vYmplY3RTdG9yZSgnbGlzdC1uYW1lcycpXHJcbiAgICAgICAgICAgIHJldHVybiBsaXN0TmFtZVN0b3JlLmdldChsaXN0TmFtZSlcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBnZXRMaXN0TmFtZXMgPSgpPT57XHJcbiAgICAgICAgcmV0dXJuIGRiUHJvbWlzZS50aGVuKChkYik9PntcclxuICAgICAgICAgICAgdmFyIHR4ID0gZGIudHJhbnNhY3Rpb24oJ2xpc3QtbmFtZXMnKVxyXG4gICAgICAgICAgICB2YXIgbGlzdFN0b3JlID0gdHgub2JqZWN0U3RvcmUoJ2xpc3QtbmFtZXMnKVxyXG4gICAgICAgICAgICByZXR1cm4gbGlzdFN0b3JlLmdldEFsbEtleXMoKVxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IGdldExpc3RJdGVtcyA9IChsaXN0TmFtZSA9IGRlZmF1bHRMaXN0TmFtZSk9PntcclxuICAgICAgICByZXR1cm4gZGJQcm9taXNlLnRoZW4oKGRiKT0+e1xyXG4gICAgICAgICAgICB2YXIgdHggPSBkYi50cmFuc2FjdGlvbigncHVyY2hhc2VkLWl0ZW1zJylcclxuICAgICAgICAgICAgdmFyIHB1cmNoYXNlZEl0ZW1TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKCdwdXJjaGFzZWQtaXRlbXMnKVxyXG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoW1xyXG4gICAgICAgICAgICAgICAgcHVyY2hhc2VkSXRlbVN0b3JlLmdldEFsbCgpLFxyXG4gICAgICAgICAgICAgICAgcHVyY2hhc2VkSXRlbVN0b3JlLmdldEFsbEtleXMoKVxyXG4gICAgICAgICAgICBdKVxyXG4gICAgICAgIH0pLnRoZW4oKHB1cmNoYXNlZEl0ZW1EZXRhaWxzKT0+e1xyXG4gICAgICAgICAgICByZXR1cm4gcHVyY2hhc2VkSXRlbURldGFpbHNbMF0ubWFwKChpdGVtVmFsdWVzLCBpbmRleCk9PntcclxuICAgICAgICAgICAgICAgIGl0ZW1WYWx1ZXMuc3RvcmVLZXkgPSBwdXJjaGFzZWRJdGVtRGV0YWlsc1sxXVtpbmRleF1cclxuICAgICAgICAgICAgICAgIHJldHVybiBpdGVtVmFsdWVzXHJcbiAgICAgICAgICAgIH0pLmZpbHRlcigoaXRlbURldGFpbHMpPT57XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaXRlbURldGFpbHMubGlzdE5hbWUgPT0gbGlzdE5hbWVcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBkZWxldGVQdXJjaGFzZWRJdGVtID0gKHRhYmxlS2V5KT0+e1xyXG4gICAgICAgIHJldHVybiBkYlByb21pc2UudGhlbigoZGIpPT57XHJcbiAgICAgICAgICAgIGxldCB0eCA9IGRiLnRyYW5zYWN0aW9uKCdwdXJjaGFzZWQtaXRlbXMnLCAncmVhZHdyaXRlJylcclxuICAgICAgICAgICAgbGV0IHB1cmNoYXNlZEl0ZW1TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKCdwdXJjaGFzZWQtaXRlbXMnKVxyXG4gICAgICAgICAgICByZXR1cm4gcHVyY2hhc2VkSXRlbVN0b3JlLmRlbGV0ZSh0YWJsZUtleSlcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBkZWxldGVMaXN0ID0gKGxpc3ROYW1lKT0+e1xyXG4gICAgICAgIHJldHVybiBkYlByb21pc2UudGhlbigoZGIpPT57XHJcbiAgICAgICAgICAgIGxldCB0eCA9IGRiLnRyYW5zYWN0aW9uKFsnbGlzdC1uYW1lcycsJ3B1cmNoYXNlZC1pdGVtcyddLCAncmVhZHdyaXRlJylcclxuICAgICAgICAgICAgbGV0IGxpc3ROYW1lU3RvcmUgPSB0eC5vYmplY3RTdG9yZSgnbGlzdC1uYW1lcycpXHJcbiAgICAgICAgICAgIGxldCBwdXJjaGFzZWRJdGVtU3RvcmUgPSB0eC5vYmplY3RTdG9yZSgncHVyY2hhc2VkLWl0ZW1zJylcclxuICAgIFxyXG4gICAgICAgICAgICBsZXQgbGlzdE5hbWVEZWxldGUgPSBsaXN0TmFtZVN0b3JlLmRlbGV0ZShsaXN0TmFtZSk7XHJcbiAgICAgICAgICAgIGxldCBsaXN0SXRlbXNEZWxldGUgPSBwdXJjaGFzZWRJdGVtU3RvcmUub3BlbkN1cnNvcihudWxsLCBcIm5leHRcIikudGhlbihmdW5jdGlvbiByZW1vdmVJdGVtQnlMaXN0KGN1cnNvcil7XHJcbiAgICAgICAgICAgICAgICBpZighY3Vyc29yKSByZXR1cm4gLy8gcmVjdXJzaXZlIGV4aXQgY29uZGl0aW9uXHJcbiAgICAgICAgICAgICAgICBpZihjdXJzb3IudmFsdWUubGlzdE5hbWUgPT0gbGlzdE5hbWUpIGN1cnNvci5kZWxldGUoKSAgICAvLyBpZiBsaXN0IGlzIHJpZ2h0IC0gZGVsZXRlIGl0ZW1cclxuICAgICAgICAgICAgICAgIHJldHVybiBjdXJzb3IuY29udGludWUoKS50aGVuKHJlbW92ZUl0ZW1CeUxpc3QpIC8vIG1vdmUgdG8gdGhlIG5leHQgaXRlbVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgXHJcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLmFsbChbbGlzdE5hbWVEZWxldGUsIGxpc3RJdGVtc0RlbGV0ZV0pXHJcbiAgICAgICAgfSlcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBnZXRBY3RpdmVMaXN0ID0gKCk9PntcclxuICAgICAgICByZXR1cm4gYWN0aXZlTGlzdC5zbGljZSgwKVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGFkZFJlY29yZCxcclxuICAgICAgICBjcmVhdGVMaXN0LFxyXG4gICAgICAgIGNoYW5nZUxpc3QsXHJcbiAgICAgICAgZ2V0TGlzdCxcclxuICAgICAgICBnZXRMaXN0TmFtZXMsXHJcbiAgICAgICAgZ2V0TGlzdEl0ZW1zLFxyXG4gICAgICAgIGRlbGV0ZVB1cmNoYXNlZEl0ZW0sXHJcbiAgICAgICAgZGVsZXRlTGlzdCxcclxuICAgICAgICBnZXRBY3RpdmVMaXN0XHJcbiAgICB9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTGlzdE1vZHVsZSIsImNvbnN0IE5ldHdvcmtIZWxwZXIgPSgpPT57XHJcbiAgICBcclxuICAgIGxldCByZXR1cm5PYmplY3QgPSB7fTtcclxuICAgIFxyXG4gICAgY29uc3QgaGFuZGxlUmVzcG9uc2UgPSAocmVzcG9uc2UpPT57IC8vIGNoZWNrcyBpZiB0aGUgcmVxdWVzdCBmb3IgdGhlIHJhdGVzIHdhcyBzdWNjZXNzZnVsXHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLm9rKXtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKVxyXG4gICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICBQcm9taXNlLnJlamVjdCggbmV3IEVycm9yICgnVW5leHBlY3RlZCBSZXNwb25zZScpKVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgbG9nTWVzc2FnZSA9IChtZXNzYWdlKT0+e1xyXG4gICAgICAgIGNvbnNvbGUubG9nKG1lc3NhZ2UpXHJcbiAgICAgICAgcmV0dXJuIG1lc3NhZ2VcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBnZXRSYXRlcyA9ICgpPT57ICAvLyByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIHRoZSBkYXRhXHJcbiAgICAgICAgcmV0dXJuIGZldGNoKCcvcmF0ZXMnLCB7bWV0aG9kOiAnR0VUJyxjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nIH0pXHJcbiAgICAgICAgICAgIC50aGVuKGhhbmRsZVJlc3BvbnNlKVxyXG4gICAgICAgICAgICAuY2F0Y2goKGVycik9PnsgbG9nTWVzc2FnZShlcnIubWVzc2FnZSkgfSlcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbiggcmV0dXJuT2JqZWN0LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgZ2V0UmF0ZXNcclxuICAgICAgICB9XHJcbiAgICApXHJcblxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBOZXR3b3JrSGVscGVyIl19
