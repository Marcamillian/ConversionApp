console.log("Running SW code")

const staticCacheName = "convapp-static-v1"
const fakeRates = JSON.stringify({'USD': 1, 'EUR': 1, 'GBP':1, 'INR':1})

self.addEventListener('install',(event)=>{
    event.waitUntil(
        caches.open(staticCacheName).then((cache)=>{
            return cache.addAll([
                '/',
                'main.js',
                '/rates'
            ])
        })
    )
})

self.addEventListener('fetch', (event)=>{   // listening for calls to fetch
    
    const requestUrl = new URL(event.request.url)
    
    // == Deal with the rates request
    /*
    if (requestUrl.origin == location.origin){ // if the site we are getting from is our own
        if(requestUrl.pathname === '/rates'){   // if it is a call to the rates object
            event.respondWith(promiseWrap(fakeRates))
            return;
        }
    }*/

    // == get other things from cache first || get from network if not in the cache
    event.respondWith(
        caches.match(event.request).then((response)=>{  // look in the caches for the response
            return response || fetch(event.request) // if no response - get it from the network
        })
    )

})

const promiseWrap = (data)=>{    // return promise that resolves to the rates
    return new Promise((resolve, reject)=>{
        resolve( new Response(data) )
    })
}

