
window.onload = ()=>{

    // get references to all the static html elements
    const curr1 = document.getElementById('curr-1')
    const curr2 = document.getElementById('curr-2') 


    // helper modules
    const networkHelper = function NetworkHelper(){
        const handleResponse = (response)=>{

            if(response.ok){
                return new Promise((resolve, reject)=>{
                    resolve(response.json())
                })
            }else{
                Promise.reject( new Error ('Unexpected Response'))
            }
            /*
            return response.ok
                ? response.json()
                :Promise.reject(new Error ('Unexpected response'))
            */
        };

        const logMessage = (message)=>{
            console.log(message)
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
            return USD/rates[targetCurrency]   // return value 
        }

        return {
            useRates,
            convertValue
        }

    }()

    // ==== main code === 

    // get the rates && process them
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

}
