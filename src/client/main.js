const ConversionModule = require(`./../modules/ConversionHelper.js`)
const NetworkModule = require('./../modules/NetworkHelper.js')
const DisplayHelper = require('./../modules/DisplayHelper.js')

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
    let currSelectButtonsTop = document.querySelectorAll('.curr-select.top button')
    let currSelectButtonsBottom = document.querySelectorAll('.curr-select.bottom button')
    // list elements
    const listPopup = document.querySelector("#spend-list")
    const listPopupShowButton = document.querySelector("#spend-list button.show")
    const listPopupAddButton = document.querySelector(!"#spend-list button.add")


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
            const labelName = document.createElement('p')

            
            
            labelName.innerText = currLabel // set the labelname

            checkElement.src = "assets/checkmark.svg";
            checkElement.classList.add("checkmark")

            if(selected) currButton.classList.add('selected')
            
            currButton.appendChild(checkElement)
            currButton.appendChild(labelName)

            return currButton
        }

        const emptyElement = (element)=>{
            while(element.children.length > 0){
                element.children[0].remove()
            }
        }

        return {
            revealPopup,
            hidePopup,
            showCurrSelect,
            updateCurrencyLabel,
            generateCurrSelectButton,
            emptyElement
        }
    }()

    const networkHelper = NetworkModule()

    const conversionHelper = ConversionModule()

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

                    displayHelper.revealPopup(updateUI)  // show the UI
                }
            })
        }

    }('/sw.js',updateDialog, updateInstallButton)

    
// IMPLEMENTATION SPECIFIC COMMANDS

    // callback for when currency select buttons are clicked
    const currSelectCallback = (event,isTopCurr)=>{
    
        const currIndex = (isTopCurr) ? 1:2;
        const currLabel = (isTopCurr) ? currLabelTop: currLabelBottom
        const currPopup = (isTopCurr) ? currPopupTop: currPopupBottom
        const currSelectButtons = (isTopCurr) ? currSelectButtonsTop: currSelectButtonsBottom;
        const currButton = (event.target.tagName != 'button') ? event.target.parentNode : event.target; // if the click on a child - set parent OR - set the parent as the button
        const currButtonCurrName = currButton.querySelector('p').innerText


        let newConvValues;
        
        displayHelper.showCurrSelect(currButton, currSelectButtons); // display the tick on the currency
        displayHelper.updateCurrencyLabel(currLabel, currButtonCurrName) // change the label at the top

        conversionHelper.setCurr(currIndex, currButtonCurrName) // set the new currency for top
        
        newConvValues = conversionHelper.updateConversions() // get the new values for the conversion (using defaults)
        curr1Input.value = newConvValues.topValue;
        curr2Input.value = newConvValues.bottomValue;

        //changeCurrency
        displayHelper.hidePopup(currPopup)// hide the currency select
        return
    }

    // grab the rates
    networkHelper.getRates().then((rates)=>{
        let currLabels;


        conversionHelper.setRates(rates)
        
        currLabels = conversionHelper.getCurrLabels()

        // empty the popups of their buttons
        displayHelper.emptyElement(currPopupTop)
        displayHelper.emptyElement(currPopupBottom)

        currLabels.forEach((currLabel)=>{
            const topButton = displayHelper.generateCurrSelectButton(currLabel, currLabel == conversionHelper.getCurr(1))
            const bottomButton = displayHelper.generateCurrSelectButton(currLabel, currLabel == conversionHelper.getCurr(2))

            topButton.addEventListener('click', (event)=>{ currSelectCallback(event, true)})
            bottomButton.addEventListener('click', (event)=>{ currSelectCallback(event, false)})

            currPopupTop.appendChild(topButton)
            currPopupBottom.appendChild(bottomButton)
        })

        // update the currSelectButtons - so they can be cleared
        currSelectButtonsTop = document.querySelectorAll('.curr-select.top button')
        currSelectButtonsBottom = document.querySelectorAll('.curr-select.bottom button')

    })

    // == Update functionality
    // dismiss the update 
    updateDismissButton.addEventListener('click',()=>{
        displayHelper.hidePopup(updateDismissButton)
    })



    // == currency relevant events

    // event listeners -- when the input is modified 
    curr1Input.addEventListener('keyup',(e)=>{        
        const convertValues = conversionHelper.updateConversions(event.target.value, conversionHelper.getCurr(1))
        curr2Input.value = convertValues.bottomValue;
    })

    curr2Input.addEventListener('keyup',(e)=>{
        const convertValues = conversionHelper.updateConversions(event.target.value, conversionHelper.getCurr(2))
        curr1Input.value = convertValues.topValue;
    })

    topCurrRevealButton.addEventListener('click', ()=>{
        displayHelper.revealPopup(currPopupTop);
    })
    bottomCurrRevealButton.addEventListener('click', ()=>{
        displayHelper.revealPopup(currPopupBottom)
    })

    // == list related events
    listPopupShowButton.addEventListener('click', ()=>{
        if(listPopup.classList.contains("active")){
            displayHelper.hidePopup(listPopup)
        }else{
            displayHelper.revealPopup(listPopup)
        } 
    })



// expose the modules for inspection- dev only
    window.convAppObjs = {
        displayHelper,
        networkHelper,
        conversionHelper,
        serviceWorkerHelper
    }
}
