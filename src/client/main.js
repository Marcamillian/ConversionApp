window.onload = ()=>{

    // helper modules

    const displayHelper = function DisplayHelper(){
        
        if (!document) throw new Error("No document object to work with")   // check to see if there is a document object
        
        // === GET ALL THE RELEVANT ELEMENTS IN THE DOM

        // currency conversion boxes
        const curr1 = document.getElementById('curr-1')
        const curr2 = document.getElementById('curr-2')

        // update dialog boxes
        const updateDialog = document.getElementById('update-display')
        const updateInstallButton = document.getElementById('update-accept')
        const updateDismissButton = document.getElementById('update-dismiss')
        
        // currency select boxes


        // === SET THE CLICK EVENTS



        // == update relevant events

        // if update dismissed - hide the message
        updateDismissButton.addEventListener('click',()=>{
            hideUpdate()
        })

        // called to show the update messagebox for the service worker
        const showUpdate = ()=>{
            updateDialog.classList.add('active')
        }

        // called to hide the message box for updating the service worker
        const hideUpdate = ()=>{
            updateDialog.classList.remove('active')
        }

        // when the update install button pressed - send a message to the new service worker to take over
        const updateListener = (worker)=>{
            updateInstallButton.addEventListener('click', ()=>{
                worker.postMessage({action: 'skipWaiting'})
            })
        }

        // event listeners -- when the input is modified 
        curr1.addEventListener('keyup',()=>{        
            curr2.value = conversionHelper.convertValue({sourceValue: curr1.value}).toFixed(2)
        })

        curr2.addEventListener('keyup',()=>{
            curr1.value = conversionHelper.convertValue({sourceValue: curr2.value}).toFixed(2)
        })

        // === TODO: currency relevant events 

        return {
            showUpdate,
            hideUpdate,
            updateListener
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

        // TODO: model for what currencies are being used

        let rates = {
            USD: 1,
            GBP: 0.752245
        }

        const useRates = (newRates)=>{
            rates = newRates
        }

        const convertValue= ({sourceValue=0, sourceCurrency='USD', targetCurrency='GBP'}={})=>{
            const USD = rates[sourceCurrency] * sourceValue // convert to base currency (USD)
            return USD*rates[targetCurrency]   // return value 
        }

        // TODO: functions to update what currency is being used

        return {
            useRates,
            convertValue
        }

    }()

    const serviceWorkerHelper = function ServiceWorkerHelper(workerLocation){
        if (!navigator.serviceWorker) throw new Error("service worker not supported")

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
                    displayHelper.updateListener(worker)
                    displayHelper.showUpdate()
                }
            })
        }

    }('/sw.js')

    
    // grab the rates
    networkHelper.getRates().then((rates)=>{
        conversionHelper.useRates(rates)
    })

    // for dev purposes - expose the modules for inspection
    window.convAppObjs = {
        displayHelper,
        networkHelper,
        conversionHelper,
        serviceWorkerHelper
    }
}
