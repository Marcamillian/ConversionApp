const NetworkHelper =()=>{
    
    let returnObject = {};
    
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

    return Object.assign( returnObject,
        {
            getRates
        }
    )


}

module.exports = NetworkHelper