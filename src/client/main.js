window.onload = ()=>{

    // get references to all the static html elements
    const curr1 = document.getElementById('curr-1')
    const curr2 = document.getElementById('curr-2') 


    // helper modules

    const displayHelper = function DisplayHelper(){
        
        if (!document) throw new Error("No document object to work with")   // check to see if there is a document object
        
        // get all the relevant elements in the DOM
        const curr1 = document.getElementById('curr-1')
        const curr2 = document.getElementById('curr-2')
        const updateDialog = document.getElementById('update-display')
        const updateInstallButton = document.getElementById('update-accept')
        const updateDismissButton = document.getElementById('update-dismiss')
        
        // if update dismissed - hide the message
        updateDismissButton.addEventListener('click',()=>{
            hideUpdate()
        })

        // called to show the update messagebox for the service worker
        const showUpdate = ()=>{
            updateDialog.classList.remove('hidden')
        }

        // called to hide the message box for updating the service worker
        const hideUpdate = ()=>{
            updateDialog.classList.add('hidden')
        }

        // when the update install button pressed - send a message to the new service worker to take over
        const updateListener = (worker)=>{
            updateInstallButton.addEventListener('click', ()=>{
                worker.postMessage({action: 'skipWaiting'})
            })
        }

        // TODO : function to display the currency conversions 

        return {
            showUpdate,
            hideUpdate,
            updateListener
        }
    }()

    const networkHelper = function NetworkHelper(){
        const handleResponse = (response)=>{

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

        // listen for change over of service worker - reload page if a new one took over
        navigator.serviceWorker.addEventListener('controllerchange', ()=>{
            window.location.reload()
        })



        const trackInstalling = (worker)=>{

            worker.addEventListener('statechange', ()=>{
                if(worker.state == 'installed'){
                    displayHelper.updateListener(worker)
                    displayHelper.showUpdate()
                }
            })
        }

        const installWaitingWorker = ()=>{

        }

    }('/sw.js')

    

    // grab the rates
    networkHelper.getRates().then((rates)=>{
        conversionHelper.useRates(rates)
    })

    // event listeners -- when the input is modified 
    curr1.addEventListener('keyup',()=>{        
        curr2.value = conversionHelper.convertValue({sourceValue: curr1.value}).toFixed(2)
    })

    curr2.addEventListener('keyup',()=>{
        curr1.value = conversionHelper.convertValue({sourceValue: curr2.value}).toFixed(2)
    })

    // for dev purposes - expose the modules for inspection
    window.convAppObjs = {
        displayHelper,
        networkHelper,
        conversionHelper,
        serviceWorkerHelper
    }
}
