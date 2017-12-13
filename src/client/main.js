window.onload = ()=>{


    // === GET ALL THE RELEVANT ELEMENTS IN THE DOM

    // currency conversion boxes
    const curr1Input = document.getElementById('curr-1')
    const curr2Input = document.getElementById('curr-2')
    const currLabelTop = document.querySelector('.currency-label.top h2')
    const currLabelBottom = document.querySelector('.currency-label.bottom h2')

    // update dialog boxes
    const updateDialog = document.getElementById('update-display')
    const updateInstallButton = document.getElementById('update-accept')
    const updateDismissButton = document.getElementById('update-dismiss')
    
    // currency select tirggers
    const topCurrRevealButton = document.querySelector('.currency-label.top .dropdown')
    const bottomCurrRevealButton = document.querySelector('.currency-label.bottom .dropdown')
    // currency select popups
    const currPopupTop = document.querySelector('.curr-select.top')
    const currPopupBottom = document.querySelector('.curr-select.bottom')
    // currency option buttons
    const currSelectButtonsTop = document.querySelectorAll('.curr-select.top button')
    const currSelectButtonsBottom = document.querySelectorAll('.curr-select.bottom button')

    // helper modules
    const displayHelper = function DisplayHelper(){
        
        if (!document) throw new Error("No document object to work with")   // check to see if there is a document object

        // add the events to the currencySelectButtons
        const showCurrSelect = (buttonClicked, currButtons)=>{
            // remove selected class from all buttons
            currButtons.forEach((button)=>{
                button.classList.remove('selected')
            })
            // set the currency to the same as the selected button
            
            // add the selected class to the selected button
            buttonClicked.classList.add('selected')
            
            return 
        }

        const revealPopup = (popupElement)=>{
            return popupElement.classList.add('active')
        }
        const hidePopup = (popupElement)=>{
            return popupElement.classList.remove('active')
        }

        const updateCurrencyLabel = (labelElement,currencyString)=>{
            labelElement.innerText = currencyString
        }

        const generateCurrSelectButton = (currLabel, selected)=>{
            const currButton = document.createElement('button');
            const checkElement = document.createElement('img');

            currButton.innerText = currLabel
            checkElement.classList.add("checkmark")
            if(selected) checkElement.classList.add('selected')
            
            currButton.appendChild(checkElement)

            return currButton
        }

        return {
            revealPopup,
            hidePopup,
            showCurrSelect,
            updateCurrencyLabel,
            generateCurrSelectButton
        }
    }()

    const networkHelper = function NetworkHelper(){
        const handleResponse = (response)=>{ // checks if the request for the rates was successful

            if(response.ok){
                return response.json()
            }else{
                Promise.reject( new Error ('Unexpected Response'))
            }
        };

        const logMessage = (message)=>{
            console.log(message)
            return message
        }

        const getRates = ()=>{  // returns a promise that resolves to the data
            return fetch('/rates', {method: 'GET',credentials:'same-origin' })
                .then(handleResponse)
                .catch((err)=>{ logMessage(err.message) })
        }

        return{
            getRates
        }


    }()

    const conversionHelper = function ConversionHelper(){

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

        // TODO: functions to update what currency is being used

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

    }()

    const serviceWorkerHelper = function ServiceWorkerHelper(workerLocation, updateUI, updateTriggerEl){
        if (!navigator.serviceWorker) throw new Error("service worker not supported")

        const updateTriggerElement = updateTriggerEl;

        // register the service worker
        navigator.serviceWorker.register(workerLocation).then((reg)=>{
            
            // check if service worker loaded the page - if it didn't return (as service worker is the latest)
            if (!navigator.serviceWorker.controller) return
            
            // if there is one waiting - there was a service worker installed on the last refresh and its waiting
            if(reg.waiting){
                displayHelper.showUpdate()
                return;
            }

            // if there is a service worker installing
            if(reg.installing){
                trackInstalling(reg.installing)
                return;
            }

            // listen for future workers installing
            reg.addEventListener('updatefound', ()=>{
                trackInstalling(reg.installing)
            })


        }).catch((err)=>{
            throw new Error(`Service worker didn't register: ${err.message}`)
        })

        // listen for changeover of service worker - reload page if a new one took over
        navigator.serviceWorker.addEventListener('controllerchange', ()=>{
            window.location.reload()
        })


        // listen to installing service worker && show user when its waiting
        const trackInstalling = (worker)=>{

            worker.addEventListener('statechange', ()=>{
                if(worker.state == 'installed'){

                    updateTriggerElement.addEventListener('click', ()=>{ // add click event to the UI
                        worker.postMessage({action: 'skipWaiting'})
                    })

                    displayHelper.showPopup(updateUI)  // show the UI
                }
            })
        }

    }('/sw.js',updateDialog, updateInstallButton)

    
// 
// IMPLEMENTATION SPECIFIC COMMANDS
//

    // grab the rates
    networkHelper.getRates().then((rates)=>{
        conversionHelper.setRates(rates)
    })

// == Update functionality
    // dismiss the update 
    updateDismissButton.addEventListener('click',()=>{
        displayHelper.hidePopup(updateDismissButton)
    })



// == currency relevant events

    const currSelectCallback = (event,isTopCurr)=>{

        const currIndex = (isTopCurr) ? 1:2;
        const currLabel = (isTopCurr) ? currLabelTop: currLabelBottom

        let newConvValues;
        
        displayHelper.showCurrSelect(event.target, currSelectButtonsTop); // display the tick on the currency
        displayHelper.updateCurrencyLabel(currLabel, event.target.innerText) // change the label at the top

        conversionHelper.setCurr(currIndex, event.target.innerText) // set the new currency for top
        
        newConvValues = conversionHelper.updateConversions() // get the new values for the conversion (using defaults)
        curr1Input.value = newConvValues.topValue;
        curr2Input.value = newConvValues.bottomValue;

        //changeCurrency
        displayHelper.hidePopup(currPopupTop)// hide the currency select
        return
    }

    // event listeners -- when the input is modified 
    curr1Input.addEventListener('keyup',(e)=>{        
        const convertValues = conversionHelper.updateConversions(event.target.value, conversionHelper.getCurr(1))
        curr2Input.value = convertValues.bottomValue;
    })

    curr2Input.addEventListener('keyup',(e)=>{
        const convertValues = conversionHelper.updateConversions(event.target.value, conversionHelper.getCurr(2))
        curr1Input.value = convertValues.topValue;
    })

    // === TODO: currencySelect relevant events
    topCurrRevealButton.addEventListener('click', ()=>{
        displayHelper.revealPopup(currPopupTop);
    })
    bottomCurrRevealButton.addEventListener('click', ()=>{
        displayHelper.revealPopup(currPopupBottom)
    })
    currSelectButtonsTop.forEach((button)=>{
        button.addEventListener('click', (event)=>{
            let newConvValues;

            displayHelper.showCurrSelect(event.target, currSelectButtonsTop); // display the tick on the currency
            displayHelper.updateCurrencyLabel(currLabelTop, event.target.innerText) // change the label at the top

            conversionHelper.setCurr(1, event.target.innerText) // set the new currency for top
            
            newConvValues = conversionHelper.updateConversions() // get the new values for the conversion (using defaults)
            curr1Input.value = newConvValues.topValue;
            curr2Input.value = newConvValues.bottomValue;

            //changeCurrency
            displayHelper.hidePopup(currPopupTop)// hide the currency select
            return
        })
    })
    currSelectButtonsBottom.forEach((button)=>{
        button.addEventListener('click',(event)=>{
            let newConvValues;

            displayHelper.showCurrSelect(event.target, currSelectButtonsBottom);
            displayHelper.updateCurrencyLabel(currLabelBottom, event.target.innerText)
            // change currency
            conversionHelper.setCurr(2, event.target.innerText)

            newConvValues = conversionHelper.updateConversions()
            curr1Input.value = newConvValues.topValue;
            curr2Input.value = newConvValues.bottomValue;

            displayHelper.hidePopup(currPopupBottom)
        })
    })

    // for dev purposes - expose the modules for inspection
    window.convAppObjs = {
        displayHelper,
        networkHelper,
        conversionHelper,
        serviceWorkerHelper
    }
}
