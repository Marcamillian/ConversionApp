const fs = require('fs')
const rimraf = require('rimraf')
const dir = './dist';


// remove the directory
console.log(`is the folder here - ${fs.existsSync(dir)}`)

// needs to use promises
// delete the folder and everything inside (if needed) 
// THEN - create the new folder
// THEN - copy all of the contents of the src/server folder over to dist/server
// THEN - copy all except the .js file to dist/client
// THEN - browserify the client .js code
// THEN - babel the browserified code
// THEN - write the resulting file to dist/client


