console.log("Hello World!")

const handleResponse = (response)=>{
    return response.ok
        ? response.json()
        :Promise.reject(new Error ('Unexpected response'))
}

const useRates = (rates)=>{
    
    console.log(rates)
}

const logMessage = (message)=>{
    console.log(message)
}

fetch('/rates', {method: 'GET',credentials:'same-origin' })
    .then(handleResponse)
    .then(useRates)
    .catch((err)=>{ logMessage(err.message) })

