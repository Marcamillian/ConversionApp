(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var ConversionModule = require('./../modules/ConversionHelper.js');
var NetworkModule = require('./../modules/NetworkHelper.js');
var DisplayHelper = require('./../modules/DisplayHelper.js');

window.onload = function () {

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

        return {
            revealPopup: revealPopup,
            hidePopup: hidePopup,
            showCurrSelect: showCurrSelect,
            updateCurrencyLabel: updateCurrencyLabel,
            generateCurrSelectButton: generateCurrSelectButton,
            emptyElement: emptyElement
        };
    }();

    var networkHelper = NetworkModule();

    var conversionHelper = ConversionModule();

    /*function ConversionHelper(){
          let coreUSDValue = 0;
        let curr = ['USD', 'GBP']
          let rates = {
            USD: 1,
            GBP: 0.752245
        }
          const setRates = (newRates)=>{
            return rates = newRates
        }
          const convertValue= ({sourceValue=0, sourceCurrency='USD', targetCurrency='GBP'}={})=>{
            const USD = sourceValue / rates[sourceCurrency]   // convert to base currency (USD)
            return USD*rates[targetCurrency]   // return value 
        }
          // functions to update what currency is being used
          const getCurr = (currIndex)=>{
            return curr[currIndex-1]
        }
          const setCurr = (currIndex, newCurr)=>{
            curr[currIndex-1] = newCurr
        }
          const updateConversions = (convertValue=coreUSDValue, sourceCurrency='USD')=>{
            
            // normalise to USD
            const incomingUSDValue = conversionHelper.convertValue({
                sourceValue: convertValue,
                sourceCurrency: sourceCurrency,
                targetCurrency: 'USD'
            })
    
            coreUSDValue = incomingUSDValue; // store this value for the future
    
            // update the value in top box
            const conversion1 = conversionHelper.convertValue({
                sourceValue: incomingUSDValue,
                sourceCurrency:'USD',
                targetCurrency: curr[0]
            }).toFixed(2)
    
            // update value in bottom box
            const conversion2 = conversionHelper.convertValue({
                sourceValue: incomingUSDValue,
                sourceCurrency: 'USD',
                targetCurrency: curr[1]
            }).toFixed(2)
            return { topValue: conversion1, bottomValue: conversion2}
        }
          const getCurrLabels = ()=>{
            return Object.keys(rates)
        }
          return {
            setRates,
            convertValue,
            getCurr,
            setCurr,
            updateConversions,
            getCurrLabels
        }
      }()*/

    var serviceWorkerHelper = function ServiceWorkerHelper(workerLocation, updateUI, updateTriggerEl) {
        if (!navigator.serviceWorker) throw new Error("service worker not supported");

        var updateTriggerElement = updateTriggerEl;

        // register the service worker
        navigator.serviceWorker.register(workerLocation).then(function (reg) {

            // check if service worker loaded the page - if it didn't return (as service worker is the latest)
            if (!navigator.serviceWorker.controller) return;

            // if there is one waiting - there was a service worker installed on the last refresh and its waiting
            if (reg.waiting) {
                displayHelper.showUpdate();
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
    }('/sw.js', updateDialog, updateInstallButton);

    // IMPLEMENTATION SPECIFIC COMMANDS

    // callback for when currency select buttons are clicked
    var currSelectCallback = function currSelectCallback(event, isTopCurr) {

        var currIndex = isTopCurr ? 1 : 2;
        var currLabel = isTopCurr ? currLabelTop : currLabelBottom;
        var currPopup = isTopCurr ? currPopupTop : currPopupBottom;
        var currSelectButtons = isTopCurr ? currSelectButtonsTop : currSelectButtonsBottom;
        var currButton = event.target.tagName != 'button' ? event.target.parentNode : event.target; // if the click on a child - set parent OR - set the parent as the button
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
    });

    // == Update functionality
    // dismiss the update 
    updateDismissButton.addEventListener('click', function () {
        displayHelper.hidePopup(updateDismissButton);
    });

    // == currency relevant events

    // event listeners -- when the input is modified 
    curr1Input.addEventListener('keyup', function (e) {
        var convertValues = conversionHelper.updateConversions(event.target.value, conversionHelper.getCurr(1));
        curr2Input.value = convertValues.bottomValue;
    });

    curr2Input.addEventListener('keyup', function (e) {
        var convertValues = conversionHelper.updateConversions(event.target.value, conversionHelper.getCurr(2));
        curr1Input.value = convertValues.topValue;
    });

    topCurrRevealButton.addEventListener('click', function () {
        displayHelper.revealPopup(currPopupTop);
    });
    bottomCurrRevealButton.addEventListener('click', function () {
        displayHelper.revealPopup(currPopupBottom);
    });

    // expose the modules for inspection- dev only
    window.convAppObjs = {
        displayHelper: displayHelper,
        networkHelper: networkHelper,
        conversionHelper: conversionHelper,
        serviceWorkerHelper: serviceWorkerHelper
    };
};

},{"./../modules/ConversionHelper.js":2,"./../modules/DisplayHelper.js":3,"./../modules/NetworkHelper.js":4}],2:[function(require,module,exports){
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

    return Object.assign(returnObject, {
        setRates: setRates,
        convertValue: convertValue,
        getCurr: getCurr,
        setCurr: setCurr,
        updateConversions: updateConversions,
        getCurrLabels: getCurrLabels
    });
};

module.exports = ConversionHelper;

},{}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
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

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmNcXGNsaWVudFxcbWFpbi5qcyIsInNyY1xcbW9kdWxlc1xcQ29udmVyc2lvbkhlbHBlci5qcyIsInNyY1xcbW9kdWxlc1xcRGlzcGxheUhlbHBlci5qcyIsInNyY1xcbW9kdWxlc1xcTmV0d29ya0hlbHBlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0FDQUEsSUFBTSxtQkFBbUIsMkNBQXpCO0FBQ0EsSUFBTSxnQkFBZ0IsUUFBUSwrQkFBUixDQUF0QjtBQUNBLElBQU0sZ0JBQWdCLFFBQVEsK0JBQVIsQ0FBdEI7O0FBRUEsT0FBTyxNQUFQLEdBQWdCLFlBQUk7O0FBR3BCOztBQUVJO0FBQ0EsUUFBTSxhQUFhLFNBQVMsY0FBVCxDQUF3QixRQUF4QixDQUFuQjtBQUNBLFFBQU0sYUFBYSxTQUFTLGNBQVQsQ0FBd0IsUUFBeEIsQ0FBbkI7QUFDQSxRQUFNLGVBQWUsU0FBUyxhQUFULENBQXVCLHdCQUF2QixDQUFyQjtBQUNBLFFBQU0sa0JBQWtCLFNBQVMsYUFBVCxDQUF1QiwyQkFBdkIsQ0FBeEI7O0FBRUE7QUFDQSxRQUFNLGVBQWUsU0FBUyxjQUFULENBQXdCLGdCQUF4QixDQUFyQjtBQUNBLFFBQU0sc0JBQXNCLFNBQVMsY0FBVCxDQUF3QixlQUF4QixDQUE1QjtBQUNBLFFBQU0sc0JBQXNCLFNBQVMsY0FBVCxDQUF3QixnQkFBeEIsQ0FBNUI7O0FBRUE7QUFDQSxRQUFNLHNCQUFzQixTQUFTLGFBQVQsQ0FBdUIsK0JBQXZCLENBQTVCO0FBQ0EsUUFBTSx5QkFBeUIsU0FBUyxhQUFULENBQXVCLGtDQUF2QixDQUEvQjtBQUNBO0FBQ0EsUUFBTSxlQUFlLFNBQVMsYUFBVCxDQUF1QixrQkFBdkIsQ0FBckI7QUFDQSxRQUFNLGtCQUFrQixTQUFTLGFBQVQsQ0FBdUIscUJBQXZCLENBQXhCO0FBQ0E7QUFDQSxRQUFJLHVCQUF1QixTQUFTLGdCQUFULENBQTBC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S0EsUUFBTSxXQUFXLFNBQVgsUUFBVyxHQUFJO0FBQUc7QUFDcEIsZUFBTyxNQUFNLFFBQU4sRUFBZ0IsRUFBQyxRQUFRLEtBQVQsRUFBZSxhQUFZLGFBQTNCLEVBQWhCLEVBQ0YsSUFERSxDQUNHLGNBREgsRUFFRixLQUZFLENBRUksVUFBQyxHQUFELEVBQU87QUFBRSx1QkFBVyxJQUFJLE9BQWY7QUFBeUIsU0FGdEMsQ0FBUDtBQUdILEtBSkQ7O0FBTUEsV0FBTyxPQUFPLE1BQVAsQ0FBZSxZQUFmLEVBQ0g7QUFDSTtBQURKLEtBREcsQ0FBUDtBQU9ILENBL0JEOztBQWlDQSxPQUFPLE9BQVAsR0FBaUIsYUFBakIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiY29uc3QgQ29udmVyc2lvbk1vZHVsZSA9IHJlcXVpcmUoYC4vLi4vbW9kdWxlcy9Db252ZXJzaW9uSGVscGVyLmpzYClcclxuY29uc3QgTmV0d29ya01vZHVsZSA9IHJlcXVpcmUoJy4vLi4vbW9kdWxlcy9OZXR3b3JrSGVscGVyLmpzJylcclxuY29uc3QgRGlzcGxheUhlbHBlciA9IHJlcXVpcmUoJy4vLi4vbW9kdWxlcy9EaXNwbGF5SGVscGVyLmpzJylcclxuXHJcbndpbmRvdy5vbmxvYWQgPSAoKT0+e1xyXG5cclxuXHJcbi8vID09PSBHRVQgQUxMIFRIRSBSRUxFVkFOVCBFTEVNRU5UUyBJTiBUSEUgRE9NXHJcblxyXG4gICAgLy8gY3VycmVuY3kgY29udmVyc2lvbiBib3hlc1xyXG4gICAgY29uc3QgY3VycjFJbnB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjdXJyLTEnKVxyXG4gICAgY29uc3QgY3VycjJJbnB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjdXJyLTInKVxyXG4gICAgY29uc3QgY3VyckxhYmVsVG9wID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmN1cnJlbmN5LWxhYmVsLnRvcCBoMicpXHJcbiAgICBjb25zdCBjdXJyTGFiZWxCb3R0b20gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY3VycmVuY3ktbGFiZWwuYm90dG9tIGgyJylcclxuXHJcbiAgICAvLyB1cGRhdGUgZGlhbG9nIGJveGVzXHJcbiAgICBjb25zdCB1cGRhdGVEaWFsb2cgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndXBkYXRlLWRpc3BsYXknKVxyXG4gICAgY29uc3QgdXBkYXRlSW5zdGFsbEJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd1cGRhdGUtYWNjZXB0JylcclxuICAgIGNvbnN0IHVwZGF0ZURpc21pc3NCdXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndXBkYXRlLWRpc21pc3MnKVxyXG4gICAgXHJcbiAgICAvLyBjdXJyZW5jeSBzZWxlY3QgdGlyZ2dlcnNcclxuICAgIGNvbnN0IHRvcEN1cnJSZXZlYWxCdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY3VycmVuY3ktbGFiZWwudG9wIC5kcm9wZG93bicpXHJcbiAgICBjb25zdCBib3R0b21DdXJyUmV2ZWFsQnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmN1cnJlbmN5LWxhYmVsLmJvdHRvbSAuZHJvcGRvd24nKVxyXG4gICAgLy8gY3VycmVuY3kgc2VsZWN0IHBvcHVwc1xyXG4gICAgY29uc3QgY3VyclBvcHVwVG9wID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmN1cnItc2VsZWN0LnRvcCcpXHJcbiAgICBjb25zdCBjdXJyUG9wdXBCb3R0b20gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY3Vyci1zZWxlY3QuYm90dG9tJylcclxuICAgIC8vIGN1cnJlbmN5IG9wdGlvbiBidXR0b25zXHJcbiAgICBsZXQgY3VyclNlbGVjdEJ1dHRvbnNUb3AgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuY3Vyci1zZWxlY3QudG9wIGJ1dHRvbicpXHJcbiAgICBsZXQgY3VyclNlbGVjdEJ1dHRvbnNCb3R0b20gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuY3Vyci1zZWxlY3QuYm90dG9tIGJ1dHRvbicpXHJcblxyXG4vLyBoZWxwZXIgbW9kdWxlc1xyXG4gICAgY29uc3QgZGlzcGxheUhlbHBlciA9IGZ1bmN0aW9uIERpc3BsYXlIZWxwZXIoKXtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoIWRvY3VtZW50KSB0aHJvdyBuZXcgRXJyb3IoXCJObyBkb2N1bWVudCBvYmplY3QgdG8gd29yayB3aXRoXCIpICAgLy8gY2hlY2sgdG8gc2VlIGlmIHRoZXJlIGlzIGEgZG9jdW1lbnQgb2JqZWN0XHJcblxyXG4gICAgICAgIC8vIGFkZCB0aGUgZXZlbnRzIHRvIHRoZSBjdXJyZW5jeVNlbGVjdEJ1dHRvbnNcclxuICAgICAgICBjb25zdCBzaG93Q3VyclNlbGVjdCA9IChidXR0b25DbGlja2VkLCBjdXJyQnV0dG9ucyk9PntcclxuICAgICAgICAgICAgLy8gcmVtb3ZlIHNlbGVjdGVkIGNsYXNzIGZyb20gYWxsIGJ1dHRvbnNcclxuICAgICAgICAgICAgY3VyckJ1dHRvbnMuZm9yRWFjaCgoYnV0dG9uKT0+e1xyXG4gICAgICAgICAgICAgICAgYnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoJ3NlbGVjdGVkJylcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgLy8gc2V0IHRoZSBjdXJyZW5jeSB0byB0aGUgc2FtZSBhcyB0aGUgc2VsZWN0ZWQgYnV0dG9uXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBhZGQgdGhlIHNlbGVjdGVkIGNsYXNzIHRvIHRoZSBzZWxlY3RlZCBidXR0b25cclxuICAgICAgICAgICAgYnV0dG9uQ2xpY2tlZC5jbGFzc0xpc3QuYWRkKCdzZWxlY3RlZCcpXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCByZXZlYWxQb3B1cCA9IChwb3B1cEVsZW1lbnQpPT57XHJcbiAgICAgICAgICAgIHJldHVybiBwb3B1cEVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnYWN0aXZlJylcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgaGlkZVBvcHVwID0gKHBvcHVwRWxlbWVudCk9PntcclxuICAgICAgICAgICAgcmV0dXJuIHBvcHVwRWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdhY3RpdmUnKVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgdXBkYXRlQ3VycmVuY3lMYWJlbCA9IChsYWJlbEVsZW1lbnQsY3VycmVuY3lTdHJpbmcpPT57XHJcbiAgICAgICAgICAgIGxhYmVsRWxlbWVudC5pbm5lclRleHQgPSBjdXJyZW5jeVN0cmluZ1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgZ2VuZXJhdGVDdXJyU2VsZWN0QnV0dG9uID0gKGN1cnJMYWJlbCwgc2VsZWN0ZWQpPT57XHJcbiAgICAgICAgICAgIGNvbnN0IGN1cnJCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICAgICAgICAgICAgY29uc3QgY2hlY2tFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW1nJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGxhYmVsTmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKVxyXG5cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBsYWJlbE5hbWUuaW5uZXJUZXh0ID0gY3VyckxhYmVsIC8vIHNldCB0aGUgbGFiZWxuYW1lXHJcblxyXG4gICAgICAgICAgICBjaGVja0VsZW1lbnQuc3JjID0gXCJhc3NldHMvY2hlY2ttYXJrLnN2Z1wiO1xyXG4gICAgICAgICAgICBjaGVja0VsZW1lbnQuY2xhc3NMaXN0LmFkZChcImNoZWNrbWFya1wiKVxyXG5cclxuICAgICAgICAgICAgaWYoc2VsZWN0ZWQpIGN1cnJCdXR0b24uY2xhc3NMaXN0LmFkZCgnc2VsZWN0ZWQnKVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY3VyckJ1dHRvbi5hcHBlbmRDaGlsZChjaGVja0VsZW1lbnQpXHJcbiAgICAgICAgICAgIGN1cnJCdXR0b24uYXBwZW5kQ2hpbGQobGFiZWxOYW1lKVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGN1cnJCdXR0b25cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGVtcHR5RWxlbWVudCA9IChlbGVtZW50KT0+e1xyXG4gICAgICAgICAgICB3aGlsZShlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDApe1xyXG4gICAgICAgICAgICAgICAgZWxlbWVudC5jaGlsZHJlblswXS5yZW1vdmUoKVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICByZXZlYWxQb3B1cCxcclxuICAgICAgICAgICAgaGlkZVBvcHVwLFxyXG4gICAgICAgICAgICBzaG93Q3VyclNlbGVjdCxcclxuICAgICAgICAgICAgdXBkYXRlQ3VycmVuY3lMYWJlbCxcclxuICAgICAgICAgICAgZ2VuZXJhdGVDdXJyU2VsZWN0QnV0dG9uLFxyXG4gICAgICAgICAgICBlbXB0eUVsZW1lbnRcclxuICAgICAgICB9XHJcbiAgICB9KClcclxuXHJcbiAgICBjb25zdCBuZXR3b3JrSGVscGVyID0gTmV0d29ya01vZHVsZSgpXHJcblxyXG4gICAgY29uc3QgY29udmVyc2lvbkhlbHBlciA9IENvbnZlcnNpb25Nb2R1bGUoKVxyXG4gICAgXHJcbiAgICAvKmZ1bmN0aW9uIENvbnZlcnNpb25IZWxwZXIoKXtcclxuXHJcbiAgICAgICAgbGV0IGNvcmVVU0RWYWx1ZSA9IDA7XHJcbiAgICAgICAgbGV0IGN1cnIgPSBbJ1VTRCcsICdHQlAnXVxyXG5cclxuICAgICAgICBsZXQgcmF0ZXMgPSB7XHJcbiAgICAgICAgICAgIFVTRDogMSxcclxuICAgICAgICAgICAgR0JQOiAwLjc1MjI0NVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3Qgc2V0UmF0ZXMgPSAobmV3UmF0ZXMpPT57XHJcbiAgICAgICAgICAgIHJldHVybiByYXRlcyA9IG5ld1JhdGVzXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBjb252ZXJ0VmFsdWU9ICh7c291cmNlVmFsdWU9MCwgc291cmNlQ3VycmVuY3k9J1VTRCcsIHRhcmdldEN1cnJlbmN5PSdHQlAnfT17fSk9PntcclxuICAgICAgICAgICAgY29uc3QgVVNEID0gc291cmNlVmFsdWUgLyByYXRlc1tzb3VyY2VDdXJyZW5jeV0gICAvLyBjb252ZXJ0IHRvIGJhc2UgY3VycmVuY3kgKFVTRClcclxuICAgICAgICAgICAgcmV0dXJuIFVTRCpyYXRlc1t0YXJnZXRDdXJyZW5jeV0gICAvLyByZXR1cm4gdmFsdWUgXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBmdW5jdGlvbnMgdG8gdXBkYXRlIHdoYXQgY3VycmVuY3kgaXMgYmVpbmcgdXNlZFxyXG5cclxuICAgICAgICBjb25zdCBnZXRDdXJyID0gKGN1cnJJbmRleCk9PntcclxuICAgICAgICAgICAgcmV0dXJuIGN1cnJbY3VyckluZGV4LTFdXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBzZXRDdXJyID0gKGN1cnJJbmRleCwgbmV3Q3Vycik9PntcclxuICAgICAgICAgICAgY3VycltjdXJySW5kZXgtMV0gPSBuZXdDdXJyXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCB1cGRhdGVDb252ZXJzaW9ucyA9IChjb252ZXJ0VmFsdWU9Y29yZVVTRFZhbHVlLCBzb3VyY2VDdXJyZW5jeT0nVVNEJyk9PntcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIG5vcm1hbGlzZSB0byBVU0RcclxuICAgICAgICAgICAgY29uc3QgaW5jb21pbmdVU0RWYWx1ZSA9IGNvbnZlcnNpb25IZWxwZXIuY29udmVydFZhbHVlKHtcclxuICAgICAgICAgICAgICAgIHNvdXJjZVZhbHVlOiBjb252ZXJ0VmFsdWUsXHJcbiAgICAgICAgICAgICAgICBzb3VyY2VDdXJyZW5jeTogc291cmNlQ3VycmVuY3ksXHJcbiAgICAgICAgICAgICAgICB0YXJnZXRDdXJyZW5jeTogJ1VTRCdcclxuICAgICAgICAgICAgfSlcclxuICAgIFxyXG4gICAgICAgICAgICBjb3JlVVNEVmFsdWUgPSBpbmNvbWluZ1VTRFZhbHVlOyAvLyBzdG9yZSB0aGlzIHZhbHVlIGZvciB0aGUgZnV0dXJlXHJcbiAgICBcclxuICAgICAgICAgICAgLy8gdXBkYXRlIHRoZSB2YWx1ZSBpbiB0b3AgYm94XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbnZlcnNpb24xID0gY29udmVyc2lvbkhlbHBlci5jb252ZXJ0VmFsdWUoe1xyXG4gICAgICAgICAgICAgICAgc291cmNlVmFsdWU6IGluY29taW5nVVNEVmFsdWUsXHJcbiAgICAgICAgICAgICAgICBzb3VyY2VDdXJyZW5jeTonVVNEJyxcclxuICAgICAgICAgICAgICAgIHRhcmdldEN1cnJlbmN5OiBjdXJyWzBdXHJcbiAgICAgICAgICAgIH0pLnRvRml4ZWQoMilcclxuICAgIFxyXG4gICAgICAgICAgICAvLyB1cGRhdGUgdmFsdWUgaW4gYm90dG9tIGJveFxyXG4gICAgICAgICAgICBjb25zdCBjb252ZXJzaW9uMiA9IGNvbnZlcnNpb25IZWxwZXIuY29udmVydFZhbHVlKHtcclxuICAgICAgICAgICAgICAgIHNvdXJjZVZhbHVlOiBpbmNvbWluZ1VTRFZhbHVlLFxyXG4gICAgICAgICAgICAgICAgc291cmNlQ3VycmVuY3k6ICdVU0QnLFxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0Q3VycmVuY3k6IGN1cnJbMV1cclxuICAgICAgICAgICAgfSkudG9GaXhlZCgyKVxyXG4gICAgICAgICAgICByZXR1cm4geyB0b3BWYWx1ZTogY29udmVyc2lvbjEsIGJvdHRvbVZhbHVlOiBjb252ZXJzaW9uMn1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGdldEN1cnJMYWJlbHMgPSAoKT0+e1xyXG4gICAgICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMocmF0ZXMpXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBzZXRSYXRlcyxcclxuICAgICAgICAgICAgY29udmVydFZhbHVlLFxyXG4gICAgICAgICAgICBnZXRDdXJyLFxyXG4gICAgICAgICAgICBzZXRDdXJyLFxyXG4gICAgICAgICAgICB1cGRhdGVDb252ZXJzaW9ucyxcclxuICAgICAgICAgICAgZ2V0Q3VyckxhYmVsc1xyXG4gICAgICAgIH1cclxuXHJcbiAgICB9KCkqL1xyXG5cclxuICAgIGNvbnN0IHNlcnZpY2VXb3JrZXJIZWxwZXIgPSBmdW5jdGlvbiBTZXJ2aWNlV29ya2VySGVscGVyKHdvcmtlckxvY2F0aW9uLCB1cGRhdGVVSSwgdXBkYXRlVHJpZ2dlckVsKXtcclxuICAgICAgICBpZiAoIW5hdmlnYXRvci5zZXJ2aWNlV29ya2VyKSB0aHJvdyBuZXcgRXJyb3IoXCJzZXJ2aWNlIHdvcmtlciBub3Qgc3VwcG9ydGVkXCIpXHJcblxyXG4gICAgICAgIGNvbnN0IHVwZGF0ZVRyaWdnZXJFbGVtZW50ID0gdXBkYXRlVHJpZ2dlckVsO1xyXG5cclxuICAgICAgICAvLyByZWdpc3RlciB0aGUgc2VydmljZSB3b3JrZXJcclxuICAgICAgICBuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5yZWdpc3Rlcih3b3JrZXJMb2NhdGlvbikudGhlbigocmVnKT0+e1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gY2hlY2sgaWYgc2VydmljZSB3b3JrZXIgbG9hZGVkIHRoZSBwYWdlIC0gaWYgaXQgZGlkbid0IHJldHVybiAoYXMgc2VydmljZSB3b3JrZXIgaXMgdGhlIGxhdGVzdClcclxuICAgICAgICAgICAgaWYgKCFuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5jb250cm9sbGVyKSByZXR1cm5cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGlmIHRoZXJlIGlzIG9uZSB3YWl0aW5nIC0gdGhlcmUgd2FzIGEgc2VydmljZSB3b3JrZXIgaW5zdGFsbGVkIG9uIHRoZSBsYXN0IHJlZnJlc2ggYW5kIGl0cyB3YWl0aW5nXHJcbiAgICAgICAgICAgIGlmKHJlZy53YWl0aW5nKXtcclxuICAgICAgICAgICAgICAgIGRpc3BsYXlIZWxwZXIuc2hvd1VwZGF0ZSgpXHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGlmIHRoZXJlIGlzIGEgc2VydmljZSB3b3JrZXIgaW5zdGFsbGluZ1xyXG4gICAgICAgICAgICBpZihyZWcuaW5zdGFsbGluZyl7XHJcbiAgICAgICAgICAgICAgICB0cmFja0luc3RhbGxpbmcocmVnLmluc3RhbGxpbmcpXHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGxpc3RlbiBmb3IgZnV0dXJlIHdvcmtlcnMgaW5zdGFsbGluZ1xyXG4gICAgICAgICAgICByZWcuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZm91bmQnLCAoKT0+e1xyXG4gICAgICAgICAgICAgICAgdHJhY2tJbnN0YWxsaW5nKHJlZy5pbnN0YWxsaW5nKVxyXG4gICAgICAgICAgICB9KVxyXG5cclxuXHJcbiAgICAgICAgfSkuY2F0Y2goKGVycik9PntcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTZXJ2aWNlIHdvcmtlciBkaWRuJ3QgcmVnaXN0ZXI6ICR7ZXJyLm1lc3NhZ2V9YClcclxuICAgICAgICB9KVxyXG5cclxuICAgICAgICAvLyBsaXN0ZW4gZm9yIGNoYW5nZW92ZXIgb2Ygc2VydmljZSB3b3JrZXIgLSByZWxvYWQgcGFnZSBpZiBhIG5ldyBvbmUgdG9vayBvdmVyXHJcbiAgICAgICAgbmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignY29udHJvbGxlcmNoYW5nZScsICgpPT57XHJcbiAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKVxyXG4gICAgICAgIH0pXHJcblxyXG5cclxuICAgICAgICAvLyBsaXN0ZW4gdG8gaW5zdGFsbGluZyBzZXJ2aWNlIHdvcmtlciAmJiBzaG93IHVzZXIgd2hlbiBpdHMgd2FpdGluZ1xyXG4gICAgICAgIGNvbnN0IHRyYWNrSW5zdGFsbGluZyA9ICh3b3JrZXIpPT57XHJcblxyXG4gICAgICAgICAgICB3b3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignc3RhdGVjaGFuZ2UnLCAoKT0+e1xyXG4gICAgICAgICAgICAgICAgaWYod29ya2VyLnN0YXRlID09ICdpbnN0YWxsZWQnKXtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlVHJpZ2dlckVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKT0+eyAvLyBhZGQgY2xpY2sgZXZlbnQgdG8gdGhlIFVJXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHdvcmtlci5wb3N0TWVzc2FnZSh7YWN0aW9uOiAnc2tpcFdhaXRpbmcnfSlcclxuICAgICAgICAgICAgICAgICAgICB9KVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBkaXNwbGF5SGVscGVyLnJldmVhbFBvcHVwKHVwZGF0ZVVJKSAgLy8gc2hvdyB0aGUgVUlcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSlcclxuICAgICAgICB9XHJcblxyXG4gICAgfSgnL3N3LmpzJyx1cGRhdGVEaWFsb2csIHVwZGF0ZUluc3RhbGxCdXR0b24pXHJcblxyXG4gICAgXHJcbi8vIElNUExFTUVOVEFUSU9OIFNQRUNJRklDIENPTU1BTkRTXHJcblxyXG4gICAgLy8gY2FsbGJhY2sgZm9yIHdoZW4gY3VycmVuY3kgc2VsZWN0IGJ1dHRvbnMgYXJlIGNsaWNrZWRcclxuICAgIGNvbnN0IGN1cnJTZWxlY3RDYWxsYmFjayA9IChldmVudCxpc1RvcEN1cnIpPT57XHJcbiAgICBcclxuICAgICAgICBjb25zdCBjdXJySW5kZXggPSAoaXNUb3BDdXJyKSA/IDE6MjtcclxuICAgICAgICBjb25zdCBjdXJyTGFiZWwgPSAoaXNUb3BDdXJyKSA/IGN1cnJMYWJlbFRvcDogY3VyckxhYmVsQm90dG9tXHJcbiAgICAgICAgY29uc3QgY3VyclBvcHVwID0gKGlzVG9wQ3VycikgPyBjdXJyUG9wdXBUb3A6IGN1cnJQb3B1cEJvdHRvbVxyXG4gICAgICAgIGNvbnN0IGN1cnJTZWxlY3RCdXR0b25zID0gKGlzVG9wQ3VycikgPyBjdXJyU2VsZWN0QnV0dG9uc1RvcDogY3VyclNlbGVjdEJ1dHRvbnNCb3R0b207XHJcbiAgICAgICAgY29uc3QgY3VyckJ1dHRvbiA9IChldmVudC50YXJnZXQudGFnTmFtZSAhPSAnYnV0dG9uJykgPyBldmVudC50YXJnZXQucGFyZW50Tm9kZSA6IGV2ZW50LnRhcmdldDsgLy8gaWYgdGhlIGNsaWNrIG9uIGEgY2hpbGQgLSBzZXQgcGFyZW50IE9SIC0gc2V0IHRoZSBwYXJlbnQgYXMgdGhlIGJ1dHRvblxyXG4gICAgICAgIGNvbnN0IGN1cnJCdXR0b25DdXJyTmFtZSA9IGN1cnJCdXR0b24ucXVlcnlTZWxlY3RvcigncCcpLmlubmVyVGV4dFxyXG5cclxuXHJcbiAgICAgICAgbGV0IG5ld0NvbnZWYWx1ZXM7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZGlzcGxheUhlbHBlci5zaG93Q3VyclNlbGVjdChjdXJyQnV0dG9uLCBjdXJyU2VsZWN0QnV0dG9ucyk7IC8vIGRpc3BsYXkgdGhlIHRpY2sgb24gdGhlIGN1cnJlbmN5XHJcbiAgICAgICAgZGlzcGxheUhlbHBlci51cGRhdGVDdXJyZW5jeUxhYmVsKGN1cnJMYWJlbCwgY3VyckJ1dHRvbkN1cnJOYW1lKSAvLyBjaGFuZ2UgdGhlIGxhYmVsIGF0IHRoZSB0b3BcclxuXHJcbiAgICAgICAgY29udmVyc2lvbkhlbHBlci5zZXRDdXJyKGN1cnJJbmRleCwgY3VyckJ1dHRvbkN1cnJOYW1lKSAvLyBzZXQgdGhlIG5ldyBjdXJyZW5jeSBmb3IgdG9wXHJcbiAgICAgICAgXHJcbiAgICAgICAgbmV3Q29udlZhbHVlcyA9IGNvbnZlcnNpb25IZWxwZXIudXBkYXRlQ29udmVyc2lvbnMoKSAvLyBnZXQgdGhlIG5ldyB2YWx1ZXMgZm9yIHRoZSBjb252ZXJzaW9uICh1c2luZyBkZWZhdWx0cylcclxuICAgICAgICBjdXJyMUlucHV0LnZhbHVlID0gbmV3Q29udlZhbHVlcy50b3BWYWx1ZTtcclxuICAgICAgICBjdXJyMklucHV0LnZhbHVlID0gbmV3Q29udlZhbHVlcy5ib3R0b21WYWx1ZTtcclxuXHJcbiAgICAgICAgLy9jaGFuZ2VDdXJyZW5jeVxyXG4gICAgICAgIGRpc3BsYXlIZWxwZXIuaGlkZVBvcHVwKGN1cnJQb3B1cCkvLyBoaWRlIHRoZSBjdXJyZW5jeSBzZWxlY3RcclxuICAgICAgICByZXR1cm5cclxuICAgIH1cclxuXHJcbiAgICAvLyBncmFiIHRoZSByYXRlc1xyXG4gICAgbmV0d29ya0hlbHBlci5nZXRSYXRlcygpLnRoZW4oKHJhdGVzKT0+e1xyXG4gICAgICAgIGxldCBjdXJyTGFiZWxzO1xyXG5cclxuXHJcbiAgICAgICAgY29udmVyc2lvbkhlbHBlci5zZXRSYXRlcyhyYXRlcylcclxuICAgICAgICBcclxuICAgICAgICBjdXJyTGFiZWxzID0gY29udmVyc2lvbkhlbHBlci5nZXRDdXJyTGFiZWxzKClcclxuXHJcbiAgICAgICAgLy8gZW1wdHkgdGhlIHBvcHVwcyBvZiB0aGVpciBidXR0b25zXHJcbiAgICAgICAgZGlzcGxheUhlbHBlci5lbXB0eUVsZW1lbnQoY3VyclBvcHVwVG9wKVxyXG4gICAgICAgIGRpc3BsYXlIZWxwZXIuZW1wdHlFbGVtZW50KGN1cnJQb3B1cEJvdHRvbSlcclxuXHJcbiAgICAgICAgY3VyckxhYmVscy5mb3JFYWNoKChjdXJyTGFiZWwpPT57XHJcbiAgICAgICAgICAgIGNvbnN0IHRvcEJ1dHRvbiA9IGRpc3BsYXlIZWxwZXIuZ2VuZXJhdGVDdXJyU2VsZWN0QnV0dG9uKGN1cnJMYWJlbCwgY3VyckxhYmVsID09IGNvbnZlcnNpb25IZWxwZXIuZ2V0Q3VycigxKSlcclxuICAgICAgICAgICAgY29uc3QgYm90dG9tQnV0dG9uID0gZGlzcGxheUhlbHBlci5nZW5lcmF0ZUN1cnJTZWxlY3RCdXR0b24oY3VyckxhYmVsLCBjdXJyTGFiZWwgPT0gY29udmVyc2lvbkhlbHBlci5nZXRDdXJyKDIpKVxyXG5cclxuICAgICAgICAgICAgdG9wQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KT0+eyBjdXJyU2VsZWN0Q2FsbGJhY2soZXZlbnQsIHRydWUpfSlcclxuICAgICAgICAgICAgYm90dG9tQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KT0+eyBjdXJyU2VsZWN0Q2FsbGJhY2soZXZlbnQsIGZhbHNlKX0pXHJcblxyXG4gICAgICAgICAgICBjdXJyUG9wdXBUb3AuYXBwZW5kQ2hpbGQodG9wQnV0dG9uKVxyXG4gICAgICAgICAgICBjdXJyUG9wdXBCb3R0b20uYXBwZW5kQ2hpbGQoYm90dG9tQnV0dG9uKVxyXG4gICAgICAgIH0pXHJcblxyXG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgY3VyclNlbGVjdEJ1dHRvbnMgLSBzbyB0aGV5IGNhbiBiZSBjbGVhcmVkXHJcbiAgICAgICAgY3VyclNlbGVjdEJ1dHRvbnNUb3AgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuY3Vyci1zZWxlY3QudG9wIGJ1dHRvbicpXHJcbiAgICAgICAgY3VyclNlbGVjdEJ1dHRvbnNCb3R0b20gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuY3Vyci1zZWxlY3QuYm90dG9tIGJ1dHRvbicpXHJcblxyXG4gICAgfSlcclxuXHJcbiAgICAvLyA9PSBVcGRhdGUgZnVuY3Rpb25hbGl0eVxyXG4gICAgLy8gZGlzbWlzcyB0aGUgdXBkYXRlIFxyXG4gICAgdXBkYXRlRGlzbWlzc0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsKCk9PntcclxuICAgICAgICBkaXNwbGF5SGVscGVyLmhpZGVQb3B1cCh1cGRhdGVEaXNtaXNzQnV0dG9uKVxyXG4gICAgfSlcclxuXHJcblxyXG5cclxuICAgIC8vID09IGN1cnJlbmN5IHJlbGV2YW50IGV2ZW50c1xyXG5cclxuICAgIC8vIGV2ZW50IGxpc3RlbmVycyAtLSB3aGVuIHRoZSBpbnB1dCBpcyBtb2RpZmllZCBcclxuICAgIGN1cnIxSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLChlKT0+eyAgICAgICAgXHJcbiAgICAgICAgY29uc3QgY29udmVydFZhbHVlcyA9IGNvbnZlcnNpb25IZWxwZXIudXBkYXRlQ29udmVyc2lvbnMoZXZlbnQudGFyZ2V0LnZhbHVlLCBjb252ZXJzaW9uSGVscGVyLmdldEN1cnIoMSkpXHJcbiAgICAgICAgY3VycjJJbnB1dC52YWx1ZSA9IGNvbnZlcnRWYWx1ZXMuYm90dG9tVmFsdWU7XHJcbiAgICB9KVxyXG5cclxuICAgIGN1cnIySW5wdXQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLChlKT0+e1xyXG4gICAgICAgIGNvbnN0IGNvbnZlcnRWYWx1ZXMgPSBjb252ZXJzaW9uSGVscGVyLnVwZGF0ZUNvbnZlcnNpb25zKGV2ZW50LnRhcmdldC52YWx1ZSwgY29udmVyc2lvbkhlbHBlci5nZXRDdXJyKDIpKVxyXG4gICAgICAgIGN1cnIxSW5wdXQudmFsdWUgPSBjb252ZXJ0VmFsdWVzLnRvcFZhbHVlO1xyXG4gICAgfSlcclxuXHJcbiAgICB0b3BDdXJyUmV2ZWFsQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCk9PntcclxuICAgICAgICBkaXNwbGF5SGVscGVyLnJldmVhbFBvcHVwKGN1cnJQb3B1cFRvcCk7XHJcbiAgICB9KVxyXG4gICAgYm90dG9tQ3VyclJldmVhbEJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpPT57XHJcbiAgICAgICAgZGlzcGxheUhlbHBlci5yZXZlYWxQb3B1cChjdXJyUG9wdXBCb3R0b20pXHJcbiAgICB9KVxyXG5cclxuXHJcblxyXG4vLyBleHBvc2UgdGhlIG1vZHVsZXMgZm9yIGluc3BlY3Rpb24tIGRldiBvbmx5XHJcbiAgICB3aW5kb3cuY29udkFwcE9ianMgPSB7XHJcbiAgICAgICAgZGlzcGxheUhlbHBlcixcclxuICAgICAgICBuZXR3b3JrSGVscGVyLFxyXG4gICAgICAgIGNvbnZlcnNpb25IZWxwZXIsXHJcbiAgICAgICAgc2VydmljZVdvcmtlckhlbHBlclxyXG4gICAgfVxyXG59XHJcbiIsIlxyXG5jb25zdCBDb252ZXJzaW9uSGVscGVyID0gKCk9PntcclxuICAgIFxyXG4gICAgbGV0IHJldHVybk9iamVjdCA9IHt9XHJcbiAgICBsZXQgY29yZVVTRFZhbHVlID0gMDtcclxuICAgIGxldCBjdXJyID0gWydVU0QnLCAnR0JQJ11cclxuICAgIGxldCByYXRlcyA9IHtcclxuICAgICAgICBVU0Q6IDEsXHJcbiAgICAgICAgR0JQOiAwLjc1MjI0NVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNldFJhdGVzID0gKG5ld1JhdGVzKT0+e1xyXG4gICAgICAgIHJldHVybiByYXRlcyA9IG5ld1JhdGVzXHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY29udmVydFZhbHVlPSAoe3NvdXJjZVZhbHVlPTAsIHNvdXJjZUN1cnJlbmN5PSdVU0QnLCB0YXJnZXRDdXJyZW5jeT0nR0JQJ309e30pPT57XHJcbiAgICAgICAgY29uc3QgVVNEID0gc291cmNlVmFsdWUgLyByYXRlc1tzb3VyY2VDdXJyZW5jeV0gICAvLyBjb252ZXJ0IHRvIGJhc2UgY3VycmVuY3kgKFVTRClcclxuICAgICAgICByZXR1cm4gVVNEKnJhdGVzW3RhcmdldEN1cnJlbmN5XSAgIC8vIHJldHVybiB2YWx1ZSBcclxuICAgIH1cclxuXHJcbiAgICAvLyBmdW5jdGlvbnMgdG8gdXBkYXRlIHdoYXQgY3VycmVuY3kgaXMgYmVpbmcgdXNlZFxyXG5cclxuICAgIGNvbnN0IGdldEN1cnIgPSAoY3VyckluZGV4KT0+e1xyXG4gICAgICAgIHJldHVybiBjdXJyW2N1cnJJbmRleC0xXVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNldEN1cnIgPSAoY3VyckluZGV4LCBuZXdDdXJyKT0+e1xyXG4gICAgICAgIGN1cnJbY3VyckluZGV4LTFdID0gbmV3Q3VyclxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHVwZGF0ZUNvbnZlcnNpb25zID0gKGNvbnZlcnRWYWx1ZT1jb3JlVVNEVmFsdWUsIHNvdXJjZUN1cnJlbmN5PSdVU0QnKT0+e1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIG5vcm1hbGlzZSB0byBVU0RcclxuICAgICAgICBjb25zdCBpbmNvbWluZ1VTRFZhbHVlID0gcmV0dXJuT2JqZWN0LmNvbnZlcnRWYWx1ZSh7XHJcbiAgICAgICAgICAgIHNvdXJjZVZhbHVlOiBjb252ZXJ0VmFsdWUsXHJcbiAgICAgICAgICAgIHNvdXJjZUN1cnJlbmN5OiBzb3VyY2VDdXJyZW5jeSxcclxuICAgICAgICAgICAgdGFyZ2V0Q3VycmVuY3k6ICdVU0QnXHJcbiAgICAgICAgfSlcclxuXHJcbiAgICAgICAgY29yZVVTRFZhbHVlID0gaW5jb21pbmdVU0RWYWx1ZTsgLy8gc3RvcmUgdGhpcyB2YWx1ZSBmb3IgdGhlIGZ1dHVyZVxyXG5cclxuICAgICAgICAvLyB1cGRhdGUgdGhlIHZhbHVlIGluIHRvcCBib3hcclxuICAgICAgICBjb25zdCBjb252ZXJzaW9uMSA9IHJldHVybk9iamVjdC5jb252ZXJ0VmFsdWUoe1xyXG4gICAgICAgICAgICBzb3VyY2VWYWx1ZTogaW5jb21pbmdVU0RWYWx1ZSxcclxuICAgICAgICAgICAgc291cmNlQ3VycmVuY3k6J1VTRCcsXHJcbiAgICAgICAgICAgIHRhcmdldEN1cnJlbmN5OiBjdXJyWzBdXHJcbiAgICAgICAgfSkudG9GaXhlZCgyKVxyXG5cclxuICAgICAgICAvLyB1cGRhdGUgdmFsdWUgaW4gYm90dG9tIGJveFxyXG4gICAgICAgIGNvbnN0IGNvbnZlcnNpb24yID0gcmV0dXJuT2JqZWN0LmNvbnZlcnRWYWx1ZSh7XHJcbiAgICAgICAgICAgIHNvdXJjZVZhbHVlOiBpbmNvbWluZ1VTRFZhbHVlLFxyXG4gICAgICAgICAgICBzb3VyY2VDdXJyZW5jeTogJ1VTRCcsXHJcbiAgICAgICAgICAgIHRhcmdldEN1cnJlbmN5OiBjdXJyWzFdXHJcbiAgICAgICAgfSkudG9GaXhlZCgyKVxyXG4gICAgICAgIHJldHVybiB7IHRvcFZhbHVlOiBjb252ZXJzaW9uMSwgYm90dG9tVmFsdWU6IGNvbnZlcnNpb24yfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGdldEN1cnJMYWJlbHMgPSAoKT0+e1xyXG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhyYXRlcylcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihyZXR1cm5PYmplY3QsXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBzZXRSYXRlcyxcclxuICAgICAgICAgICAgY29udmVydFZhbHVlLFxyXG4gICAgICAgICAgICBnZXRDdXJyLFxyXG4gICAgICAgICAgICBzZXRDdXJyLFxyXG4gICAgICAgICAgICB1cGRhdGVDb252ZXJzaW9ucyxcclxuICAgICAgICAgICAgZ2V0Q3VyckxhYmVsc1xyXG4gICAgICAgIH1cclxuICAgIClcclxufVxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ29udmVyc2lvbkhlbHBlciIsImNvbnN0IERpc3BsYXlIZWxwZXIgPSAoKT0+e1xyXG4gICAgICAgIFxyXG4gICAgaWYgKCFkb2N1bWVudCkgdGhyb3cgbmV3IEVycm9yKFwiTm8gZG9jdW1lbnQgb2JqZWN0IHRvIHdvcmsgd2l0aFwiKSAgIC8vIGNoZWNrIHRvIHNlZSBpZiB0aGVyZSBpcyBhIGRvY3VtZW50IG9iamVjdFxyXG5cclxuICAgIGxldCByZXR1cm5PYmplY3QgPSB7fVxyXG5cclxuICAgIC8vIGFkZCB0aGUgZXZlbnRzIHRvIHRoZSBjdXJyZW5jeVNlbGVjdEJ1dHRvbnNcclxuICAgIGNvbnN0IHNob3dDdXJyU2VsZWN0ID0gKGJ1dHRvbkNsaWNrZWQsIGN1cnJCdXR0b25zKT0+e1xyXG4gICAgICAgIC8vIHJlbW92ZSBzZWxlY3RlZCBjbGFzcyBmcm9tIGFsbCBidXR0b25zXHJcbiAgICAgICAgY3VyckJ1dHRvbnMuZm9yRWFjaCgoYnV0dG9uKT0+e1xyXG4gICAgICAgICAgICBidXR0b24uY2xhc3NMaXN0LnJlbW92ZSgnc2VsZWN0ZWQnKVxyXG4gICAgICAgIH0pXHJcbiAgICAgICAgLy8gc2V0IHRoZSBjdXJyZW5jeSB0byB0aGUgc2FtZSBhcyB0aGUgc2VsZWN0ZWQgYnV0dG9uXHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gYWRkIHRoZSBzZWxlY3RlZCBjbGFzcyB0byB0aGUgc2VsZWN0ZWQgYnV0dG9uXHJcbiAgICAgICAgYnV0dG9uQ2xpY2tlZC5jbGFzc0xpc3QuYWRkKCdzZWxlY3RlZCcpXHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIFxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJldmVhbFBvcHVwID0gKHBvcHVwRWxlbWVudCk9PntcclxuICAgICAgICByZXR1cm4gcG9wdXBFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2FjdGl2ZScpXHJcbiAgICB9XHJcbiAgICBjb25zdCBoaWRlUG9wdXAgPSAocG9wdXBFbGVtZW50KT0+e1xyXG4gICAgICAgIHJldHVybiBwb3B1cEVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnYWN0aXZlJylcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB1cGRhdGVDdXJyZW5jeUxhYmVsID0gKGxhYmVsRWxlbWVudCxjdXJyZW5jeVN0cmluZyk9PntcclxuICAgICAgICBsYWJlbEVsZW1lbnQuaW5uZXJUZXh0ID0gY3VycmVuY3lTdHJpbmdcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBnZW5lcmF0ZUN1cnJTZWxlY3RCdXR0b24gPSAoY3VyckxhYmVsLCBzZWxlY3RlZCk9PntcclxuICAgICAgICBjb25zdCBjdXJyQnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgICAgICAgY29uc3QgY2hlY2tFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW1nJyk7XHJcbiAgICAgICAgY29uc3QgbGFiZWxOYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpXHJcblxyXG4gICAgICAgIFxyXG4gICAgICAgIFxyXG4gICAgICAgIGxhYmVsTmFtZS5pbm5lclRleHQgPSBjdXJyTGFiZWwgLy8gc2V0IHRoZSBsYWJlbG5hbWVcclxuXHJcbiAgICAgICAgY2hlY2tFbGVtZW50LnNyYyA9IFwiYXNzZXRzL2NoZWNrbWFyay5zdmdcIjtcclxuICAgICAgICBjaGVja0VsZW1lbnQuY2xhc3NMaXN0LmFkZChcImNoZWNrbWFya1wiKVxyXG5cclxuICAgICAgICBpZihzZWxlY3RlZCkgY3VyckJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdzZWxlY3RlZCcpXHJcbiAgICAgICAgXHJcbiAgICAgICAgY3VyckJ1dHRvbi5hcHBlbmRDaGlsZChjaGVja0VsZW1lbnQpXHJcbiAgICAgICAgY3VyckJ1dHRvbi5hcHBlbmRDaGlsZChsYWJlbE5hbWUpXHJcblxyXG4gICAgICAgIHJldHVybiBjdXJyQnV0dG9uXHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZW1wdHlFbGVtZW50ID0gKGVsZW1lbnQpPT57XHJcbiAgICAgICAgd2hpbGUoZWxlbWVudC5jaGlsZHJlbi5sZW5ndGggPiAwKXtcclxuICAgICAgICAgICAgZWxlbWVudC5jaGlsZHJlblswXS5yZW1vdmUoKVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGVsZW1lbnRcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihyZXR1cm5PYmplY3QsXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICByZXZlYWxQb3B1cCxcclxuICAgICAgICAgICAgaGlkZVBvcHVwLFxyXG4gICAgICAgICAgICBzaG93Q3VyclNlbGVjdCxcclxuICAgICAgICAgICAgdXBkYXRlQ3VycmVuY3lMYWJlbCxcclxuICAgICAgICAgICAgZ2VuZXJhdGVDdXJyU2VsZWN0QnV0dG9uLFxyXG4gICAgICAgICAgICBlbXB0eUVsZW1lbnRcclxuICAgICAgICB9XHJcbiAgICApXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRGlzcGxheUhlbHBlciIsImNvbnN0IE5ldHdvcmtIZWxwZXIgPSgpPT57XHJcbiAgICBcclxuICAgIGxldCByZXR1cm5PYmplY3QgPSB7fTtcclxuICAgIFxyXG4gICAgY29uc3QgaGFuZGxlUmVzcG9uc2UgPSAocmVzcG9uc2UpPT57IC8vIGNoZWNrcyBpZiB0aGUgcmVxdWVzdCBmb3IgdGhlIHJhdGVzIHdhcyBzdWNjZXNzZnVsXHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLm9rKXtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKVxyXG4gICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICBQcm9taXNlLnJlamVjdCggbmV3IEVycm9yICgnVW5leHBlY3RlZCBSZXNwb25zZScpKVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgbG9nTWVzc2FnZSA9IChtZXNzYWdlKT0+e1xyXG4gICAgICAgIGNvbnNvbGUubG9nKG1lc3NhZ2UpXHJcbiAgICAgICAgcmV0dXJuIG1lc3NhZ2VcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBnZXRSYXRlcyA9ICgpPT57ICAvLyByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIHRoZSBkYXRhXHJcbiAgICAgICAgcmV0dXJuIGZldGNoKCcvcmF0ZXMnLCB7bWV0aG9kOiAnR0VUJyxjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nIH0pXHJcbiAgICAgICAgICAgIC50aGVuKGhhbmRsZVJlc3BvbnNlKVxyXG4gICAgICAgICAgICAuY2F0Y2goKGVycik9PnsgbG9nTWVzc2FnZShlcnIubWVzc2FnZSkgfSlcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbiggcmV0dXJuT2JqZWN0LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgZ2V0UmF0ZXNcclxuICAgICAgICB9XHJcbiAgICApXHJcblxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBOZXR3b3JrSGVscGVyIl19
