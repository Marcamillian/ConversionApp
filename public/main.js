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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvaWRiL2xpYi9pZGIuanMiLCJzcmNcXGNsaWVudFxcbWFpbi5qcyIsInNyY1xcbW9kdWxlc1xcQ29udmVyc2lvbkhlbHBlci5qcyIsInNyY1xcbW9kdWxlc1xcRGlzcGxheUhlbHBlci5qcyIsInNyY1xcbW9kdWxlc1xcTGlzdE1vZHVsZS5qcyIsInNyY1xcbW9kdWxlc1xcTmV0d29ya0hlbHBlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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ZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxuKGZ1bmN0aW9uKCkge1xuICBmdW5jdGlvbiB0b0FycmF5KGFycikge1xuICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcnIpO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvbWlzaWZ5UmVxdWVzdChyZXF1ZXN0KSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVzb2x2ZShyZXF1ZXN0LnJlc3VsdCk7XG4gICAgICB9O1xuXG4gICAgICByZXF1ZXN0Lm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KHJlcXVlc3QuZXJyb3IpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb21pc2lmeVJlcXVlc3RDYWxsKG9iaiwgbWV0aG9kLCBhcmdzKSB7XG4gICAgdmFyIHJlcXVlc3Q7XG4gICAgdmFyIHAgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHJlcXVlc3QgPSBvYmpbbWV0aG9kXS5hcHBseShvYmosIGFyZ3MpO1xuICAgICAgcHJvbWlzaWZ5UmVxdWVzdChyZXF1ZXN0KS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgfSk7XG5cbiAgICBwLnJlcXVlc3QgPSByZXF1ZXN0O1xuICAgIHJldHVybiBwO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvbWlzaWZ5Q3Vyc29yUmVxdWVzdENhbGwob2JqLCBtZXRob2QsIGFyZ3MpIHtcbiAgICB2YXIgcCA9IHByb21pc2lmeVJlcXVlc3RDYWxsKG9iaiwgbWV0aG9kLCBhcmdzKTtcbiAgICByZXR1cm4gcC50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICBpZiAoIXZhbHVlKSByZXR1cm47XG4gICAgICByZXR1cm4gbmV3IEN1cnNvcih2YWx1ZSwgcC5yZXF1ZXN0KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5UHJvcGVydGllcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBwcm9wZXJ0aWVzKSB7XG4gICAgcHJvcGVydGllcy5mb3JFYWNoKGZ1bmN0aW9uKHByb3ApIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShQcm94eUNsYXNzLnByb3RvdHlwZSwgcHJvcCwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiB0aGlzW3RhcmdldFByb3BdW3Byb3BdO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgIHRoaXNbdGFyZ2V0UHJvcF1bcHJvcF0gPSB2YWw7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJveHlSZXF1ZXN0TWV0aG9kcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBDb25zdHJ1Y3RvciwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBpZiAoIShwcm9wIGluIENvbnN0cnVjdG9yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICAgIFByb3h5Q2xhc3MucHJvdG90eXBlW3Byb3BdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNpZnlSZXF1ZXN0Q2FsbCh0aGlzW3RhcmdldFByb3BdLCBwcm9wLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5TWV0aG9kcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBDb25zdHJ1Y3RvciwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBpZiAoIShwcm9wIGluIENvbnN0cnVjdG9yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICAgIFByb3h5Q2xhc3MucHJvdG90eXBlW3Byb3BdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzW3RhcmdldFByb3BdW3Byb3BdLmFwcGx5KHRoaXNbdGFyZ2V0UHJvcF0sIGFyZ3VtZW50cyk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJveHlDdXJzb3JSZXF1ZXN0TWV0aG9kcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBDb25zdHJ1Y3RvciwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBpZiAoIShwcm9wIGluIENvbnN0cnVjdG9yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICAgIFByb3h5Q2xhc3MucHJvdG90eXBlW3Byb3BdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNpZnlDdXJzb3JSZXF1ZXN0Q2FsbCh0aGlzW3RhcmdldFByb3BdLCBwcm9wLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIEluZGV4KGluZGV4KSB7XG4gICAgdGhpcy5faW5kZXggPSBpbmRleDtcbiAgfVxuXG4gIHByb3h5UHJvcGVydGllcyhJbmRleCwgJ19pbmRleCcsIFtcbiAgICAnbmFtZScsXG4gICAgJ2tleVBhdGgnLFxuICAgICdtdWx0aUVudHJ5JyxcbiAgICAndW5pcXVlJ1xuICBdKTtcblxuICBwcm94eVJlcXVlc3RNZXRob2RzKEluZGV4LCAnX2luZGV4JywgSURCSW5kZXgsIFtcbiAgICAnZ2V0JyxcbiAgICAnZ2V0S2V5JyxcbiAgICAnZ2V0QWxsJyxcbiAgICAnZ2V0QWxsS2V5cycsXG4gICAgJ2NvdW50J1xuICBdKTtcblxuICBwcm94eUN1cnNvclJlcXVlc3RNZXRob2RzKEluZGV4LCAnX2luZGV4JywgSURCSW5kZXgsIFtcbiAgICAnb3BlbkN1cnNvcicsXG4gICAgJ29wZW5LZXlDdXJzb3InXG4gIF0pO1xuXG4gIGZ1bmN0aW9uIEN1cnNvcihjdXJzb3IsIHJlcXVlc3QpIHtcbiAgICB0aGlzLl9jdXJzb3IgPSBjdXJzb3I7XG4gICAgdGhpcy5fcmVxdWVzdCA9IHJlcXVlc3Q7XG4gIH1cblxuICBwcm94eVByb3BlcnRpZXMoQ3Vyc29yLCAnX2N1cnNvcicsIFtcbiAgICAnZGlyZWN0aW9uJyxcbiAgICAna2V5JyxcbiAgICAncHJpbWFyeUtleScsXG4gICAgJ3ZhbHVlJ1xuICBdKTtcblxuICBwcm94eVJlcXVlc3RNZXRob2RzKEN1cnNvciwgJ19jdXJzb3InLCBJREJDdXJzb3IsIFtcbiAgICAndXBkYXRlJyxcbiAgICAnZGVsZXRlJ1xuICBdKTtcblxuICAvLyBwcm94eSAnbmV4dCcgbWV0aG9kc1xuICBbJ2FkdmFuY2UnLCAnY29udGludWUnLCAnY29udGludWVQcmltYXJ5S2V5J10uZm9yRWFjaChmdW5jdGlvbihtZXRob2ROYW1lKSB7XG4gICAgaWYgKCEobWV0aG9kTmFtZSBpbiBJREJDdXJzb3IucHJvdG90eXBlKSkgcmV0dXJuO1xuICAgIEN1cnNvci5wcm90b3R5cGVbbWV0aG9kTmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjdXJzb3IgPSB0aGlzO1xuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgY3Vyc29yLl9jdXJzb3JbbWV0aG9kTmFtZV0uYXBwbHkoY3Vyc29yLl9jdXJzb3IsIGFyZ3MpO1xuICAgICAgICByZXR1cm4gcHJvbWlzaWZ5UmVxdWVzdChjdXJzb3IuX3JlcXVlc3QpLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICBpZiAoIXZhbHVlKSByZXR1cm47XG4gICAgICAgICAgcmV0dXJuIG5ldyBDdXJzb3IodmFsdWUsIGN1cnNvci5fcmVxdWVzdCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gT2JqZWN0U3RvcmUoc3RvcmUpIHtcbiAgICB0aGlzLl9zdG9yZSA9IHN0b3JlO1xuICB9XG5cbiAgT2JqZWN0U3RvcmUucHJvdG90eXBlLmNyZWF0ZUluZGV4ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBJbmRleCh0aGlzLl9zdG9yZS5jcmVhdGVJbmRleC5hcHBseSh0aGlzLl9zdG9yZSwgYXJndW1lbnRzKSk7XG4gIH07XG5cbiAgT2JqZWN0U3RvcmUucHJvdG90eXBlLmluZGV4ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBJbmRleCh0aGlzLl9zdG9yZS5pbmRleC5hcHBseSh0aGlzLl9zdG9yZSwgYXJndW1lbnRzKSk7XG4gIH07XG5cbiAgcHJveHlQcm9wZXJ0aWVzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgW1xuICAgICduYW1lJyxcbiAgICAna2V5UGF0aCcsXG4gICAgJ2luZGV4TmFtZXMnLFxuICAgICdhdXRvSW5jcmVtZW50J1xuICBdKTtcblxuICBwcm94eVJlcXVlc3RNZXRob2RzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgSURCT2JqZWN0U3RvcmUsIFtcbiAgICAncHV0JyxcbiAgICAnYWRkJyxcbiAgICAnZGVsZXRlJyxcbiAgICAnY2xlYXInLFxuICAgICdnZXQnLFxuICAgICdnZXRBbGwnLFxuICAgICdnZXRLZXknLFxuICAgICdnZXRBbGxLZXlzJyxcbiAgICAnY291bnQnXG4gIF0pO1xuXG4gIHByb3h5Q3Vyc29yUmVxdWVzdE1ldGhvZHMoT2JqZWN0U3RvcmUsICdfc3RvcmUnLCBJREJPYmplY3RTdG9yZSwgW1xuICAgICdvcGVuQ3Vyc29yJyxcbiAgICAnb3BlbktleUN1cnNvcidcbiAgXSk7XG5cbiAgcHJveHlNZXRob2RzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgSURCT2JqZWN0U3RvcmUsIFtcbiAgICAnZGVsZXRlSW5kZXgnXG4gIF0pO1xuXG4gIGZ1bmN0aW9uIFRyYW5zYWN0aW9uKGlkYlRyYW5zYWN0aW9uKSB7XG4gICAgdGhpcy5fdHggPSBpZGJUcmFuc2FjdGlvbjtcbiAgICB0aGlzLmNvbXBsZXRlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICBpZGJUcmFuc2FjdGlvbi5vbmNvbXBsZXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH07XG4gICAgICBpZGJUcmFuc2FjdGlvbi5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChpZGJUcmFuc2FjdGlvbi5lcnJvcik7XG4gICAgICB9O1xuICAgICAgaWRiVHJhbnNhY3Rpb24ub25hYm9ydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QoaWRiVHJhbnNhY3Rpb24uZXJyb3IpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIFRyYW5zYWN0aW9uLnByb3RvdHlwZS5vYmplY3RTdG9yZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgT2JqZWN0U3RvcmUodGhpcy5fdHgub2JqZWN0U3RvcmUuYXBwbHkodGhpcy5fdHgsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhUcmFuc2FjdGlvbiwgJ190eCcsIFtcbiAgICAnb2JqZWN0U3RvcmVOYW1lcycsXG4gICAgJ21vZGUnXG4gIF0pO1xuXG4gIHByb3h5TWV0aG9kcyhUcmFuc2FjdGlvbiwgJ190eCcsIElEQlRyYW5zYWN0aW9uLCBbXG4gICAgJ2Fib3J0J1xuICBdKTtcblxuICBmdW5jdGlvbiBVcGdyYWRlREIoZGIsIG9sZFZlcnNpb24sIHRyYW5zYWN0aW9uKSB7XG4gICAgdGhpcy5fZGIgPSBkYjtcbiAgICB0aGlzLm9sZFZlcnNpb24gPSBvbGRWZXJzaW9uO1xuICAgIHRoaXMudHJhbnNhY3Rpb24gPSBuZXcgVHJhbnNhY3Rpb24odHJhbnNhY3Rpb24pO1xuICB9XG5cbiAgVXBncmFkZURCLnByb3RvdHlwZS5jcmVhdGVPYmplY3RTdG9yZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgT2JqZWN0U3RvcmUodGhpcy5fZGIuY3JlYXRlT2JqZWN0U3RvcmUuYXBwbHkodGhpcy5fZGIsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhVcGdyYWRlREIsICdfZGInLCBbXG4gICAgJ25hbWUnLFxuICAgICd2ZXJzaW9uJyxcbiAgICAnb2JqZWN0U3RvcmVOYW1lcydcbiAgXSk7XG5cbiAgcHJveHlNZXRob2RzKFVwZ3JhZGVEQiwgJ19kYicsIElEQkRhdGFiYXNlLCBbXG4gICAgJ2RlbGV0ZU9iamVjdFN0b3JlJyxcbiAgICAnY2xvc2UnXG4gIF0pO1xuXG4gIGZ1bmN0aW9uIERCKGRiKSB7XG4gICAgdGhpcy5fZGIgPSBkYjtcbiAgfVxuXG4gIERCLnByb3RvdHlwZS50cmFuc2FjdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgVHJhbnNhY3Rpb24odGhpcy5fZGIudHJhbnNhY3Rpb24uYXBwbHkodGhpcy5fZGIsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhEQiwgJ19kYicsIFtcbiAgICAnbmFtZScsXG4gICAgJ3ZlcnNpb24nLFxuICAgICdvYmplY3RTdG9yZU5hbWVzJ1xuICBdKTtcblxuICBwcm94eU1ldGhvZHMoREIsICdfZGInLCBJREJEYXRhYmFzZSwgW1xuICAgICdjbG9zZSdcbiAgXSk7XG5cbiAgLy8gQWRkIGN1cnNvciBpdGVyYXRvcnNcbiAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgb25jZSBicm93c2VycyBkbyB0aGUgcmlnaHQgdGhpbmcgd2l0aCBwcm9taXNlc1xuICBbJ29wZW5DdXJzb3InLCAnb3BlbktleUN1cnNvciddLmZvckVhY2goZnVuY3Rpb24oZnVuY05hbWUpIHtcbiAgICBbT2JqZWN0U3RvcmUsIEluZGV4XS5mb3JFYWNoKGZ1bmN0aW9uKENvbnN0cnVjdG9yKSB7XG4gICAgICBDb25zdHJ1Y3Rvci5wcm90b3R5cGVbZnVuY05hbWUucmVwbGFjZSgnb3BlbicsICdpdGVyYXRlJyldID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gdG9BcnJheShhcmd1bWVudHMpO1xuICAgICAgICB2YXIgY2FsbGJhY2sgPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV07XG4gICAgICAgIHZhciBuYXRpdmVPYmplY3QgPSB0aGlzLl9zdG9yZSB8fCB0aGlzLl9pbmRleDtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuYXRpdmVPYmplY3RbZnVuY05hbWVdLmFwcGx5KG5hdGl2ZU9iamVjdCwgYXJncy5zbGljZSgwLCAtMSkpO1xuICAgICAgICByZXF1ZXN0Lm9uc3VjY2VzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNhbGxiYWNrKHJlcXVlc3QucmVzdWx0KTtcbiAgICAgICAgfTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIHBvbHlmaWxsIGdldEFsbFxuICBbSW5kZXgsIE9iamVjdFN0b3JlXS5mb3JFYWNoKGZ1bmN0aW9uKENvbnN0cnVjdG9yKSB7XG4gICAgaWYgKENvbnN0cnVjdG9yLnByb3RvdHlwZS5nZXRBbGwpIHJldHVybjtcbiAgICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZ2V0QWxsID0gZnVuY3Rpb24ocXVlcnksIGNvdW50KSB7XG4gICAgICB2YXIgaW5zdGFuY2UgPSB0aGlzO1xuICAgICAgdmFyIGl0ZW1zID0gW107XG5cbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlKSB7XG4gICAgICAgIGluc3RhbmNlLml0ZXJhdGVDdXJzb3IocXVlcnksIGZ1bmN0aW9uKGN1cnNvcikge1xuICAgICAgICAgIGlmICghY3Vyc29yKSB7XG4gICAgICAgICAgICByZXNvbHZlKGl0ZW1zKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaXRlbXMucHVzaChjdXJzb3IudmFsdWUpO1xuXG4gICAgICAgICAgaWYgKGNvdW50ICE9PSB1bmRlZmluZWQgJiYgaXRlbXMubGVuZ3RoID09IGNvdW50KSB7XG4gICAgICAgICAgICByZXNvbHZlKGl0ZW1zKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY3Vyc29yLmNvbnRpbnVlKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfSk7XG5cbiAgdmFyIGV4cCA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbihuYW1lLCB2ZXJzaW9uLCB1cGdyYWRlQ2FsbGJhY2spIHtcbiAgICAgIHZhciBwID0gcHJvbWlzaWZ5UmVxdWVzdENhbGwoaW5kZXhlZERCLCAnb3BlbicsIFtuYW1lLCB2ZXJzaW9uXSk7XG4gICAgICB2YXIgcmVxdWVzdCA9IHAucmVxdWVzdDtcblxuICAgICAgcmVxdWVzdC5vbnVwZ3JhZGVuZWVkZWQgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBpZiAodXBncmFkZUNhbGxiYWNrKSB7XG4gICAgICAgICAgdXBncmFkZUNhbGxiYWNrKG5ldyBVcGdyYWRlREIocmVxdWVzdC5yZXN1bHQsIGV2ZW50Lm9sZFZlcnNpb24sIHJlcXVlc3QudHJhbnNhY3Rpb24pKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgcmV0dXJuIHAudGhlbihmdW5jdGlvbihkYikge1xuICAgICAgICByZXR1cm4gbmV3IERCKGRiKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgZGVsZXRlOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICByZXR1cm4gcHJvbWlzaWZ5UmVxdWVzdENhbGwoaW5kZXhlZERCLCAnZGVsZXRlRGF0YWJhc2UnLCBbbmFtZV0pO1xuICAgIH1cbiAgfTtcblxuICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGV4cDtcbiAgICBtb2R1bGUuZXhwb3J0cy5kZWZhdWx0ID0gbW9kdWxlLmV4cG9ydHM7XG4gIH1cbiAgZWxzZSB7XG4gICAgc2VsZi5pZGIgPSBleHA7XG4gIH1cbn0oKSk7XG4iLCJjb25zdCBDb252ZXJzaW9uTW9kdWxlID0gcmVxdWlyZShgLi8uLi9tb2R1bGVzL0NvbnZlcnNpb25IZWxwZXIuanNgKVxyXG5jb25zdCBOZXR3b3JrTW9kdWxlID0gcmVxdWlyZSgnLi8uLi9tb2R1bGVzL05ldHdvcmtIZWxwZXIuanMnKVxyXG5jb25zdCBEaXNwbGF5SGVscGVyID0gcmVxdWlyZSgnLi8uLi9tb2R1bGVzL0Rpc3BsYXlIZWxwZXIuanMnKVxyXG5jb25zdCBMaXN0TW9kdWxlID0gcmVxdWlyZSgnLi8uLi9tb2R1bGVzL0xpc3RNb2R1bGUuanMnKVxyXG5cclxud2luZG93Lm9ubG9hZCA9ICgpPT57XHJcbiAgICBsZXQgbGlzdEN1cnIgPSBcIlVTRFwiO1xyXG4vLyA9PT0gR0VUIEFMTCBUSEUgUkVMRVZBTlQgRUxFTUVOVFMgSU4gVEhFIERPTVxyXG5cclxuICAgIC8vIGN1cnJlbmN5IGNvbnZlcnNpb24gYm94ZXNcclxuICAgIGNvbnN0IGN1cnIxSW5wdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY3Vyci0xJylcclxuICAgIGNvbnN0IGN1cnIySW5wdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY3Vyci0yJylcclxuICAgIGNvbnN0IGN1cnJMYWJlbFRvcCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jdXJyZW5jeS1sYWJlbC50b3AgaDInKVxyXG4gICAgY29uc3QgY3VyckxhYmVsQm90dG9tID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmN1cnJlbmN5LWxhYmVsLmJvdHRvbSBoMicpXHJcblxyXG4gICAgLy8gdXBkYXRlIGRpYWxvZyBib3hlc1xyXG4gICAgY29uc3QgdXBkYXRlRGlhbG9nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3VwZGF0ZS1kaXNwbGF5JylcclxuICAgIGNvbnN0IHVwZGF0ZUluc3RhbGxCdXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndXBkYXRlLWFjY2VwdCcpXHJcbiAgICBjb25zdCB1cGRhdGVEaXNtaXNzQnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3VwZGF0ZS1kaXNtaXNzJylcclxuICAgIFxyXG4gICAgLy8gY3VycmVuY3kgc2VsZWN0IHRpcmdnZXJzXHJcbiAgICBjb25zdCB0b3BDdXJyUmV2ZWFsQnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmN1cnJlbmN5LWxhYmVsLnRvcCAuZHJvcGRvd24nKVxyXG4gICAgY29uc3QgYm90dG9tQ3VyclJldmVhbEJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jdXJyZW5jeS1sYWJlbC5ib3R0b20gLmRyb3Bkb3duJylcclxuICAgIC8vIGN1cnJlbmN5IHNlbGVjdCBwb3B1cHNcclxuICAgIGNvbnN0IGN1cnJQb3B1cFRvcCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jdXJyLXNlbGVjdC50b3AnKVxyXG4gICAgY29uc3QgY3VyclBvcHVwQm90dG9tID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmN1cnItc2VsZWN0LmJvdHRvbScpXHJcbiAgICAvLyBjdXJyZW5jeSBvcHRpb24gYnV0dG9uc1xyXG4gICAgbGV0IGN1cnJTZWxlY3RCdXR0b25zVG9wID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmN1cnItc2VsZWN0LnRvcCBidXR0b24nKVxyXG4gICAgbGV0IGN1cnJTZWxlY3RCdXR0b25zQm90dG9tID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmN1cnItc2VsZWN0LmJvdHRvbSBidXR0b24nKVxyXG4gICAgLy8gbGlzdCBlbGVtZW50c1xyXG4gICAgY29uc3QgbGlzdFBvcHVwID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNzcGVuZC1saXN0XCIpXHJcbiAgICBjb25zdCBsaXN0UG9wdXBTaG93QnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNzcGVuZC1saXN0IC5zaG93LWxpc3RcIilcclxuICAgIGNvbnN0IGxpc3ROYW1lc0VsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi5saXN0LW5hbWVzXCIpXHJcbiAgICBjb25zdCBsaXN0TmFtZXNFeHBhbmRFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIubGlzdC1uYW1lLWRpc3BsYXkgaW1nXCIpXHJcbiAgICBjb25zdCBsaXN0SXRlbXNFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIubGlzdC1pdGVtc1wiKVxyXG4gICAgY29uc3QgbGlzdFRvdGFsRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLml0ZW0tdG90YWxcIilcclxuICAgIGNvbnN0IGxpc3RDdXJyZW5jeUVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi5saXN0LWN1cnJzXCIpXHJcbiAgICBjb25zdCBsaXN0Q3VycmVuY3lFeHBhbmRFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIuY3Vyci1kaXNwbGF5IGltZ1wiKVxyXG5cclxuICAgIC8vIGxpc3QgdGFiIGVsZW1lbnRzXHJcbiAgICBjb25zdCBsaXN0UG9wdXBUYWIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI3NwZW5kLWxpc3QgLnRhYlwiKTtcclxuICAgIGNvbnN0IGxpc3RQb3B1cEFkZFRvTGlzdEJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjc3BlbmQtbGlzdCAuYWRkLXRvLWxpc3RcIilcclxuICAgIGNvbnN0IGxpc3RQb3B1cEl0ZW1EZXNjcmlwdGlvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjc3BlbmQtbGlzdCAuaXRlbS1kZXNjcmlwdGlvblwiKVxyXG4gICAgY29uc3QgbGlzdFBvcHVwRXhwYW5kRGVzY3JpcHRpb24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLmV4cGFuZC1kZXNjcmlwdGlvblwiKVxyXG5cclxuLy8gaGVscGVyIG1vZHVsZXNcclxuICAgIGNvbnN0IGRpc3BsYXlIZWxwZXIgPSBmdW5jdGlvbiBEaXNwbGF5SGVscGVyKCl7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCFkb2N1bWVudCkgdGhyb3cgbmV3IEVycm9yKFwiTm8gZG9jdW1lbnQgb2JqZWN0IHRvIHdvcmsgd2l0aFwiKSAgIC8vIGNoZWNrIHRvIHNlZSBpZiB0aGVyZSBpcyBhIGRvY3VtZW50IG9iamVjdFxyXG5cclxuICAgICAgICAvLyBhZGQgdGhlIGV2ZW50cyB0byB0aGUgY3VycmVuY3lTZWxlY3RCdXR0b25zXHJcbiAgICAgICAgY29uc3Qgc2hvd0N1cnJTZWxlY3QgPSAoYnV0dG9uQ2xpY2tlZCwgY3VyckJ1dHRvbnMpPT57XHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBzZWxlY3RlZCBjbGFzcyBmcm9tIGFsbCBidXR0b25zXHJcbiAgICAgICAgICAgIGN1cnJCdXR0b25zLmZvckVhY2goKGJ1dHRvbik9PntcclxuICAgICAgICAgICAgICAgIGJ1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCdzZWxlY3RlZCcpXHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIC8vIHNldCB0aGUgY3VycmVuY3kgdG8gdGhlIHNhbWUgYXMgdGhlIHNlbGVjdGVkIGJ1dHRvblxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gYWRkIHRoZSBzZWxlY3RlZCBjbGFzcyB0byB0aGUgc2VsZWN0ZWQgYnV0dG9uXHJcbiAgICAgICAgICAgIGJ1dHRvbkNsaWNrZWQuY2xhc3NMaXN0LmFkZCgnc2VsZWN0ZWQnKVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgcmV2ZWFsUG9wdXAgPSAocG9wdXBFbGVtZW50KT0+e1xyXG4gICAgICAgICAgICByZXR1cm4gcG9wdXBFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2FjdGl2ZScpXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IGhpZGVQb3B1cCA9IChwb3B1cEVsZW1lbnQpPT57XHJcbiAgICAgICAgICAgIHJldHVybiBwb3B1cEVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnYWN0aXZlJylcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHVwZGF0ZUN1cnJlbmN5TGFiZWwgPSAobGFiZWxFbGVtZW50LGN1cnJlbmN5U3RyaW5nKT0+e1xyXG4gICAgICAgICAgICBsYWJlbEVsZW1lbnQuaW5uZXJUZXh0ID0gY3VycmVuY3lTdHJpbmdcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGdlbmVyYXRlQ3VyclNlbGVjdEJ1dHRvbiA9IChjdXJyTGFiZWwsIHNlbGVjdGVkKT0+e1xyXG4gICAgICAgICAgICBjb25zdCBjdXJyQnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGNoZWNrRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xyXG4gICAgICAgICAgICBjb25zdCBsYWJlbE5hbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJylcclxuXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgbGFiZWxOYW1lLmlubmVyVGV4dCA9IGN1cnJMYWJlbCAvLyBzZXQgdGhlIGxhYmVsbmFtZVxyXG5cclxuICAgICAgICAgICAgY2hlY2tFbGVtZW50LnNyYyA9IFwiYXNzZXRzL2NoZWNrbWFyay5zdmdcIjtcclxuICAgICAgICAgICAgY2hlY2tFbGVtZW50LmNsYXNzTGlzdC5hZGQoXCJjaGVja21hcmtcIilcclxuXHJcbiAgICAgICAgICAgIGlmKHNlbGVjdGVkKSBjdXJyQnV0dG9uLmNsYXNzTGlzdC5hZGQoJ3NlbGVjdGVkJylcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGN1cnJCdXR0b24uYXBwZW5kQ2hpbGQoY2hlY2tFbGVtZW50KVxyXG4gICAgICAgICAgICBjdXJyQnV0dG9uLmFwcGVuZENoaWxkKGxhYmVsTmFtZSlcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBjdXJyQnV0dG9uXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBlbXB0eUVsZW1lbnQgPSAoZWxlbWVudCk9PntcclxuICAgICAgICAgICAgd2hpbGUoZWxlbWVudC5jaGlsZHJlbi5sZW5ndGggPiAwKXtcclxuICAgICAgICAgICAgICAgIGVsZW1lbnQuY2hpbGRyZW5bMF0ucmVtb3ZlKClcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgdG9nZ2xlRXhwYW5kZWQgPSAoZWxlbWVudCk9PntcclxuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZShcImV4cGFuZGVkXCIpXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBnZW5MaXN0TmFtZUVsID0gKGxpc3ROYW1lID0gXCI8bmFtZSBtaXNzaW5nPlwiLCBjYWxsYmFja3MgPVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgICByZW1vdmUgPSAoKT0+e2NvbnNvbGUubG9nKFwiZGVsZXRlIGNsaWNrZWRcIil9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGljayA9ICgpPT57Y29uc29sZS5sb2coXCJsaXN0TmFtZSBjbGlja2VkXCIpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gPSB7fSApPT57XHJcblxyXG4gICAgICAgICAgICBsZXQgbGlzdE5hbWVFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XHJcbiAgICAgICAgICAgIGxldCBkZWxldGVCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKVxyXG5cclxuICAgICAgICAgICAgZGVsZXRlQnV0dG9uLmlubmVyVGV4dCA9IFwiLVwiO1xyXG4gICAgICAgICAgICBkZWxldGVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLGNhbGxiYWNrcy5yZW1vdmUpXHJcblxyXG4gICAgICAgICAgICBsaXN0TmFtZUVsLmlubmVyVGV4dCA9IGxpc3ROYW1lO1xyXG4gICAgICAgICAgICBsaXN0TmFtZUVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBjYWxsYmFja3MuY2xpY2spXHJcblxyXG4gICAgICAgICAgICBpZihsaXN0TmFtZSAhPSBcIkRlZmF1bHQgTGlzdFwiKSBsaXN0TmFtZUVsLmFwcGVuZENoaWxkKGRlbGV0ZUJ1dHRvbilcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBsaXN0TmFtZUVsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgZ2VuTGlzdEFkZEVsID0gKGFkZENhbGxiYWNrID0gKCk9Pntjb25zb2xlLmxvZyhcIkFkZCBMaXN0IGJ1dHRvbiBjbGlja2VkXCIpfSk9PntcclxuXHJcbiAgICAgICAgICAgIGxldCBsaXN0QWRkRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xyXG4gICAgICAgICAgICBsZXQgYWRkQnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJylcclxuICAgICAgICAgICAgbGV0IG5hbWVJbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0JylcclxuXHJcbiAgICAgICAgICAgIGFkZEJ1dHRvbi5pbm5lclRleHQgPSBcIitcIjtcclxuICAgICAgICAgICAgYWRkQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJyxhZGRDYWxsYmFjaylcclxuXHJcbiAgICAgICAgICAgIG5hbWVJbnB1dC5jbGFzc0xpc3QuYWRkKFwibGlzdGFkZC1saXN0bmFtZVwiKVxyXG5cclxuICAgICAgICAgICAgbGlzdEFkZEVsLmFwcGVuZENoaWxkKG5hbWVJbnB1dCk7XHJcbiAgICAgICAgICAgIGxpc3RBZGRFbC5hcHBlbmRDaGlsZChhZGRCdXR0b24pO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGxpc3RBZGRFbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGdlbkxpc3RJdGVtRWwgPSAoIGRlc2NyaXB0aW9uID0gXCI8ZGVzY3JpcHRpb24gbWlzc2luZz5cIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmljZSA9IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyAgIHJlbW92ZSA9ICgpPT57Y29uc29sZS5sb2coXCJsaXRJdGVtIGRlbGV0ZSBjbGlja2VkXCIpfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xpY2sgPSAoKT0+e2NvbnNvbGUubG9nKFwibGlzdEl0ZW0gY2xpY2tlZFwiKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9PXt9ICk9PntcclxuXHJcblxyXG4gICAgICAgICAgICBsZXQgbGlzdEl0ZW1FbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XHJcbiAgICAgICAgICAgIGxldCBkZWxldGVCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKVxyXG5cclxuICAgICAgICAgICAgZGVsZXRlQnV0dG9uLmlubmVyVGV4dCA9IFwiLVwiO1xyXG4gICAgICAgICAgICBkZWxldGVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCByZW1vdmUpXHJcblxyXG4gICAgICAgICAgICBsaXN0SXRlbUVsLmlubmVyVGV4dCA9IGAke3ByaWNlfSA6ICR7ZGVzY3JpcHRpb259YDtcclxuICAgICAgICAgICAgbGlzdEl0ZW1FbC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgY2xpY2spXHJcbiAgICAgICAgICAgIGxpc3RJdGVtRWwuYXBwZW5kQ2hpbGQoZGVsZXRlQnV0dG9uKVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGxpc3RJdGVtRWw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBnZW5MaXN0Q3VyckVsID0gKGN1cnJOYW1lID0gXCI8Y3VyciBub3QgZGVmaW5lZD5cIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYWxsYmFja3NcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGNsaWNrID0gKCk9Pntjb25zb2xlLmxvZyhcImxpc3RDdXJyIGNsaWNrZWRcIil9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSA9IHt9KT0+e1xyXG4gICAgICAgICAgICBsZXQgbGlzdEN1cnJFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJylcclxuXHJcbiAgICAgICAgICAgIGxpc3RDdXJyRWwuaW5uZXJUZXh0ID0gY3Vyck5hbWU7XHJcbiAgICAgICAgICAgIGxpc3RDdXJyRWwuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGNsaWNrKVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGxpc3RDdXJyRWxcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHJldmVhbFBvcHVwLFxyXG4gICAgICAgICAgICBoaWRlUG9wdXAsXHJcbiAgICAgICAgICAgIHNob3dDdXJyU2VsZWN0LFxyXG4gICAgICAgICAgICB1cGRhdGVDdXJyZW5jeUxhYmVsLFxyXG4gICAgICAgICAgICBnZW5lcmF0ZUN1cnJTZWxlY3RCdXR0b24sXHJcbiAgICAgICAgICAgIGVtcHR5RWxlbWVudCxcclxuICAgICAgICAgICAgdG9nZ2xlRXhwYW5kZWQsXHJcbiAgICAgICAgICAgIGdlbkxpc3ROYW1lRWwsXHJcbiAgICAgICAgICAgIGdlbkxpc3RJdGVtRWwsXHJcbiAgICAgICAgICAgIGdlbkxpc3RBZGRFbCxcclxuICAgICAgICAgICAgZ2VuTGlzdEN1cnJFbFxyXG4gICAgICAgIH1cclxuICAgIH0oKVxyXG5cclxuICAgIGNvbnN0IGxpc3RIZWxwZXIgPSBMaXN0TW9kdWxlKCk7XHJcblxyXG4gICAgY29uc3QgbmV0d29ya0hlbHBlciA9IE5ldHdvcmtNb2R1bGUoKVxyXG5cclxuICAgIGNvbnN0IGNvbnZlcnNpb25IZWxwZXIgPSBDb252ZXJzaW9uTW9kdWxlKClcclxuXHJcbiAgICBjb25zdCBzZXJ2aWNlV29ya2VySGVscGVyID0gZnVuY3Rpb24gU2VydmljZVdvcmtlckhlbHBlcih3b3JrZXJMb2NhdGlvbiwgdXBkYXRlVUksIHVwZGF0ZVRyaWdnZXJFbCl7XHJcbiAgICAgICAgaWYgKCFuYXZpZ2F0b3Iuc2VydmljZVdvcmtlcikgdGhyb3cgbmV3IEVycm9yKFwic2VydmljZSB3b3JrZXIgbm90IHN1cHBvcnRlZFwiKVxyXG5cclxuICAgICAgICBjb25zdCB1cGRhdGVUcmlnZ2VyRWxlbWVudCA9IHVwZGF0ZVRyaWdnZXJFbDtcclxuXHJcbiAgICAgICAgLy8gcmVnaXN0ZXIgdGhlIHNlcnZpY2Ugd29ya2VyXHJcbiAgICAgICAgbmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIucmVnaXN0ZXIod29ya2VyTG9jYXRpb24pLnRoZW4oKHJlZyk9PntcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHNlcnZpY2Ugd29ya2VyIGxvYWRlZCB0aGUgcGFnZSAtIGlmIGl0IGRpZG4ndCByZXR1cm4gKGFzIHNlcnZpY2Ugd29ya2VyIGlzIHRoZSBsYXRlc3QpXHJcbiAgICAgICAgICAgIGlmICghbmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIuY29udHJvbGxlcikgcmV0dXJuXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBpZiB0aGVyZSBpcyBvbmUgd2FpdGluZyAtIHRoZXJlIHdhcyBhIHNlcnZpY2Ugd29ya2VyIGluc3RhbGxlZCBvbiB0aGUgbGFzdCByZWZyZXNoIGFuZCBpdHMgd2FpdGluZ1xyXG4gICAgICAgICAgICBpZihyZWcud2FpdGluZyl7XHJcbiAgICAgICAgICAgICAgICBkaXNwbGF5SGVscGVyLnJldmVhbFBvcHVwKHVwZGF0ZVVJKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBpZiB0aGVyZSBpcyBhIHNlcnZpY2Ugd29ya2VyIGluc3RhbGxpbmdcclxuICAgICAgICAgICAgaWYocmVnLmluc3RhbGxpbmcpe1xyXG4gICAgICAgICAgICAgICAgdHJhY2tJbnN0YWxsaW5nKHJlZy5pbnN0YWxsaW5nKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBsaXN0ZW4gZm9yIGZ1dHVyZSB3b3JrZXJzIGluc3RhbGxpbmdcclxuICAgICAgICAgICAgcmVnLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWZvdW5kJywgKCk9PntcclxuICAgICAgICAgICAgICAgIHRyYWNrSW5zdGFsbGluZyhyZWcuaW5zdGFsbGluZylcclxuICAgICAgICAgICAgfSlcclxuXHJcblxyXG4gICAgICAgIH0pLmNhdGNoKChlcnIpPT57XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU2VydmljZSB3b3JrZXIgZGlkbid0IHJlZ2lzdGVyOiAke2Vyci5tZXNzYWdlfWApXHJcbiAgICAgICAgfSlcclxuXHJcbiAgICAgICAgLy8gbGlzdGVuIGZvciBjaGFuZ2VvdmVyIG9mIHNlcnZpY2Ugd29ya2VyIC0gcmVsb2FkIHBhZ2UgaWYgYSBuZXcgb25lIHRvb2sgb3ZlclxyXG4gICAgICAgIG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRyb2xsZXJjaGFuZ2UnLCAoKT0+e1xyXG4gICAgICAgICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKClcclxuICAgICAgICB9KVxyXG5cclxuXHJcbiAgICAgICAgLy8gbGlzdGVuIHRvIGluc3RhbGxpbmcgc2VydmljZSB3b3JrZXIgJiYgc2hvdyB1c2VyIHdoZW4gaXRzIHdhaXRpbmdcclxuICAgICAgICBjb25zdCB0cmFja0luc3RhbGxpbmcgPSAod29ya2VyKT0+e1xyXG5cclxuICAgICAgICAgICAgd29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ3N0YXRlY2hhbmdlJywgKCk9PntcclxuICAgICAgICAgICAgICAgIGlmKHdvcmtlci5zdGF0ZSA9PSAnaW5zdGFsbGVkJyl7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZVRyaWdnZXJFbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCk9PnsgLy8gYWRkIGNsaWNrIGV2ZW50IHRvIHRoZSBVSVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2Uoe2FjdGlvbjogJ3NraXBXYWl0aW5nJ30pXHJcbiAgICAgICAgICAgICAgICAgICAgfSlcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgZGlzcGxheUhlbHBlci5yZXZlYWxQb3B1cCh1cGRhdGVVSSkgIC8vIHNob3cgdGhlIFVJXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH0oJ3N3LmpzJyx1cGRhdGVEaWFsb2csIHVwZGF0ZUluc3RhbGxCdXR0b24pXHJcblxyXG4gICAgXHJcbi8vIElNUExFTUVOVEFUSU9OIFNQRUNJRklDIENPTU1BTkRTXHJcblxyXG4gICAgLy8gY2FsbGJhY2sgZm9yIHdoZW4gY3VycmVuY3kgc2VsZWN0IGJ1dHRvbnMgYXJlIGNsaWNrZWRcclxuICAgIGNvbnN0IGN1cnJTZWxlY3RDYWxsYmFjayA9IChldmVudCxpc1RvcEN1cnIpPT57XHJcbiAgICBcclxuICAgICAgICBjb25zdCBjdXJySW5kZXggPSAoaXNUb3BDdXJyKSA/IDE6MjtcclxuICAgICAgICBjb25zdCBjdXJyTGFiZWwgPSAoaXNUb3BDdXJyKSA/IGN1cnJMYWJlbFRvcDogY3VyckxhYmVsQm90dG9tXHJcbiAgICAgICAgY29uc3QgY3VyclBvcHVwID0gKGlzVG9wQ3VycikgPyBjdXJyUG9wdXBUb3A6IGN1cnJQb3B1cEJvdHRvbVxyXG4gICAgICAgIGNvbnN0IGN1cnJTZWxlY3RCdXR0b25zID0gKGlzVG9wQ3VycikgPyBjdXJyU2VsZWN0QnV0dG9uc1RvcDogY3VyclNlbGVjdEJ1dHRvbnNCb3R0b207XHJcbiAgICAgICAgY29uc3QgY3VyckJ1dHRvbiA9IChldmVudC50YXJnZXQudGFnTmFtZSAhPSAnQlVUVE9OJykgPyBldmVudC50YXJnZXQucGFyZW50Tm9kZSA6IGV2ZW50LnRhcmdldDsgLy8gaWYgdGhlIGNsaWNrIG9uIGEgY2hpbGQgLSBzZXQgcGFyZW50IE9SIC0gc2V0IHRoZSBwYXJlbnQgYXMgdGhlIGJ1dHRvblxyXG4gICAgICAgIGNvbnN0IGN1cnJCdXR0b25DdXJyTmFtZSA9IGN1cnJCdXR0b24ucXVlcnlTZWxlY3RvcigncCcpLmlubmVyVGV4dFxyXG5cclxuXHJcbiAgICAgICAgbGV0IG5ld0NvbnZWYWx1ZXM7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZGlzcGxheUhlbHBlci5zaG93Q3VyclNlbGVjdChjdXJyQnV0dG9uLCBjdXJyU2VsZWN0QnV0dG9ucyk7IC8vIGRpc3BsYXkgdGhlIHRpY2sgb24gdGhlIGN1cnJlbmN5XHJcbiAgICAgICAgZGlzcGxheUhlbHBlci51cGRhdGVDdXJyZW5jeUxhYmVsKGN1cnJMYWJlbCwgY3VyckJ1dHRvbkN1cnJOYW1lKSAvLyBjaGFuZ2UgdGhlIGxhYmVsIGF0IHRoZSB0b3BcclxuXHJcbiAgICAgICAgY29udmVyc2lvbkhlbHBlci5zZXRDdXJyKGN1cnJJbmRleCwgY3VyckJ1dHRvbkN1cnJOYW1lKSAvLyBzZXQgdGhlIG5ldyBjdXJyZW5jeSBmb3IgdG9wXHJcbiAgICAgICAgXHJcbiAgICAgICAgbmV3Q29udlZhbHVlcyA9IGNvbnZlcnNpb25IZWxwZXIudXBkYXRlQ29udmVyc2lvbnMoKSAvLyBnZXQgdGhlIG5ldyB2YWx1ZXMgZm9yIHRoZSBjb252ZXJzaW9uICh1c2luZyBkZWZhdWx0cylcclxuICAgICAgICBjdXJyMUlucHV0LnZhbHVlID0gbmV3Q29udlZhbHVlcy50b3BWYWx1ZTtcclxuICAgICAgICBjdXJyMklucHV0LnZhbHVlID0gbmV3Q29udlZhbHVlcy5ib3R0b21WYWx1ZTtcclxuXHJcbiAgICAgICAgLy9jaGFuZ2VDdXJyZW5jeVxyXG4gICAgICAgIGRpc3BsYXlIZWxwZXIuaGlkZVBvcHVwKGN1cnJQb3B1cCkvLyBoaWRlIHRoZSBjdXJyZW5jeSBzZWxlY3RcclxuICAgICAgICByZXR1cm5cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB1cGRhdGVMaXN0TmFtZURpc3BsYXkgPSAoKT0+e1xyXG4gICAgICAgIC8vIGVtcHR5IHRoZSBsaXN0IG5hbWUgRWxlbWVudFxyXG4gICAgICAgIGRpc3BsYXlIZWxwZXIuZW1wdHlFbGVtZW50KGxpc3ROYW1lc0VsKTtcclxuXHJcbiAgICAgICAgY29uc3QgY2xpY2tDYWxsYmFjayA9IChsaXN0TmFtZSk9PntcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYGRvaW5nIGFsbCB0aGUgY2xpY2sgc3R1ZmY6ICR7bGlzdE5hbWV9YClcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGxpc3RIZWxwZXIuY2hhbmdlTGlzdChsaXN0TmFtZSkudGhlbigoKT0+e1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYExpc3QgY2hhbmdlZDogJHtsaXN0TmFtZX1gKVxyXG4gICAgICAgICAgICAgICAgZGlzcGxheUhlbHBlci50b2dnbGVFeHBhbmRlZChsaXN0TmFtZXNFbClcclxuICAgICAgICAgICAgICAgIHVwZGF0ZUxpc3ROYW1lRGlzcGxheSgpXHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBkZWxldGVDYWxsYmFjayA9IChldmVudCxsaXN0TmFtZSk9PntcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYGRvaW5nIGFsbCB0aGUgZGVsZXRlIHN0dWZmOiAke2xpc3ROYW1lfWApXHJcblxyXG4gICAgICAgICAgICAvLyBjYW5jZWwgdGhlIGV2ZW50IGJ1YmJsaW5nXHJcbiAgICAgICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXHJcblxyXG4gICAgICAgICAgICAvLyBkZWxldGUgdGhlIGl0ZW1zIGluIHRoZSBsaXN0XHJcbiAgICAgICAgICAgIGxpc3RIZWxwZXIuZGVsZXRlTGlzdChsaXN0TmFtZSlcclxuICAgICAgICAgICAgLnRoZW4obGlzdEhlbHBlci5jaGFuZ2VMaXN0KCkpXHJcbiAgICAgICAgICAgIC50aGVuKCgpPT57XHJcbiAgICAgICAgICAgICAgICB1cGRhdGVMaXN0TmFtZURpc3BsYXkoKVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gZ2V0IHRoZSBhbm1lcyBvZiB0aGUgbGlzdHNcclxuICAgICAgICBsaXN0SGVscGVyLmdldExpc3ROYW1lcygpLnRoZW4oKGxpc3ROYW1lcyk9PntcclxuICAgICAgICAgICAgY29uc3QgYWN0aXZlTGlzdCA9IGxpc3RIZWxwZXIuZ2V0QWN0aXZlTGlzdCgpO1xyXG5cclxuICAgICAgICAgICAgbGlzdE5hbWVzLmZvckVhY2goKGxpc3ROYW1lKT0+e1xyXG4gICAgICAgICAgICAgICAgY29uc3QgY2FsbGJhY2tzID0geyBjbGljazooKT0+e2NsaWNrQ2FsbGJhY2sobGlzdE5hbWUpfSAsIHJlbW92ZTooZXZlbnQpPT57ZGVsZXRlQ2FsbGJhY2soZXZlbnQsbGlzdE5hbWUpfSB9XHJcbiAgICAgICAgICAgICAgICBjb25zdCBwb3NpdGlvbkluc2VydCA9IChsaXN0TmFtZSA9PSBhY3RpdmVMaXN0KSA/IGxpc3ROYW1lc0VsLmZpcnN0Q2hpbGQgOiBudWxsO1xyXG5cclxuICAgICAgICAgICAgICAgIGxpc3ROYW1lc0VsLmluc2VydEJlZm9yZShkaXNwbGF5SGVscGVyLmdlbkxpc3ROYW1lRWwobGlzdE5hbWUsIGNhbGxiYWNrcyksIHBvc2l0aW9uSW5zZXJ0KVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxyXG5cclxuICAgICAgICB9KS50aGVuKCgpPT57IC8vIGFkZCB0aGUgZWxlbWVudCB0byBhZGQgYSBsaXN0XHJcblxyXG4gICAgICAgICAgICAvLyBjYWxsYmFjayBmb3Igd2hlbiB5b3Ugd2FudCB0byBjcmVhdGUgYSBuZXcgbGlzdFxyXG4gICAgICAgICAgICBjb25zdCBjcmVhdGVOZXdMaXN0ID0gKCk9PntcclxuICAgICAgICAgICAgICAgIGNvbnN0IGxpc3ROYW1lID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi5saXN0YWRkLWxpc3RuYW1lXCIpLnZhbHVlO1xyXG4gICAgICAgICAgICAgICAgbGlzdEhlbHBlci5jcmVhdGVMaXN0KGxpc3ROYW1lKS50aGVuKCgpPT57dXBkYXRlTGlzdE5hbWVEaXNwbGF5KCl9KVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vYWRkIHRoZSBhZGQgbGlzdCBidXR0b25cclxuICAgICAgICAgICAgbGlzdE5hbWVzRWwuYXBwZW5kQ2hpbGQoZGlzcGxheUhlbHBlci5nZW5MaXN0QWRkRWwoY3JlYXRlTmV3TGlzdCkpXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB1cGRhdGVJdGVtTGlzdERpc3BsYXkoKVxyXG5cclxuICAgICAgICB9KS5jYXRjaCgoZXJyb3IpPT57XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiQ291bGRuJ3QgdXBkYXRlIHRoZSBsaXN0TmFtZXNFbGVtZW50XCIpXHJcbiAgICAgICAgfSlcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB1cGRhdGVJdGVtTGlzdERpc3BsYXkgPSAoKT0+e1xyXG4gICAgICAgIC8vIGVtcHR5IHRoZSBsaXN0IGl0ZW1zXHJcbiAgICAgICAgZGlzcGxheUhlbHBlci5lbXB0eUVsZW1lbnQobGlzdEl0ZW1zRWwpXHJcbiAgICAgICAgLy8gbGlzdEl0ZW1zRWxcclxuXHJcbiAgICAgICAgLy8gZGVmaW5lIGZ1bmN0aW9ucyBmb3IgdGhlIGNsaWNrIGFuZCByZW1vdmVcclxuICAgICAgICBjb25zdCBjbGlja0NhbGxiYWNrID0gKCk9PntcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJkb2luZyB0aGUgY2xpY2sgY2FsbGJhY2tcIilcclxuICAgICAgICAgICAgLy8gZG9uJ3Qgd2FudCBhbnl0aGluZyB0byBoYXBwZW4gd2hlbiB0aGUgaXRlbSBnZXRzIGNsaWNrZWRcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHJlbW92ZUNhbGxiYWNrID0gKGV2ZW50LCBzdG9yZUtleSk9PntcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJkb2luZyB0aGUgcmVtb3ZlIGNhbGxiYWNrXCIpXHJcbiAgICAgICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXHJcbiAgICAgICAgICAgIGxpc3RIZWxwZXIuZGVsZXRlUHVyY2hhc2VkSXRlbShzdG9yZUtleSkudGhlbigoKT0+e1xyXG4gICAgICAgICAgICAgICAgdXBkYXRlSXRlbUxpc3REaXNwbGF5KClcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICAvLyBnZXQgdGhlIGRldGFpbHMgb2YgdGhlIGxpc3QgaXRlbXNcclxuICAgICAgICBsaXN0SGVscGVyLmdldExpc3RJdGVtcyhsaXN0SGVscGVyLmdldEFjdGl2ZUxpc3QoKSkudGhlbigobGlzdEl0ZW1EZXRhaWxzKT0+e1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgbGV0IGxpc3RUb3RhbCA9IDA7XHJcblxyXG4gICAgICAgICAgICBsaXN0SXRlbURldGFpbHMuZm9yRWFjaCgobGlzdEl0ZW0pPT57XHJcbiAgICAgICAgICAgICAgICBjb25zdCBjYWxsYmFja3MgPSB7Y2xpY2s6IGNsaWNrQ2FsbGJhY2ssIHJlbW92ZTooZXZlbnQpPT57cmVtb3ZlQ2FsbGJhY2soZXZlbnQsIGxpc3RJdGVtLnN0b3JlS2V5KX0gfVxyXG4gICAgICAgICAgICAgICAgY29uc3QgY29udmVydGVkUHJpY2UgPSBjb252ZXJzaW9uSGVscGVyLmNvbnZlcnRWYWx1ZSh7c291cmNlVmFsdWU6IGxpc3RJdGVtLnByaWNlLCB0YXJnZXRDdXJyZW5jeTpsaXN0Q3Vycn0pXHJcbiAgICAgICAgICAgICAgICBsaXN0SXRlbXNFbC5hcHBlbmRDaGlsZChkaXNwbGF5SGVscGVyLmdlbkxpc3RJdGVtRWwobGlzdEl0ZW0uZGVzY3JpcHRpb24sIGNvbnZlcnRlZFByaWNlLnRvRml4ZWQoMiksIGNhbGxiYWNrcykpXHJcbiAgICAgICAgICAgICAgICBsaXN0VG90YWwgKz0gY29udmVydGVkUHJpY2VcclxuICAgICAgICAgICAgfSlcclxuXHJcbiAgICAgICAgICAgIGxpc3RUb3RhbEVsLmlubmVyVGV4dCA9IGAke2xpc3RUb3RhbC50b0ZpeGVkKDIpfWBcclxuICAgICAgICB9KVxyXG5cclxuXHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc2V0TGlzdEN1cnIgPSAoY3VycmVuY3kpPT57XHJcbiAgICAgICAgaWYoY29udmVyc2lvbkhlbHBlci5nZXRDdXJyTGFiZWxzKCkuaW5jbHVkZXMoY3VycmVuY3kpKXtcclxuICAgICAgICAgICAgcmV0dXJuIGxpc3RDdXJyID0gY3VycmVuY3k7XHJcbiAgICAgICAgfWVsc2V7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtjdXJyZW5jeX0gbm90IGEgdmFsaWQgY3VycmVuY3lgKVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB1cGRhdGVMaXN0Q3VyckRpc3BsYXkgPSAoKT0+e1xyXG4gICAgICAgIC8vIGVtcHR5IHRoZSBjdXJyZW5jeSBlbGVtZW50XHJcbiAgICAgICAgZGlzcGxheUhlbHBlci5lbXB0eUVsZW1lbnQobGlzdEN1cnJlbmN5RWwpXHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gZ2V0IHRoZSBjdXJyZW5jaWVzIGF2YWlsYWJsZVxyXG4gICAgICAgIGNvbnN0IGN1cnJlbmNpZXMgPSBjb252ZXJzaW9uSGVscGVyLmdldEN1cnJMYWJlbHMoKVxyXG5cclxuICAgICAgICBjb25zdCBjbGlja0NhbGxiYWNrID0gKGN1cnJlbmN5TmFtZSk9PntcclxuICAgICAgICAgICAgc2V0TGlzdEN1cnIoY3VycmVuY3lOYW1lKTtcclxuICAgICAgICAgICAgdXBkYXRlTGlzdEN1cnJEaXNwbGF5KCk7XHJcbiAgICAgICAgICAgIGRpc3BsYXlIZWxwZXIudG9nZ2xlRXhwYW5kZWQobGlzdEN1cnJlbmN5RWwpXHJcbiAgICAgICAgICAgIHVwZGF0ZUl0ZW1MaXN0RGlzcGxheSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY3VycmVuY2llcy5mb3JFYWNoKChjdXJyTmFtZSk9PntcclxuICAgICAgICAgICAgbGV0IGN1cnJOYW1lUG9zaXRpb24gPSAoY3Vyck5hbWUgPT0gbGlzdEN1cnIpID8gbGlzdEN1cnJlbmN5RWwuZmlyc3RDaGlsZCA6IG51bGw7XHJcbiAgICAgICAgICAgIGxpc3RDdXJyZW5jeUVsLmluc2VydEJlZm9yZShkaXNwbGF5SGVscGVyLmdlbkxpc3RDdXJyRWwoY3Vyck5hbWUsIHtjbGljazooKT0+e2NsaWNrQ2FsbGJhY2soY3Vyck5hbWUpfX0pLCBjdXJyTmFtZVBvc2l0aW9uKTtcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG5cclxuICAgIC8vID09IGN1cnJlbmN5IHJlbGV2YW50IGV2ZW50c1xyXG5cclxuICAgIC8vIGV2ZW50IGxpc3RlbmVycyAtLSB3aGVuIHRoZSBpbnB1dCBpcyBtb2RpZmllZCBcclxuICAgIGN1cnIxSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLChldmVudCk9PnsgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGNvbnZlcnRWYWx1ZXMgPSBjb252ZXJzaW9uSGVscGVyLnVwZGF0ZUNvbnZlcnNpb25zKGV2ZW50LnRhcmdldC52YWx1ZSwgY29udmVyc2lvbkhlbHBlci5nZXRDdXJyKDEpKVxyXG4gICAgICAgIGN1cnIySW5wdXQudmFsdWUgPSBjb252ZXJ0VmFsdWVzLmJvdHRvbVZhbHVlO1xyXG4gICAgfSlcclxuXHJcbiAgICBjdXJyMklucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywoZXZlbnQpPT57XHJcbiAgICAgICAgY29uc3QgY29udmVydFZhbHVlcyA9IGNvbnZlcnNpb25IZWxwZXIudXBkYXRlQ29udmVyc2lvbnMoZXZlbnQudGFyZ2V0LnZhbHVlLCBjb252ZXJzaW9uSGVscGVyLmdldEN1cnIoMikpXHJcbiAgICAgICAgY3VycjFJbnB1dC52YWx1ZSA9IGNvbnZlcnRWYWx1ZXMudG9wVmFsdWU7XHJcbiAgICB9KVxyXG5cclxuICAgIHRvcEN1cnJSZXZlYWxCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKT0+e1xyXG4gICAgICAgIGRpc3BsYXlIZWxwZXIucmV2ZWFsUG9wdXAoY3VyclBvcHVwVG9wKTtcclxuICAgIH0pXHJcbiAgICBib3R0b21DdXJyUmV2ZWFsQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCk9PntcclxuICAgICAgICBkaXNwbGF5SGVscGVyLnJldmVhbFBvcHVwKGN1cnJQb3B1cEJvdHRvbSlcclxuICAgIH0pXHJcblxyXG4gICAgLy8gPT0gbGlzdCB0YWIgcmVsYXRlZCBldmVudHNcclxuICAgIGxpc3RQb3B1cFNob3dCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKT0+e1xyXG4gICAgICAgIGlmKGxpc3RQb3B1cC5jbGFzc0xpc3QuY29udGFpbnMoXCJhY3RpdmVcIikpe1xyXG4gICAgICAgICAgICBkaXNwbGF5SGVscGVyLmhpZGVQb3B1cChsaXN0UG9wdXApXHJcbiAgICAgICAgfWVsc2V7XHJcbiAgICAgICAgICAgIGRpc3BsYXlIZWxwZXIucmV2ZWFsUG9wdXAobGlzdFBvcHVwKVxyXG4gICAgICAgIH0gXHJcbiAgICB9KVxyXG5cclxuICAgIC8vIGFkZCB0byBsaXN0XHJcbiAgICBsaXN0UG9wdXBBZGRUb0xpc3RCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKT0+e1xyXG4gICAgICAgIGxpc3RIZWxwZXIuYWRkUmVjb3JkKHtcclxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGxpc3RQb3B1cEl0ZW1EZXNjcmlwdGlvbi52YWx1ZSxcclxuICAgICAgICAgICAgY29zdDpjb252ZXJzaW9uSGVscGVyLmdldENvcmVVU0RWYWx1ZSgpXHJcbiAgICAgICAgfSkudGhlbigoKT0+e1xyXG4gICAgICAgICAgICB1cGRhdGVJdGVtTGlzdERpc3BsYXkoKVxyXG4gICAgICAgIH0pXHJcbiAgICB9KVxyXG5cclxuICAgIGxpc3RQb3B1cEV4cGFuZERlc2NyaXB0aW9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCk9PntcclxuICAgICAgICBkaXNwbGF5SGVscGVyLnRvZ2dsZUV4cGFuZGVkKGxpc3RQb3B1cFRhYilcclxuICAgIH0pXHJcblxyXG4gICAgLy8gPT0gbGlzdCByZWFsYXRlZCBldmVudHNcclxuICAgIGxpc3ROYW1lc0V4cGFuZEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKT0+e1xyXG4gICAgICAgIGRpc3BsYXlIZWxwZXIudG9nZ2xlRXhwYW5kZWQobGlzdE5hbWVzRWwpXHJcbiAgICB9KVxyXG5cclxuICAgIGxpc3RDdXJyZW5jeUV4cGFuZEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKT0+e1xyXG4gICAgICAgIGRpc3BsYXlIZWxwZXIudG9nZ2xlRXhwYW5kZWQobGlzdEN1cnJlbmN5RWwpXHJcbiAgICB9KVxyXG5cclxuICAgIC8vIEdFVFRJTkcgU1RBUlRFRCAtIGFmdGVyIHdlIGhhdmUgZ3JhYmJlZCByYXRlc1xyXG5cclxuICAgIC8vIGdyYWIgdGhlIHJhdGVzXHJcbiAgICBuZXR3b3JrSGVscGVyLmdldFJhdGVzKCkudGhlbigocmF0ZXMpPT57XHJcbiAgICAgICAgbGV0IGN1cnJMYWJlbHM7XHJcblxyXG5cclxuICAgICAgICBjb252ZXJzaW9uSGVscGVyLnNldFJhdGVzKHJhdGVzKVxyXG4gICAgICAgIFxyXG4gICAgICAgIGN1cnJMYWJlbHMgPSBjb252ZXJzaW9uSGVscGVyLmdldEN1cnJMYWJlbHMoKVxyXG5cclxuICAgICAgICAvLyBlbXB0eSB0aGUgcG9wdXBzIG9mIHRoZWlyIGJ1dHRvbnNcclxuICAgICAgICBkaXNwbGF5SGVscGVyLmVtcHR5RWxlbWVudChjdXJyUG9wdXBUb3ApXHJcbiAgICAgICAgZGlzcGxheUhlbHBlci5lbXB0eUVsZW1lbnQoY3VyclBvcHVwQm90dG9tKVxyXG5cclxuICAgICAgICBjdXJyTGFiZWxzLmZvckVhY2goKGN1cnJMYWJlbCk9PntcclxuICAgICAgICAgICAgY29uc3QgdG9wQnV0dG9uID0gZGlzcGxheUhlbHBlci5nZW5lcmF0ZUN1cnJTZWxlY3RCdXR0b24oY3VyckxhYmVsLCBjdXJyTGFiZWwgPT0gY29udmVyc2lvbkhlbHBlci5nZXRDdXJyKDEpKVxyXG4gICAgICAgICAgICBjb25zdCBib3R0b21CdXR0b24gPSBkaXNwbGF5SGVscGVyLmdlbmVyYXRlQ3VyclNlbGVjdEJ1dHRvbihjdXJyTGFiZWwsIGN1cnJMYWJlbCA9PSBjb252ZXJzaW9uSGVscGVyLmdldEN1cnIoMikpXHJcblxyXG4gICAgICAgICAgICB0b3BCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpPT57IGN1cnJTZWxlY3RDYWxsYmFjayhldmVudCwgdHJ1ZSl9KVxyXG4gICAgICAgICAgICBib3R0b21CdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpPT57IGN1cnJTZWxlY3RDYWxsYmFjayhldmVudCwgZmFsc2UpfSlcclxuXHJcbiAgICAgICAgICAgIGN1cnJQb3B1cFRvcC5hcHBlbmRDaGlsZCh0b3BCdXR0b24pXHJcbiAgICAgICAgICAgIGN1cnJQb3B1cEJvdHRvbS5hcHBlbmRDaGlsZChib3R0b21CdXR0b24pXHJcbiAgICAgICAgfSlcclxuXHJcbiAgICAgICAgLy8gdXBkYXRlIHRoZSBjdXJyU2VsZWN0QnV0dG9ucyAtIHNvIHRoZXkgY2FuIGJlIGNsZWFyZWRcclxuICAgICAgICBjdXJyU2VsZWN0QnV0dG9uc1RvcCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jdXJyLXNlbGVjdC50b3AgYnV0dG9uJylcclxuICAgICAgICBjdXJyU2VsZWN0QnV0dG9uc0JvdHRvbSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jdXJyLXNlbGVjdC5ib3R0b20gYnV0dG9uJylcclxuXHJcbiAgICAgICAgdXBkYXRlTGlzdE5hbWVEaXNwbGF5KClcclxuICAgICAgICB1cGRhdGVMaXN0Q3VyckRpc3BsYXkoKVxyXG4gICAgfSlcclxuXHJcbiAgICAvLyBkaXNtaXNzIHRoZSB1cGRhdGUgXHJcbiAgICB1cGRhdGVEaXNtaXNzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywoKT0+e1xyXG4gICAgICAgIGRpc3BsYXlIZWxwZXIuaGlkZVBvcHVwKHVwZGF0ZURpc21pc3NCdXR0b24pXHJcbiAgICB9KVxyXG5cclxuLy8gZXhwb3NlIHRoZSBtb2R1bGVzIGZvciBpbnNwZWN0aW9uLSBkZXYgb25seVxyXG4gICAgd2luZG93LmNvbnZBcHBPYmpzID0ge1xyXG4gICAgICAgIGRpc3BsYXlIZWxwZXIsXHJcbiAgICAgICAgbmV0d29ya0hlbHBlcixcclxuICAgICAgICBjb252ZXJzaW9uSGVscGVyLFxyXG4gICAgICAgIHNlcnZpY2VXb3JrZXJIZWxwZXIsXHJcbiAgICAgICAgbGlzdEhlbHBlcixcclxuICAgICAgICBzZXRMaXN0Q3VyclxyXG4gICAgfVxyXG59XHJcbiIsIlxyXG5jb25zdCBDb252ZXJzaW9uSGVscGVyID0gKCk9PntcclxuICAgIFxyXG4gICAgbGV0IHJldHVybk9iamVjdCA9IHt9XHJcbiAgICBsZXQgY29yZVVTRFZhbHVlID0gMDtcclxuICAgIGxldCBjdXJyID0gWydVU0QnLCAnR0JQJ11cclxuICAgIGxldCByYXRlcyA9IHtcclxuICAgICAgICBVU0Q6IDEsXHJcbiAgICAgICAgR0JQOiAwLjc1MjI0NVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNldFJhdGVzID0gKG5ld1JhdGVzKT0+e1xyXG4gICAgICAgIHJldHVybiByYXRlcyA9IG5ld1JhdGVzXHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY29udmVydFZhbHVlPSAoe3NvdXJjZVZhbHVlPTAsIHNvdXJjZUN1cnJlbmN5PSdVU0QnLCB0YXJnZXRDdXJyZW5jeT0nR0JQJ309e30pPT57XHJcbiAgICAgICAgY29uc3QgVVNEID0gc291cmNlVmFsdWUgLyByYXRlc1tzb3VyY2VDdXJyZW5jeV0gICAvLyBjb252ZXJ0IHRvIGJhc2UgY3VycmVuY3kgKFVTRClcclxuICAgICAgICByZXR1cm4gVVNEKnJhdGVzW3RhcmdldEN1cnJlbmN5XSAgIC8vIHJldHVybiB2YWx1ZSBcclxuICAgIH1cclxuXHJcbiAgICAvLyBmdW5jdGlvbnMgdG8gdXBkYXRlIHdoYXQgY3VycmVuY3kgaXMgYmVpbmcgdXNlZFxyXG5cclxuICAgIGNvbnN0IGdldEN1cnIgPSAoY3VyckluZGV4KT0+e1xyXG4gICAgICAgIHJldHVybiBjdXJyW2N1cnJJbmRleC0xXVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNldEN1cnIgPSAoY3VyckluZGV4LCBuZXdDdXJyKT0+e1xyXG4gICAgICAgIGN1cnJbY3VyckluZGV4LTFdID0gbmV3Q3VyclxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHVwZGF0ZUNvbnZlcnNpb25zID0gKGNvbnZlcnRWYWx1ZT1jb3JlVVNEVmFsdWUsIHNvdXJjZUN1cnJlbmN5PSdVU0QnKT0+e1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIG5vcm1hbGlzZSB0byBVU0RcclxuICAgICAgICBjb25zdCBpbmNvbWluZ1VTRFZhbHVlID0gcmV0dXJuT2JqZWN0LmNvbnZlcnRWYWx1ZSh7XHJcbiAgICAgICAgICAgIHNvdXJjZVZhbHVlOiBjb252ZXJ0VmFsdWUsXHJcbiAgICAgICAgICAgIHNvdXJjZUN1cnJlbmN5OiBzb3VyY2VDdXJyZW5jeSxcclxuICAgICAgICAgICAgdGFyZ2V0Q3VycmVuY3k6ICdVU0QnXHJcbiAgICAgICAgfSlcclxuXHJcbiAgICAgICAgY29yZVVTRFZhbHVlID0gaW5jb21pbmdVU0RWYWx1ZTsgLy8gc3RvcmUgdGhpcyB2YWx1ZSBmb3IgdGhlIGZ1dHVyZVxyXG5cclxuICAgICAgICAvLyB1cGRhdGUgdGhlIHZhbHVlIGluIHRvcCBib3hcclxuICAgICAgICBjb25zdCBjb252ZXJzaW9uMSA9IHJldHVybk9iamVjdC5jb252ZXJ0VmFsdWUoe1xyXG4gICAgICAgICAgICBzb3VyY2VWYWx1ZTogaW5jb21pbmdVU0RWYWx1ZSxcclxuICAgICAgICAgICAgc291cmNlQ3VycmVuY3k6J1VTRCcsXHJcbiAgICAgICAgICAgIHRhcmdldEN1cnJlbmN5OiBjdXJyWzBdXHJcbiAgICAgICAgfSkudG9GaXhlZCgyKVxyXG5cclxuICAgICAgICAvLyB1cGRhdGUgdmFsdWUgaW4gYm90dG9tIGJveFxyXG4gICAgICAgIGNvbnN0IGNvbnZlcnNpb24yID0gcmV0dXJuT2JqZWN0LmNvbnZlcnRWYWx1ZSh7XHJcbiAgICAgICAgICAgIHNvdXJjZVZhbHVlOiBpbmNvbWluZ1VTRFZhbHVlLFxyXG4gICAgICAgICAgICBzb3VyY2VDdXJyZW5jeTogJ1VTRCcsXHJcbiAgICAgICAgICAgIHRhcmdldEN1cnJlbmN5OiBjdXJyWzFdXHJcbiAgICAgICAgfSkudG9GaXhlZCgyKVxyXG4gICAgICAgIHJldHVybiB7IHRvcFZhbHVlOiBjb252ZXJzaW9uMSwgYm90dG9tVmFsdWU6IGNvbnZlcnNpb24yfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGdldEN1cnJMYWJlbHMgPSAoKT0+e1xyXG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhyYXRlcylcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBnZXRDb3JlVVNEVmFsdWUgPSAoKT0+e1xyXG4gICAgICAgIHJldHVybiBjb3JlVVNEVmFsdWVcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihyZXR1cm5PYmplY3QsXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBzZXRSYXRlcyxcclxuICAgICAgICAgICAgY29udmVydFZhbHVlLFxyXG4gICAgICAgICAgICBnZXRDdXJyLFxyXG4gICAgICAgICAgICBzZXRDdXJyLFxyXG4gICAgICAgICAgICB1cGRhdGVDb252ZXJzaW9ucyxcclxuICAgICAgICAgICAgZ2V0Q3VyckxhYmVscyxcclxuICAgICAgICAgICAgZ2V0Q29yZVVTRFZhbHVlXHJcbiAgICAgICAgfVxyXG4gICAgKVxyXG59XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDb252ZXJzaW9uSGVscGVyIiwiY29uc3QgRGlzcGxheUhlbHBlciA9ICgpPT57XHJcbiAgICAgICAgXHJcbiAgICBpZiAoIWRvY3VtZW50KSB0aHJvdyBuZXcgRXJyb3IoXCJObyBkb2N1bWVudCBvYmplY3QgdG8gd29yayB3aXRoXCIpICAgLy8gY2hlY2sgdG8gc2VlIGlmIHRoZXJlIGlzIGEgZG9jdW1lbnQgb2JqZWN0XHJcblxyXG4gICAgbGV0IHJldHVybk9iamVjdCA9IHt9XHJcblxyXG4gICAgLy8gYWRkIHRoZSBldmVudHMgdG8gdGhlIGN1cnJlbmN5U2VsZWN0QnV0dG9uc1xyXG4gICAgY29uc3Qgc2hvd0N1cnJTZWxlY3QgPSAoYnV0dG9uQ2xpY2tlZCwgY3VyckJ1dHRvbnMpPT57XHJcbiAgICAgICAgLy8gcmVtb3ZlIHNlbGVjdGVkIGNsYXNzIGZyb20gYWxsIGJ1dHRvbnNcclxuICAgICAgICBjdXJyQnV0dG9ucy5mb3JFYWNoKChidXR0b24pPT57XHJcbiAgICAgICAgICAgIGJ1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCdzZWxlY3RlZCcpXHJcbiAgICAgICAgfSlcclxuICAgICAgICAvLyBzZXQgdGhlIGN1cnJlbmN5IHRvIHRoZSBzYW1lIGFzIHRoZSBzZWxlY3RlZCBidXR0b25cclxuICAgICAgICBcclxuICAgICAgICAvLyBhZGQgdGhlIHNlbGVjdGVkIGNsYXNzIHRvIHRoZSBzZWxlY3RlZCBidXR0b25cclxuICAgICAgICBidXR0b25DbGlja2VkLmNsYXNzTGlzdC5hZGQoJ3NlbGVjdGVkJylcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gXHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcmV2ZWFsUG9wdXAgPSAocG9wdXBFbGVtZW50KT0+e1xyXG4gICAgICAgIHJldHVybiBwb3B1cEVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnYWN0aXZlJylcclxuICAgIH1cclxuICAgIGNvbnN0IGhpZGVQb3B1cCA9IChwb3B1cEVsZW1lbnQpPT57XHJcbiAgICAgICAgcmV0dXJuIHBvcHVwRWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdhY3RpdmUnKVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHVwZGF0ZUN1cnJlbmN5TGFiZWwgPSAobGFiZWxFbGVtZW50LGN1cnJlbmN5U3RyaW5nKT0+e1xyXG4gICAgICAgIGxhYmVsRWxlbWVudC5pbm5lclRleHQgPSBjdXJyZW5jeVN0cmluZ1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGdlbmVyYXRlQ3VyclNlbGVjdEJ1dHRvbiA9IChjdXJyTGFiZWwsIHNlbGVjdGVkKT0+e1xyXG4gICAgICAgIGNvbnN0IGN1cnJCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICAgICAgICBjb25zdCBjaGVja0VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcclxuICAgICAgICBjb25zdCBsYWJlbE5hbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJylcclxuXHJcbiAgICAgICAgXHJcbiAgICAgICAgXHJcbiAgICAgICAgbGFiZWxOYW1lLmlubmVyVGV4dCA9IGN1cnJMYWJlbCAvLyBzZXQgdGhlIGxhYmVsbmFtZVxyXG5cclxuICAgICAgICBjaGVja0VsZW1lbnQuc3JjID0gXCJhc3NldHMvY2hlY2ttYXJrLnN2Z1wiO1xyXG4gICAgICAgIGNoZWNrRWxlbWVudC5jbGFzc0xpc3QuYWRkKFwiY2hlY2ttYXJrXCIpXHJcblxyXG4gICAgICAgIGlmKHNlbGVjdGVkKSBjdXJyQnV0dG9uLmNsYXNzTGlzdC5hZGQoJ3NlbGVjdGVkJylcclxuICAgICAgICBcclxuICAgICAgICBjdXJyQnV0dG9uLmFwcGVuZENoaWxkKGNoZWNrRWxlbWVudClcclxuICAgICAgICBjdXJyQnV0dG9uLmFwcGVuZENoaWxkKGxhYmVsTmFtZSlcclxuXHJcbiAgICAgICAgcmV0dXJuIGN1cnJCdXR0b25cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBlbXB0eUVsZW1lbnQgPSAoZWxlbWVudCk9PntcclxuICAgICAgICB3aGlsZShlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDApe1xyXG4gICAgICAgICAgICBlbGVtZW50LmNoaWxkcmVuWzBdLnJlbW92ZSgpXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gZWxlbWVudFxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHJldHVybk9iamVjdCxcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHJldmVhbFBvcHVwLFxyXG4gICAgICAgICAgICBoaWRlUG9wdXAsXHJcbiAgICAgICAgICAgIHNob3dDdXJyU2VsZWN0LFxyXG4gICAgICAgICAgICB1cGRhdGVDdXJyZW5jeUxhYmVsLFxyXG4gICAgICAgICAgICBnZW5lcmF0ZUN1cnJTZWxlY3RCdXR0b24sXHJcbiAgICAgICAgICAgIGVtcHR5RWxlbWVudFxyXG4gICAgICAgIH1cclxuICAgIClcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBEaXNwbGF5SGVscGVyIiwiY29uc3QgaWRiID0gcmVxdWlyZSgnaWRiJylcclxuXHJcbmNvbnN0IExpc3RNb2R1bGUgPSAoKT0+e1xyXG4gICAgY29uc3QgZGVmYXVsdExpc3ROYW1lID0gXCJEZWZhdWx0IExpc3RcIjtcclxuICAgIGxldCBhY3RpdmVMaXN0ID0gZGVmYXVsdExpc3ROYW1lO1xyXG5cclxuICAgIGxldCBkYlByb21pc2UgPSBpZGIub3Blbignc3BlbmQtbGlzdHMnLDIsICh1cGdyYWRlRGIpPT57XHJcbiAgICAgICAgc3dpdGNoKHVwZ3JhZGVEYi5vbGRWZXJzaW9uKXtcclxuICAgICAgICAgICAgY2FzZSAwOlxyXG4gICAgICAgICAgICAgICAgdmFyIGxpc3RTdG9yZSA9IHVwZ3JhZGVEYi5jcmVhdGVPYmplY3RTdG9yZSgncHVyY2hhc2VkLWl0ZW1zJywge2F1dG9JbmNyZW1lbnQ6IHRydWV9KTtcclxuICAgICAgICAgICAgICAgIGxpc3RTdG9yZS5jcmVhdGVJbmRleCgnYnktbGlzdCcsIFwibGlzdE5hbWVcIilcclxuICAgICAgICAgICAgY2FzZSAxOlxyXG4gICAgICAgICAgICAgICAgdmFyIGxpc3ROYW1lU3RvcmUgPSB1cGdyYWRlRGIuY3JlYXRlT2JqZWN0U3RvcmUoJ2xpc3QtbmFtZXMnKTtcclxuICAgICAgICAgICAgICAgIGxpc3ROYW1lU3RvcmUucHV0KHRydWUsYWN0aXZlTGlzdClcclxuICAgICAgICB9XHJcbiAgICB9KVxyXG4gICAgXHJcbiAgICBcclxuICAgIC8vIElEQiBmdW5jdGlvbnNcclxuICAgIGNvbnN0IGFkZFJlY29yZCA9ICh7IGxpc3ROYW1lPWFjdGl2ZUxpc3QgLCBkZXNjcmlwdGlvbj1cIlNvbWV0aGluZ1wiLCBjb3N0PTAgfT0ge30pPT57XHJcbiAgICAgICAgcmV0dXJuIGRiUHJvbWlzZS50aGVuKChkYik9PntcclxuICAgICAgICAgICAgdmFyIHR4ID0gZGIudHJhbnNhY3Rpb24oJ3B1cmNoYXNlZC1pdGVtcycsICdyZWFkd3JpdGUnKVxyXG4gICAgICAgICAgICB2YXIgbGlzdFN0b3JlID0gdHgub2JqZWN0U3RvcmUoJ3B1cmNoYXNlZC1pdGVtcycpXHJcbiAgICAgICAgICAgIGxpc3RTdG9yZS5wdXQoIHtsaXN0TmFtZTogbGlzdE5hbWUsIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbiwgcHJpY2U6IGNvc3R9KVxyXG4gICAgICAgICAgICByZXR1cm4gdHguY29tcGxldGU7XHJcbiAgICAgICAgfSlcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc3QgY3JlYXRlTGlzdCA9IChsaXN0TmFtZSk9PntcclxuICAgICAgICByZXR1cm4gZGJQcm9taXNlLnRoZW4oKGRiKT0+e1xyXG4gICAgICAgICAgICB2YXIgdHggPSBkYi50cmFuc2FjdGlvbignbGlzdC1uYW1lcycsICdyZWFkd3JpdGUnKVxyXG4gICAgICAgICAgICB2YXIgbGlzdE5hbWVTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKCdsaXN0LW5hbWVzJylcclxuICAgICAgICAgICAgbGlzdE5hbWVTdG9yZS5wdXQodHJ1ZSwgbGlzdE5hbWUpXHJcbiAgICAgICAgICAgIHJldHVybiB0eC5jb21wbGV0ZVxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IGNoYW5nZUxpc3QgPSAobGlzdE5hbWUgPSBkZWZhdWx0TGlzdE5hbWUpPT57XHJcbiAgICAgICAgcmV0dXJuIGdldExpc3QobGlzdE5hbWUpLnRoZW4oKGxpc3RPYmplY3QpPT57XHJcbiAgICAgICAgICAgIGlmKGxpc3RPYmplY3QgIT0gdW5kZWZpbmVkKXtcclxuICAgICAgICAgICAgICAgIGFjdGl2ZUxpc3QgPSBsaXN0TmFtZTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlXHJcbiAgICAgICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBnZXRMaXN0ID0gKGxpc3ROYW1lKT0+e1xyXG4gICAgICAgIHJldHVybiBkYlByb21pc2UudGhlbigoZGIpPT57XHJcbiAgICAgICAgICAgIHZhciB0eCA9IGRiLnRyYW5zYWN0aW9uKCdsaXN0LW5hbWVzJylcclxuICAgICAgICAgICAgdmFyIGxpc3ROYW1lU3RvcmUgPSB0eC5vYmplY3RTdG9yZSgnbGlzdC1uYW1lcycpXHJcbiAgICAgICAgICAgIHJldHVybiBsaXN0TmFtZVN0b3JlLmdldChsaXN0TmFtZSlcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBnZXRMaXN0TmFtZXMgPSgpPT57XHJcbiAgICAgICAgcmV0dXJuIGRiUHJvbWlzZS50aGVuKChkYik9PntcclxuICAgICAgICAgICAgdmFyIHR4ID0gZGIudHJhbnNhY3Rpb24oJ2xpc3QtbmFtZXMnKVxyXG4gICAgICAgICAgICB2YXIgbGlzdFN0b3JlID0gdHgub2JqZWN0U3RvcmUoJ2xpc3QtbmFtZXMnKVxyXG4gICAgICAgICAgICByZXR1cm4gbGlzdFN0b3JlLmdldEFsbEtleXMoKVxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IGdldExpc3RJdGVtcyA9IChsaXN0TmFtZSA9IGRlZmF1bHRMaXN0TmFtZSk9PntcclxuICAgICAgICByZXR1cm4gZGJQcm9taXNlLnRoZW4oKGRiKT0+e1xyXG4gICAgICAgICAgICB2YXIgdHggPSBkYi50cmFuc2FjdGlvbigncHVyY2hhc2VkLWl0ZW1zJylcclxuICAgICAgICAgICAgdmFyIHB1cmNoYXNlZEl0ZW1TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKCdwdXJjaGFzZWQtaXRlbXMnKVxyXG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoW1xyXG4gICAgICAgICAgICAgICAgcHVyY2hhc2VkSXRlbVN0b3JlLmdldEFsbCgpLFxyXG4gICAgICAgICAgICAgICAgcHVyY2hhc2VkSXRlbVN0b3JlLmdldEFsbEtleXMoKVxyXG4gICAgICAgICAgICBdKVxyXG4gICAgICAgIH0pLnRoZW4oKHB1cmNoYXNlZEl0ZW1EZXRhaWxzKT0+e1xyXG4gICAgICAgICAgICByZXR1cm4gcHVyY2hhc2VkSXRlbURldGFpbHNbMF0ubWFwKChpdGVtVmFsdWVzLCBpbmRleCk9PntcclxuICAgICAgICAgICAgICAgIGl0ZW1WYWx1ZXMuc3RvcmVLZXkgPSBwdXJjaGFzZWRJdGVtRGV0YWlsc1sxXVtpbmRleF1cclxuICAgICAgICAgICAgICAgIHJldHVybiBpdGVtVmFsdWVzXHJcbiAgICAgICAgICAgIH0pLmZpbHRlcigoaXRlbURldGFpbHMpPT57XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaXRlbURldGFpbHMubGlzdE5hbWUgPT0gbGlzdE5hbWVcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBkZWxldGVQdXJjaGFzZWRJdGVtID0gKHRhYmxlS2V5KT0+e1xyXG4gICAgICAgIHJldHVybiBkYlByb21pc2UudGhlbigoZGIpPT57XHJcbiAgICAgICAgICAgIGxldCB0eCA9IGRiLnRyYW5zYWN0aW9uKCdwdXJjaGFzZWQtaXRlbXMnLCAncmVhZHdyaXRlJylcclxuICAgICAgICAgICAgbGV0IHB1cmNoYXNlZEl0ZW1TdG9yZSA9IHR4Lm9iamVjdFN0b3JlKCdwdXJjaGFzZWQtaXRlbXMnKVxyXG4gICAgICAgICAgICByZXR1cm4gcHVyY2hhc2VkSXRlbVN0b3JlLmRlbGV0ZSh0YWJsZUtleSlcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBkZWxldGVMaXN0ID0gKGxpc3ROYW1lKT0+e1xyXG4gICAgICAgIHJldHVybiBkYlByb21pc2UudGhlbigoZGIpPT57XHJcbiAgICAgICAgICAgIGxldCB0eCA9IGRiLnRyYW5zYWN0aW9uKFsnbGlzdC1uYW1lcycsJ3B1cmNoYXNlZC1pdGVtcyddLCAncmVhZHdyaXRlJylcclxuICAgICAgICAgICAgbGV0IGxpc3ROYW1lU3RvcmUgPSB0eC5vYmplY3RTdG9yZSgnbGlzdC1uYW1lcycpXHJcbiAgICAgICAgICAgIGxldCBwdXJjaGFzZWRJdGVtU3RvcmUgPSB0eC5vYmplY3RTdG9yZSgncHVyY2hhc2VkLWl0ZW1zJylcclxuICAgIFxyXG4gICAgICAgICAgICBsZXQgbGlzdE5hbWVEZWxldGUgPSBsaXN0TmFtZVN0b3JlLmRlbGV0ZShsaXN0TmFtZSk7XHJcbiAgICAgICAgICAgIGxldCBsaXN0SXRlbXNEZWxldGUgPSBwdXJjaGFzZWRJdGVtU3RvcmUub3BlbkN1cnNvcihudWxsLCBcIm5leHRcIikudGhlbihmdW5jdGlvbiByZW1vdmVJdGVtQnlMaXN0KGN1cnNvcil7XHJcbiAgICAgICAgICAgICAgICBpZighY3Vyc29yKSByZXR1cm4gLy8gcmVjdXJzaXZlIGV4aXQgY29uZGl0aW9uXHJcbiAgICAgICAgICAgICAgICBpZihjdXJzb3IudmFsdWUubGlzdE5hbWUgPT0gbGlzdE5hbWUpIGN1cnNvci5kZWxldGUoKSAgICAvLyBpZiBsaXN0IGlzIHJpZ2h0IC0gZGVsZXRlIGl0ZW1cclxuICAgICAgICAgICAgICAgIHJldHVybiBjdXJzb3IuY29udGludWUoKS50aGVuKHJlbW92ZUl0ZW1CeUxpc3QpIC8vIG1vdmUgdG8gdGhlIG5leHQgaXRlbVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgXHJcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLmFsbChbbGlzdE5hbWVEZWxldGUsIGxpc3RJdGVtc0RlbGV0ZV0pXHJcbiAgICAgICAgfSlcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBnZXRBY3RpdmVMaXN0ID0gKCk9PntcclxuICAgICAgICByZXR1cm4gYWN0aXZlTGlzdC5zbGljZSgwKVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGFkZFJlY29yZCxcclxuICAgICAgICBjcmVhdGVMaXN0LFxyXG4gICAgICAgIGNoYW5nZUxpc3QsXHJcbiAgICAgICAgZ2V0TGlzdCxcclxuICAgICAgICBnZXRMaXN0TmFtZXMsXHJcbiAgICAgICAgZ2V0TGlzdEl0ZW1zLFxyXG4gICAgICAgIGRlbGV0ZVB1cmNoYXNlZEl0ZW0sXHJcbiAgICAgICAgZGVsZXRlTGlzdCxcclxuICAgICAgICBnZXRBY3RpdmVMaXN0XHJcbiAgICB9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTGlzdE1vZHVsZSIsImNvbnN0IE5ldHdvcmtIZWxwZXIgPSgpPT57XHJcbiAgICBcclxuICAgIGxldCByZXR1cm5PYmplY3QgPSB7fTtcclxuICAgIFxyXG4gICAgY29uc3QgaGFuZGxlUmVzcG9uc2UgPSAocmVzcG9uc2UpPT57IC8vIGNoZWNrcyBpZiB0aGUgcmVxdWVzdCBmb3IgdGhlIHJhdGVzIHdhcyBzdWNjZXNzZnVsXHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLm9rKXtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKVxyXG4gICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICBQcm9taXNlLnJlamVjdCggbmV3IEVycm9yICgnVW5leHBlY3RlZCBSZXNwb25zZScpKVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgbG9nTWVzc2FnZSA9IChtZXNzYWdlKT0+e1xyXG4gICAgICAgIGNvbnNvbGUubG9nKG1lc3NhZ2UpXHJcbiAgICAgICAgcmV0dXJuIG1lc3NhZ2VcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBnZXRSYXRlcyA9ICgpPT57ICAvLyByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIHRoZSBkYXRhXHJcbiAgICAgICAgcmV0dXJuIGZldGNoKCcvcmF0ZXMnLCB7bWV0aG9kOiAnR0VUJyxjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nIH0pXHJcbiAgICAgICAgICAgIC50aGVuKGhhbmRsZVJlc3BvbnNlKVxyXG4gICAgICAgICAgICAuY2F0Y2goKGVycik9PnsgbG9nTWVzc2FnZShlcnIubWVzc2FnZSkgfSlcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbiggcmV0dXJuT2JqZWN0LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgZ2V0UmF0ZXNcclxuICAgICAgICB9XHJcbiAgICApXHJcblxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBOZXR3b3JrSGVscGVyIl19
