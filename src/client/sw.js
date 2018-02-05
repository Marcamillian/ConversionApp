/////////////
const staticCacheName = "convapp-static-v3"
const fakeRates = JSON.stringify({'USD': 1, 'EUR': 1, 'GBP':1, 'INR':1})

self.addEventListener('install',(event)=>{  // do things when the service worker installs
    event.waitUntil(
        caches.open(staticCacheName).then((cache)=>{
            return cache.addAll([
                '/',
                'main.js',
                'styles.css',
                '/rates',
                '/assets/dropdown.svg',
                '/assets/checkmark.svg',
                'https://fonts.googleapis.com/css?family=Nunito:300|Nunito+Sans:200'
            ])
        })
    )
})


self.addEventListener('activate', (event)=>{   // when active -delete the outdated caches
    // delte the caches that arn't the current one
    event.waitUntil(
        caches.keys().then((cacheNames)=>{
            return Promise.all(
                cacheNames.filter((cacheName)=>{
                    return cacheName.startsWith('convapp') &&
                            cacheName != staticCacheName
                }).map((cacheName)=>{
                    return caches.delete(cacheName)
                })
            )
        })
    )
})


self.addEventListener('fetch', (event)=>{   // listening for calls to fetch
    
    const requestUrl = new URL(event.request.url)
    
    // == get things from cache first || get from network if not in the cache
    event.respondWith(
        caches.match(event.request).then((response)=>{  // look in the caches for the response
            return response || fetch(event.request) // if no response - get it from the network
        })
    )

    /* == Faking the /rates response{
        if (requestUrl.origin == location.origin){ // if the site we are getting from is our own
            if(requestUrl.pathname === '/rates'){   // if it is a call to the rates object
                event.respondWith(promiseWrap(fakeRates))
                return;
            }
        }
    }*/

})

self.addEventListener('message', (event)=>{ // listening to messages to service worker

    // if a message has been sent to have the installed service worker stop waiting
    if(event.data.action == 'skipWaiting'){
        self.skipWaiting()  // tell the service worker to install itself
    }
})

const promiseWrap = (data)=>{    // return promise that resolves to the rates
    return new Promise((resolve, reject)=>{
        resolve( new Response(data) )
    })
}

