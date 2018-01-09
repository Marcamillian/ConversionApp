const express = require('express');
const http = require('http')

// ==pull in the server app object/module

// == set up the express server
const app = express();
let server;       // http server

app.set('port', (process.env.PORT || 5000))
// == Set up to use the static location
app.use(express.static('./src/client'))

// == define endpoints for posting

app.get('/rates', (request, response)=>{
    response.send({
        USD: 1,
        EUR: 0.841730,
        GBP: 0.752245,
        IDR: 64.4750
    })
})

// == create HTTP server
server = http.createServer(app)

// == Start the server
server.listen(app.get('port'), ()=>{
    console.log(`Node app is running on port ${app.get('port')}`)
})


