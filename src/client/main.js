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

        const showUpdate = ()=>{
            updateDialog.classList.remove('hidden')
        }

        return {
            showUpdate
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

        console.log(`can I see displayHelper here ${displayHelper}`)

        navigator.serviceWorker.register(workerLocation).then((reg)=>{
            console.log("Registered a service worker")
            
            // check if service worker loaded the page - if it didn't return (as service worker is the latest)
            if (!navigator.serviceWorker.controller) return
            
            // if there is one waiting - there was a service worker installed on the last refresh and its waiting
            if(reg.waiting){
                console.log("Service worker waiting")
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

        const trackInstalling = (worker)=>{
            console.log(`watching ${worker} for things installing`)

            worker.addEventListener('statechange', ()=>{
                if(worker.state == 'installed'){
                    console.log("worker finished installing")
                    displayHelper.showUpdate()
                }
            })
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
