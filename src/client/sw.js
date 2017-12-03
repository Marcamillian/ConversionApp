console.log("Running SW code")

const fakeRates = JSON.stringify({'USD': 1, 'EUR': 1, 'GBP':1, 'INR':1})

self.addEventListener('install',(event)=>{
    
})

self.addEventListener('fetch', (event)=>{   // listening for calls to fetch
    
    const requestUrl = new URL(event.request.url)
    
    if (requestUrl.origin == location.origin){ // if the site we are getting from is our own
        if(requestUrl.pathname === '/rates'){   // if it is a call to the rates object
            //event.respondWith(fetch(event.request))
            event.respondWith(promiseWrap(fakeRates))
            return;
        }
    }
    
    event.respondWith(fetch(event.request)) // return what it originally wanted
    return
})

const promiseWrap = (data)=>{    // return promise that resolves to the rates
    return new Promise((resolve, reject)=>{
        resolve( new Response(data) )
    })
}

